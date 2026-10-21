import { getOutletConfig } from "./outletConfig.service.js";

const readRaptorJson = async (response, operation) => {
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${operation}: Raptor returned invalid JSON`);
  }

  if (!response.ok) {
    throw new Error(
      `${operation} failed (HTTP ${response.status}): ${
        data.msg || data.detail || text
      }`
    );
  }

  return data;
};

const assertRaptorSuccess = (data, operation) => {
  if (Number(data?.errorcode) !== 1) {
    const error = new Error(
      `${operation} failed: ${data?.msg || "Raptor operation unsuccessful"}`
    );

    error.raptorResponse = data;
    error.statusCode =
      Number(data?.errorcode) === 2 ? 409 : 502;

    throw error;
  }

  return data;
};

export const getRaptorToken = async (outletUuid = null) => {
  const config = await getOutletConfig(outletUuid);

  const body = new URLSearchParams({
    username: config.username,
    password: config.password,
  });

  const response = await fetch(
    `${config.outlet_api_url}/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Raptor token failed: ${response.status} ${text}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Raptor token missing access_token");
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || "bearer",
    config,
  };
};

export const getRaptorSalesNo = async (
  config,
  accessToken,
  tableNo
) => {
  const response = await fetch(
    `${config.outlet_api_url}/hds/salesno`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        posid: config.posid,
        operatorid: config.operatorno,
        tableno: tableNo,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Raptor salesno failed: ${response.status} ${text}`
    );
  }

  const data = await response.json();

  if (!data.salesno) {
    throw new Error("Raptor salesno not returned");
  }

  return data.salesno;
};

const fetchOpenTableList = async (config, accessToken) => {
  const response = await fetch(
    `${config.outlet_api_url}/order/open_table_list`,
    {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await readRaptorJson(
    response,
    "Raptor open table list"
  );

  assertRaptorSuccess(data, "Raptor open table list");

  if (!Array.isArray(data.details)) {
    throw new Error(
      "Raptor open table list did not return a details array"
    );
  }

  return data.details;
};

export const getRaptorOpenTableList = async (outletUuid) => {
  const { accessToken, config } =
    await getRaptorToken(outletUuid);

  return fetchOpenTableList(config, accessToken);
};

export const getRaptorBill = async (
  tableNo,
  outletUuid = null
) => {
  const { accessToken, config } =
    await getRaptorToken(outletUuid);

  let salesNo = null;
  let splitNo = 0;
  let openTables = [];

  // 1. Try the original known-table lookup first.
  try {
    salesNo = await getRaptorSalesNo(
      config,
      accessToken,
      tableNo
    );
  } catch (error) {
    console.warn(
      "Raptor salesno lookup failed; using open-table lookup.",
      error.message
    );
  }

  // 2. Use the open-table list to identify the matching split.
  //    Failure of this optional lookup must not block a sale
  //    already identified by /hds/salesno.
  try {
    openTables = await fetchOpenTableList(
      config,
      accessToken
    );
  } catch (error) {
    if (salesNo == null) {
      throw error;
    }

    console.warn(
      "Could not retrieve open-table list; continuing with the known sales number."
    );
  }

  if (salesNo != null) {
    // Match both table and sales number; don't select an
    // unrelated or older bill from the same table.
    const match = openTables.find(
      (entry) =>
        String(entry.tablename ?? entry.tableno) ===
          String(tableNo) &&
        String(entry.salesno) === String(salesNo)
    );

    if (match) {
      splitNo = Number(match.splitno ?? 0);
    } else {
      // Preserve the original behavior for the known-table path.
      // The viewbill response must still identify the requested sale.
      console.warn(
        `Sales ${salesNo} was not found in open_table_list; trying viewbill with split ${splitNo}.`
      );
    }
  } else {
    // 3. The known-table lookup failed, so use the documented
    //    open-table-list alternative.
    const candidates = openTables.filter(
      (entry) =>
        String(entry.tablename ?? entry.tableno) ===
          String(tableNo) &&
        Number(entry.balance || 0) > 0
    );

    if (candidates.length === 0) {
      const error = new Error(
        `No outstanding bill was found for table ${tableNo}`
      );

      error.code = "NO_ACTIVE_BILL";
      error.statusCode = 404;
      throw error;
    }

    if (candidates.length > 1) {
      const error = new Error(
        `Multiple outstanding bills found for table ${tableNo}`
      );

      error.code = "AMBIGUOUS_OPEN_BILL";
      error.statusCode = 409;
      throw error;
    }

    salesNo = Number(candidates[0].salesno);
    splitNo = Number(candidates[0].splitno ?? 0);
  }

  // 4. Fetch the latest bill from Raptor.
  const response = await fetch(
    `${config.outlet_api_url}/info/viewbill`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        posid: config.posid,
        operatorno: config.operatorno,
        tableno: String(tableNo),
        salesno: Number(salesNo),
        splitno: Number(splitNo),
      }),
    }
  );

  const data = await readRaptorJson(
    response,
    "Raptor viewbill"
  );

  // 5. Validate the response before syncing it to PostgreSQL.
  const heldTable = data?.held_table;

  if (
    !heldTable ||
    heldTable.msg !== "Held Table found"
  ) {
    const error = new Error(
      `Raptor did not return an active bill for table ${tableNo}`
    );

    error.code = "NO_ACTIVE_BILL";
    error.statusCode = 404;
    throw error;
  }

  if (
    String(heldTable.tableno) !== String(tableNo) ||
    String(heldTable.salesno) !== String(salesNo)
  ) {
    const error = new Error(
      "Raptor returned a different table or sales number than requested"
    );

    error.code = "BILL_IDENTITY_MISMATCH";
    error.statusCode = 409;
    throw error;
  }

  // Preserve the outlet UUID for PostgreSQL bill syncing.
  data.outletuuid = config.outletuuid;

  return data;
};

export const mapRaptorBill = (data, outletUuid = null) => {
  const heldTable = data.held_table;

  if (!heldTable) {
    return null;
  }

  if (heldTable.msg !== "Held Table found") {
    return null;
  }

  const items = (data.held_items || []).map((item) => ({
    id: item.itemseqno,
    name: item.itemname,
    quantity: Number(item.quantity || 0),
    price: Number(item.itemamount || 0),
    pluNumber: item.plunumber,
    salesRef: item.salesref,
  }));

  const taxes = [];

  for (let i = 0; i <= 10; i++) {
    const tax = data.tax_details?.[`tax${i}`];

    if (
      tax &&
      Number(tax.tax_amount || 0) !== 0
    ) {
      taxes.push({
        name: tax.tax_title,
        amount: Number(tax.tax_amount),
      });
    }
  }

  return {
    outletuuid: outletUuid,

    id: heldTable.salesno,

    table_id: heldTable.tableno,

    receipt_no: heldTable.rcptno,

    salesno: Number(heldTable.salesno),
    splitno: Number(heldTable.splitno || 0),
    posid: heldTable.posid,
    operatorno: Number(heldTable.operatorno),

    subtotal: Number(heldTable.subtotal || 0),

    total: Number(heldTable.grandtotal || 0),

    balance: Number(heldTable.balance || 0),

    paid_total: Number(heldTable.paidtotal || 0),

    discount: Number(heldTable.disctotal || 0),

    surcharge: Number(heldTable.surcharge || 0),

    covers: Number(heldTable.covers || 0),

    currency: "SGD",

    status: Number(heldTable.balance || 0) > 0
      ? "OPEN"
      : "OPEN",

    items,

    taxes,

    raptor: {
      salesno: heldTable.salesno,
      splitno: heldTable.splitno,
      posid: heldTable.posid,
      operatorno: heldTable.operatorno,
      operatorname: heldTable.operatorname,
      orderdate: heldTable.opendate + " " + heldTable.opentime
    },
  };
};

const updateRaptorTableState = async ({
  outletUuid,
  tableNo,
  salesNo,
  splitNo = 0,
  endpoint,
}) => {
  if (!outletUuid || !tableNo || !salesNo) {
    throw new Error(
      "Outlet UUID, table number and sales number are required"
    );
  }

  const { accessToken, config } =
    await getRaptorToken(outletUuid);

  const response = await fetch(
    `${config.outlet_api_url}${endpoint}`,
    {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        posid: config.posid,
        operator: Number(config.operatorno),
        tablename: String(tableNo),
        salesno: Number(salesNo),
        splitno: Number(splitNo),
      }),
    }
  );

  const data = await readRaptorJson(
    response,
    `Raptor ${endpoint}`
  );

  return assertRaptorSuccess(data, `Raptor ${endpoint}`);
};

export const recallRaptorTable = async (details) =>
  updateRaptorTableState({
    ...details,
    endpoint: "/order/recall_table",
  });

export const holdRaptorTable = async (details) =>
  updateRaptorTableState({
    ...details,
    endpoint: "/order/hold_table",
  });

export const doRaptorPayment = async ({
  outletUuid = null,
  tableNo,
  salesNo,
  splitNo = 0,
  paymentType = 10,
  paidAmount,
  customerId = "",
  idempotencyKey,
}) => {
  const {
    accessToken,
    config,
  } = await getRaptorToken(outletUuid);

  const payload = {
    posid: config.posid,
    operatorno: config.operatorno,
    tableno: String(tableNo),
    salesno: Number(salesNo),
    splitno: Number(splitNo),
    paymenttype: Number(paymentType),
    paidamount: Number(paidAmount),
    customerid: customerId || "",
    idempotencyKey,
  };

  const response = await fetch(
    `${config.outlet_api_url}/payment/dopayment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Raptor doPayment failed: ${response.status} ${text}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Raptor doPayment returned invalid JSON: ${text}`
    );
  }

  // Raptor's response in your Postman example:
  //
  // {
  //   "errorcode": 1,
  //   "msg": "",
  //   "paymentmsg": "Paid",
  //   "amount": 0.0,
  //   "tipamount": 0.0
  // }

  if (Number(data.errorcode) !== 1) {
    throw new Error(
      `Raptor payment request failed: ${data.msg || "Unknown error"}`
    );
  }
  
  if (
    String(data.paymentmsg || "").trim().toLowerCase() !== "paid"
  ) {
    throw new Error(
      `Raptor has not confirmed full payment: ${
        data.paymentmsg || data.msg || "Unknown payment status"
      }`
    );
  }

  return {
    success: true,
    payload,
    response: data,
  };
};

export const getRaptorEReceipt = async (
  receiptNo,
  outletUuid = null
) => {
  const {
    accessToken,
    config,
  } = await getRaptorToken(outletUuid);

  const payload = {
    receiptno: String(receiptNo),
  };

  const response = await fetch(
    `${config.outlet_api_url}/info/E-receipt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Raptor E-Receipt failed: ${response.status} ${text}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Raptor E-Receipt returned invalid JSON: ${text}`
    );
  }

  if (Number(data.errorcode) !== 1 || !data.url) {
    throw new Error(
      `Raptor E-Receipt was not generated: ${JSON.stringify(data)}`
    );
  }

  return {
    success: true,
    receiptNo,
    url: data.url,
    response: data,
  };
};