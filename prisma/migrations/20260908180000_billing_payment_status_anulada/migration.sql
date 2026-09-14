-- Estado de pago para facturas anuladas por nota de crédito.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'BillingPaymentStatus' AND e.enumlabel = 'ANULADA'
  ) THEN
    ALTER TYPE "BillingPaymentStatus" ADD VALUE 'ANULADA';
  END IF;
END $$;
