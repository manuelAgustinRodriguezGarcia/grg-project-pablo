# Relevamiento del módulo de Facturación

Inventario del código existente. No describe funcionalidad futura. Fecha de relevamiento: 22 de septiembre de 2026.

Ya existe un placeholder **Guía por facturación** en el Resumen (`BillingHub`): abre un `ConfirmDialog` con texto de “próximamente”. No hay guía real todavía.

---

## 1. Secciones existentes de Facturación

El layout vive en `src/app/admin/facturacion/layout.tsx`. La barra es `BillingPillNav`. El acceso al módulo en el sidenav es **Facturación** (`ReceiptText`, permiso `invoices.read`) → `/admin/facturacion`.

| Nombre visible | Ruta pública | Archivo de página | Componente principal | Para qué sirve | Acciones | Abre | Permiso de ruta |
|---|---|---|---|---|---|---|---|
| **Resumen** | `/admin/facturacion` | `src/app/admin/facturacion/page.tsx` | `BillingHub` | KPIs del mes, top clientes/rubros, deudores, placeholder de guía | Ver deudores, ver clientes, ver rubros, abrir guía (placeholder) | `ConfirmDialog` “Guía de facturación” | `billing.hub.read`. Si no: VENDEDOR → nueva factura; si solo lee facturas → `/facturas`; si no → `/admin/catalogos` |
| **Clientes** | `/admin/facturacion/clientes` | `(secciones)/clientes/page.tsx` | `ClientsManager` | Alta/consulta/edición de clientes | Crear, editar, eliminar (si no hay historial), ver detalle, emitir recibo/NC/ND desde historial | `ClientFormModal`, `ClientDetailsModal`, `InvoiceDetailModal`, `ReceiptFormModal`, `NoteFormModal`, `ConfirmDialog` eliminar | `clients.read`. Crear/editar/borrar: `clients.create` / `clients.update` / `clients.delete` |
| **Clientes con deuda** | `/admin/facturacion/deudores` | `(secciones)/deudores/page.tsx` | `DeudoresManager` | Clientes con saldo de cuenta corriente | Filtrar período, ordenar, buscar, imprimir, Excel, ir a historial o factura | `DeudoresPeriodDialog`; navega a clientes (`?cliente=&historial=1`) o facturas (`?factura=`) | `debts.read` |
| **Rubros** | `/admin/facturacion/rubros` | `(secciones)/rubros/page.tsx` | `RubrosManager` | Conceptos de factura | Crear, editar, activar/desactivar, eliminar | `RubroFormModal`, `ConfirmDialog` eliminar | `categories.read`. Gestionar: `categories.update` (`canManageCategories`) |
| **Facturas** | `/admin/facturacion/facturas` | `(secciones)/comprobantes/page.tsx` (rewrite) | `ComprobantesManager` | Historial de facturas, PDF, Libro IVA | Filtrar, buscar, detalle, descargar, imprimir, compartir, emitir recibo, Libro IVA | `InvoiceDetailModal`, `LibroIvaDialog`, `ReceiptFormModal`, `NoteFormModal` | `invoices.read` |
| **Nueva factura** | `/admin/facturacion/nueva-factura` | `(secciones)/nueva-factura/page.tsx` | `NewInvoiceManager` | Emitir factura (hoy en **modo prueba**) | Elegir/crear cliente, ítems, descuento, pago, confirmar, PDF, imprimir, compartir | `ClientFormModal`, `InvoiceCreateConfirmModal`, `UnprintedInvoiceLeaveDialog`, `ConfirmDialog` quitar ítem | Ruta: `invoices.read`. Emitir: `invoices.create` |
| **Movimientos** | `/admin/facturacion/movimientos` | `(secciones)/movimientos/page.tsx` | `MovimientosManager` | Recibos, NC, ND e imputaciones | Crear recibo/NC/ND, imputar (si hay `movements.update`), detalle, PDF, imprimir | `ReceiptFormModal`, `NoteFormModal`, `ReceiptDetailModal`, `InvoiceDetailModal`, `BillingIssueSuccessModal` | `movements.read`. Crear: `movements.create`. Imputar: `movements.update` |
| **Configuración** | `/admin/facturacion/configuracion-fiscal` | `(secciones)/configuracion-fiscal/page.tsx` | `FiscalSettingsManager` | IVA, límite de cliente genérico, ambiente | Actualizar IVA y límite (con confirmación). Ambiente **solo lectura** | `ConfirmDialog` | `settings.read`. Cambiar: `settings.update` |

