# Contexto de cambios UX/UI — Facturación, impresión, catálogos, deudores, Libro IVA

**Uso de este documento:** pegarlo en ChatGPT (o similar) y pedir que, a partir de este contexto, genere un **prompt ideal** para un agente de código (Cursor/Claude/etc.) que implemente los cambios.  
**No** es un plan de desarrollo ni una spec de implementación: es mapa de requisitos ↔ zonas del repo.

**Repo:** `grg-project-pablo` (Next.js + facturación admin + PDF server-side).  
**Fecha del contexto:** 2026-09-12.

---

## Instrucción para ChatGPT (meta)

Con este archivo como única fuente de verdad de alcance:

1. Generá un **prompt ideal** en español, listo para copiar a un coding agent.
2. El prompt debe: listar cambios por área, citar rutas relevantes, distinguir comportamiento actual vs deseado, y marcar reglas A vs B / impresión vs pantalla.
3. No inventes archivos fuera de los listados acá; si falta detalle técnico, pedí al agent que inspeccione esas rutas.
4. No conviertas esto en un plan de sprints; el output debe ser un prompt de implementación accionable.

---

## Mapa rápido de áreas

| Área | Rutas principales |
|------|-------------------|
| Nueva factura (UI) | `src/app/admin/facturacion/(secciones)/nueva-factura/page.tsx`, `src/features/billing/components/invoices/NewInvoiceManager.tsx`, `InvoiceItemsSection.tsx`, `InvoiceClientSection.tsx`, `InvoiceSummarySection.tsx`, `InvoiceSearchPicker.tsx`, hooks `useInvoiceKeyboardFlow.ts`, utils `invoice-keyboard-flow.ts`, estilos `NewInvoice.module.scss` |
| Reglas A/B y totales | `src/shared/utils/billing-invoice-rules.ts`, `src/shared/utils/billing-invoice-totals.ts`, `src/features/billing/utils/invoice-detail-totals.ts` |
| Impresión factura A/B (PDF) | `src/server/pdf/build-invoice-pdf.ts`, `src/server/pdf/billing-pdf-header.ts`, `src/server/pdf/comprobante-letter-box.ts`, `src/server/pdf/pdf-layout.ts`, `src/server/pdf/invoice-pdf.types.ts`, API `src/app/api/admin/billing/invoices/[invoiceId]/pdf/route.ts`, cliente `src/features/billing/utils/invoice-pdf-client.ts` |
| Catálogos (menú nav) | `src/features/catalog/components/CustomDropdown.tsx`, `CatalogFolderSelectors.tsx`, `CatalogNavigator.tsx`, `CatalogPageChrome.tsx` |
| Deudores | `src/features/billing/components/deudores/DeudoresManager.tsx`, estilos `src/features/billing/styles/ClientsManager.module.scss` (clase `.invoiceMeta`) |
| Libro IVA | `src/features/billing/components/invoices/LibroIvaDialog.tsx`, `src/features/billing/utils/libro-iva.ts`, `src/server/services/billing-libro-iva.service.ts`, `src/server/pdf/build-libro-iva-pdf.ts`, APIs `src/app/api/admin/billing/libro-iva/pdf/route.ts` y `.../xlsx/route.ts` |

---

## Cambios solicitados (requisito ↔ zona)

### 1. Nueva factura — tecla `+` para agregar ítem en lista de rubros

**Requisito:** En el sistema de factura nueva, la tecla `+` debe agregar un nuevo ítem/fila en la lista de rubros.

**Estado actual:** No hay shortcut `+`. Una fila vacía nueva se crea al completar precio y apretar Enter (`useInvoiceKeyboardFlow` / `invoice-keyboard-flow.ts` → `add-empty-row`). Delete quita fila. Esc en rubro vacío sale hacia pago.

**Zona:**
- `src/features/billing/hooks/useInvoiceKeyboardFlow.ts`
- `src/features/billing/utils/invoice-keyboard-flow.ts`
- `src/features/billing/components/invoices/InvoiceItemsSection.tsx`
- `src/features/billing/components/invoices/InvoiceSearchPicker.tsx`
- `src/features/billing/components/invoices/NewInvoiceManager.tsx`
- Tests: `useInvoiceKeyboardFlow.test.tsx` (y afines)

