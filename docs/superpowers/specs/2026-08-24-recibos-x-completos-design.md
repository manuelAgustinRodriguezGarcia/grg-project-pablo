# Recibos X completos (Facturación fase 5.1)

## Goal

Reemplazar el Recibo X de “una factura, cobro total, exige adjunto” por cobros reales de Pablo: un recibo del cliente, imputable a 0..N facturas, con restante a cuenta e imputación posterior. La gestión vive en **Movimientos**. Facturas solo ofrece el atajo **Emitir recibo** sobre impagas.

## Scope

Incluido:

- Modelo `BillingReceipt` del cliente + tabla `BillingReceiptAllocation`.
- Estados de pago de factura: Impaga / Parcialmente pagada / Paga, derivados del saldo.
- Modal único de alta / imputación (mismo cromado que clientes y detalle de factura, con scroll).
- Atajo desde la lista de Facturas.
- Anticipo (recibo sin facturas) e imputar restante después, sin crear otro número de recibo.
- PDF de Recibo X actualizado (varias facturas o “pago a cuenta”).
- Quitar del producto los comprobantes de pago (código, storage, PRD).
- Tests de reparto, tope de saldo, anticipo, imputación posterior y atajo.

Fuera de alcance:

- Notas de crédito y débito (Movimientos sigue mostrando el filtro; la emisión no se construye).
- Libro IVA, ARCA, tabla de cuenta corriente / mayor.
- Relación Recibo X ↔ punto de venta 0007 (los recibos no son fiscales).

## Decisions

- Un solo formulario: modal grande sobre la lista, no pantalla tipo Nueva factura.
- Entrada B: gestión en Movimientos + atajo en Facturas. El detalle de factura **no** emite recibos.
- Reparto C: Pablo carga el importe; el sistema propone de la más antigua a la más nueva; cada línea es editable. Sobrante → a cuenta.
- Se puede emitir sin tildar facturas (anticipo).
- Imputar después agrega filas al mismo recibo; no genera `REC-X` nuevo.
- Persistencia B: recibo + imputaciones; saldos calculados. Sin libro de movimientos de cuenta corriente.
- Comprobantes de pago no existen en este sistema. Se eliminan de UI, schema, actions y `docs/PRD-FACTURACION.md`. No se reintroducen como adjunto opcional.
- Numeración: `REC-X-00000001` (hoy es `REC-00000001`; se migra el formato para recibos nuevos y se actualiza el helper).
- Formas de pago del recibo (no de la factura): Efectivo, Cheque, Transferencia, Tarjeta, Otros. Nunca Cuenta corriente.
- Sin tope de facturas en el modal: la lista scrollea.

## Data model

### `BillingReceipt`

Deja de exigir `invoiceId`. Campos:

| Campo | Notas |
| --- | --- |
| `id` | cuid |
| `receiptNumber` | único, `REC-X-` + 8 dígitos |
| `sequenceNumber` | único, correlativo interno |
| `clientId` | obligatorio, `onDelete: Restrict` |
| `issuedAt` | default now |
| `amount` | Decimal 18,2 — importe cobrado (no cambia al imputar después) |
| `paymentMethod` | enum de recibo (ver abajo) |
| `notes` | opcional, max 1000 |
| `createdByUserId` | admin emisor |
| timestamps | createdAt / updatedAt |

Estado de imputación **no se guarda**: se deriva.

```txt
allocated = suma(allocations.amount)
remaining = amount − allocated

remaining = amount  → a cuenta
0 < remaining < amount → parcialmente imputado
remaining = 0 → imputado
```

### `BillingReceiptAllocation`

| Campo | Notas |
| --- | --- |
| `id` | cuid |
| `receiptId` | cascade |
| `invoiceId` | restrict |
| `amount` | Decimal 18,2, > 0 |
| `createdAt` | |

Índice `(receiptId, invoiceId)` único: un recibo no imputa dos veces la misma factura. Una segunda imputación del mismo recibo a la misma factura se resuelve **sumando** en esa fila (upsert), no creando duplicados.

### Factura — estado de pago

Extender `BillingPaymentStatus`: `IMPAGA | PARCIALMENTE_PAGA | PAGA`.

