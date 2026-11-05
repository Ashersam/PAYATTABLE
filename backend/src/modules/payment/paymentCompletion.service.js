
import { db } from "../../db/index.js";

import {
  doRaptorPayment,
  recallRaptorTable,
} from "../../services/raptor.service.js";

const SUCCESS_EVENT = "payment_intent.succeeded";

const FINAL_NON_SUCCESS_STATUSES = new Set([
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

const normaliseStatus = (status) =>
  String(status || "").toUpperCase();

const moneyToMinorUnits = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
};

async function insertProcessedEvent(client, event, intentId) {
  if (!event?.id) return;

  await client.query(
    `
    INSERT INTO public.payment_events
      (id, intent_id, event_type, payload)
    VALUES
      ($1, $2, $3, $4)
    ON CONFLICT (id) DO NOTHING
    `,
    [
      event.id,
      intentId,
      event.name,
      event,
    ]
  );
}

/**
 * Common success-completion process.
 *
 * Called by:
 * 1. Airwallex success webhook.
 * 2. Payment reconciliation worker.
 *
 * IMPORTANT:
 * payment.amount includes the tip.
 * Do not subtract payment.tip before sending
 * the amount to Raptor.
 */
export const completeSuccessfulPayment = async ({
  intent,
  event = null,
}) => {
  const intentId = String(intent?.id || "").trim();

  if (!intentId) {
    throw new Error("Missing Airwallex PaymentIntent ID.");
  }

  const providerStatus = normaliseStatus(intent?.status);

  // Webhook events must be success events.
  if (event && event.name !== SUCCESS_EVENT) {
    throw new Error("Invalid success webhook event.");
  }

  // Reconciliation must have independently retrieved
  // a confirmed SUCCEEDED intent.
  if (
    providerStatus &&
    providerStatus !== "SUCCEEDED"
  ) {
    throw new Error(
      `PaymentIntent ${intentId} is not successful: ${providerStatus}`
    );
  }

  if (!providerStatus && !event) {
    throw new Error(
      `Airwallex success status was not confirmed for ${intentId}.`
    );
  }

  const client = await db.connect();

  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    // --------------------------------------------------
    // 1. Find payment identity
    // --------------------------------------------------

    const identityResult = await client.query(
      `
      SELECT bill_id
      FROM public.payments
      WHERE intent_id = $1
      LIMIT 1
      `,
      [intentId]
    );

    if (!identityResult.rows.length) {
      throw new Error(
        `Payment not found for Airwallex intent ${intentId}.`
      );
    }

    const billId = identityResult.rows[0].bill_id;

    // --------------------------------------------------
    // 2. Lock bill first
    //
    // Keep the same bill -> payment locking order
    // used by the existing webhook logic.
    // --------------------------------------------------

    const billResult = await client.query(
      `
      SELECT *
      FROM public.bills
      WHERE id = $1
      FOR UPDATE
      `,
      [billId]
    );

    if (!billResult.rows.length) {
      throw new Error(`Bill not found: ${billId}`);
    }

    const bill = billResult.rows[0];

    // --------------------------------------------------
    // 3. Lock payment
    // --------------------------------------------------

    const paymentResult = await client.query(
      `
      SELECT *
      FROM public.payments
      WHERE intent_id = $1
      FOR UPDATE
      `,
      [intentId]
    );

    if (!paymentResult.rows.length) {
      throw new Error(
        `Payment disappeared for intent ${intentId}.`
      );
    }

    const payment = paymentResult.rows[0];

    if (
      payment.provider &&
      normaliseStatus(payment.provider) !== "AIRWALLEX"
    ) {
      throw new Error(
        `Unexpected payment provider for intent ${intentId}.`
      );
    }

    // --------------------------------------------------
    // 4. Validate amount and currency
    //
    // Both amounts include the tip.
    // --------------------------------------------------

    const providerAmount = moneyToMinorUnits(
      intent.amount
    );

    const storedAmount = moneyToMinorUnits(
      payment.amount
    );

    if (
      providerAmount === null ||
      storedAmount === null ||
      providerAmount !== storedAmount
    ) {
      throw new Error(
        `Payment amount mismatch for ${intentId}. ` +
        `Airwallex: ${intent.amount}, Database: ${payment.amount}`
      );
    }

    if (
      payment.currency &&
      intent.currency &&
      normaliseStatus(payment.currency) !==
        normaliseStatus(intent.currency)
    ) {
      throw new Error(
        `Payment currency mismatch for ${intentId}.`
      );
    }

    // --------------------------------------------------
    // 5. Duplicate webhook protection
    // --------------------------------------------------

    if (event?.id) {
      const existingEvent = await client.query(
        `
        SELECT 1
        FROM public.payment_events
        WHERE id = $1
        LIMIT 1
        `,
        [event.id]
      );

      if (existingEvent.rows.length) {
        await client.query("COMMIT");
        transactionOpen = false;

        console.log(
          "Duplicate Airwallex event ignored:",
          event.id
        );

        return {
          success: true,
          duplicate: true,
        };
      }
    }

    // --------------------------------------------------
    // 6. Payment already completed
    // --------------------------------------------------

    if (normaliseStatus(payment.status) === "PAID") {
      await insertProcessedEvent(
        client,
        event,
        intentId
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return {
        success: true,
        alreadyPaid: true,
      };
    }

    // --------------------------------------------------
    // 7. Check whether another intent paid this bill
    // --------------------------------------------------

    const anotherPaidPayment = await client.query(
      `
      SELECT intent_id
      FROM public.payments
      WHERE bill_id = $1
        AND id <> $2
        AND status = 'PAID'
      LIMIT 1
      `,
      [
        payment.bill_id,
        payment.id,
      ]
    );

    if (
      anotherPaidPayment.rows.length ||
      normaliseStatus(bill.status) === "PAID"
    ) {
      console.error(
        "MANUAL RECONCILIATION REQUIRED: " +
        "Airwallex succeeded, but another payment " +
        "already paid this bill.",
        {
          intentId,
          billId: payment.bill_id,
          otherPaidIntent:
            anotherPaidPayment.rows[0]?.intent_id || null,
        }
      );

      // A webhook can be acknowledged to prevent repeated
      // delivery, but the payment must not be posted again.
      await insertProcessedEvent(
        client,
        event,
        intentId
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return {
        success: false,
        manualReview: true,
      };
    }

    // --------------------------------------------------
    // 8. Validate Raptor identifiers
    // --------------------------------------------------

    if (
      !bill.outletuuid ||
      bill.table_id == null ||
      bill.salesno == null
    ) {
      throw new Error(
        `Missing Raptor identifiers for bill ${billId}.`
      );
    }

    // --------------------------------------------------
    // 9. Recall previously held table if necessary
    // --------------------------------------------------

    if (
      FINAL_NON_SUCCESS_STATUSES.has(
        normaliseStatus(payment.status)
      )
    ) {
      await recallRaptorTable({
        outletUuid: bill.outletuuid,
        tableNo: bill.table_id,
        salesNo: bill.salesno,
        splitNo: bill.splitno ?? 0,
      });
    }

    // --------------------------------------------------
    // 10. Submit payment to Raptor POS
    //
    // payment.amount = bill balance + tip
    //
    // Example:
    // Balance: 179.85
    // Tip:       4.50
    // Amount:  184.35
    //
    // Raptor automatically allocates the excess to tip.
    // --------------------------------------------------

    const paidAmount = Number(payment.amount);

    console.log(
      "Submitting successful Airwallex payment to Raptor:",
      {
        intentId,
        receiptNo: payment.receipt_no,
        balanceAndTipAmount: paidAmount,
        tipAmount: Number(payment.tip || 0),
      }
    );

    const raptorResult = await doRaptorPayment({
      outletUuid: bill.outletuuid,
      tableNo: bill.table_id,
      salesNo: bill.salesno,
      splitNo: bill.splitno ?? 0,
      paymentType: 10,

      // IMPORTANT: Send full amount, including tip.
      paidAmount,

      customerId: "",

      // Must be enforced by Raptor for safe retries.
      idempotencyKey: `airwallex-${intentId}`,
    });

    if (raptorResult?.success !== true) {
      throw new Error(
        `Raptor did not confirm payment for ${intentId}.`
      );
    }

    console.log(
      "Raptor payment completed:",
      intentId
    );

    // --------------------------------------------------
    // 11. Update payment status
    // --------------------------------------------------

    const updatePaymentResult = await client.query(
      `
      UPDATE public.payments
      SET status = 'PAID',
          payment_method = 'QR',
          payment_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND intent_id = $2
        AND status <> 'PAID'
      RETURNING id
      `,
      [
        payment.id,
        intentId,
      ]
    );

    if (!updatePaymentResult.rows.length) {
      throw new Error(
        `Could not update payment ${intentId} to PAID.`
      );
    }

    // --------------------------------------------------
    // 12. Expire other pending payment attempts
    // --------------------------------------------------

    await client.query(
      `
      UPDATE public.payments
      SET status = 'EXPIRED',
          updated_at = NOW()
      WHERE bill_id = $1
        AND intent_id <> $2
        AND status = 'PENDING'
      `,
      [
        payment.bill_id,
        intentId,
      ]
    );

    // --------------------------------------------------
    // 13. Mark bill PAID
    // --------------------------------------------------

    const updateBillResult = await client.query(
      `
      UPDATE public.bills
      SET status = 'PAID'
      WHERE id = $1
        AND outletuuid = $2
      RETURNING id
      `,
      [
        payment.bill_id,
        bill.outletuuid,
      ]
    );

    if (!updateBillResult.rows.length) {
      throw new Error(
        `Could not mark bill ${billId} as PAID.`
      );
    }

    // --------------------------------------------------
    // 14. Record webhook event
    // --------------------------------------------------

    await insertProcessedEvent(
      client,
      event,
      intentId
    );

    // --------------------------------------------------
    // 15. Commit transaction
    // --------------------------------------------------

    await client.query("COMMIT");
    transactionOpen = false;

    console.log(
      "Payment completed successfully:",
      intentId
    );

    return {
      success: true,
      intentId,
      paymentId: payment.id,
      receiptNo: payment.receipt_no,
    };

  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(
        (rollbackError) => {
          console.error(
            "Payment completion rollback failed:",
            rollbackError.message
          );
        }
      );
    }

    throw error;

  } finally {
    client.release();
  }
};
