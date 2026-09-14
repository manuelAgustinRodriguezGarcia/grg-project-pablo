# Prompt para Cursor — Ajustes UX/UI Facturación, PDFs, Libro IVA, deudores y catálogos

Implementá los cambios de este documento en el repo **`grg-project-pablo`** (Rothamel Repuestos).

## Cómo trabajar

1. Inspeccioná primero los archivos listados; no reescribas módulos desde cero.
2. Cambios incrementales, respetando arquitectura, estilos SCSS Modules y helpers existentes.
3. No inventes rutas. Si falta detalle, leé los archivos citados.
4. No integres ARCA / CAE / QR fiscal real. No rompas modo prueba.
5. Sin comentarios innecesarios en el código.
6. Agregá/actualizá tests solo donde ya hay estructura de tests.
7. Al final, verificá mentalmente el checklist de “Resultado esperado”.

Stack relevante: Next.js, TypeScript, SCSS Modules, Prisma, `pdf-lib`, facturación admin server-side.

---

## Orden sugerido de implementación

1. Totales A/B en UI (punto 5) — base para resumen/PDF.
2. Tecla `+`, reset al cambiar cliente, modal resumen, bug Esc (1–4).
3. PDF A columnas, multipágina, header, caja cliente (6–9).
4. Catálogos, deudores, Libro IVA rango (10–12).
5. Tests y smoke de atajos (13–16).

---

## 1. Tecla `+` — agregar ítem en Nueva Factura

**Archivos**
- `src/features/billing/hooks/useInvoiceKeyboardFlow.ts`
- `src/features/billing/utils/invoice-keyboard-flow.ts`
- `src/features/billing/components/invoices/InvoiceItemsSection.tsx`
- `src/features/billing/components/invoices/InvoiceSearchPicker.tsx`
- `src/features/billing/components/invoices/NewInvoiceManager.tsx`
- Tests: `test/unit/features/billing/invoice-keyboard-flow.test.ts` y cualquier `*useInvoiceKeyboardFlow*` existente

**Hoy:** no hay shortcut `+`. Nueva fila vacía = Enter al completar precio. Delete quita fila. Esc en rubro vacío → pago.

**Deseado**
- `+` agrega una fila vacía de ítem.
- Si ya hay una fila vacía usable, **no** crear otra: enfocar esa.
- Tras crear/enfocar: foco en el **selector de rubro** de esa fila.
- **No** disparar `+` si el foco está en `input` / `textarea` / campo numérico / select / contenteditable donde `+` pueda ser texto (precio, cantidad, detalle, etc.).
- Mantener Enter y Delete intactos.

---

## 2. Modal de resumen antes de emitir

**Archivos**
- `src/features/billing/components/invoices/InvoiceSummarySection.tsx`
- `src/features/billing/components/invoices/NewInvoiceManager.tsx`
- `src/features/billing/hooks/useBillingModalKeyboard.ts`
- Referencia de patrón: `UnprintedInvoiceLeaveDialog.tsx`
- Totales/labels: `src/features/billing/utils/invoice-detail-totals.ts`, `InvoiceSummarySection.tsx`

**Hoy:** botón “Crear factura en modo prueba” y Shift+F crean al toque. `C` en éxito = Compartir.

**Deseado**
- Botón / Shift+F **abren** modal de resumen; **no** crean todavía.
- Resumen mínimo: cliente, tipo A/B, ítems (o lista compacta), cantidad de ítems, subtotal, descuento si hay, subtotal neto si A, IVA si A, total, método de pago, estado inicial de pago.
- En este modal:
  - **`C`** → confirmar creación
  - **`Esc`** → cancelar/cerrar (sin scroll jump; ver §3)
  - **Enter** → no confirma salvo que el botón primario esté enfocado
- Conflicto de `C`: solo “confirmar” en modal **pre-creación**. En modal **post-creación/éxito**, `C` sigue siendo **Compartir**.

---

## 3. Bug — Esc mueve el scroll al top

**Archivos a auditar**
- `InvoiceSearchPicker.tsx`, `useInvoiceKeyboardFlow.ts`, `useBillingModalKeyboard.ts`
- Modales/dialogs de billing que manejen Escape
- Buscar: `focus(`, `scrollIntoView(`, `window.scrollTo(`, y falta de `preventDefault`/`stopPropagation` en Esc

