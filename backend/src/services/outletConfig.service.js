import { db } from "../db/index.js";

export const getOutletConfig = async () => {
  const result = await db.query(`
    SELECT
      posid,
      operatorno,
      username,
      password,
      outlet_api_url
    FROM outlet_config
    LIMIT 1
  `);

  if (!result.rows.length) {
    throw new Error("Outlet configuration not found");
  }

  return result.rows[0];
};