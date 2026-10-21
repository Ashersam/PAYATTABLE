import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "../../db/index.js";

import {
    doRaptorPayment,
    recallRaptorTable,
    holdRaptorTable,
} from "../../services/raptor.service.js";

const SUPPORTED_EVENTS = new Set([
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.cancelled",
    "payment_intent.canceled",
]);

const SUCCESS_EVENT = "payment_intent.succeeded";

const FAILED_EVENT = "payment_intent.payment_failed";

const CANCELLED_EVENTS = new Set([
    "payment_intent.cancelled",
    "payment_intent.canceled",
]);

const FINAL_NON_SUCCESS_STATUSES = new Set([
    "FAILED",
    "CANCELLED",
    "EXPIRED",
]);

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Convert a monetary value into minor units to avoid
 * floating-point comparison problems.
 *
 * Example:
 * 76.74 -> 7674
 */
function moneyToMinorUnits(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return null;
    }

    return Math.round(amount * 100);
}

/**
 * Verify that the webhook came from Airwallex.
 *
 * IMPORTANT:
 * server.js must apply express.raw() to the webhook route
 * before express.json().
 */
function verifyWebhookSignature(req) {
    const secret = process.env.AIRWALLEX_WEBHOOK_SECRET;

    if (!secret) {
        throw new Error(
            "AIRWALLEX_WEBHOOK_SECRET is not configured."
        );
    }

    if (!Buffer.isBuffer(req.body)) {
        console.error(
            "Webhook body is not a raw Buffer. Check server.js middleware order."
        );

        return false;
    }

    const timestamp = req.get("x-timestamp");
    const signature = req.get("x-signature");

    if (!timestamp || !signature) {
        console.error(
            "Airwallex webhook is missing x-timestamp or x-signature."
        );

        return false;
    }

    const timestampNumber = Number(timestamp);

    if (!Number.isFinite(timestampNumber)) {
        return false;
    }

    // Reject old or excessively future-dated webhook requests.
    if (
        Math.abs(Date.now() - timestampNumber) >
        SIGNATURE_TOLERANCE_MS
    ) {
        console.error("Airwallex webhook timestamp is outside tolerance.");

        return false;
    }

    // Airwallex signs the exact timestamp + original raw request body.
    const expectedSignature = createHmac("sha256", secret)
        .update(timestamp, "utf8")
        .update(req.body)
        .digest("hex");

    const suppliedSignature = signature.trim().toLowerCase();

    // Prevent malformed hex and mismatched-length comparisons.
    if (!/^[a-f0-9]{64}$/.test(suppliedSignature)) {
        return false;
    }

    const expectedBuffer = Buffer.from(
        expectedSignature,
        "hex"
    );

    const suppliedBuffer = Buffer.from(
        suppliedSignature,
        "hex"
    );

    if (expectedBuffer.length !== suppliedBuffer.length) {
        return false;
    }

    return timingSafeEqual(
        expectedBuffer,
        suppliedBuffer
    );
}

/**
 * Save the event only after its business processing succeeds.
 *
 * The primary/unique constraint on payment_events.id should
 * remain in place for ON CONFLICT to work.
 */
