import { db } from "../db/index.js";

export const syncRaptorBill = async (bill) => {
  // ---------------------------------------------------------
  // 1. Find existing bill by Raptor receipt number
  // ---------------------------------------------------------
  const existingRes = await db.query(
    `
    SELECT id
    FROM bills
    WHERE receipt_no = $1
    LIMIT 1
    `,
    [bill.receipt_no]
  );

  let billId;

  // ---------------------------------------------------------
  // 2. INSERT new bill
  // ---------------------------------------------------------
  if (!existingRes.rows.length) {
    const insertRes = await db.query(
      `
      INSERT INTO bills
      (
        table_id,
        total,
        status,
        currency,
        receipt_no,
        sub_total,
        total_disc,
        total_tax0,
        tax0_name,
        total_tax1,
        tax1_name,
        total_tax2,
        tax2_name,
        total_tax3,
        tax3_name,
        salesno,
        splitno,
        posid,
        operatorno
      )
      VALUES
      (
        $1,$2,$3,$4,$5,
        $6,$7,
        $8,$9,
        $10,$11,
        $12,$13,
        $14,$15,$16,$17,$18,$19
      )
      RETURNING id
      `,
      [
        bill.table_id,
        bill.total,
        bill.status,
        bill.currency,
        bill.receipt_no,
        bill.subtotal,
        bill.discount,

        bill.taxes?.[0]?.amount || 0,
        bill.taxes?.[0]?.name || "",

        bill.taxes?.[1]?.amount || 0,
        bill.taxes?.[1]?.name || "",

        bill.taxes?.[2]?.amount || 0,
        bill.taxes?.[2]?.name || "",

        bill.taxes?.[3]?.amount || 0,
        bill.taxes?.[3]?.name || "",
        bill.salesno,
        bill.splitno ?? 0,
        bill.posid,
        bill.operatorno,
      ]
    );

    billId = insertRes.rows[0].id;
  }

  // ---------------------------------------------------------
  // 3. UPDATE existing bill
  // ---------------------------------------------------------
  else {
    billId = existingRes.rows[0].id;

    await db.query(
      `
      UPDATE bills
      SET
        table_id = $1,
        total = $2,
        status = $3,
        currency = $4,
        sub_total = $5,
        total_disc = $6,

        total_tax0 = $7,
        tax0_name = $8,

        total_tax1 = $9,
        tax1_name = $10,

        total_tax2 = $11,
        tax2_name = $12,

        total_tax3 = $13,
        tax3_name = $14,
        salesno = $15,
        splitno = $16,
        posid = $17,
        operatorno = $18

      WHERE id = $19
      `,
      [
        bill.table_id,
        bill.total,
        bill.status,
        bill.currency,
        bill.subtotal,
        bill.discount,

        bill.taxes?.[0]?.amount || 0,
        bill.taxes?.[0]?.name || "",

        bill.taxes?.[1]?.amount || 0,
        bill.taxes?.[1]?.name || "",

        bill.taxes?.[2]?.amount || 0,
        bill.taxes?.[2]?.name || "",

        bill.taxes?.[3]?.amount || 0,
        bill.taxes?.[3]?.name || "",

        // Raptor identifiers
        bill.salesno,
        bill.splitno ?? 0,
        bill.posid,
        bill.operatorno,

        billId,
      ]
    );
  }

  // ---------------------------------------------------------
  // 4. Replace bill items
  // ---------------------------------------------------------

  await db.query(
    `
    DELETE FROM bill_items
    WHERE bill_id = $1
    `,
    [billId]
  );

  for (const item of bill.items || []) {
    await db.query(
      `
      INSERT INTO bill_items
      (
        bill_id,
        name,
        price,
        quantity,
        qty,
        amount
      )
      VALUES
      ($1,$2,$3,$4,$5,$6)
      `,
      [
        billId,
        item.name,
        item.price,
        item.quantity,
        item.quantity,
        item.price,
      ]
    );
  }

  return billId;
};