```txt
saldo = totalVisualRounded − suma(allocations a esa factura)
saldo = total → IMPAGA
0 < saldo < total → PARCIALMENTE_PAGA
saldo = 0 → PAGA
```

El estado no se elige a mano. Al emitir o imputar, el backend recalcula las facturas tocadas.

Facturas de contado/tarjeta/etc. que nacen `PAGA` no tienen saldo y **no aparecen** en el modal. Solo entran facturas con `saldo > 0`.

### Recibo — forma de pago

Enum propio `BillingReceiptPaymentMethod` (no reutilizar el de facturas, que incluye cuenta corriente):

- `EFECTIVO`
- `CHEQUE`
- `TRANSFERENCIA`
- `TARJETA`
- `OTROS`

`BillingReceipt.paymentMethod` usa este enum. Las facturas siguen con `BillingPaymentMethod`.

### Migración de datos existentes

- Recibos actuales: crear una allocation por `invoiceId` con `amount = receipt.amount`, setear `clientId` desde la factura, luego quitar `invoiceId` de `BillingReceipt`.
- Recibos cuyo número es `REC-00000001`: se dejan como están (históricos). Los **nuevos** usan `REC-X-`. El correlativo `sequenceNumber` continúa.
- Columnas y relaciones de payment proof: drop. Archivos en Storage de comprobantes: no se migran; el código deja de referenciarlos. No hace falta un job de borrado de blobs en esta fase.

### Qué se borra

- `PaymentProofPanel`, `canIssueReceipt`, helpers de edición de proof, actions/upload de proof.
- Campos `paymentProof*` en `BillingInvoice` y tipos UI.
- Emisión de recibo desde `InvoiceReceiptsPanel`. El detalle de factura puede mostrar **solo lectura**: lista de recibos/imputaciones de esa factura + descargar PDF.

## UI

### Modal `ReceiptFormModal`

Misma overlay/card que `PriceColumnEditModal` + estilos de `ClientsManager` (acento billing, no un skin nuevo). Ancho ~ `min(100%, 40rem)`, `max-height` viewport, body con scroll.

Campos, en este orden:

1. Cliente (`CustomSelect` / picker existente de facturación). Bloqueado si se abrió desde Facturas o desde Imputar.
2. Importe cobrado. Bloqueado en modo Imputar (vale el `remaining` del recibo).
3. Forma de pago. Oculta / bloqueada en modo Imputar (ya está en el recibo).
4. Tabla de facturas con saldo del cliente: checkbox, número, fecha, saldo, input “Aplica”.
5. Línea de resumen: imputado / a cuenta.
6. Observaciones. En modo Imputar se puede dejar vacío (no pisa las notas del recibo salvo que Pablo escriba).
7. Cancelar / CTA: **Emitir recibo** o **Imputar**.

Autoreparto: al cambiar importe o al tildar/destildar, se llena “Aplica” FIFO por `issuedAt` ascendente. Editar un “Aplica” no relanza el FIFO de esa fila. Destildar pone aplica = 0.

Sin facturas tildadas y importe > 0 → emitible; 100% a cuenta.

### Aperturas

| Origen | Prefill |
| --- | --- |
| Movimientos → **Recibo X** | Vacío. Pablo elige cliente. |
| Facturas → **Emitir recibo** (solo filas con saldo > 0) | Cliente + esa factura tildada. El resto de impagas del mismo cliente listadas. |
| Movimientos → **Imputar** (solo si `remaining > 0`) | Cliente e importe fijos. Facturas con saldo. Autoreparto del restante. |

No hay paso previo “elegí qué facturas” aparte del modal.

### Movimientos

- El listado sale de **recibos** (y más adelante NC/ND), no se arma recorriendo facturas. Un anticipo tiene que aparecer aunque no tenga allocations.
- Intro: botón primario **Recibo X** a la izquierda de los filtros, mismo patrón que “Nuevo cliente”.
- Columnas: fecha, tipo, número, cliente, facturas asociadas (texto: una, “N facturas”, o “A cuenta”), importe, forma de pago, estado de imputación, acciones (PDF, Imputar si resta, Ver factura si hay una sola asociada).
- Empty copy: “Todavía no hay Recibos X. Emitilos acá o desde una factura impaga.”

