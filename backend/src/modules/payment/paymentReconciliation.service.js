import { db } from "../../db/index.js";

import {
  retrievePaymentIntent,
  cancelAirwallexPaymentIntent,
} from "./payment.service.js";

import {
  holdRaptorTable,
} from "../../services/raptor.service.js";

const DEFAULT_CLAIM_TIMEOUT_MINUTES = 5;
const DEFAULT_CHECKOUT_TIMEOUT_MINUTES = 30;
const DEFAULT_RETRY_MINUTES = 5;
const DEFAULT_INTERVAL_SECONDS = 60;

const BATCH_SIZE = 50;

// Prevent two backend instances from processing the same
// reconciliation batch at the same time.
const ADVISORY_LOCK = [524928, 1];

const CANCELLABLE_STATUSES = new Set([
  "REQUIRES_PAYMENT_METHOD",
  "REQUIRES_CUSTOMER_ACTION",
  "REQUIRES_CAPTURE",
]);

let reconciliationRunning = false;
let schedulerStarted = false;
let reconciliationTimer = null;

const normaliseStatus = (status) =>
  String(status || "").toUpperCase();

async function getReconciliationIntervalMs() {
  const result = await db.query(`
    SELECT COALESCE(
      MIN(payment_reconciliation_interval_seconds),
      ${DEFAULT_INTERVAL_SECONDS}
    ) AS interval_seconds
    FROM public.outlet_config
    WHERE payment_reconciliation_interval_seconds
      BETWEEN 10 AND 3600
  `);

  return Number(result.rows[0].interval_seconds) * 1000;
}

async function restoreRaptorTable(bill) {
  if (
    !bill?.outletuuid ||
    bill.table_id == null ||
    bill.salesno == null
  ) {
    throw new Error(
      `Missing Raptor identifiers for bill ${bill?.id ?? "unknown"}`
    );
  }

  await holdRaptorTable({
    outletUuid: bill.outletuuid,
    tableNo: bill.table_id,
    salesNo: bill.salesno,
    splitNo: bill.splitno ?? 0,
  });
}

/**
 * A claim was created, but no Airwallex intent was attached.
 * If it is stale, restore the table and release the claim.
 */
async function failStaleClaimWithoutIntent(paymentId) {
  const client = await db.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const identity = await client.query(
      `
      SELECT bill_id
      FROM public.payments
      WHERE id = $1
      `,
      [paymentId]
    );

    if (!identity.rows.length) {
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }

    // Lock in the same bill-then-payment order used by webhooks.
    const billResult = await client.query(
      `
      SELECT *
      FROM public.bills
      WHERE id = $1
      FOR UPDATE
      `,
      [identity.rows[0].bill_id]
    );

    const paymentResult = await client.query(
      `
      SELECT *
      FROM public.payments
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentId]
    );

    const payment = paymentResult.rows[0];
    const bill = billResult.rows[0];

    if (
      !payment ||
      normaliseStatus(payment.status) !== "PENDING" ||
      payment.intent_id
    ) {
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }

    if (!bill) {
      throw new Error(
        `Bill not found for stale payment ${paymentId}`
      );
    }

    const anotherPaidPayment = await client.query(
      `
      SELECT 1
      FROM public.payments
      WHERE bill_id = $1
        AND id <> $2
        AND status = 'PAID'
      LIMIT 1
      `,
      [payment.bill_id, payment.id]
    );

    const alreadyPaid =
      normaliseStatus(bill.status) === "PAID" ||
      anotherPaidPayment.rows.length > 0;

    if (!alreadyPaid) {
      // Restore Raptor before releasing the pending claim.
      await restoreRaptorTable(bill);
    }

    await client.query(
      `
      UPDATE public.payments
      SET status = 'FAILED',
          updated_at = NOW()
      WHERE id = $1
        AND status = 'PENDING'
        AND intent_id IS NULL
      `,
      [payment.id]
    );

    await client.query("COMMIT");
    transactionOpen = false;

    console.warn(
      "Stale payment claim released:",
      payment.id
    );
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Finalise a payment only after Airwallex confirms cancellation.
 * The cancellation webhook and this worker may race; row locks
 * and status checks prevent the same payment being finalised twice.
 */
async function finaliseConfirmedCancellation(
  paymentId,
  intentId
) {
  const client = await db.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const identity = await client.query(
      `
      SELECT bill_id
      FROM public.payments
      WHERE id = $1
      `,
      [paymentId]
    );

    if (!identity.rows.length) {
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }

    const billResult = await client.query(
      `
      SELECT *
      FROM public.bills
      WHERE id = $1
      FOR UPDATE
      `,
      [identity.rows[0].bill_id]
    );

    const paymentResult = await client.query(
      `
      SELECT *
      FROM public.payments
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentId]
    );

    const payment = paymentResult.rows[0];
    const bill = billResult.rows[0];

    if (
      !payment ||
      payment.intent_id !== intentId ||
      normaliseStatus(payment.status) !== "PENDING"
    ) {
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }

    if (!bill) {
      throw new Error(
        `Bill not found for payment ${paymentId}`
      );
    }

    const anotherPaidPayment = await client.query(
      `
      SELECT 1
      FROM public.payments
      WHERE bill_id = $1
        AND id <> $2
        AND status = 'PAID'
      LIMIT 1
      `,
      [payment.bill_id, payment.id]
    );

    const alreadyPaid =
      normaliseStatus(bill.status) === "PAID" ||
      anotherPaidPayment.rows.length > 0;

    if (!alreadyPaid) {
      await restoreRaptorTable(bill);
    }

    // Release the unique PENDING claim only after cancellation
    // and required Raptor restoration have succeeded.
    await client.query(
      `
      UPDATE public.payments
      SET status = 'CANCELLED',
          updated_at = NOW()
      WHERE id = $1
        AND intent_id = $2
        AND status = 'PENDING'
      `,
      [payment.id, intentId]
    );

    await client.query("COMMIT");
    transactionOpen = false;

    console.log(
      "Abandoned checkout finalised as CANCELLED:",
      intentId
    );
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

