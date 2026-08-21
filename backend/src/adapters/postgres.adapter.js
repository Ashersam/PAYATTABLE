import { db } from "../db/index.js";

export const getBill = async (tableId) => {
    const billRes = await db.query(
      "SELECT * FROM bills WHERE table_id=$1 ORDER BY id DESC LIMIT 1",
      [tableId]
    );
  
    const bill = billRes.rows[0];
    if (!bill) return null;
  
    const itemsRes = await db.query(
      "SELECT * FROM bill_items WHERE bill_id=$1",
      [bill.id] // 🔥 numeric ID
    );
  
    return {
      receipt_no: bill.receipt_no || `RCPT-${bill.id}`,
      receipt_items: itemsRes.rows.map((i) => ({
        name: i.name,
        qty: i.qty,
        amount: i.amount, // 🔥 use amount (not price)
      })),
      sub_total: Number(bill.sub_total || bill.total),
      total_disc: Number(bill.total_disc || 0),
      total_tax0: Number(bill.total_tax0 || 0),
      tax0_name: bill.tax0_name || "GST",
      total_tax1: 0,
      tax1_name: "",
      total_tax2: 0,
      tax2_name: "",
      total_tax3: 0,
      tax3_name: "",
      grand_total: Number(bill.total),
    };
  };

export const closeBill = async ({
    receipt_no,
    paid_amount,
    tips_amount,
    currency,
    payment_method,
}) => {
    // find bill
    const billRes = await db.query(
        "SELECT * FROM bills WHERE receipt_no=$1",
        [receipt_no]
    );

    const bill = billRes.rows[0];
    if (!bill) throw new Error("Bill not found");

    // update bill
    await db.query(
        "UPDATE bills SET status='PAID' WHERE id=$1",
        [bill.id]
    );

    return { success: true };
};