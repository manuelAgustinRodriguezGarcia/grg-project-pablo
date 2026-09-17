-- Recibos X: clientId + allocations, drop payment proofs, receipt payment methods.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'BillingPaymentStatus' AND e.enumlabel = 'PARCIALMENTE_PAGA'
  ) THEN
    ALTER TYPE "BillingPaymentStatus" ADD VALUE 'PARCIALMENTE_PAGA';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingReceiptPaymentMethod') THEN
    CREATE TYPE "BillingReceiptPaymentMethod" AS ENUM (
      'EFECTIVO',
      'CHEQUE',
      'TRANSFERENCIA',
      'TARJETA',
      'OTROS'
    );
  END IF;
END $$;

ALTER TABLE "BillingReceipt" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

CREATE TABLE IF NOT EXISTS "BillingReceiptAllocation" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingReceiptAllocation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BillingReceipt'
      AND column_name = 'invoiceId'
  ) THEN
    UPDATE "BillingReceipt" AS receipt
    SET "clientId" = invoice."clientId"
    FROM "BillingInvoice" AS invoice
    WHERE receipt."invoiceId" = invoice.id
      AND receipt."clientId" IS NULL
      AND invoice."clientId" IS NOT NULL;

    INSERT INTO "BillingReceiptAllocation" ("id", "receiptId", "invoiceId", "amount", "createdAt")
    SELECT
      ('alloc_' || receipt.id),
      receipt.id,
      receipt."invoiceId",
      receipt.amount,
      receipt."createdAt"
    FROM "BillingReceipt" AS receipt
    WHERE receipt."invoiceId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "BillingReceiptAllocation" AS allocation
        WHERE allocation."receiptId" = receipt.id
          AND allocation."invoiceId" = receipt."invoiceId"
      );
  END IF;
END $$;

ALTER TABLE "BillingReceipt" ADD COLUMN IF NOT EXISTS "receiptPaymentMethod" "BillingReceiptPaymentMethod";

UPDATE "BillingReceipt"
SET "receiptPaymentMethod" = CASE "paymentMethod"::text
  WHEN 'TARJETA' THEN 'TARJETA'::"BillingReceiptPaymentMethod"
  WHEN 'TRANSFERENCIA' THEN 'TRANSFERENCIA'::"BillingReceiptPaymentMethod"
  WHEN 'OTROS' THEN 'OTROS'::"BillingReceiptPaymentMethod"
  ELSE 'EFECTIVO'::"BillingReceiptPaymentMethod"
END
WHERE "receiptPaymentMethod" IS NULL
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'BillingReceipt' AND column_name = 'paymentMethod'
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BillingReceipt' AND column_name = 'paymentMethod'
      AND udt_name = 'BillingPaymentMethod'
  ) THEN
    ALTER TABLE "BillingReceipt" DROP COLUMN "paymentMethod";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BillingReceipt' AND column_name = 'receiptPaymentMethod'
  ) THEN
    ALTER TABLE "BillingReceipt" RENAME COLUMN "receiptPaymentMethod" TO "paymentMethod";
  END IF;
END $$;

ALTER TABLE "BillingReceipt" ALTER COLUMN "paymentMethod" SET NOT NULL;

DELETE FROM "BillingReceipt" WHERE "clientId" IS NULL;

ALTER TABLE "BillingReceipt" ALTER COLUMN "clientId" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BillingReceipt' AND column_name = 'invoiceId'
  ) THEN
    ALTER TABLE "BillingReceipt" DROP COLUMN "invoiceId";
  END IF;
END $$;

ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofPath";
ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofOriginalName";
ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofMimeType";
ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofUploadedAt";
ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofUploadedById";
ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofEditedAt";
ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofEditedById";
ALTER TABLE "BillingInvoice" DROP COLUMN IF EXISTS "paymentProofEditCount";

