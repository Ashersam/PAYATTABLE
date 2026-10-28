import { db } from "../../db/index.js";

/**
 * Atomically claim a bill for a new payment attempt.
 *
 * Only ONE PENDING payment is allowed per bill because of:
 *
 * ux_payments_one_pending_per_bill
 *
 * Returns:
 *   {
 *     acquired: true,
 *     payment
 *   }
 *
 * or:
 *
 *   {
 *     acquired: false,
 *     payment
 *   }
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

    if (result.rows.length) {
      return {
        acquired: true,
        payment: result.rows[0],
      };
    }

    // Another checkout already owns the bill.
    const existing = await db.query(
      `
      SELECT
        id,
        bill_id,
        receipt_no,
        amount,
        tip,
        currency,
        status,
        provider,
        intent_id
      FROM public.payments
      WHERE bill_id = $1
        AND status = 'PENDING'
      ORDER BY id DESC
      LIMIT 1
      `,
      [billId]
    );

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
    SET intent_id = $1
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