### Qué no es una sección propia

- **Recibos / Notas de crédito / Notas de débito:** no tienen ruta. Se emiten desde Movimientos o desde el detalle de una factura/cliente.
- **Libro IVA:** diálogo en Facturas, no página.
- **`/admin/facturacion/pagos`:** solo `redirect` a `/movimientos`. Prefijo de permiso `movements.read` sigue existiendo.
- **`/admin/facturacion/comprobantes`:** redirect permanente a `/facturas`. El archivo real está en `(secciones)/comprobantes`.
- **`DashboardView`:** no es el Resumen de Facturación. Se usa en `/admin/inicio`.
- **`BillingSectionPlaceholder`:** definido, **nunca importado**.

### Roles (estado actual)

| Rol | Facturación |
|---|---|
| `VISITANTE` | Sin acceso |
| `VENDEDOR` | Lee/crea facturas y clientes. Sin Resumen, rubros, movimientos, deudores, configuración |
| `VISITANTE_AVANZADO` | Lee casi todo (salvo usuarios). Crea facturas, clientes, recibos/NC/ND. **No edita ni borra**. No imputa recibos (`movements.update`) |
| `ADMINISTRADOR` | Todo |

---

## 2. Navegación

**Sidenav:** `ADMIN_NAV_ITEMS` → Facturación `/admin/facturacion`.

**Barra del módulo:** `BillingPillNav` + `BILLING_NAV_TABS`:

1. Resumen (`LayoutDashboard`, exact)
2. Clientes (`BookUser`) con menú hover:
   - Lista de clientes
   - Clientes con deuda (`FileText`, tono rojo)
3. Rubros
4. Facturas
5. Movimientos
6. Configuración

**CTA derecha:** “Nueva factura” + `F2` (si `invoices.create`). En esa ruta el texto pasa a **Facturando...** si hay draft no emitido. En mobile: **Facturar** (FAB).

### Cómo se marca activa

- Clase `tabActive`: fondo azul, texto blanco, relleno `::before`.
- Al navegar: la actual se desmarca; el destino usa `tabPending` (celeste).
- Al cargar: relleno azul de arriba hacia abajo.
- Menú Clientes abierto: la pestaña se ve como hover.
- `aria-current="page"` solo si el href exacto coincide.

### Otros saltos

- Resumen → deudores, clientes, rubros, historial de un deudor.
- Nueva factura → “Lista de facturas” / `L`.
- Recibo/nota emitidos → “Ver lista” / `L` → movimientos.
- Deudores → factura o historial de cliente.
- Factura detalle → historial: `/clientes?cliente={id}&historial=1`.
- Query: `cliente`, `historial`, `factura`, `estado`.

No hay breadcrumbs.

### Constantes de ruta (`src/features/billing/data/billingNav.ts`)

- `BILLING_HUB_PATH` = `/admin/facturacion`
- `BILLING_NEW_INVOICE_PATH` = `/admin/facturacion/nueva-factura`
- `BILLING_NEW_INVOICE_SHORTCUT` = `F2`
- `BILLING_INVOICES_PATH` = `/admin/facturacion/facturas`
- `BILLING_CLIENTS_PATH` = `/admin/facturacion/clientes`
- `BILLING_DEBTORS_PATH` = `/admin/facturacion/deudores`
- `BILLING_MOVIMIENTOS_PATH` = `/admin/facturacion/movimientos`
- Query keys: `cliente`, `historial`, `factura`, `estado`

Rewrite/redirect en `next.config.ts`:

- redirect: `/admin/facturacion/comprobantes` → `/admin/facturacion/facturas`
- rewrite: `/admin/facturacion/facturas` → `/admin/facturacion/comprobantes`

---

## 3. Botones y acciones importantes

Librería de iconos: **lucide-react**, reexportados en `@/shared/icons`. WhatsApp: `WhatsAppIcon` (no Lucide).

