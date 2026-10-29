-- =========================================================
-- 1. Configurable payment recovery settings per outlet
-- =========================================================

ALTER TABLE public.outlet_config
ADD COLUMN IF NOT EXISTS payment_claim_timeout_minutes
    INTEGER NOT NULL DEFAULT 5
    CHECK (payment_claim_timeout_minutes BETWEEN 1 AND 1440);

ALTER TABLE public.outlet_config
ADD COLUMN IF NOT EXISTS payment_checkout_timeout_minutes
    INTEGER NOT NULL DEFAULT 30
    CHECK (payment_checkout_timeout_minutes BETWEEN 1 AND 1440);

ALTER TABLE public.outlet_config
ADD COLUMN IF NOT EXISTS payment_reconciliation_interval_seconds
    INTEGER NOT NULL DEFAULT 60
    CHECK (payment_reconciliation_interval_seconds BETWEEN 10 AND 3600);

ALTER TABLE public.outlet_config
ADD COLUMN IF NOT EXISTS payment_reconciliation_retry_minutes
    INTEGER NOT NULL DEFAULT 5
    CHECK (payment_reconciliation_retry_minutes BETWEEN 1 AND 1440);


-- =========================================================
-- 2. Track payment recovery state
-- =========================================================

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMPTZ;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS reconciliation_attempts
    INTEGER NOT NULL DEFAULT 0;


-- Existing pending intents use their original creation time
-- as a fallback, so old records can also be reconciled.

UPDATE public.payments
SET checkout_started_at = created_at
WHERE intent_id IS NOT NULL
  AND checkout_started_at IS NULL;


-- =========================================================
-- 3. Index pending payments for recovery scans
-- =========================================================

CREATE INDEX IF NOT EXISTS ix_payments_pending_created_at
ON public.payments (created_at)
WHERE status = 'PENDING';