-- Notas de crédito/débito y estados fiscales de ajuste/anulación.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'BillingInvoiceFiscalStatus' AND e.enumlabel = 'AJUSTADA_NC'
  ) THEN
    ALTER TYPE "BillingInvoiceFiscalStatus" ADD VALUE 'AJUSTADA_NC';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'BillingInvoiceFiscalStatus' AND e.enumlabel = 'AJUSTADA_ND'
  ) THEN
    ALTER TYPE "BillingInvoiceFiscalStatus" ADD VALUE 'AJUSTADA_ND';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'BillingInvoiceFiscalStatus' AND e.enumlabel = 'ANULADA_NC'
  ) THEN
    ALTER TYPE "BillingInvoiceFiscalStatus" ADD VALUE 'ANULADA_NC';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingNoteKind') THEN
    CREATE TYPE "BillingNoteKind" AS ENUM ('CREDIT', 'DEBIT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BillingNote" (
  "id" TEXT NOT NULL,
  "kind" "BillingNoteKind" NOT NULL,
  "environment" "BillingFiscalEnvironment" NOT NULL DEFAULT 'MODO_PRUEBA',
  "invoiceType" "BillingInvoiceType" NOT NULL,
  "pointOfSale" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "noteNumber" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invoiceId" TEXT NOT NULL,
  "clientId" TEXT,
  "clientCode" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientIdentificationType" "BillingIdentificationType" NOT NULL,
  "clientIdentificationNumber" TEXT,
  "clientIvaCondition" "BillingIvaCondition" NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "ivaPercent" DECIMAL(5, 2) NOT NULL,
  "ivaAmount" DECIMAL(18, 2) NOT NULL,
  "netAmount" DECIMAL(18, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "pdfPath" TEXT,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingNote_noteNumber_key" ON "BillingNote"("noteNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingNote_kind_sequenceNumber_key" ON "BillingNote"("kind", "sequenceNumber");
CREATE INDEX IF NOT EXISTS "BillingNote_invoiceId_idx" ON "BillingNote"("invoiceId");
CREATE INDEX IF NOT EXISTS "BillingNote_issuedAt_idx" ON "BillingNote"("issuedAt");
CREATE INDEX IF NOT EXISTS "BillingNote_kind_idx" ON "BillingNote"("kind");
CREATE INDEX IF NOT EXISTS "BillingNote_clientId_idx" ON "BillingNote"("clientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BillingNote_invoiceId_fkey'
  ) THEN
    ALTER TABLE "BillingNote"
      ADD CONSTRAINT "BillingNote_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BillingNote_clientId_fkey'
  ) THEN
    ALTER TABLE "BillingNote"
      ADD CONSTRAINT "BillingNote_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "BillingClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BillingNote_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "BillingNote"
      ADD CONSTRAINT "BillingNote_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
