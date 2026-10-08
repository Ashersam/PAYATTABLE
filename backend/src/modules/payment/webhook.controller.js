import { db } from "../../db/index.js";
import { doRaptorPayment } from "../../services/raptor.service.js";
export const handleWebhook = async (req, res) => {
  const event = req.body;

  if (event.name === "payment_intent.succeeded") {
    const intent = event.data.object;

    const paymentRes = await db.query(
      "SELECT * FROM payments WHERE intent_id=$1",
      [intent.id]
    );

    const payment = paymentRes.rows[0];
    if (!payment) return res.sendStatus(200);

    await POS.closeBill({
      receipt_no: payment.bill_id,
      paid_amount: intent.amount,
      tips_amount: payment.tip,
      currency: intent.currency,
      payment_method: "QR",
    });

    await db.query(
      "UPDATE payments SET status='PAID' WHERE intent_id=$1",
      [intent.id]
    );
  }

  res.sendStatus(200);
};

export const handlePaymentSuccess = async (req, res) => {
  try {
    console.log("🔥 WEBHOOK HIT");
    const event = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString("utf8"))
      : req.body;


    const eventId = event.id;
    const intentId = event.data.object.id;

    // 🔐 idempotency check
    const exists = await db.query(
      "SELECT 1 FROM payment_events WHERE id=$1",
      [eventId]
    );

    if (exists.rows.length) {
      return res.sendStatus(200);
    }

    // store event
    await db.query(
      "INSERT INTO payment_events (id, intent_id, event_type, payload) VALUES ($1,$2,$3,$4)",
      [eventId, intentId, event.name, event]
    );

    // 🔥 fetch payment
    const paymentRes = await db.query(
      "SELECT * FROM payments WHERE intent_id=$1",
      [intentId]
    );

    const payment = paymentRes.rows[0];
    if (!payment) return res.sendStatus(200);

    // 🔐 idempotent
    if (payment.status === "PAID") return res.sendStatus(200);

    // 🔐 OPTIONAL: verify amount with provider
    const providerAmount = event.data.object.amount;

    if (Number(providerAmount) !== Number(payment.amount)) {
      console.error("🚨 AMOUNT MISMATCH");
      return res.status(400).send("Amount mismatch");
    }

    // ----------------------------------------------------
    // 🔥 Raptor POS PAYMENT
    // ----------------------------------------------------

    const billRes = await db.query(
      "SELECT * FROM bills WHERE id=$1",
      [payment.bill_id]
    );

    const bill = billRes.rows[0];

    if (!bill) {
      console.error("❌ Bill not found:", payment.bill_id);
      return res.status(500).send("Bill not found");
    }

    const raptorResult = await doRaptorPayment({
      tableNo: bill.table_id,
      salesNo: bill.salesno,
      splitNo: bill.splitno || 0,
      paymentType: 10,
      paidAmount: Number(payment.amount),
      customerId: "",
    });

    // ✅ mark PAID
    await db.query(
      "UPDATE payments SET status='PAID', updated_at=NOW() WHERE intent_id=$1",
      [intentId]
    );

    // ✅ expire others
    await db.query(
      "UPDATE payments SET status='EXPIRED' WHERE bill_id=$1 AND intent_id != $2",
      [payment.bill_id, intentId]
    );

    // ✅ close bill (DB now → POS later)
    await db.query(
      "UPDATE bills SET status='PAID' WHERE id=$1",
      [payment.bill_id]
    );

    // ✅ future hook point
    // await POS.closeBill(...)
    // await Printer.print(...)

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};