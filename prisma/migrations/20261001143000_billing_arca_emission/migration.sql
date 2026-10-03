-- Emisión ARCA y unicidad fiscal A/B.
-- No modifica filas existentes. No elimina facturas.

ALTER TABLE "BillingInvoice" DROP CONSTRAINT IF EXISTS "BillingInvoice_invoiceNumber_key";
DROP INDEX IF EXISTS "BillingInvoice_invoiceNumber_key";

ALTER TABLE "BillingInvoice" DROP CONSTRAINT IF EXISTS "BillingInvoice_environment_pointOfSale_sequenceNumber_key";
DROP INDEX IF EXISTS "BillingInvoice_environment_pointOfSale_sequenceNumber_key";

CREATE UNIQUE INDEX "BillingInvoice_environment_pointOfSale_invoiceType_sequenceNumber_key"
ON "BillingInvoice"("environment", "pointOfSale", "invoiceType", "sequenceNumber");

CREATE TYPE "BillingArcaEmissionStatus" AS ENUM (
  'PREPARED',
  'SENDING',
  'APPROVED_PENDING_PERSISTENCE',
  'REJECTED',
  'AMBIGUOUS',
  'FAILED_PRE_SEND',
  'COMPLETED'
);

CREATE TABLE "BillingArcaEmission" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "environment" "ArcaAccessEnvironment" NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'wsfe',
    "status" "BillingArcaEmissionStatus" NOT NULL,
    "issuerCuit" TEXT NOT NULL,
    "pointOfSale" INTEGER NOT NULL,
    "invoiceType" "BillingInvoiceType" NOT NULL,
    "voucherType" INTEGER NOT NULL,
    "voucherNumber" INTEGER,
    "fiscalRequestSnapshot" JSONB,
    "arcaResult" TEXT,
    "authorizationCode" TEXT,
    "authorizationExpiresAt" TIMESTAMP(3),
    "arcaProcessDate" TEXT,
    "reprocess" TEXT,
    "observations" JSONB,
    "errors" JSONB,
    "events" JSONB,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingArcaEmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingArcaEmission_idempotencyKey_key" ON "BillingArcaEmission"("idempotencyKey");
CREATE UNIQUE INDEX "BillingArcaEmission_invoiceId_key" ON "BillingArcaEmission"("invoiceId");
CREATE UNIQUE INDEX "BillingArcaEmission_voucher_key" ON "BillingArcaEmission"("environment", "pointOfSale", "voucherType", "voucherNumber");
CREATE INDEX "BillingArcaEmission_status_idx" ON "BillingArcaEmission"("status");
