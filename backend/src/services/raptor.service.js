import { getOutletConfig } from "./outletConfig.service.js";

export const getRaptorToken = async () => {
    const config = await getOutletConfig();

    const body = new URLSearchParams();

    body.append("username", config.username);
    body.append("password", config.password);

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

export const getRaptorSalesNo = async (tableNo) => {
    const {
        accessToken,
        config,
    } = await getRaptorToken();

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

    const salesno = await getRaptorSalesNo(tableNo);

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

    const data = await response.json();

    return data;
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
        : "PAID",
  
      items,
  
      taxes,
  
      raptor: {
        salesno: heldTable.salesno,
        splitno: heldTable.splitno,
        posid: heldTable.posid,
        operatorno: heldTable.operatorno,
      },
    };
  };