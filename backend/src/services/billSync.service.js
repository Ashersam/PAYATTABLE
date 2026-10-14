import { db } from "../db/index.js";

export const syncRaptorBill = async (bill) => {

  if (!bill.outletuuid) {
    throw new Error("Cannot sync bill without outlet UUID");
  }

  // ---------------------------------------------------------
  // 1. Find this receipt within the selected outlet.
  // ---------------------------------------------------------
  const existingRes = await db.query(
    `
    SELECT id
    FROM public.bills
    WHERE outletuuid = $1
      AND receipt_no = $2
    LIMIT 1
    `,
    [bill.outletuuid, bill.receipt_no]
  );

  let billId;

  const values = [
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
  ];
  // ---------------------------------------------------------
  // 2. INSERT new bill
  // ---------------------------------------------------------
  if (!existingRes.rows.length) {
    const insertRes = await db.query(
      `
      INSERT INTO public.bills
      (
        outletuuid,
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING id
      `,
      [bill.outletuuid, ...values]
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
      UPDATE public.bills
      SET
        table_id = $1,
        total = $2,
        status = $3,
        currency = $4,
        receipt_no = $5,
        sub_total = $6,
        total_disc = $7,
        total_tax0 = $8,
        tax0_name = $9,
        total_tax1 = $10,
        tax1_name = $11,
        total_tax2 = $12,
        tax2_name = $13,
        total_tax3 = $14,
        tax3_name = $15,
        salesno = $16,
        splitno = $17,
        posid = $18,
        operatorno = $19

      WHERE id = $20

        AND outletuuid = $21
      `,
      [...values, billId, bill.outletuuid]
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