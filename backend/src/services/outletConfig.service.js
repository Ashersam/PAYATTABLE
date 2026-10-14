import { db } from "../db/index.js";

export const getOutletConfig = async (outletUuid = null) => {
  let result;

  if (outletUuid) {
    // Use the outlet UUID provided by the scanned URL.
    result = await db.query(
      `
      SELECT
        outletuuid,
        posid,
        operatorno,
        username,
        password,
        outlet_api_url
      FROM public.outlet_config
      WHERE outletuuid = $1
      LIMIT 1
      `,
      [String(outletUuid).trim()]
    );
  } else {
    // Temporary backward compatibility while existing routes
    // are being updated to include the outlet UUID.
    result = await db.query(
      `
      SELECT
        outletuuid,
        posid,
        operatorno,
        username,
        password,
        outlet_api_url
      FROM public.outlet_config
      ORDER BY id
      LIMIT 1
      `
    );
  }

  if (!result.rows.length) {
    const error = new Error(
      outletUuid
        ? "Outlet not found"
        : "Outlet configuration not found"
    );

    error.statusCode = outletUuid ? 404 : 500;
    throw error;
  }

  return result.rows[0];
};