-- Alinea facturas ya anuladas por NC con el nuevo estado de pago.

UPDATE "BillingInvoice"
SET "paymentStatus" = 'ANULADA'
WHERE "fiscalStatus" = 'ANULADA_NC'
  AND "paymentStatus" <> 'ANULADA';
