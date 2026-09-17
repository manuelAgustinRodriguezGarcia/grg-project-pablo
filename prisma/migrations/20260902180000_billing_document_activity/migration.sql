-- Datos fiscales extra del emisor y timestamps de impresión/descarga/compartido.

ALTER TABLE "BillingFiscalSettings" ADD COLUMN IF NOT EXISTS "issuerGrossIncome" TEXT;
ALTER TABLE "BillingFiscalSettings" ADD COLUMN IF NOT EXISTS "issuerActivitiesStartedAt" TEXT;

ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "downloadedAt" TIMESTAMP(3);
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "sharedAt" TIMESTAMP(3);

ALTER TABLE "BillingReceipt" ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);
ALTER TABLE "BillingReceipt" ADD COLUMN IF NOT EXISTS "downloadedAt" TIMESTAMP(3);
ALTER TABLE "BillingReceipt" ADD COLUMN IF NOT EXISTS "sharedAt" TIMESTAMP(3);

ALTER TABLE "BillingNote" ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);
ALTER TABLE "BillingNote" ADD COLUMN IF NOT EXISTS "downloadedAt" TIMESTAMP(3);
ALTER TABLE "BillingNote" ADD COLUMN IF NOT EXISTS "sharedAt" TIMESTAMP(3);
