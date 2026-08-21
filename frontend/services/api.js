const BASE = process.env.NEXT_PUBLIC_API_URL;

  export const getBill = (tableId) =>
  fetch(`${BASE}/bill/${tableId}`).then(r => r.json());

  export const createPayment = async (payload) => {
    const res = await fetch(`${BASE}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  
    return res.json();
  };

  export const confirmPayment = async (intentId, billId, amount, tip, currency) => {
    const res = await fetch(`${BASE}/payment/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intentId,
        billId,
        amount,
        tip,
        currency,
      }),
    });
  
    return res.json();
  };

  export const getReceipt = async (receiptNo) => {
    const res = await fetch(
      `${BASE}/payment/receipt/${receiptNo}`
    );
  
    return res.json();
  };