| Texto visible | Sección | Acción | Componente / función | Icono | Variantes |
|---|---|---|---|---|---|
| Nueva factura / Facturar / Facturando... | Pill nav | Ir a nueva factura (`F2`) | `BillingPillNav` | `ReceiptText` | Outline gris; hover/activo azul; mobile FAB |
| Guía por facturación | Resumen | Abre placeholder | `BillingHub` | `Info` | Card KPI |
| Ver todos / Ver todos los clientes / Ver todos los rubros | Resumen | Navega | `BillingHub`, `TopRankCard` | — | Links |
| Nuevo cliente | Clientes | Abre alta | `ClientsPageIntro` | `Plus` | `primaryButton` |
| Crear primer cliente | Clientes vacío | Igual | `ClientsTable` | — | |
| Detalles | Clientes / Deudores / Facturas / Movimientos | Abre detalle | tablas / `InvoiceDocumentActions` | `Eye` | icon / card |
| Editar | Clientes / Rubros | Abre form | tablas | `Pencil` | |
| Eliminar | Clientes / Rubros | Confirm + delete | `ConfirmDialog` | `Trash2` | Oculto si el cliente tiene historial |
| Nuevo rubro / Crear primer rubro | Rubros | Alta | `RubrosPageIntro` / tabla | `Plus` | |
| Desactivar / Activar | Rubros | Cambia `ACTIVE`/`INACTIVE` | `RubrosTable` | `Ban` | Sin confirmación |
| Libro IVA | Facturas | Abre diálogo | `ComprobantesPageIntro` | `FileSpreadsheet` | |
| Crear factura | Facturas vacío | Nueva factura | `ComprobantesTable` | `Plus` | |
| Descargar / Descargando… | Facturas, movimientos, recibos, notas | PDF | `InvoiceDocumentActions`, modales | `Download` | icon / card / footer |
| Imprimir / Abriendo… | Igual | Print PDF | mismos + Libro IVA / deudores | `Printer` | |
| Compartir | Factura | WhatsApp / email | `InvoiceShareMenu` | `Share2` | icon / button / footer |
| Enviar por WhatsApp / Enviar a {tel} | Share | Comparte PDF | `InvoiceShareMenu` | `WhatsAppIcon` | |
| Enviar por email / Enviar a {email} | Share | mailto + PDF | `InvoiceShareMenu` | `Mail` | |
| Emitir recibo | Factura / historial | `ReceiptFormModal` | `InvoiceDocumentActions`, `InvoiceReceiptsPanel` | `Receipt` | Solo CC con saldo |
| Nota de crédito / Nota de débito | Detalle factura | `NoteFormModal` | `InvoiceNotesPanel` | `FileText` | |
| Recibo / N. Crédito / N. Débito | Movimientos | Abre forms | `MovimientosPageIntro` | `Plus` | primary / secondary |
| Imputar | Movimientos | Imputa recibo | `MovimientosTable` | `Receipt` | Solo si `canUpdateMovements` y queda saldo |
| Detalle (recibo) | Movimientos | `ReceiptDetailModal` | tabla | `Eye` | |
| Imprimir / Excel | Deudores | Período + export | `DeudoresManager` | `FileSpreadsheet` | |
| Aplicar / Cancelar | Diálogo período deudores | Aplica o cierra | `DeudoresPeriodDialog` | — | |
| Crear factura en modo prueba | Nueva factura | Confirm | `NewInvoiceManager` | — | Disabled sin permiso o datos |
| Confirmar factura / Cancelar | Confirmación | Crea / cierra | `InvoiceCreateConfirmModal` | — | Atajos `C` / Esc |
| Lista de facturas | Post-emisión | Va a `/facturas` (`L`) | `NewInvoiceManager` | `ReceiptText` | |
| Nueva factura (post-éxito) | Post-emisión | Resetea form (`F2`) | `NewInvoiceManager` | — | |
| Agregar nuevo cliente | Nueva factura | `ClientFormModal` | `InvoiceSearchPicker` | `Plus` | |
| Cliente sin identificación | Nueva factura | Cliente genérico | `InvoiceClientSection` | `UserLock` | |
| Cambiar | Nueva factura / recibo / nota | Limpia selección | secciones | `UserRoundArrowLeft` | |
| Agregar ítem | Nueva factura | Nueva fila | `InvoiceItemsSection` | `Plus` | |
| Quitar / Cancelar | Quitar ítem | Confirm | `ConfirmDialog` | `Trash2` en fila | |
| Aplicar / Quitar | Descuento | Aplica o saca % | `InvoiceSummarySection` | `Percent` | |
| 100% | Recibo / nota | Imputa o toma el total | forms | — | |
| Emitir recibo / Imputar | Recibo | Crea o imputa | `ReceiptFormModal` | — | |
| Emitir nota | NC/ND | Crea | `NoteFormModal` | — | |
| Ver lista | Éxito recibo/nota | Movimientos (`L`) | `BillingIssueSuccessModal` | `ArrowLeftRight` | |
| Crear nuevo | Éxito | Resetea form (`N`) | mismo | — | |
| Entendido | Guía placeholder | Cierra | `ConfirmDialog` | — | |
| Actualizar IVA / Actualizar límite | Config | Confirm + save | `FiscalSettingsManager` | `Percent` / `Wallet` | |
| Confirmar cambio / Cancelar | Config | Aplica o no | `ConfirmDialog` | — | |
| Cerrar | Casi todos los modales | Cierra | varios | `X` | |
| Seguir editando / Descartar cambios | Forms sucios | — | `ClientFormModal`, `RubroFormModal` | `AlertTriangle` | |
| Confirmar / Cancelar | Confirmar CUIT/DNI | — | `ClientFormModal` | — | |
| Copiar / Copiado | Detalle cliente | Clipboard | `ClientDetailsModal` | `Mail` en email | |