---

### 2. Nueva factura — modal de resumen al emitir (“Crear factura…”) con confirm `C` / cancel Esc

**Requisito:** Al apretar el botón de crear factura (UI: “Crear factura en modo prueba” / emitir), abrir un **modal con resumen de la factura**. Confirmar con tecla **`C`**, cancelar con **`Esc`**.

**Estado actual:** El submit va directo desde `InvoiceSummarySection` (Shift+F / botón). La tecla **`C`** hoy en flujos de éxito/share significa **compartir**, no confirmar creación (`useBillingSuccessShortcuts` / success modal). Esc cierra modales o sale del flujo de ítems.

**Nota de fricción conocida:** al usar Esc, el scroll se mueve a la zona top (ver punto 3). El modal nuevo no debe provocar ese salto (o hay que corregirlo).

**Zona:**
- `src/features/billing/components/invoices/InvoiceSummarySection.tsx` (botón submit + Shift+F)
- `src/features/billing/components/invoices/NewInvoiceManager.tsx` (orquestación create)
- Posible reutilizar patrones de: `UnprintedInvoiceLeaveDialog.tsx`, hooks `useBillingModalKeyboard.ts` / success shortcuts
- Totales/labels A/B para el resumen: `InvoiceSummarySection.tsx`, `invoice-detail-totals.ts`

---

### 3. Esc mueve el scroll al top

**Requisito / bug:** Esc desplaza el scroll hacia arriba (zona top). Debe corregirse en el flujo de factura nueva / modales relacionados, de forma que Esc cancele o cierre sin saltar el viewport.

**Zona probable:**
- Handlers de teclado en nueva factura / pickers / modales
- `InvoiceSearchPicker.tsx`, `useInvoiceKeyboardFlow.ts`, diálogos de billing
- Cualquier `focus()`, `scrollIntoView`, o reset de foco al manejar Escape

---

### 4. Al cambiar de cliente, vaciar todos los campos

**Requisito:** Al cambiar el cliente en factura nueva, borrar/vaciar todos los campos del formulario (ítems, descuentos, notas, método de pago a default, etc.), no solo el cliente.

**Estado actual:** “Cambiar cliente” en `InvoiceClientSection` llama `onClear={() => setSelectedClient(null)}` en `NewInvoiceManager` — **limpia solo el cliente**. Existe `resetForm()` que sí limpia cliente + filas + descuento + pago + notas, pero se usa en “Crear nueva” / leave, no al cambiar cliente.

**Zona:**
- `src/features/billing/components/invoices/InvoiceClientSection.tsx`
- `src/features/billing/components/invoices/NewInvoiceManager.tsx` (`onClear`, `resetForm`)

---

### 5. Nueva factura — columnas solo para Factura A

**Requisito (solo Facturas A; Facturas B se mantienen igual):**
- Agregar columna **P. unitario S/IVA**
- Renombrar la columna actual de neto: ya no “Total neto s/IVA” → pasar a **TOTAL S/IVA** (o “Total S/IVA” según copy de UI)

**Estado actual (UI ítems):** headers en `InvoiceItemsSection.tsx`:
- `P. unit. c/IVA`
- `Total neto s/IVA`
- La línea siempre calcula neto s/IVA vía helpers de totales.

**Zona:**
- `src/features/billing/components/invoices/InvoiceItemsSection.tsx`
- Estilos `NewInvoice.module.scss`
- Cálculos: `billing-invoice-totals.ts`, helpers de línea usados por el form
- Condición A vs B: `billing-invoice-rules.ts` (`determineInvoiceType`)
- Resumen lateral: `InvoiceSummarySection.tsx` (labels “Subtotal neto s/IVA” en A)

**Importante:** Factura **B** en pantalla: sin estos cambios de columnas/nombres.

---

### 6. Impresión Facturas A — columnas de precio

**Requisito (impresión PDF Factura A):**
- **No** se imprime / no existe en impresión la columna **P. unitario** (la actual con IVA / “P. unitario” genérica).
- Se imprime: **P. unitario s/IVA** y **Total s/IVA**.