async function reconcileAttachedIntent(payment) {
  let intent = await retrievePaymentIntent(payment.intent_id);
  let providerStatus = normaliseStatus(intent?.status);

  // A successful intent must never be cancelled or released
  // as an abandoned checkout. It needs success reconciliation.
  if (providerStatus === "SUCCEEDED") {
    console.error(
      "URGENT: Airwallex succeeded but local payment is PENDING. " +
      "Keep the claim and reconcile payment success.",
      payment.intent_id
    );
    return;
  }

  if (providerStatus === "CANCELLED") {
    await finaliseConfirmedCancellation(
      payment.id,
      payment.intent_id
    );
    return;
  }

  // PENDING and PENDING_REVIEW are not automatically cancelled.
  if (!CANCELLABLE_STATUSES.has(providerStatus)) {
    console.warn(
      "Keeping stale payment claim; Airwallex status is not cancellable:",
      {
        intentId: payment.intent_id,
        providerStatus,
      }
    );
    return;
  }

  try {
    await cancelAirwallexPaymentIntent(payment.intent_id);
  } catch (cancelError) {
    // The cancellation request may have timed out after Airwallex
    // already processed it. Retrieve the status before retrying.
    try {
      intent = await retrievePaymentIntent(payment.intent_id);
      providerStatus = normaliseStatus(intent?.status);
    } catch {
      throw cancelError;
    }

    if (providerStatus === "CANCELLED") {
      await finaliseConfirmedCancellation(
        payment.id,
        payment.intent_id
      );
      return;
    }

    if (providerStatus === "SUCCEEDED") {
      console.error(
        "Intent succeeded while cancellation was attempted. Claim retained:",
        payment.intent_id
      );
      return;
    }

    throw cancelError;
  }

  // Confirm the remote status instead of assuming that the
  // cancellation API response means the intent is already closed.
  intent = await retrievePaymentIntent(payment.intent_id);
  providerStatus = normaliseStatus(intent?.status);

  if (providerStatus === "CANCELLED") {
    await finaliseConfirmedCancellation(
      payment.id,
      payment.intent_id
    );
    return;
  }

  if (providerStatus === "SUCCEEDED") {
    console.error(
      "Intent succeeded while recovery was running. Claim retained:",
      payment.intent_id
    );
    return;
  }

  console.warn(
    "Cancellation is not confirmed; payment remains pending:",
    {
      intentId: payment.intent_id,
      providerStatus,
    }
  );
}

