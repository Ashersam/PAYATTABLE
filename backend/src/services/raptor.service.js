import { getOutletConfig } from "./outletConfig.service.js";

export const getRaptorToken = async () => {
  const config = await getOutletConfig();

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

export const getRaptorBill = async (tableNo) => {
  const {
    accessToken,
    config,
  } = await getRaptorToken();

  const salesno = await getRaptorSalesNo(
    config,
    accessToken,
    tableNo
  );

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
        salesno,
        splitno: 0,
        tableno: tableNo,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Raptor viewbill failed: ${response.status} ${text}`
    );
  }

  return await response.json();
};
export const mapRaptorBill = (data) => {
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

export const doRaptorPayment = async ({
  tableNo,
  salesNo,
  splitNo = 0,
  paymentType = 10,
  paidAmount,
  customerId = "",
}) => {
  const {
    accessToken,
    config,
  } = await getRaptorToken();

  const payload = {
    posid: config.posid,
    operatorno: config.operatorno,
    tableno: String(tableNo),
    salesno: Number(salesNo),
    splitno: Number(splitNo),
    paymenttype: Number(paymentType),
    paidamount: Number(paidAmount),
    customerid: customerId || "",
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

  if (
    String(data.paymentmsg || "").toLowerCase() !== "paid"
  ) {
    throw new Error(
      `Raptor payment was not successful: ${JSON.stringify(data)}`
    );
  }

  return {
    success: true,
    payload,
    response: data,
  };
};

export const getRaptorEReceipt = async (receiptNo) => {
  const {
    accessToken,
    config,
  } = await getRaptorToken();

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