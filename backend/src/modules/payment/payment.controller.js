import { db } from "../../db/index.js";
import { createPaymentIntent } from "./payment.service.js";
// import { POS } from "../../adapters/pos.adapter.js";
import {
  getRaptorBill,
  mapRaptorBill,
  recallRaptorTable,
  holdRaptorTable,
  getRaptorEReceipt,
} from "../../services/raptor.service.js";
import { syncRaptorBill } from "../../services/billSync.service.js";

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

// export const confirmPayment = async (req, res) => {
//   try {
//     const { intentId, billId, amount, tip, currency } = req.body;

//     const paymentRes = await db.query(
//       "SELECT * FROM payments WHERE intent_id=$1",
//       [intentId]
//     );

//     const payment = paymentRes.rows[0];
//     if (!payment) {
//       return res.status(404).json({ error: "Payment not found" });
//     }

//     // ✅ mark PAID
//     await db.query(
//       "UPDATE payments SET status='PAID' WHERE intent_id=$1",
//       [intentId]
//     );

//     // ✅ expire others
//     await db.query(
//       "UPDATE payments SET status='EXPIRED' WHERE bill_id=$1 AND intent_id != $2",
//       [payment.bill_id, intentId]
//     );

//     // 🔥 CLOSE BILL USING POS FORMAT
//     await POS.closeBill({
//       receipt_no: billId,
//       paid_amount: amount,
//       tips_amount: tip,
//       currency,
//       payment_method: "QR",
//     });

//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Confirm failed" });
//   }
// };

// export const createPayment = async (req, res) => {
//   try {
//     const { billId, amount, tip, currency } = req.body;

//     // 🔐 fetch bill from DB
//     const billRes = await db.query(
//       "SELECT * FROM bills WHERE receipt_no=$1",
//       [billId]
//     );

//     const bill = billRes.rows[0];
//     if (!bill) return res.status(404).json({ error: "Bill not found" });

//     // 🔐 validate amount (IMPORTANT)
//     if (Number(amount) <= 0) {
//       return res.status(400).json({ error: "Invalid amount" });
//     }

//     // 🔐 prevent duplicate paid
//     const existing = await db.query(
//       "SELECT * FROM payments WHERE bill_id=$1 AND status='PAID'",
//       [bill.id]
//     );

//     if (existing.rows.length) {
//       return res.status(400).json({ error: "Already paid" });
//     }

//     // 🔥 create intent
//     const intent = await createPaymentIntent({
//       ...bill,
//       total: amount,
//     });

//     // 🔐 store locked amount
//     await db.query(
//       `INSERT INTO payments
//      (bill_id, receipt_no, amount, tip, currency, status, provider, intent_id)
//      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
//       [
//         bill.id,
//         billId,
//         amount,
//         tip,
//         currency,
//         "PENDING",
//         "AIRWALLEX",
//         intent.id
//       ]
//     );

//     res.json({
//       intent_id: intent.id,
//       client_secret: intent.client_secret,
//       currency
//     });
//   } catch (err) {
//     console.error("❌ createPayment error:", err);
//     res.status(500).json({ error: "Payment failed" });
//   }
// };
// export const createPayment = async (req, res) => {
//   try {
//     const {
//       billId,
//       tip = 0,
//       currency,
//     } = req.body;

//     // ---------------------------------------------------------
//     // 1. Find the synced bill
//     // ---------------------------------------------------------

//     const billRes = await db.query(
//       `
//       SELECT *
//       FROM bills
//       WHERE receipt_no = $1
//       LIMIT 1
//       `,
//       [billId]
//     );

//     const bill = billRes.rows[0];

//     if (!bill) {
//       return res.status(404).json({
//         error: "Bill not found",
//       });
//     }

//     // ---------------------------------------------------------
//     // 2. Check whether bill is already paid
//     // ---------------------------------------------------------

//     const existing = await db.query(
//       `
//       SELECT *
//       FROM payments
//       WHERE bill_id = $1
//       AND status = 'PAID'
//       LIMIT 1
//       `,
//       [bill.id]
//     );

//     if (existing.rows.length) {
//       return res.status(409).json({
//         error: "Bill already paid",
//         code: "BILL_ALREADY_PAID",
//         receipt_no: bill.receipt_no,
//       });
//     }

//     // ---------------------------------------------------------
//     // 3. Calculate payment amount
//     //
//     // bill.total = Raptor outstanding balance
//     //
//     // Example:
//     // balance = 3.40
//     // tip     = 0.30
//     // payment = 3.70
//     // ---------------------------------------------------------

//     const billBalance = Number(bill.total || 0);
//     const tipAmount = Number(tip || 0);

//     if (billBalance <= 0) {
//       return res.status(400).json({
//         error: "Invalid bill balance",
//       });
//     }

//     if (tipAmount < 0) {
//       return res.status(400).json({
//         error: "Invalid tip",
//       });
//     }

//     const totalAmount = Number(
//       (billBalance + tipAmount).toFixed(2)
//     );

//     // ---------------------------------------------------------
//     // 4. Create Airwallex Payment Intent
//     // ---------------------------------------------------------

//     const intent = await createPaymentIntent(
//       {
//         ...bill,

//         // IMPORTANT:
//         // Airwallex must receive balance + tip
//         total: totalAmount,

//         currency: currency || bill.currency,
//       },
//       tipAmount
//     );
    
//     // ---------------------------------------------------------
//     // 5. Save PENDING payment
//     // ---------------------------------------------------------