**Deseado:** Esc cierra dropdowns / cancela modales / sale del flujo de ítems cuando corresponde, **sin** desplazar el viewport. Evitar foco en nodos superiores que disparen scroll implícito.

---

## 4. Cambiar cliente → vaciar formulario completo

**Archivos**
- `InvoiceClientSection.tsx`
- `NewInvoiceManager.tsx` (`onClear` hoy solo hace `setSelectedClient(null)`; ya existe `resetForm()`)

**Deseado:** al “Cambiar cliente”, reset completo: cliente, ítems, detalles, cantidades, precios, descuentos, notas, método de pago (default), errores temporales. Dejar **una** fila vacía inicial (como `createEmptyRow()` / estado base). Formulario listo para elegir otro cliente.

---

## 5. UI Nueva Factura — columnas solo Factura A

**Archivos**
- `InvoiceItemsSection.tsx`, `InvoiceSummarySection.tsx`
- `src/features/billing/styles/NewInvoice.module.scss`
- `src/shared/utils/billing-invoice-rules.ts`
- `src/shared/utils/billing-invoice-totals.ts`

**Hoy:** headers `P. unit. c/IVA` y `Total neto s/IVA`.

**Deseado (solo A)**
- Columnas: **P. unitario c/IVA** | **P. unitario S/IVA** | **TOTAL S/IVA**
- Renombrar “Total neto s/IVA” → **TOTAL S/IVA**
- Calcular unitario s/IVA y total s/IVA por línea reutilizando helpers (no duplicar fórmulas).

Ejemplo: unit c/IVA `$1.210`, IVA 21% → unit s/IVA `$1.000`; cant `2` → TOTAL S/IVA `$2.000`.

**Factura B:** UI actual sin cambios (no agregar columnas A).

---

## 6. PDF Factura A — columnas de precio

**Archivos**
- `src/server/pdf/build-invoice-pdf.ts`
- `src/server/pdf/invoice-pdf.types.ts`
- helpers de montos PDF (`pdf-money.ts` / layout existente)

**Hoy:** columnas Código / Detalle / Cant / **P. unitario** / **Total**.

**Deseado (solo PDF A)**
- **No** imprimir P. unitario con IVA.
- Imprimir **P. unitario S/IVA** y **Total S/IVA**.

**PDF B:** columnas/comportamiento actuales.

---

## 7. PDF — multipágina

**Archivos:** `build-invoice-pdf.ts`, `billing-pdf-header.ts`

**Hoy:** al paginar se redibuja solo header de tabla; no se repite header del documento ni caja de cliente.

**Deseado**
- En **cada** hoja: header documento + letter box A/B + datos emisor + datos cliente + header de tabla.
- **Totales solo en la última hoja.** Sin totales en páginas intermedias.

---

## 8. PDF — header derecho

**Archivos:** `build-invoice-pdf.ts`, `billing-pdf-header.ts`, `comprobante-letter-box.ts`, `pdf-layout.ts`

**Deseado**
- Bloque derecho más a la derecha (menos pegado al bbox A/B).
- **Quitar** el texto “Punto de venta” (y su label). Mantener número de comprobante.
- Fecha más **bold**, más cerca del bloque título/número, mejor spacing.
- No descentrar el box de letra A/B.

---

## 9. PDF — caja cliente: tipo de factura / pago

**Archivos**
- `build-invoice-pdf.ts`
- `src/features/billing/types/billing-invoice.types.ts`  
  (no confundir con `billing-receipt.types.ts`)

**Hoy:** `Metodo de pago: …` en `drawTotals`.

**Deseado (PDF A y B)**
- Bajo **Código cliente**, bloque con fondo distinto:
  - Contado / Contado efectivo / Transferencia / Tarjeta / Otros → **`Tipo de factura: CONTADO`**
  - Cuenta corriente → **`Tipo de factura: CUENTA CORRIENTE`** (o label del sistema si ya existe uno canónico)
- Quitar el método de pago del bloque de totales si quedaría duplicado.

---

## 10. Catálogos — flechas en menú (hover/activo)

