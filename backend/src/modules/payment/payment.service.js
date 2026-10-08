import axios from "axios";
import { getAirwallexToken } from "../../config/airwallex.js";

export const createPaymentIntent = async (bill, tip) => {
  const token = await getAirwallexToken();

  const amount = Number(bill.total);

  if (!amount || amount <= 0) {
    throw new Error("Invalid amount");
  }

  const payload = {
    request_id: `req_${Date.now()}`,

    // ✅ FIXED
    amount: amount,

    currency: bill.currency || "SGD",

    // 🔥 USE receipt_no (NOT id)
    merchant_order_id: `order_${bill.receipt_no}`,

    confirmation_method: "automatic",
    capture_method: "automatic",

    return_url: process.env.FRONTEND_URL + "/success",

    customer: {
      merchant_customer_id: `cust_${bill.receipt_no}`,
    },
    connected_account_id: process.env.CONNECTED_ACCOUNT_ID,
    payment_method_options: {
      card: { auto_capture: true },
    },
    metadata: {
      account_id_external: process.env.CONNECTED_ACCOUNT_ID,
      payment_source: process.env.PAYMENT_SOURCE,
      partner_id: process.env.PARTNER_ID,
      method_type: process.env.PAYMENT_METHOD_TYPE, 
      pos_id: "POS001"
    },
  };

  const res = await axios.post(
    `${process.env.AIRWALLEX_BASE_URL}/api/v1/pa/payment_intents/create`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};

export const buildClosePayload = ({
  receiptNo,
  amount,
  tip,
  currency,
}) => {
  return {
    payment_id: `PAY-${Date.now()}`,
    receipt_no: receiptNo,
    paid_amount: amount,
    tips_amount: tip,
    currency,
    payment_method: "QR",
    payment_at: new Date().toISOString(),
  };
};