//     await db.query(
//       `
//       INSERT INTO payments
//       (
//         bill_id,
//         receipt_no,
//         amount,
//         tip,
//         currency,
//         status,
//         provider,
//         intent_id
//       )
//       VALUES
//       ($1,$2,$3,$4,$5,$6,$7,$8)
//       `,
//       [
//         bill.id,
//         bill.receipt_no,
//         totalAmount,
//         tipAmount,
//         currency || bill.currency,
//         "PENDING",
//         "AIRWALLEX",
//         intent.id,
//       ]
//     );

//     // ---------------------------------------------------------
//     // 6. Return PaymentIntent details to frontend
//     // ---------------------------------------------------------

//     return res.json({
//       intent_id: intent.id,
//       client_secret: intent.client_secret,
//       currency: currency || bill.currency,

//       // useful for frontend debugging/display
//       amount: totalAmount,
//       bill_balance: billBalance,
//       tip: tipAmount,
//     });

//   } catch (err) {
//     console.error("❌ createPayment error:", err);

//     return res.status(500).json({
//       error: "Payment failed",
//       message: err.message,
//     });
//   }
// };


export const createPayment = async (req, res) => {
  let recalled = false;
  let recallDetails = null;

  try {
    const {
      outletUuid,
      tableId,
      billId,
      tip = 0,
    } = req.body;

    // 1. Validate the request.
    if (!outletUuid || !tableId || !billId) {
      return res.status(400).json({
        error: "Outlet UUID, table number and receipt number are required",
      });
    }

    const tipAmount = Number(tip);

    if (!Number.isFinite(tipAmount) || tipAmount < 0) {
      return res.status(400).json({
        error: "Invalid tip amount",
      });
    }

    // 2. Refresh the latest bill from the selected Raptor outlet.
    const raptorData = await getRaptorBill(
      tableId,
      outletUuid
    );

    const bill = mapRaptorBill(
      raptorData,
      outletUuid
    );

    if (!bill) {
      return res.status(404).json({
        error: "No active bill",
        code: "NO_ACTIVE_BILL",
      });
    }

    // 3. Ensure the customer is paying the bill they reviewed.
    if (String(bill.receipt_no) !== String(billId)) {
      return res.status(409).json({
        error: "The bill has changed. Please reload the page.",
        code: "BILL_CHANGED",
      });
    }

    // Raptor's current outstanding balance is authoritative.
    const balance = Number(bill.balance);

    if (!Number.isFinite(balance) || balance <= 0) {
      return res.status(409).json({
        error: "There is no outstanding balance to pay.",
        code: "NO_OUTSTANDING_BALANCE",
      });
    }

    // 4. Sync the current bill to PostgreSQL.
    const dbBillId = await syncRaptorBill(bill);

    // 5. Refuse to collect payment for a bill already marked paid.
    const paidCheck = await db.query(
      `
      SELECT id
      FROM public.payments
      WHERE bill_id = $1
        AND status = 'PAID'
      LIMIT 1
      `,
      [dbBillId]
    );

    if (paidCheck.rows.length) {
      return res.status(409).json({
        error: "This bill has already been paid.",
        code: "BILL_ALREADY_PAID",
      });
    }

    // 6. Recall the exact Raptor table, sale and split.
    recallDetails = {
      outletUuid,
      tableNo: String(bill.table_id),
      salesNo: Number(bill.salesno),
      splitNo: Number(bill.splitno || 0),
    };

    await recallRaptorTable(recallDetails);
    recalled = true;

    // 7. Calculate payment from outstanding balance plus tip.
    const totalAmount = Number(
      (balance + tipAmount).toFixed(2)
    );

    // 8. Create the Airwallex PaymentIntent.
    const intent = await createPaymentIntent(
      {
        ...bill,
        total: totalAmount,
        currency: bill.currency,
      },
      tipAmount
    );

    // 9. Save the payment attempt as PENDING.
    await db.query(
      `
      INSERT INTO public.payments
      (
        bill_id,
        receipt_no,
        amount,
        tip,
        currency,
        status,
        provider,
        intent_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        dbBillId,
        bill.receipt_no,
        totalAmount,
        tipAmount,
        bill.currency,
        "PENDING",
        "AIRWALLEX",
        intent.id,
      ]
    );

    return res.json({
      intent_id: intent.id,
      client_secret: intent.client_secret,
      currency: bill.currency,
      amount: totalAmount,
      bill_balance: balance,
      tip: tipAmount,
    });
  } catch (err) {
    console.error("Payment preparation failed:", {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      raptorResponse: err.raptorResponse,
    });

    // If recall succeeded but checkout preparation failed,
    // attempt to restore the table.
    if (recalled && recallDetails) {
      try {
        await holdRaptorTable(recallDetails);
      } catch (holdError) {
        console.error(
          "Failed to restore Raptor table:",
          holdError.message
        );
      }
    }

    if (err.code === "NO_ACTIVE_BILL") {
      return res.status(404).json({
        error: "No outstanding bill was found for this table.",
        code: err.code,
      });
    }

    if (Number(err.raptorResponse?.errorcode) === 2) {
      return res.status(409).json({
        error:
          "This table is currently open on another POS. Please ask staff for assistance.",
        code: "TABLE_BUSY",
      });
    }

    const statusCode =
      err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 502;

    return res.status(statusCode).json({
      error: "Unable to prepare payment. Please try again or ask staff.",
      code: err.code || "PAYMENT_PREPARATION_FAILED",
    });
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

export const getEReceipt = async (req, res) => {
  try {
    const { receiptNo } = req.params;

    if (!receiptNo) {
      return res.status(400).json({
        error: "Receipt number is required",
      });
    }

    const result = await getRaptorEReceipt(receiptNo);

    return res.json({
      success: true,
      receiptNo,
      url: result.url,
    });

  } catch (error) {
    console.error("❌ E-Receipt error:", error);

    return res.status(500).json({
      error: error.message || "Failed to retrieve E-Receipt",
    });
  }
};