/**
 * Find and process stale pending payment records.
 */
export async function reconcileAbandonedPayments() {
  if (reconciliationRunning) return;

  reconciliationRunning = true;

  let lockClient;
  let lockAcquired = false;

  try {
    lockClient = await db.connect();

    const lockResult = await lockClient.query(
      "SELECT pg_try_advisory_lock($1, $2) AS acquired",
      ADVISORY_LOCK
    );

    lockAcquired =
      lockResult.rows[0]?.acquired === true;

    if (!lockAcquired) return;

    const staleResult = await db.query(
      `
      SELECT
        p.id,
        p.bill_id,
        p.intent_id,
        p.created_at,
        p.checkout_started_at
      FROM public.payments p
      JOIN public.bills b
        ON b.id = p.bill_id
      LEFT JOIN public.outlet_config oc
        ON oc.outletuuid = b.outletuuid
      WHERE p.status = 'PENDING'
        AND (
          p.last_reconciled_at IS NULL
          OR p.last_reconciled_at <= NOW()
             - (
                 COALESCE(
                   oc.payment_reconciliation_retry_minutes,
                   $3
                 ) * INTERVAL '1 minute'
               )
        )
        AND (
          (
            p.intent_id IS NULL
            AND COALESCE(p.updated_at, p.created_at) <= NOW()
                - (
                    COALESCE(
                      oc.payment_claim_timeout_minutes,
                      $1
                    ) * INTERVAL '1 minute'
                  )
          )
          OR
          (
            p.intent_id IS NOT NULL
            AND COALESCE(
                  p.checkout_started_at,
                  p.created_at
                ) <= NOW()
                - (
                    COALESCE(
                      oc.payment_checkout_timeout_minutes,
                      $2
                    ) * INTERVAL '1 minute'
                  )
          )
        )
      ORDER BY COALESCE(
        p.checkout_started_at,
        p.created_at
      ) ASC
      LIMIT $4
      `,
      [
        DEFAULT_CLAIM_TIMEOUT_MINUTES,
        DEFAULT_CHECKOUT_TIMEOUT_MINUTES,
        DEFAULT_RETRY_MINUTES,
        BATCH_SIZE,
      ]
    );

    for (const payment of staleResult.rows) {
      try {
        // Mark attempt and throttle repeated failures.
        const marked = await db.query(
          `
          UPDATE public.payments
          SET last_reconciled_at = NOW(),
              reconciliation_attempts =
                reconciliation_attempts + 1
          WHERE id = $1
            AND status = 'PENDING'
          RETURNING id
          `,
          [payment.id]
        );

        if (!marked.rows.length) continue;

        if (!payment.intent_id) {
          await failStaleClaimWithoutIntent(payment.id);
        } else {
          await reconcileAttachedIntent(payment);
        }
      } catch (error) {
        console.error(
          "Abandoned checkout reconciliation failed:",
          {
            paymentId: payment.id,
            intentId: payment.intent_id,
            message: error.message,
            airwallexError: error.response?.data,
          }
        );
      }
    }
  } catch (error) {
    console.error(
      "Payment reconciliation job failed:",
      error.message
    );
  } finally {
    if (lockClient) {
      if (lockAcquired) {
        await lockClient.query(
          "SELECT pg_advisory_unlock($1, $2)",
          ADVISORY_LOCK
        ).catch((error) => {
          console.error(
            "Failed to release reconciliation lock:",
            error.message
          );
        });
      }

      lockClient.release();
    }

    reconciliationRunning = false;
  }
}

async function scheduleNextRun() {
  await reconcileAbandonedPayments();

  let intervalMs = DEFAULT_INTERVAL_SECONDS * 1000;

  try {
    intervalMs = await getReconciliationIntervalMs();
  } catch (error) {
    console.error(
      "Could not load outlet reconciliation interval; using fallback:",
      error.message
    );
  }

  reconciliationTimer = setTimeout(() => {
    void scheduleNextRun();
  }, intervalMs);

  reconciliationTimer.unref?.();
}

export function startPaymentReconciliation() {
  if (schedulerStarted) return;

  schedulerStarted = true;

  console.log(
    "Starting outlet-config-driven payment reconciliation."
  );

  void scheduleNextRun();
}