async function insertProcessedEvent(
    client,
    event,
    intentId
) {
    await client.query(
        `
        INSERT INTO payment_events
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
 * Handle failed or cancelled Airwallex payment intents.
 */
async function handleFailedOrCancelled({
    client,
    event,
    intentId,
    payment,
    bill,
}) {
    const targetStatus =
        event.name === FAILED_EVENT
            ? "FAILED"
            : "CANCELLED";

    // Never hold a bill that has already been paid.
    const alreadyPaid = await client.query(
        `
        SELECT 1
        FROM payments
        WHERE bill_id = $1
          AND status = 'PAID'
        LIMIT 1
        `,
        [payment.bill_id]
    );

    if (
        payment.status === "PAID" ||
        bill.status === "PAID" ||
        alreadyPaid.rows.length > 0
    ) {
        await insertProcessedEvent(
            client,
            event,
            intentId
        );

        return;
    }

    // This failure/cancellation was already handled.
    if (
        FINAL_NON_SUCCESS_STATUSES.has(
            String(payment.status).toUpperCase()
        )
    ) {
        await insertProcessedEvent(
            client,
            event,
            intentId
        );

        return;
    }

    /*
     * Return the table to Raptor's held state only after
     * validating the outlet/table/sales identifiers.
     *
     * If Raptor rejects the request, an exception should
     * propagate so this webhook can be retried.
     */
    if (
        !bill.outletuuid ||
        bill.table_id == null ||
        bill.salesno == null
    ) {
        throw new Error(
            `Missing Raptor bill identifiers for bill ${payment.bill_id}.`
        );
    }

    await holdRaptorTable({
        outletUuid: bill.outletuuid,
        tableNo: bill.table_id,
        salesNo: bill.salesno,
        splitNo: bill.splitno ?? 0,
    });

    // Change status only after the Raptor operation succeeds.
    await client.query(
        `
        UPDATE payments
        SET status = $1,
            updated_at = NOW()
        WHERE id = $2
          AND status <> 'PAID'
        `,
        [
            targetStatus,
            payment.id,
        ]
    );

    await insertProcessedEvent(
        client,
        event,
        intentId
    );
}

/**
 * Main Airwallex webhook handler.
 */
export const handlePaymentSuccess = async (req, res) => {
    let client;
    let transactionOpen = false;

    try {
        console.log("Airwallex webhook received.");

        // --------------------------------------------------
        // 1. Verify the Airwallex signature
        // --------------------------------------------------

        const signatureValid = verifyWebhookSignature(req);

        if (!signatureValid) {
            console.error(
                "Airwallex webhook signature verification failed."
            );

            return res.status(400).send(
                "Invalid webhook signature"
            );
        }

        // Do not parse JSON until signature verification succeeds.
        const event = JSON.parse(
            req.body.toString("utf8")
        );

        if (!event?.id || !event?.name) {
            return res.status(400).send(
                "Invalid webhook event"
            );
        }

        // Acknowledge event types this handler does not process.
        if (!SUPPORTED_EVENTS.has(event.name)) {
            console.log(
                `Ignoring unsupported Airwallex event: ${event.name}`
            );

            return res.sendStatus(200);
        }

        const intent = event.data?.object;
        const intentId = intent?.id;

        if (!intentId) {
            return res.status(400).send(
                "Missing PaymentIntent ID"
            );
        }

        const isSuccessEvent =
            event.name === SUCCESS_EVENT;

        // --------------------------------------------------
        // 2. Find the local payment
        // --------------------------------------------------

        const paymentLookup = await db.query(
            `
            SELECT *
            FROM payments
            WHERE intent_id = $1
            LIMIT 1
            `,
            [intentId]
        );

        if (!paymentLookup.rows.length) {
            // Do not record the event yet. Allow retry after
            // the local payment record becomes available.
            console.error(
                "Payment not found for Airwallex intent:",
                intentId
            );

            return res.status(500).send(
                "Payment record not found"
            );
        }

        const initialPayment = paymentLookup.rows[0];

        // --------------------------------------------------
        // 3. Validate amount and currency for successful events
        // --------------------------------------------------

        if (isSuccessEvent) {
            if (
                intent.status &&
                String(intent.status).toUpperCase() !== "SUCCEEDED"
            ) {
                console.error(
                    "Succeeded event contains an unexpected intent status:",
                    intent.status
                );

                return res.status(500).send(
                    "PaymentIntent is not confirmed as succeeded"
                );
            }

            const providerAmount = moneyToMinorUnits(
                intent.amount
            );

            const storedAmount = moneyToMinorUnits(
                initialPayment.amount
            );

            if (
                providerAmount === null ||
                storedAmount === null ||
                providerAmount !== storedAmount
            ) {
                console.error(
                    "Airwallex payment amount mismatch.",
                    {
                        intentId,
                        providerAmount: intent.amount,
                        expectedAmount: initialPayment.amount,
                    }
                );

                return res.status(400).send(
                    "Payment amount mismatch"
                );
            }

            if (
                initialPayment.currency &&
                intent.currency &&
                String(initialPayment.currency).toUpperCase() !==
                    String(intent.currency).toUpperCase()
            ) {
                console.error(
                    "Airwallex payment currency mismatch.",
                    {
                        intentId,
                        providerCurrency: intent.currency,
                        expectedCurrency: initialPayment.currency,
                    }
                );

                return res.status(400).send(
                    "Payment currency mismatch"
                );
            }
        }

        // --------------------------------------------------
        // 4. Start transaction and lock the bill
        // --------------------------------------------------

        client = await db.connect();

        await client.query("BEGIN");
        transactionOpen = true;

        /*
         * Locking the bill serializes webhook processing for
         * different payment intents belonging to the same bill.
         */
        const billResult = await client.query(
            `
            SELECT *
            FROM bills
            WHERE id = $1
            FOR UPDATE
            `,
            [initialPayment.bill_id]
        );

        if (!billResult.rows.length) {
            throw new Error(
                `Bill not found: ${initialPayment.bill_id}`
            );
        }

        const bill = billResult.rows[0];

        // Lock and re-read the payment after acquiring the bill lock.
        const lockedPaymentResult = await client.query(
            `
            SELECT *
            FROM payments
            WHERE intent_id = $1
            FOR UPDATE
            `,
            [intentId]
        );

        if (!lockedPaymentResult.rows.length) {
            throw new Error(
                `Payment disappeared for intent ${intentId}`
            );
        }

        const payment = lockedPaymentResult.rows[0];

        // --------------------------------------------------
        // 5. Idempotency: skip previously processed events
        // --------------------------------------------------

        const existingEvent = await client.query(
            `
            SELECT 1
            FROM payment_events
            WHERE id = $1
            LIMIT 1
            `,
            [event.id]
        );

        if (existingEvent.rows.length > 0) {
            await client.query("COMMIT");
            transactionOpen = false;

            console.log(
                `Duplicate webhook ignored: ${event.id}`
            );

            return res.sendStatus(200);
        }

        // --------------------------------------------------
        // 6. Failure / cancellation flow
        // --------------------------------------------------

        if (!isSuccessEvent) {
            await handleFailedOrCancelled({
                client,
                event,
                intentId,
                payment,
                bill,
            });

            await client.query("COMMIT");
            transactionOpen = false;

            console.log(
                `Payment ${intentId} handled as ${event.name}.`
            );

            return res.sendStatus(200);
        }

        // --------------------------------------------------
        // 7. Successful payment: do not process twice
        // --------------------------------------------------

        if (payment.status === "PAID") {
            await insertProcessedEvent(
                client,
                event,
                intentId
            );

            await client.query("COMMIT");
            transactionOpen = false;

            return res.sendStatus(200);
        }

        /*
         * If another payment already paid this bill, do not
         * submit another payment to Raptor. This may indicate
         * a duplicate gateway charge and requires reconciliation.
         */
        const anotherPaidPayment = await client.query(
            `
            SELECT intent_id
            FROM payments
            WHERE bill_id = $1
              AND status = 'PAID'
              AND intent_id <> $2
            LIMIT 1
            `,
            [
                payment.bill_id,
                intentId,
            ]
        );

        if (
            anotherPaidPayment.rows.length > 0 ||
            String(bill.status).toUpperCase() === "PAID"
        ) {
            console.error(
                "RECONCILIATION REQUIRED: Airwallex reports success, " +
                "but this bill is already marked PAID. " +
                "Raptor payment was not submitted again.",
                {
                    intentId,
                    billId: payment.bill_id,
                    otherPaidIntent:
                        anotherPaidPayment.rows[0]?.intent_id ?? null,
                }
            );

            // Record the event to prevent repeated POS payment attempts.
            // Investigate the gateway transaction and refund if required.
            await insertProcessedEvent(
                client,
                event,
                intentId
            );

            await client.query("COMMIT");
            transactionOpen = false;

            return res.sendStatus(200);
        }

        // --------------------------------------------------
        // 8. Validate outlet and Raptor identifiers
        // --------------------------------------------------

        if (
            !bill.outletuuid ||
            bill.table_id == null ||
            bill.salesno == null
        ) {
            throw new Error(
                `Missing Raptor bill identifiers for bill ${payment.bill_id}.`
            );
        }

        /*
         * If an earlier failed/cancelled attempt held the
         * table, recall it before processing the successful payment.
         */
        if (
            FINAL_NON_SUCCESS_STATUSES.has(
                String(payment.status).toUpperCase()
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
        // 9. Complete the payment in Raptor POS
        // --------------------------------------------------

        /*
         * doRaptorPayment should throw when Raptor does not confirm
         * success. It must pass idempotencyKey through to
         * /payment/dopayment.
         */
        const raptorResult = await doRaptorPayment({
            outletUuid: bill.outletuuid,
            tableNo: bill.table_id,
            salesNo: bill.salesno,
            splitNo: bill.splitno ?? 0,
            paymentType: 10,
            paidAmount: Number(payment.amount),
            customerId: "",
            idempotencyKey: `airwallex-${intentId}`,
        });

        if (raptorResult?.success !== true) {
            throw new Error(
                `Raptor payment not confirmed for intent ${intentId}.`
            );
        }

        console.log(
            `Raptor payment completed for intent ${intentId}.`
        );

        // --------------------------------------------------
        // 10. Update PostgreSQL only after Raptor succeeds
        // --------------------------------------------------

        const updatePaymentResult = await client.query(
            `
            UPDATE payments
            SET status = 'PAID',
                payment_method = 'QR',
                payment_at = NOW(),
                updated_at = NOW()
            WHERE intent_id = $1
            RETURNING id
            `,
            [intentId]
        );

        if (!updatePaymentResult.rows.length) {
            throw new Error(
                `Could not update payment ${intentId} to PAID.`
            );
        }

        // Expire other pending payment intents for this bill.
        await client.query(
            `
            UPDATE payments
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

        // Scope the bill update to its outlet as well.
        const updateBillResult = await client.query(
            `
            UPDATE bills
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
                `Could not mark bill ${payment.bill_id} as PAID for outlet ${bill.outletuuid}.`
            );
        }

        // Save the event only after Raptor and DB updates succeed.
        await insertProcessedEvent(
            client,
            event,
            intentId
        );

        await client.query("COMMIT");
        transactionOpen = false;

        console.log(
            `Payment completed successfully. Intent: ${intentId}`
        );

        return res.sendStatus(200);

    } catch (error) {
        if (client && transactionOpen) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Webhook transaction rollback failed:",
                    rollbackError
                );
            }

            transactionOpen = false;
        }

        console.error(
            "Airwallex webhook processing failed:",
            error
        );

        // A non-200 response allows Airwallex to retry.
        return res.status(500).send(
            "Webhook processing failed"
        );

    } finally {
        if (client) {
            client.release();
        }
    }
};

// Keep compatibility if any other file imports handleWebhook.
export const handleWebhook = handlePaymentSuccess;