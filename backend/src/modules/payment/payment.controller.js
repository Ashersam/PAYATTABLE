import { db } from "../../db/index.js";
import { createPaymentIntent } from "./payment.service.js";
import { POS } from "../../adapters/pos.adapter.js";

// export const createPayment = async (req, res) => {
//   try {
//     const { billId, amount, tip, currency } = req.body;

//     // 🔥 STEP 1: get bill via receipt_no
//     const billRes = await db.query(
//       "SELECT * FROM bills WHERE receipt_no=$1",
//       [billId]
//     );

//     const bill = billRes.rows[0];

//     if (!bill) {
//       return res.status(404).json({ error: "Bill not found" });
//     }

//     const dbBillId = bill.id;

//     // 🔥 STEP 2: prevent duplicate PAID
//     const existing = await db.query(
//       "SELECT * FROM payments WHERE bill_id=$1 AND status='PAID'",
//       [dbBillId]
//     );

//     if (existing.rows.length > 0) {
//       return res.status(400).json({
//         error: "Bill already paid",
//       });
//     }

//     const totalAmount = Number(amount);

//     if (!totalAmount || totalAmount <= 0) {
//       return res.status(400).json({ error: "Invalid amount" });
//     }

//     console.log("💰 TOTAL:", totalAmount);

//     // 🔥 STEP 3: create intent
//     const intent = await createPaymentIntent(
//       {
//         ...bill,
//         total: totalAmount,
//       },
//       tip
//     );

//     // 🔥 STEP 4: save payment
//     await db.query(
//       `INSERT INTO payments 
//    (bill_id, amount, tip, status, provider, intent_id, convenience_fee)
//    VALUES ($1,$2,$3,$4,$5,$6,$7)`,
//       [
//         dbBillId,
//         totalAmount,
//         tip,
//         "PENDING",
//         "AIRWALLEX",
//         intent.id,
//         0 // optional now
//       ]
//     );

//     res.json({
//       intent_id: intent.id,
//       client_secret: intent.client_secret,
//       currency: bill.currency,
//     });
//   } catch (err) {
//     console.error("❌ createPayment error:", err);
//     res.status(500).json({ error: "Payment failed" });
//   }
// };

// export const getReceipt = async (req, res) => {
//   try {
//     const { receiptNo } = req.params;

//     const paymentRes = await db.query(
//       `
//       SELECT
//         p.amount,
//         p.tip,
//         p.currency,
//         p.status,
//         b.receipt_no,
//         b.table_id,
//         b.total
//       FROM payments p
//       JOIN bills b ON b.id = p.bill_id
//       WHERE b.receipt_no = $1
//       AND p.status='PAID'
//       ORDER BY p.id DESC
//       LIMIT 1
//       `,
//       [receiptNo]
//     );

//     if (!paymentRes.rows.length) {
//       return res.status(404).json({
//         error: "Receipt not found"
//       });
//     }

//     return res.json(paymentRes.rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: "Receipt fetch failed"
//     });
//   }
// };

export const getReceipt = async (req, res) => {
  try {
    const { receiptNo } = req.params;

    // Receipt Header
    const receiptRes = await db.query(
      `
      SELECT
        b.id,
        b.receipt_no,
        b.table_id,
        b.total,
        b.total_tax0,
        b.tax0_name,

        p.amount,
        p.tip,
        p.currency,
        p.payment_method,
        p.payment_at,
        p.status,
        p.convenience_fee

      FROM bills b
      JOIN payments p
        ON p.bill_id = b.id

      WHERE
        b.receipt_no = $1
        AND p.status='PAID'

      ORDER BY p.id DESC
      LIMIT 1
      `,
      [receiptNo]
    );

    if (!receiptRes.rows.length) {
      return res.status(404).json({
        error: "Receipt not found"
      });
    }

    const receipt = receiptRes.rows[0];

    // Receipt Items
    const itemsRes = await db.query(
      `
      SELECT
          name,
          quantity,
          price
      FROM bill_items
      WHERE bill_id=$1
      ORDER BY id
      `,
      [receipt.id]
    );

    receipt.items = itemsRes.rows;

    return res.json(receipt);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Receipt fetch failed"
    });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { intentId, billId, amount, tip, currency } = req.body;

    const paymentRes = await db.query(
      "SELECT * FROM payments WHERE intent_id=$1",
      [intentId]
    );

    const payment = paymentRes.rows[0];
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // ✅ mark PAID
    await db.query(
      "UPDATE payments SET status='PAID' WHERE intent_id=$1",
      [intentId]
    );

    // ✅ expire others
    await db.query(
      "UPDATE payments SET status='EXPIRED' WHERE bill_id=$1 AND intent_id != $2",
      [payment.bill_id, intentId]
    );

    // 🔥 CLOSE BILL USING POS FORMAT
    await POS.closeBill({
      receipt_no: billId,
      paid_amount: amount,
      tips_amount: tip,
      currency,
      payment_method: "QR",
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Confirm failed" });
  }
};

export const createPayment = async (req, res) => {
  try {
    const { billId, amount, tip, currency } = req.body;

    // 🔐 fetch bill from DB
    const billRes = await db.query(
      "SELECT * FROM bills WHERE receipt_no=$1",
      [billId]
    );

    const bill = billRes.rows[0];
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    // 🔐 validate amount (IMPORTANT)
    if (Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // 🔐 prevent duplicate paid
    const existing = await db.query(
      "SELECT * FROM payments WHERE bill_id=$1 AND status='PAID'",
      [bill.id]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: "Already paid" });
    }

    // 🔥 create intent
    const intent = await createPaymentIntent({
      ...bill,
      total: amount,
    });

    // 🔐 store locked amount
    await db.query(
      `INSERT INTO payments
     (bill_id, receipt_no, amount, tip, currency, status, provider, intent_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        bill.id,
        billId,
        amount,
        tip,
        currency,
        "PENDING",
        "AIRWALLEX",
        intent.id
      ]
    );

    res.json({
      intent_id: intent.id,
      client_secret: intent.client_secret,
      currency
    });
  } catch (err) {
    console.error("❌ createPayment error:", err);
    res.status(500).json({ error: "Payment failed" });
  }
};

export const getPaymentStatus = async (req, res) => {
  const { billId } = req.query;

  const result = await db.query(
    `SELECT status FROM payments
     WHERE receipt_no=$1
     ORDER BY id DESC LIMIT 1`,
    [billId]
  );

  res.json(result.rows[0] || { status: "PENDING" });
};