**No existen** botones “Volver”, “Limpiar filtros” ni “Aplicar filtros” en los listados (salvo **Aplicar** en el período de deudores).

---

## 4. Iconografía

Todos los Lucide salen de `@/shared/icons` (`ICON_STROKE = 1.5`). Extra: `WhatsAppIcon`.

| Icono | Dónde | Representa |
|---|---|---|
| `LayoutDashboard` | `billingNav` | Tab Resumen |
| `BookUser` | nav, hub, clientes, invoice client | Clientes / heading Cliente |
| `FileText` | menú deudores, notas, deudores | Deuda / NC-ND |
| `Tags` | nav, hub, rubros, ítems | Rubros |
| `ReceiptText` | nav, CTA, facturas, resumen, historial | Facturación / factura |
| `ArrowLeftRight` | nav, movimientos, éxito | Movimientos / Ver lista |
| `Cog` | nav, config | Configuración |
| `Wallet` | hub, deudores, config | Deuda / límite genérico |
| `Plus` | altas y movimientos | Crear |
| `Search` | buscadores y pickers | Buscar |
| `Eye` | detalles | Ver |
| `Pencil` | editar | Editar |
| `Trash2` | borrar / quitar ítem | Eliminar |
| `Ban` | rubros | Activar/desactivar |
| `Download` | PDF | Descargar |
| `Printer` | imprimir | Imprimir |
| `Share2` | compartir | Compartir |
| `Mail` | email / copiar email | Email |
| `Receipt` | recibo / imputar | Recibo |
| `Info` | guía, aviso modo prueba | Info |
| `CircleDollarSign` | KPI facturado, charts | Importe |
| `TrendingUp` / `TrendingDown` | KPIs | Tendencia |
| `Sticker` | vacíos deuda | Empty |
| `ChevronDown` | menú mobile, scroll hint | Desplegar |
| `X` | cerrar modales | Cerrar |
| `AlertTriangle` | avisos / dirty | Advertencia |
| `CheckCircle2` | éxito | OK |
| `Check` | pills pagada/imputado | Estado |
| `UserLock` | cliente genérico | Sin ID |
| `UserRoundArrowLeft` | Cambiar | Volver a elegir |
| `Banknote` | método de pago | Pago |
| `Percent` | descuento / IVA | % |
| `Award` | top rubros del cliente | Ranking |
| `MoveUp` / `MoveDown` | orden historial | Orden |
| `FileSpreadsheet` | Libro IVA / Excel deudores | Planilla |
| `WhatsAppIcon` | share | WhatsApp |

En **Inicio** (fuera del módulo, mismo feature): `DashboardView` usa `BookUser`, `ReceiptText`, `Tags`, `TableProperties`, `AlertTriangle`, `Sticker`, etc.

---

## 5. Filtros

Todos los de listado se **combinan (AND)**, aplican al tipear/cambiar, **no van a la URL** (salvo semilla) y **no tienen Limpiar**.

