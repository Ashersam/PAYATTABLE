import {
  getRaptorBill,
  mapRaptorBill
} from "../../services/raptor.service.js";

import { syncRaptorBill } from "../../services/billSync.service.js";

export const getBill = async (req, res) => {
  try {
    const { tableId } = req.params;

    if (!tableId) {
      return res.status(400).json({
        error: "Table number is required",
      });
    }

    console.log("🔎 Fetching Raptor bill for table:", tableId);

    // -------------------------------------------------------
    // 1. Get live bill from Raptor
    // -------------------------------------------------------

    const raptorData = await getRaptorBill(tableId);

    console.log(
      "📦 Raptor response:",
      JSON.stringify(raptorData, null, 2)
    );

    // -------------------------------------------------------
    // 2. Convert Raptor response to our common format
    // -------------------------------------------------------

    const bill = mapRaptorBill(raptorData);

    if (!bill) {
      return res.status(404).json({
        error: "No active bill",
      });
    }

    // -------------------------------------------------------
    // 3. Save/update the bill in PostgreSQL
    // -------------------------------------------------------

    const dbBillId = await syncRaptorBill(bill);

    console.log(
      "💾 Bill synced to PostgreSQL:",
      {
        dbBillId,
        receiptNo: bill.receipt_no,
        tableId: bill.table_id,
      }
    );

    // -------------------------------------------------------
    // 4. Return the live Raptor bill to frontend
    // -------------------------------------------------------

    return res.json({
      ...bill,

      // PostgreSQL internal ID
      db_id: dbBillId,

      // Raptor sales number remains separate
      raptor_salesno: bill.raptor?.salesno,
    });

  } catch (err) {
    console.error("❌ getBill error:", err);

    return res.status(500).json({
      error: "Failed to fetch bill",
      message: err.message,
    });
  }
};

