import { db } from "../db/index.js";

export const syncRaptorBill = async (bill) => {
  const result = await db.query(
    `
    INSERT INTO bills (
      receipt_no,
      table_id,
      sub_total,
      total,
      balance,
      paid_total,
      total_disc,
      surcharge,
      covers,
      currency,
      status,
      total_tax0,
      tax0_name
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    )
    ON CONFLICT (receipt_no)
    DO UPDATE SET
      table_id = EXCLUDED.table_id,
      sub_total = EXCLUDED.sub_total,
      total = EXCLUDED.total,
      balance = EXCLUDED.balance,
      paid_total = EXCLUDED.paid_total,
      total_disc = EXCLUDED.total_disc,
      surcharge = EXCLUDED.surcharge,
      covers = EXCLUDED.covers,
      currency = EXCLUDED.currency,
      status = EXCLUDED.status,
      total_tax0 = EXCLUDED.total_tax0,
      tax0_name = EXCLUDED.tax0_name
    RETURNING *;
    `,
    [
      bill.receipt_no,
      bill.table_id,
      bill.subtotal,
      bill.total,
      bill.balance,
      bill.paid_total,
      bill.discount,
      bill.surcharge,
      bill.covers,
      bill.currency,
      bill.status,
      bill.taxes?.find(t => t.name === "9% GST")?.amount || 0,
      "9% GST",
    ]
  );

  const savedBill = result.rows[0];

  // Replace existing items for this bill
  await db.query(
    `DELETE FROM bill_items WHERE bill_id=$1`,
    [savedBill.id]
  );

  for (const item of bill.items || []) {
    await db.query(
      `
      INSERT INTO bill_items (
        bill_id,
        name,
        quantity,
        price
      )
      VALUES ($1,$2,$3,$4)
      `,
      [
        savedBill.id,
        item.name,
        item.quantity,
        item.price,
      ]
    );
  }

  return savedBill;
};