# Notas de crédito / débito y Libro IVA (modo prueba)

## Goal

Completar la Fase 5 del PRD de facturación en modo prueba: emitir Notas de Crédito y Notas de Débito asociadas a una factura, con PDF propio, impacto en saldo y estado fiscal, y generar el Libro IVA mensual desde Facturas.

Sin ARCA: no hay CAE, QR fiscal ni envío.

## Scope

Incluye:

- Alta de NC y ND desde el detalle de factura y desde Movimientos.
- PDF individual modo prueba (descargar / imprimir).
- Recálculo de saldo a cobrar y estado fiscal.
- Libro IVA PDF A4 horizontal, al vuelo, filtrado por mes, desde Facturas.
- Listado de notas en Movimientos (filtros crédito / débito ya existentes).

Fuera de alcance:

- Integración ARCA, CAE, QR, PDF fiscal definitivo.
- Cierre persistido de Libro IVA (`monthly_vat_books`).
- Ítems de renglón en la nota (solo importe + motivo).
- Edición o anulación de una nota ya emitida.

## Decisions

- Una tabla `BillingNote` con `kind: CREDIT | DEBIT` (no dos tablas).
- Formulario: factura asociada, importe, motivo; atajo al importe disponible.
- Numeración propia por tipo: `0007-PRUEBA-NC-000000001` y `0007-PRUEBA-ND-000000001`. La letra A/B es la de la factura, no va en el número.
- Tope NC = total factura − NC previas + ND (ignora recibos). Se puede emitir NC sobre factura paga.
- ND solo cuenta corriente con saldo a cobrar > 0. No sobre facturas pagas.
- PDF de cada nota al emitir, mismo patrón que factura / Recibo X.
- Libro IVA al vuelo: mes elegido → PDF con comprobantes de ese mes. No snapshot.
- Signos Libro IVA (PRD): facturas y ND **suman**; NC **restan**. Recibos X no entran.
- Estado fiscal de anulación total: etiqueta **ANULADA N.C**. Esa factura no se muestra como paga aunque el saldo a cobrar quede en 0.

## Data

`BillingNote`:

- `kind`: `CREDIT` | `DEBIT`
- `invoiceId` (obligatorio)
- snapshot de cliente (id, nombre, identificación, condición IVA)
- `invoiceType` (A/B, copiado de la factura)
- `pointOfSale`, `sequenceNumber`, `noteNumber` (único)
- `amount`, `ivaPercent`, `ivaAmount`, `netAmount` (importe con IVA incluido; desglose con el % de la factura)
- `reason`
- `environment` = `MODO_PRUEBA`
- `issuedAt`, `createdByUserId`
- `pdfPath` opcional

Enums fiscales nuevos en factura:

- `AJUSTADA_NC` → UI **Ajustada N.C**
- `AJUSTADA_ND` → UI **Ajustada N.D**
- `ANULADA_NC` → UI **ANULADA N.C**

## Saldo y estados

```txt
saldoACobrar = max(0, total − NC + ND − recibos imputados)
topeNC       = total − NC + ND
```

Estado de pago (impaga / parcial / paga) sale de `saldoACobrar`, **excepto** si el estado fiscal es `ANULADA_NC`: no se marca Paga.

Estado fiscal (modo prueba):

1. NC cubre el total fiscal (`topeNC` previo = importe de esta NC) → `ANULADA_NC`
2. Si no, hay ND → `AJUSTADA_ND`
3. Si no, hay NC → `AJUSTADA_NC`
4. Si no → se mantiene `MODO_PRUEBA`

## UI

**Detalle de factura**

- Botón Nota de crédito si `topeNC > 0`
- Botón Nota de débito si método cuenta corriente y `saldoACobrar > 0`
- Panel lateral (junto a Recibos): notas asociadas, PDF

**Movimientos**

- Alta: tipo crédito/débito → picker de factura elegible → mismo modal
- Filas de notas con número, cliente, factura asociada, importe, PDF

**Modal**

- Factura (fija o buscable), cliente, disponible, importe, atajo “todo el disponible”, motivo
- Confirmar emite, genera PDF, cierra, refresca listados

**Libro IVA (sección Facturas)**

- Reemplaza el placeholder: elegir mes, generar/descargar/imprimir PDF
- A4 apaisado, hoja Facturas A (+ NC A + ND A) y hoja Facturas B
- Columnas: fecha, tipo, letra, PV, número, cliente, CUIT/DNI, condición IVA, neto, IVA, total, comprobante asociado
- Totales de hoja: neto, IVA, total (NC restando)

## PDF de la nota

Mismo lenguaje visual que factura modo prueba: marca de agua / leyenda interna, sin CAE. Título “Nota de crédito” o “Nota de débito”, número, factura asociada, importe, motivo, cliente.

## Errors

Bloquear con mensaje claro (estilo recibo):

- Importe ≤ 0 o mayor al tope
- ND sobre factura paga o que no sea cuenta corriente
- Factura inexistente
- Motivo vacío

## Tests

- Tope NC ignora recibos y permite factura paga
- ND rechazada si paga o no es cuenta corriente
- Recálculo de saldo
- Anulación total → `ANULADA_NC` y no Paga
- Libro IVA: todas las facturas del mes, NC −, ND +, sin Recibos, A y B separados

## Order of work

1. Schema + recálculo de saldo / fiscal
2. Emitir NC (detalle + Movimientos + PDF)
3. Emitir ND (mismas pantallas, otras reglas)
4. Libro IVA PDF desde Facturas