**Estado actual (`build-invoice-pdf.ts`):** columnas de tabla:
- Codigo / Detalle / Cant / **P. unitario** / **Total**
- Lógica A: total de línea neto; B: bruto. Footer con IVA solo en A.

**Zona:**
- `src/server/pdf/build-invoice-pdf.ts` (definición de columnas + `drawItemRow` / valores)
- Posiblemente `invoice-pdf.types.ts`, `pdf-money.ts`
- Factura **B** en impresión: mantener comportamiento actual (sin este rediseño de columnas A).

---

### 7. Impresión — paginación multi-hoja

**Requisito:** Si se supera el límite de ítems por hoja:
- Las tablas deben seguir **separadas en hojas distintas**.
- En **todas** las hojas se repiten **encabezado** y **datos de cliente**.
- El **resumen total** se muestra **solo al final** (última hoja).

**Estado actual (`build-invoice-pdf.ts`):** al quedarse sin espacio, nueva página y re-dibuja **solo header de tabla** (`drawTableHeader`), **no** re-dibuja header del documento ni caja de cliente. Totales al final vía `drawTotals`.

**Zona:**
- `src/server/pdf/build-invoice-pdf.ts` (loop de ítems ~paginación)
- `drawHeader` / `drawClientBox` / `drawBillingDocumentHeader` en `billing-pdf-header.ts`

---

### 8. Impresión — layout del header derecho

**Requisitos:**
- Bloque derecho del header **más a la derecha** (hoy muy pegado al bbox A/B).
- **No** escribir “Punto de venta” en el PDF.
- La **fecha** más **bold** y más cerca (del bloque/título/número — ajustar tipografía y spacing).

**Estado actual:**
- Meta lines en `build-invoice-pdf.ts` incluyen `Punto de venta: …` y `Fecha: …`.
- Posicionamiento derecho usa `letterBox.rightX` / `rightMaxWidth` desde `drawBillingDocumentHeader` + `comprobante-letter-box.ts`.
- Fecha con font regular size 8 en meta lines.

**Zona:**
- `src/server/pdf/build-invoice-pdf.ts` (metaLines)
- `src/server/pdf/billing-pdf-header.ts`
- `src/server/pdf/comprobante-letter-box.ts`
- `src/server/pdf/pdf-layout.ts` (`formatPdfDate`, tipografía)

---

### 9. Impresión — datos de cliente: método de pago / tipo de factura

**Requisito:** En datos de cliente (factura A/B impresa):
- Mover el **método de pago** debajo de **“Codigo cliente”**.
- Con **background diferente** (resaltado).
- Etiqueta tipo: **“Tipo de factura: CONTADO”**.
- Mapping de impresión: `contado`, `transferencia`, `tarjeta`, `otros` (y equivalentes del enum) → **todos se muestran como CONTADO** en la impresión.
- (Cuenta corriente / no-contado: el mensaje de Manu habla del grupo contado; el agent debe respetar el mapping pedido para esos métodos y no romper CC si existe en el modelo.)

**Estado actual:** `Metodo de pago: ${PAYMENT_METHOD_LABELS[...]}` se dibuja en `drawTotals` (abajo), no en la caja de cliente. Labels reales: Contado, Contado efectivo, Tarjeta, Transferencia, Otros, etc. (`billing-invoice.types.ts`).

**Zona:**
- `src/server/pdf/build-invoice-pdf.ts` (`drawClientBox`, `drawTotals`)
- Labels: `src/features/billing/types/billing-invoice.types.ts` (`PAYMENT_METHOD_LABELS`, enums)
- No confundir con labels de recibos (`billing-receipt.types.ts`)

---

### 10. Catálogos — fijar mouse sobre menú de navegación para usar flechitas

**Requisito:** Con el mouse sobre el menú de navegación de catálogos, poder usar flechas del teclado (↑/↓) para moverse entre opciones.

**Estado actual:** `CustomDropdown.tsx` activa revelado por hover/focus y cierra con Escape, pero **no** navega opciones con ArrowUp/Down. Las flechas sí existen en búsqueda global (`CatalogPageChrome.tsx`).

**Zona:**
- `src/features/catalog/components/CustomDropdown.tsx` ← principal
- `src/features/catalog/components/CatalogFolderSelectors.tsx`
- Estilos: `CatalogNavigator.module.scss`
- Referencia de patrón flechas: `CatalogPageChrome.tsx`

