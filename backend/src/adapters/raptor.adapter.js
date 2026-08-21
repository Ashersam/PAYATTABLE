import { db } from "../db/index.js";

export class RaptorAdapter {
  async getBill(tableId) {

    const billRes = await db.query(
      "SELECT * FROM bills WHERE table_id=$1 ORDER BY id DESC LIMIT 1",
      [tableId]
    );

    const bill = billRes.rows[0];
    if (!bill) return null;

    const itemsRes = await db.query(
      "SELECT * FROM bill_items WHERE bill_id=$1",
      [bill.id]
    );

    return {
      ...bill,
      items: itemsRes.rows,
      currency: bill.currency,
    };
  }

  async markPaid(billId) {
    await db.query(
      "UPDATE bills SET status='PAID' WHERE id=$1",
      [billId]
    );
  }
}