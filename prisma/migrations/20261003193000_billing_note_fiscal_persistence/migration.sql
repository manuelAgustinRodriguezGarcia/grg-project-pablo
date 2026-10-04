-- Persistencia fiscal de BillingNote y vínculo opcional en BillingArcaEmission.
-- No reescribe noteNumber ni sequenceNumber. No borra notas, facturas ni emisiones.

CREATE TYPE "BillingNoteFiscalStatus" AS ENUM ('INTERNA', 'AUTORIZADA');

DROP INDEX "BillingNote_kind_sequenceNumber_key";

DROP INDEX "BillingNote_noteNumber_key";

ALTER TABLE "BillingArcaEmission" ADD COLUMN "noteId" TEXT;

ALTER TABLE "BillingNote" ADD COLUMN "cae" TEXT,
ADD COLUMN "caeExpiresAt" TIMESTAMP(3),
ADD COLUMN "fiscalStatus" "BillingNoteFiscalStatus" NOT NULL DEFAULT 'INTERNA',
ADD COLUMN "qrUrl" TEXT,
ADD COLUMN "voucherType" INTEGER;

CREATE UNIQUE INDEX "BillingArcaEmission_noteId_key" ON "BillingArcaEmission"("noteId");

CREATE UNIQUE INDEX "BillingNote_series_key" ON "BillingNote"("environment", "pointOfSale", "kind", "invoiceType", "sequenceNumber");

ALTER TABLE "BillingArcaEmission" ADD CONSTRAINT "BillingArcaEmission_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "BillingNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingArcaEmission" ADD CONSTRAINT "BillingArcaEmission_single_document" CHECK ("invoiceId" IS NULL OR "noteId" IS NULL);