| Sección | Filtros | Opciones | URL |
|---|---|---|---|
| Clientes | Orden | A-Z / Z-A | No |
| | Identificación | Todas / CUIT / DNI / Sin documento | No |
| | IVA | Todas + 5 condiciones | No |
| | Pago | Todos / Al día / Adeuda | No |
| Rubros | Estado | Todos / Activos / Inactivos | No |
| | Orden | Nombre o código A-Z/Z-A | No |
| Deudores | Orden deuda | Mayor/menor | No |
| | Período (diálogo) | Mensual / Personalizado / Anual | No. Excel manda `from`, `to`, `sort` |
| Facturas | Tipo | Todos / A / B | No |
| | Pago | Todos / Pagas / Parc. pagas / Impagas / Anuladas | `?estado=` solo **inicial**; el select no reescribe la URL |
| | Desde / Hasta | Fechas vacías = sin tope | No |
| Movimientos | Tipo | Todos / Recibos / NC / ND | No |
| | Desde / Hasta | Igual | No |
| Historial cliente | Estado | Todos / Pagas / Impagas / Parc. / Anuladas | No |
| | Desde / Hasta | `DD/MM/AAAA` | No |
| | Orden Fecha | ASC/DESC | No |
| Libro IVA | Mensual / Diario / Personalizado | Mes; día + Z simple/detallado; desde-hasta | No (el diálogo se queda abierto) |

**No hay** filtro por cliente en Facturas (sí busca por nombre). **No hay** filtro de forma de pago en el listado de facturas (sí columna Método). Recibos sí eligen forma de pago **al emitir**.

---

## 6. Buscadores

Ninguno tiene debounce. Todos filtran **en frontend** sobre el listado ya cargado (`listBilling*Action` + React Query, `staleTime: 30_000`).

| Sección | Placeholder | Campos | Comportamiento |
|---|---|---|---|
| Clientes | `Buscar por nombre, código, CUIT o DNI…` | name, code, dígitos de ID | Mientras se escribe |
| Rubros | `Buscar por nombre o código…` | name, code | Igual |
| Deudores | `Buscar por nombre, código o CUIT/DNI` | name, code, ID | Igual |
| Facturas | `Buscar por cliente, número, CUIT o DNI…` | número, cliente, código, ID | Igual |
| Movimientos | `Buscar por número, cliente o factura…` | number, clientName, invoiceNumbers | Igual |
| Picker cliente (factura/recibo) | `Buscar por nombre, código, CUIT o DNI…` | picker, máx. 50 | Igual |
| Picker rubro | `Buscar rubro…` | activos, máx. 50 | Igual |
| Picker factura (nota) | `Buscar por número o cliente…` | elegibles, máx. 20 | Igual |
| Provincia (alta cliente) | `Buscar o seleccionar provincia` | `CustomSelect` | Igual |
| Matches en alta cliente | — | nombre≥2, email≥3, WA≥4 dígitos, ID≥3 | Frontend, máx. 6. **No se pasa `existingClients` si se abre desde nueva factura** |

---

## 7. Tablas y listados

**Ninguna tiene paginación ni acciones masivas.**

### Clientes — `ClientsTable`

Columnas: Código, Cliente, IVA, Estado (`Adeuda`/`Al día`), Acciones.

Acciones: Detalles, Editar, Eliminar.

Insights: `ClientsInsightsPanel` (máximos compradores / deudores).

### Rubros — `RubrosTable`

Código, Rubro, Estado (`Activo`/`Inactivo`), Acciones.

También `RubrosInsightsPanel` + `RubrosSalesInsight`.

### Deudores

Código, Cliente, Pendientes, Total adeudado, Fecha, Última factura, Acciones (Detalles).

Print/Excel: CUIT, Cliente, Total adeudado.

### Facturas — `ComprobantesTable`

Fecha, Cliente, Tipo (`A`/`B`), Número (+ badges descargado/impreso/compartido), Total, Pago + método, Estado fiscal, Acciones.

Pills de pago: Impaga / Parcialmente pagada / Paga / Anulada.

Fiscal: Modo prueba, Borrador, Pendiente, Enviando ARCA, Autorizada, Rechazada, Error, Cancelada, Ajustada N.C/N.D, ANULADA N.C.

Orden backend: `issuedAt` desc. Totales del mes (no del filtro de fechas, salvo impagas).

### Movimientos — `MovimientosTable`

Fecha, Tipo, Número, Cliente, Facturas, Importe, Imputación (`A cuenta` / `Parcialmente imputado` / `Imputado`), Forma de pago, Acciones.

