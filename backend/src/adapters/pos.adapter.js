import * as postgresAdapter from "./postgres.adapter.js";

const MODE = process.env.POS_MODE || "POSTGRES";

export const POS = {
  getBill: async (tableId) => {
    if (MODE === "POSTGRES") {
      return postgresAdapter.getBill(tableId);
    }
  },

  closeBill: async (payload) => {
    if (MODE === "POSTGRES") {
      return postgresAdapter.closeBill(payload);
    }
  },
};