**Archivos**
- `CustomDropdown.tsx` (principal), `CatalogFolderSelectors.tsx`, `CatalogNavigator.tsx`
- Referencia de flechas: `CatalogPageChrome.tsx`
- Estilos: `CatalogNavigator.module.scss`

**Deseado** (menú activo por hover o focus)
- ↓ siguiente · ↑ anterior · Enter selecciona · Esc cierra
- No romper hover, click ni Tab.

---

## 11. Deudores — agrandar total

**Archivos:** `DeudoresManager.tsx`, `ClientsManager.module.scss`

**Hoy:** total en `.invoiceMeta` (~0.75rem).

**Deseado:** total general como KPI destacado (clase propia, no reutilizar `.invoiceMeta`). Copy tipo **Total adeudado: $…**.

---

## 12. Libro IVA — rango personalizado entre fechas

**Cadena completa**
- UI: `LibroIvaDialog.tsx`, entrada desde `ComprobantesManager.tsx` / `ComprobantesPageIntro.tsx`
- Utils: `libro-iva.ts`, `invoice-pdf-client.ts`
- Service: `billing-libro-iva.service.ts`
- PDF/XLSX: `build-libro-iva-pdf.ts`, `build-libro-iva-xlsx.ts`
- APIs: `src/app/api/admin/billing/libro-iva/pdf/route.ts`, `.../xlsx/route.ts`

**Hoy:** solo `monthly` y `daily`.

**Deseado**
- Tercera opción: **Personalizado / Entre fechas** (`desde` / `hasta`).
- Validar `desde <= hasta` con error claro.
- PDF y XLSX deben indicar el período.
- Mantener mensual y diario; no romper callers existentes.
- Extender APIs con algo como `period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`, manteniendo monthly/daily.
- Mantener separación A/B y NC/ND según lógica actual.

---

## 13. Atajos — no romper

| Tecla | Uso |
|-------|-----|
| F2 | Nueva factura |
| Shift+F | Abrir emisión (ahora → modal resumen, luego confirm) |
| Enter | Avanzar campos / agregar fila al completar precio |
| Esc | Salir ítems / cerrar modales / leave dialog |
| Delete | Quitar ítem |
| I / D | Imprimir / Descargar en éxito |
| C | Éxito → Compartir; pre-creación → Confirmar |
| N / L | Crear nueva / Ir a lista |
| + | Nuevo (agregar ítem con reglas del §1) |

---

## 14. Matriz A vs B (obligatoria)

| | Pantalla | PDF |
|--|----------|-----|
| **A** | P. unit. c/IVA + P. unit. S/IVA + TOTAL S/IVA; resumen con neto + IVA + total | Sin P. unit. c/IVA; sí P. unit. S/IVA + Total S/IVA |
| **B** | Sin cambios | Sin cambios |

---

## 15. Tests sugeridos (donde exista harness)

- `+`: agrega fila; reutiliza vacía; no dispara en inputs de texto/número.
- Modal resumen antes de create; `C` confirma solo ahí; Esc cancela sin scroll jump.
- Cambiar cliente resetea todo.
- UI A muestra columnas s/IVA; B no cambia.
- PDF A columnas s/IVA; PDF B igual que antes.
- Multipágina: header+cliente en cada hoja; totales solo al final.
- Libro IVA: monthly/daily intactos; custom range en PDF y XLSX.
- Catálogos: flechas + Enter + Esc en dropdown activo.
- Deudores: total con estilo destacado (assert de clase/texto si aplica).

---

## Resultado esperado

- `+` agrega/enfoca ítem en Nueva Factura.
- Emitir abre modal de resumen; `C` confirma; Esc cierra sin saltar scroll.
- Cambiar cliente limpia todo el form.
- UI/PDF A con unitario y total S/IVA; B igual.
- Multipágina con header+cliente repetidos; totales solo al final.
- Header PDF: bloque derecho más a la derecha, sin “Punto de venta”, fecha bold y cercana.
- Bajo código cliente: Tipo de factura CONTADO / CUENTA CORRIENTE con fondo distinto.
- Catálogos: flechas en menú hover/activo.
- Deudores: total grande.
- Libro IVA: rango personalizado además de mensual/diario.
- Modo prueba y atajos actuales intactos (salvo Shift+F → pasa por modal).