Orden: fecha desc. Sin control de sort.

### Historial en `ClientDetailsModal`

Fecha, Tipo, Número, Total, Pago, Método, Acciones.

---

## 8. Formularios y modales

| Modal / form | Cómo se abre | Campos clave | Validaciones UI | Botones | Resultado |
|---|---|---|---|---|---|
| `ClientFormModal` | Nuevo/Editar cliente; “Agregar nuevo cliente” | Código (edit), nombre, dirección, localidad, provincia, email, WhatsApp, observaciones, tipo ID, CUIT/DNI, IVA | Nombre; CUIT 11 + dígito; DNI 7-8; provincia; código `LETRAS-00000`; no duplicar ID; ID bloqueado si hay historial | Crear cliente / Guardar cambios; confirmar CUIT/DNI; descartar | Cierra y queda. Desde factura: selecciona el cliente |
| `ClientDetailsModal` | Detalles o `?cliente=` | Solo lectura + historial | — | Cerrar, copiar | Puede abrir factura |
| `RubroFormModal` | Nuevo/Editar | Código, nombre, descripción | Nombre (y código en edit) | Crear rubro / Guardar | Cierra, queda en rubros |
| `NewInvoiceManager` | Ruta | Cliente, rubros, cant., precios, detalle, descuento, método, observaciones | Cliente; ≥1 ítem; cant. 1–99; precio ≤ 99.999.999; descuento 0–99.99; genérico no supera límite | Crear en modo prueba → Confirmar | Éxito **en la misma página** (no usa `BillingIssueSuccessModal`) |
| `InvoiceCreateConfirmModal` | Antes de crear | Resumen | — | Confirmar factura / Cancelar | Crea o no |
| `UnprintedInvoiceLeaveDialog` | Salir sin imprimir | — | — | Imprimir / ir a facturas o nueva | Print o navega |
| `UnsavedInvoiceDraftContext` | Dejar draft sucio | — | — | `ConfirmDialog` | Bloquea nav |
| `InvoiceDetailModal` | Click / `?factura=` | Lectura + recibos/notas | — | PDF, print, share, historial, emitir | Queda en la sección |
| `ReceiptFormModal` | Recibo / Emitir / Imputar | Cliente, forma de pago, observaciones, imputaciones | Cliente; importe > 0; al imputar ≥1 factura | Emitir recibo / Imputar | Éxito embebido o cierra |
| `ReceiptDetailModal` | Detalle recibo | Lectura | — | Descargar, Imprimir | Queda |
| `NoteFormModal` | N.C / N.D | Factura, importe, motivo | Factura, importe, tope crédito, motivo | Emitir nota | Éxito embebido |
| `LibroIvaDialog` | Libro IVA | Período | Mes/día/rango | Imprimir, Excel, Descargar PDF | **No cierra** |
| `DeudoresPeriodDialog` | Imprimir/Excel deudores | Período | Mes/año/rango | Aplicar, Cancelar, Imprimir, Excel | Aplica o exporta |
| `BillingIssueSuccessModal` | Tras recibo (con plata) o nota | — | — | Ver lista, Descargar, Compartir, Crear nuevo, Imprimir | Ver lista → movimientos |
| `FiscalSettingsManager` | Página | IVA %, límite $ | 0–100; límite > 0 | Actualizar + confirmar | Queda en config. Ambiente no se edita |
| `ConfirmDialog` (catálogo) | Varios | — | — | Según caso | — |

Ambiente fiscal visible: **Modo prueba interno** / Homologación ARCA / Producción ARCA. La UI de emisión está en **modo prueba**; no hay envío ARCA usable desde la pantalla de nueva factura.

Los schemas Zod en `src/features/billing/schemas/` se usan en server actions, no como resolver de los forms React.

---

## 9. Flujo real de las tareas principales

1. **Crear cliente**
   Facturación → Clientes → **Nuevo cliente** → datos → si CUIT/DNI, **Confirmar** → **Crear cliente**. Queda en Clientes. También desde Nueva factura → **Agregar nuevo cliente** (sin avisos de duplicado).

2. **Crear rubro**
   Rubros → **Nuevo rubro** → código opcional, nombre, descripción → **Crear rubro**. Queda en Rubros. Visitante avanzado **no** puede (falta `categories.update`).

