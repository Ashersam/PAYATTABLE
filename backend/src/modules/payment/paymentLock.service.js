import { db } from "../../db/index.js";

/**
 * Atomically claim a bill for a new payment attempt.
 *
 * Only ONE PENDING payment is allowed per bill because of:
 * ux_payments_one_pending_per_bill
 *
 * Returns:
 * {
 *   acquired: true,
 *   payment
 * }
 *
 * or:
 *
 * {
 *   acquired: false,
 *   payment
 * }
 */
export const claimPayment = async ({
  billId,
  receiptNo,
  amount,
  tip,
  currency,
  provider = "AIRWALLEX",
}) => {
  try {
    // --------------------------------------------------
    // 1. Try to create a new payment claim.
    // --------------------------------------------------

    const result = await db.query(
      `
      INSERT INTO public.payments
      (
        bill_id,
        receipt_no,
        amount,
        tip,
        currency,
        status,
        provider
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
      ON CONFLICT DO NOTHING
      RETURNING *
      `,
      [
        billId,
        receiptNo,
        amount,
        tip,
        currency,
        provider,
      ]
    );

    // Successfully acquired the checkout.
    if (result.rows.length) {
      return {
        acquired: true,
        payment: result.rows[0],
      };
    }

    // --------------------------------------------------
    // 2. Another checkout already owns this bill.
    //
    // Retrieve its outlet-specific timeout settings
    // and calculate when the next reconciliation check
    // becomes eligible.
    // --------------------------------------------------

    const existing = await db.query(
      `
      WITH pending AS (
        SELECT
          p.*,

          CASE
            WHEN p.intent_id IS NULL THEN 'CLAIM'
            ELSE 'CHECKOUT'
          END AS timeout_type,

          CASE
            WHEN p.intent_id IS NULL
              THEN COALESCE(
                oc.payment_claim_timeout_minutes,
                5
              )
            ELSE COALESCE(
              oc.payment_checkout_timeout_minutes,
              30
            )
          END AS timeout_minutes,

          COALESCE(
            oc.payment_reconciliation_retry_minutes,
            5
          ) AS retry_minutes,

          CASE
            WHEN p.intent_id IS NULL
              THEN COALESCE(
                p.updated_at,
                p.created_at
              )
            ELSE COALESCE(
              p.checkout_started_at,
              p.created_at
            )
          END AS timer_started_at

        FROM public.payments p

        JOIN public.bills b
          ON b.id = p.bill_id

        LEFT JOIN public.outlet_config oc
          ON oc.outletuuid = b.outletuuid

        WHERE p.bill_id = $1
          AND p.status = 'PENDING'

        ORDER BY p.id DESC
        LIMIT 1
      ),

      timed AS (
        SELECT
          *,
          timer_started_at
            + make_interval(
                mins => timeout_minutes
              ) AS timeout_at

        FROM pending
      ),

      scheduled AS (
        SELECT
          *,

          GREATEST(
            timeout_at,

            COALESCE(
              last_reconciled_at
                + make_interval(
                    mins => retry_minutes
                  ),

              timeout_at
            )

          ) AS next_check_at

        FROM timed
      )

      SELECT
        id,
        bill_id,
        receipt_no,
        amount,
        tip,
        currency,
        status,
        provider,
        intent_id,

        timeout_type,
        timeout_minutes,
        retry_minutes,

        timeout_at,
        next_check_at,

        GREATEST(
          0,
          CEIL(
            EXTRACT(
              EPOCH FROM (
                next_check_at - NOW()
              )
            )
          )::INTEGER
        ) AS remaining_seconds

      FROM scheduled
      `,
      [billId]
    );

    // --------------------------------------------------
    // 3. Return existing payment and countdown details.
    // --------------------------------------------------

    return {
      acquired: false,
      payment: existing.rows[0] || null,
    };

  } catch (err) {
    console.error("Payment claim failed:", {
      message: err.message,
      code: err.code,
      detail: err.detail,
    });

    throw err;
  }
};


/**
 * Attach the Airwallex PaymentIntent to our already-created
 * local payment attempt.
 */
export const attachPaymentIntent = async ({
    paymentId,
    intentId,
  }) => {
    const result = await db.query(
      `
      UPDATE public.payments
      SET intent_id = $1,
          checkout_started_at = NOW(),
          last_reconciled_at = NULL,
          reconciliation_attempts = 0,
          updated_at = NOW()
      WHERE id = $2
        AND status = 'PENDING'
        AND intent_id IS NULL
      RETURNING *
      `,
      [intentId, paymentId]
    );
  
    if (!result.rows.length) {
      throw new Error(
        `Unable to attach Airwallex intent to payment ${paymentId}`
      );
    }
  
    return result.rows[0];
  };

/**
 * Release a payment claim when PaymentIntent creation fails
 * before the customer has been sent to the gateway.
 *
 * We keep the payment row for audit/history instead of deleting it.
 */
export const failPaymentClaim = async ({
  paymentId,
  status = "FAILED",
}) => {
  const result = await db.query(
    `
    UPDATE public.payments
    SET status = $1
    WHERE id = $2
      AND status = 'PENDING'
      AND intent_id IS NULL
    RETURNING *
    `,
    [status, paymentId]
  );

  return result.rows[0] || null;
};