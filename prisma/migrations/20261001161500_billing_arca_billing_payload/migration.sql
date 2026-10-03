-- Snapshot comercial de la emisión y vínculo con BillingInvoice.
-- No modifica filas existentes. No elimina facturas.

ALTER TABLE "BillingArcaEmission" ADD COLUMN "billingPayloadSnapshot" JSONB;

ALTER TABLE "BillingArcaEmission"
ADD CONSTRAINT "BillingArcaEmission_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