3. **Nueva factura**
   CTA / F2 → cliente (o genérico / alta) → rubros → pago/descuento/notas → **Crear factura en modo prueba** → **Confirmar factura**. Éxito en la misma pantalla. Si no imprimió, un diálogo frena la salida.

4. **Buscar factura**
   Facturas → buscador y/o filtros. Instantáneo, frontend. También `?factura=`.

5. **Ver detalle**
   **Detalle** / `Eye`, o desde historial, movimientos o URL.

6. **Imprimir**
   **Imprimir** en listado, detalle o post-emisión → `printInvoicePdf` + marca “impreso”.

7. **Descargar PDF**
   **Descargar** → `downloadInvoicePdf` + marca “descargado”.

8. **Emitir recibo**
   Movimientos → **Recibo**, o **Emitir recibo** en factura/historial (solo CC con saldo) → cliente, medio, imputación → **Emitir recibo**. Imputar uno ya emitido pide `movements.update` (admin).

9. **Nota de crédito**
   Movimientos → **N. Crédito**, o panel de la factura si hay importe disponible → factura, importe, motivo → **Emitir nota**.

10. **Nota de débito**
    Igual, solo facturas CC con saldo.

11. **Libro IVA**
    Facturas → **Libro IVA** → período → Imprimir / Excel / Descargar PDF.

12. **Filtros por período**
    Facturas y Movimientos: Desde/Hasta en el intro. Deudores: diálogo Mensual/Personalizado/Anual. Historial de cliente: Desde/Hasta. Libro IVA: su propio período.

13. **Buscadores**
    Escriben y filtran al toque. Sin debounce. Sin backend.

---

## 10. Componentes reutilizables para la guía

| Componente | Archivo | Uso posible en la guía |
|---|---|---|
| `ConfirmDialog` | `src/features/catalog/components/ConfirmDialog.tsx` | Ya usa el placeholder de la guía |
| `BillingPillNav` | `src/features/billing/components/BillingPillNav.tsx` | Explicar tabs |
| `BillingHub` + `HubKpiCard` | `src/features/billing/components/BillingHub.tsx` | Cards clickeables (el patrón de la guía) |
| `TopRankCard` | `src/features/billing/components/dashboard/TopRankCard.tsx` | Card con footer |
| `InvoiceTypeChart` | `src/features/billing/components/dashboard/InvoiceTypeChart.tsx` | — |
| `InvoiceDocumentActions` | `src/features/billing/components/invoices/InvoiceDocumentActions.tsx` | Enseñar Descargar/Imprimir/Detalle |
| `InvoiceShareMenu` | `src/features/billing/components/invoices/InvoiceShareMenu.tsx` | Compartir |
| `DocumentActivityBadges` | `src/features/billing/components/invoices/DocumentActivityBadges.tsx` | Estados descargado/impreso |
| `InvoiceSearchPicker` | `src/features/billing/components/invoices/InvoiceSearchPicker.tsx` | Combobox |
| `BillingIssueSuccessModal` | `src/features/billing/components/BillingIssueSuccessModal.tsx` | Modal post-acción |
| `CustomSelect` | `src/shared/components/CustomSelect.tsx` | Filtros |
| `CustomDatePicker` | `src/shared/components/CustomDatePicker.tsx` | Períodos |
| `CustomMonthPicker` | `src/shared/components/CustomMonthPicker.tsx` | Mes Libro IVA / deudores |
| `AdminTableSkeleton` | `src/features/admin/components/AdminTableSkeleton.tsx` | Carga |
| `WhatsAppIcon` | `src/shared/components/WhatsAppIcon.tsx` | Share |
| `FloatingToast` | `src/shared/components/FloatingToast.tsx` | Avisos (poco usado en billing) |

Empty states ya existen en cada tabla. Tooltips de acciones: `rowActionTooltip` en SCSS de `ClientsManager.module.scss`. No hay breadcrumbs.

---

## 11. Propuesta de categorías para la guía

Basado solo en lo que existe:

### Primeros pasos

- ¿Qué es el Resumen?
- ¿Cómo entro a Facturación?
- ¿Qué hace F2?
- ¿Qué es el modo prueba?
- ¿Por qué no puedo editar/borrar si soy visitante avanzado?

### Clientes

- ¿Cómo creo un cliente?
- ¿Qué datos son obligatorios?
- ¿CUIT o DNI?
- ¿Puedo usar un cliente sin identificación?
- ¿Cómo lo edito o borro?
- ¿Por qué no me deja borrar?
- ¿Dónde veo su historial?

