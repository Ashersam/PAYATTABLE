import {
  getRaptorBill,
  mapRaptorBill,
} from "../../services/raptor.service.js";

export const getBill = async (req, res) => {
  try {
    const { tableId } = req.params;

    if (!tableId) {
      return res.status(400).json({
        error: "Table number is required",
      });
    }

    console.log("🔎 Fetching Raptor bill for table:", tableId);

    const raptorData = await getRaptorBill(tableId);

    console.log(
      "📦 Raptor response:",
      JSON.stringify(raptorData, null, 2)
    );

    const bill = mapRaptorBill(raptorData);

    if (!bill) {
      return res.status(404).json({
        error: "No active bill",
      });
    }

     // Save/update Raptor bill in our local PostgreSQL
     const savedBill = await syncRaptorBill(bill);

     console.log(
       "💾 Bill synced:",
       savedBill.receipt_no,
       savedBill.id
     );
 
     return res.json({
       ...bill,
 
       // local DB ID
       id: savedBill.id,
 
       // keep Raptor values
       receipt_no: bill.receipt_no,
       balance: bill.balance,
     });

  } catch (err) {
    console.error("❌ getBill error:", err);

    return res.status(500).json({
      error: "Failed to fetch bill",
      message: err.message,
    });
  }
};
// import { POS } from "../../adapters/pos.adapter.js";
// export const getBill = async (req, res) => {
//   const { tableId } = req.params;

//   const posBill = await POS.getBill(tableId);

//   if (!posBill) {
//     return res.status(404).json({ error: "No active bill" });
//   }

//   // 🔁 also send UI-friendly format
//   const mapped = {
//     id: posBill.receipt_no,
//     table_id: tableId,
//     currency: "SGD",
//     total: posBill.grand_total,
//     items: posBill.receipt_items.map((i, idx) => ({
//       id: idx,
//       name: i.name,
//       price: i.amount,
//       quantity: i.qty,
//     })),
//     pos_raw: posBill, // 🔥 important for future
//   };

//   res.json(mapped);
// };


