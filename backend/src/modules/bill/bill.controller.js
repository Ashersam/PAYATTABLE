import {
  getRaptorBill,
  mapRaptorBill
} from "../../services/raptor.service.js";

import { syncRaptorBill } from "../../services/billSync.service.js";

export const getBill = async (req, res) => {
  try {
    const { outletUuid, tableId } = req.params;

    if (!outletUuid || !tableId) {
      return res.status(400).json({
        error: "Outlet UUID and table number are required",
      });
    }


    // 1. Fetch the bill from the selected outlet's Raptor POS.
    const raptorData = await getRaptorBill(tableId, outletUuid);

    // 2. Convert the Raptor response to our common bill format.
    const bill = mapRaptorBill(raptorData, outletUuid);

    if (!bill) {
      return res.status(404).json({
        error: "No active bill",
      });
    }

    // -------------------------------------------------------
    // 3. Save/update the bill in PostgreSQL
    // -------------------------------------------------------

    const dbBillId = await syncRaptorBill(bill);

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
    console.error("Bill fetch failed:", err);

    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
      error:
        statusCode === 404
          ? "Outlet not found"
          : "Failed to fetch bill",
    });
  }
};