### Clientes con deuda

- ¿Cómo veo quién debe?
- ¿Cómo filtro el período?
- ¿Cómo imprimo o bajo Excel?
- ¿Cómo abro el historial de un deudor?

### Rubros

- ¿Cómo creo un rubro?
- ¿Para qué se usa en la factura?
- ¿Cómo lo desactivo?
- Alta/edición: solo quien tenga `categories.update`.

### Nueva factura

- ¿Cómo emito una factura?
- ¿Cómo elijo el cliente o el rubro?
- ¿Qué es Cuenta corriente vs Contado?
- ¿Cómo aplico descuento?
- ¿Qué pasa si no imprimo?

### Facturas / comprobantes

- ¿Cómo busco una factura?
- ¿Cómo filtro por tipo o estado?
- ¿Qué significan Paga / Impaga / Modo prueba?
- ¿Cómo veo el detalle?

### Recibos

- ¿Cómo emito un recibo?
- ¿Desde factura o desde Movimientos?
- ¿Qué es imputar?
- ¿Por qué a veces no veo Imputar?

### Notas de crédito y débito

- ¿Cuándo puedo una NC o ND?
- ¿Cómo la emito?
- ¿Qué factura acepta cada una?

### Libro IVA

- ¿Dónde está?
- ¿Mensual, diario o personalizado?
- ¿PDF o Excel?

### Búsquedas y filtros

- ¿Qué busca cada caja?
- ¿Se combinan?
- ¿Por qué no hay Limpiar?

### Impresión, PDF y compartir

- ¿Cómo imprimo o descargo?
- ¿Qué es Compartir?
- ¿Qué marcan Impreso / Descargado / Compartido?

### Configuración

- ¿Dónde cambio el IVA?
- ¿Qué es el límite de cliente genérico?
- ¿Qué significa el ambiente?

---

## Información necesaria para construir la Guía de Facturación

### Secciones / rutas

- Resumen `/admin/facturacion`
- Clientes `/admin/facturacion/clientes`
- Deudores `/admin/facturacion/deudores`
- Rubros `/admin/facturacion/rubros`
- Facturas `/admin/facturacion/facturas`
- Nueva factura `/admin/facturacion/nueva-factura`
- Movimientos `/admin/facturacion/movimientos` (recibos, NC, ND)
- Configuración `/admin/facturacion/configuracion-fiscal`

### Acciones principales

Crear cliente/rubro/factura; buscar y filtrar; detalle; PDF; imprimir; compartir; recibo; imputar; NC/ND; Libro IVA; IVA y límite.

### Iconos a reutilizar

Los de la tabla de la sección 4 (mismos que ya ve el usuario).

### Filtros / buscadores

Todos locales, instantáneos, sin debounce ni “limpiar”; períodos en Facturas, Movimientos, Deudores, historial y Libro IVA.

### Modales

`ClientFormModal`, `ClientDetailsModal`, `RubroFormModal`, `InvoiceDetailModal`, `InvoiceCreateConfirmModal`, `ReceiptFormModal`, `ReceiptDetailModal`, `NoteFormModal`, `LibroIvaDialog`, `DeudoresPeriodDialog`, `BillingIssueSuccessModal`, `UnprintedInvoiceLeaveDialog`, `ConfirmDialog`.

### Piezas reutilizables

Cards del hub, `ConfirmDialog`, pickers, `InvoiceDocumentActions`, badges, `CustomSelect` / date / month picker.

### Punto de entrada ya existente

Card **Guía por facturación** en Resumen. Hoy es placeholder; es el lugar natural para el modal de mini-pantallas.

### Preguntas frecuentes con sentido real

- ¿Cómo creo una nueva factura?
- ¿Dónde cargo un cliente?
- ¿Cómo creo un rubro?
- ¿Cómo busco una factura?
- ¿Cómo filtro por período?
- ¿Cómo imprimo o descargo una factura?
- ¿Cómo emito un recibo?
- ¿Cómo hago una nota de crédito o débito?
- ¿Dónde está el Libro IVA?
- ¿Qué es el modo prueba?
- ¿Qué hago si no quiero imprimir al salir de una factura nueva?
- ¿Por qué no puedo editar un rubro o imputar un recibo?