### Facturas

- Botón **Emitir recibo** en acciones de fila y card mobile, visible solo con saldo > 0.
- Filtro de estado de pago: incluir Parcialmente pagada.
- Quitar cualquier UI de comprobante de pago.

## Backend / actions

Server Actions (mismo estilo que `createBillingReceiptAction`):

- `createBillingReceiptAction({ clientId, amount, paymentMethod, notes, allocations: [{ invoiceId, amount }] })`
- `allocateBillingReceiptAction({ receiptId, allocations: [{ invoiceId, amount }] })`
- `listBillingReceiptsAction` / query usada por Movimientos (include client, allocations, invoices)
- `generateReceiptPdf` ya existe; recibe el recibo con allocations.

Validación (Zod + servicio):

- Admin only.
- `amount > 0`.
- Suma(allocations) ≤ amount.
- Cada allocation > 0 y ≤ saldo **actual** de esa factura (query dentro de transacción).
- Todas las facturas del mismo `clientId`.
- Modo imputar: suma(nuevas) ≤ remaining actual.
- Si el saldo cambió: error `SALDO_CHANGED` → la UI recarga facturas y muestra “El saldo cambió. Revisá las facturas.”

Transacción Prisma: crear recibo + allocations + recalcular `paymentStatus` de cada factura afectada.

No hay route handlers nuevos si las actions bastan (el PDF puede seguir en action o GET existente).

## PDF

- Encabezado Recibo X + número `REC-X-…`.
- Cliente.
- Importe y forma de pago.
- Tabla de facturas imputadas (número + monto). Si no hay: leyenda **Pago a cuenta**.
- Si remaining > 0: línea “A cuenta: $…”.
- Sin mención de comprobante adjunto.
- Sigue siendo interno (marca de agua modo prueba si el ambiente de facturación lo requiere, igual que el PDF de factura).

## Error copy (es-AR, tuteo operativo de Pablo)

| Caso | Mensaje |
| --- | --- |
| Sin cliente | Elegí un cliente. |
| Importe ≤ 0 | El importe tiene que ser mayor a cero. |
| Sin forma de pago | Elegí cómo pagó. |
| Aplica > saldo de una fila | Supera el saldo de la factura {n}. |
| Suma aplica > importe | Lo imputado no puede superar el cobro. |
| Conflicto concurrente | El saldo cambió. Revisá las facturas. |

## Tests

Unitarios, sobre utilidades de reparto y sobre el servicio (con DB de test si el repo ya prueba servicios Prisma; si no, extraer el FIFO a función pura y testearla sí o sí):

1. Una factura, cobro = saldo → factura Paga, recibo imputado.
2. Dos facturas $1.000.000, cobro $1.500.000 → primera Paga, segunda Parcial $500.000.
3. Cobro sin allocations → recibo a cuenta, ninguna factura cambia.
4. Imputar remaining de (3) a una factura nueva.
5. Rechazo si aplica > saldo.
6. Atajo: factura preseleccionada queda tildada (test de helper de prefill, no de Playwright obligatorio).
7. `canIssueReceipt` / proof: tests que dependían del adjunto se eliminan.

## PRD

En `docs/PRD-FACTURACION.md`:

- Dejar explícito que **no existe** comprobante de pago (la §18 ya lo niega; barrer menciones residuales de dropzone / adjunto como feature viva).
- Alinear numeración `REC-X-` y el flujo de Movimientos + atajo Facturas con este spec.
- No reabrir adjuntos como “fase futura”.

## Feature layout

- `src/features/billing/components/recibos/ReceiptFormModal.tsx` — modal.
- `src/features/billing/utils/receipt-allocation.ts` — FIFO, remaining, payment status.
- `src/server/services/billing-receipt.service.ts` — create + allocate (reemplaza el create actual).
- `src/server/repositories/billing-receipt-allocation.repository.ts`
- Movimientos: dejar de usar `buildReceiptMovements(invoices)` como fuente; listar recibos.
- Quitar `PaymentProofPanel` y el create de `InvoiceReceiptsPanel`.