---

### 11. Deudores — agrandar el total

**Requisito:** Agrandar visualmente el **total** en la lista de deudores.

**Estado actual:** Total agregado en intro con clase `.invoiceMeta` (`font-size: 0.75rem`) en `DeudoresManager.tsx` + `ClientsManager.module.scss`. Hay también columna “Total adeudado” por fila.

**Zona:**
- `src/features/billing/components/deudores/DeudoresManager.tsx`
- `src/features/billing/styles/ClientsManager.module.scss` (`.invoiceMeta` / posible clase específica)

---

### 12. Libro IVA — imprimir personalizado entre fechas (período)

**Requisito:** Poder **imprimir el libro de IVA personalizado entre dos fechas** (rango / período de tiempo), no solo mes completo o un día.

**Estado actual:** `LibroIvaDialog` solo soporta:
- período **monthly** (mes vía `CustomMonthPicker`)
- período **daily** (un día vía `CustomDatePicker` + variante Z)
- APIs PDF/XLSX reciben `year` / `month` / `day` / `variant`
- Service + PDF: `billing-libro-iva.service.ts`, `build-libro-iva-pdf.ts`

**Zona a extender de punta a punta:**
- UI: `LibroIvaDialog.tsx` (+ pickers compartidos)
- Utils: `libro-iva.ts`, `invoice-pdf-client.ts`
- API: `src/app/api/admin/billing/libro-iva/pdf/route.ts`, `.../xlsx/route.ts`
- Service: `billing-libro-iva.service.ts`
- PDF/Excel: `build-libro-iva-pdf.ts`, `build-libro-iva-xlsx.ts`
- Entrada UI desde facturas: `ComprobantesManager.tsx` / `ComprobantesPageIntro.tsx`

---

## Atajos existentes (para no pisarlos sin querer)

| Tecla | Uso actual relevante |
|-------|----------------------|
| F2 | Ir a nueva factura (`BillingPillNav`) |
| Shift+F | Emitir / submit factura |
| Enter | Avanzar campos / agregar fila al completar precio |
| Escape | Salir de ítems / cerrar modales / leave dialog |
| Delete | Quitar ítem |
| I | Imprimir (éxito / documentos) |
| D | Descargar |
| C | **Compartir** en modal de éxito (conflicto potencial con confirm `C` del nuevo modal de resumen) |
| N | Crear nueva |
| L | Ir a lista |
| + | **No existe** aún (pedido nuevo) |

El prompt ideal debe resolver el conflicto **`C` = confirmar resumen** vs **`C` = compartir** según el contexto (modal de confirmación pre-create vs modal post-create).

---

## Reglas de alcance / calidad para el prompt generado

- Separar claramente: **UI nueva factura** vs **PDF impresión** vs **catálogos** vs **deudores** vs **Libro IVA**.
- Respetar **A vs B**: cambios de columnas P. unitario S/IVA y Total S/IVA en pantalla e impresión aplican a **A**; **B** se mantiene.
- En PDF A: no mostrar P. unitario con IVA; sí P. unitario s/IVA + Total s/IVA.
- Multi-página: header + cliente en cada hoja; totales solo al final.
- Impresión: sin texto “Punto de venta”; fecha bold y más cerca; bloque derecho más separado del bbox A/B.
- En caja cliente PDF: “Tipo de factura: CONTADO” con fondo distinto bajo código cliente, mapeando contado/transferencia/tarjeta/otros → CONTADO.
- Preferir patrones existentes del repo (modales billing, keyboard hooks, pdf-lib helpers).
- No pedir comentarios en código salvo que el usuario del agent lo pida.
- No inventar commits/PRs; solo implementación.

---

## Texto sugerido para abrir el chat con ChatGPT

> Usá el markdown adjunto como contexto del repo y de los cambios pedidos.  
> Devolvé **solo** un prompt ideal (en español) para un coding agent que implemente todos estos puntos, organizado por área, con rutas, estado actual vs deseado, y reglas A/B / impresión.  
> No armes un plan de desarrollo ni estimaciones; el output debe ser el prompt listo para pegar.
