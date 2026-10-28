-- ============================================================
-- Payment Concurrency Protection
-- ============================================================
--
-- Purpose:
--   1. Allow only one PENDING payment attempt per bill.
--   2. Prevent duplicate Airwallex intent IDs.
--
-- Important:
--   Existing PENDING duplicates must be cleaned before this
--   migration is executed.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Prevent multiple active payment attempts for one bill
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_payments_one_pending_per_bill
ON public.payments (bill_id)
WHERE status = 'PENDING';


-- ------------------------------------------------------------
-- 2. Prevent the same Airwallex intent from being stored
--    against multiple payment records
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_payments_unique_intent_id
ON public.payments (intent_id)
WHERE intent_id IS NOT NULL;