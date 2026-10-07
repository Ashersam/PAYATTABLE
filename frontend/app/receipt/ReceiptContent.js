"use client";

import { getSymbol } from "@/services/helper";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ReceiptPage() {
  const params = useSearchParams();
  // const tableId = params.get("tableId");
  // const symbol = params.get("sym") || "₹";
  // const tip = params.get("tip");

  const receiptNo = params.get("receiptNo");
  const [bill, setBill] = useState(null);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (receiptNo) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/payment/receipt/${receiptNo}`)
        .then((res) => res.json())
        .then(setBill)
        .catch(console.error);
    }
  }, [receiptNo]);


  // 🧾 Auto scroll effect (printing feel)
  useEffect(() => {
    const el = document.getElementById("receipt");
    if (!el) return;

    let i = 0;
    const interval = setInterval(() => {
      el.scrollTop = el.scrollHeight;
      i++;
      if (i > 20) clearInterval(interval);
    }, 80);

    return () => clearInterval(interval);
  }, [bill]);

  if (!bill)
    return <div className="p-6 text-center">Loading receipt...</div>;

  const format = (n) => Number(n).toLocaleString();

  // 💰 Calculations
  const tipAmount = Number(bill.tip || 0);
  const base = Number(bill.total || 0);
  const symbol = getSymbol(bill.currency);
  const gst = Number((base * 0.05).toFixed(2));
  const convenienceFee = Number((base * 0.01).toFixed(2));
  const subtotal =   Number((base + convenienceFee + gst).toFixed(2));
  const finalTotal = Number((subtotal + tipAmount).toFixed(2));

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center p-4">

      {/* RECEIPT CONTAINER */}
      <div
        id="receipt"
        className="w-full max-w-sm bg-white text-zinc-500 p-4 shadow-md font-mono text-sm max-h-[85vh] overflow-y-auto rounded-lg"
      >

        {/* HEADER */}
        <div className="text-center print-line" style={{ animationDelay: "0s" }}>
          <p className="font-bold tracking-wide">MR. SATEKU</p>
          <p>Rumah Sarwono</p>
          <p>By</p>
          <p className="font-bold">DAPUR MAMIH</p>
          <p>Jl. Raya Pasar Minggu No.18</p>
        </div>

        {/* TABLE */}
        <div
          className="text-center font-bold text-lg my-2 print-line"
          style={{ animationDelay: "0.1s" }}
        >
          TABLE {bill.table_id}
        </div>

        {/* META */}
        <div
          className="text-xs print-line"
          style={{ animationDelay: "0.15s" }}
        >
          <div className="flex justify-between">
            <span>Pax: 1</span>
            <span>OP: INDAH</span>
          </div>
          <div className="flex justify-between">
            <span>POS Title: Cashier 1</span>
            <span>POS: POS001</span>
          </div>
          <div className="flex justify-between">
            <span>Rcpt#: {bill.receipt_no}</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t border-dashed my-2"></div>

        <div
          className="text-center font-bold print-line"
          style={{ animationDelay: "0.2s" }}
        >
          ----------- DINE IN -----------
        </div>

        {/* ITEMS */}
        <div className="mt-2 space-y-1">
          {bill?.items?.map((item, index) => (
            <div
              key={item.id}
              className="flex justify-between print-line"
              style={{
                animationDelay: `${0.25 + index * 0.08}s`,
              }}
            >
              <span>
                {item.quantity} {item.name}
              </span>
              <span>
                {symbol} {format(item.price)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed my-2"></div>

        {/* SUBTOTAL */}
        <div
          className="flex justify-between font-bold print-line"
          style={{ animationDelay: `${0.3 + bill.items.length * 0.08}s` }}
        >
          <span>SUBTOTAL</span>
          <span>
            {symbol} {format(base)}
          </span>
        </div>

        {/* TIP */}
        {tipAmount > 0 && (
          <div
            className="flex justify-between print-line"
            style={{ animationDelay: `${0.4 + bill.items.length * 0.08}s` }}
          >
            <span>TIP</span>
            <span>
              {symbol} {format(tipAmount)}
            </span>
          </div>
        )}

        {/* CONVENIENCE */}
        <div
          className="flex justify-between print-line"
          style={{ animationDelay: `${0.5 + bill.items.length * 0.08}s` }}
        >
          <span>CONVENIENCE 1%</span>
          <span>
            {symbol} {format(convenienceFee)}
          </span>
        </div>

        <div className="border-t border-dashed my-2"></div>

        {/* FINAL TOTAL */}
        <div
          className="flex justify-between text-lg font-bold print-line"
          style={{ animationDelay: `${0.6 + bill.items.length * 0.08}s` }}
        >
          <span>TOTAL</span>
          <span>
            {symbol} {format(finalTotal)}
          </span>
        </div>

        <div
          className="flex justify-between font-bold text-sm print-line"
          style={{ animationDelay: `${0.7 + bill.items.length * 0.08}s` }}
        >
          <span>QRPAY</span>
          <span>
            {symbol} {format(finalTotal)}
          </span>
        </div>

        <div className="mt-2 text-xs print-line" style={{ animationDelay: "1s" }}>
          <p>Name: 1</p>
        </div>

        <div className="border-t my-2"></div>

        {/* FOOTER */}
        <div
          className="text-center text-xs print-line"
          style={{ animationDelay: "1.1s" }}
        >
          <p className="font-bold">Closed Bill</p>
          <p>
            &lt;------ {new Date().toLocaleString()} ------&gt;
          </p>
          <p className="mt-2">Powered by</p>
          <p className="font-bold">RAPTOR POS</p>
          <p>www.raptorpos.com</p>
        </div>

        {/* PRINT BUTTON */}
        <button
          className="w-full mt-4 bg-black text-white py-2 rounded print-line"
          style={{ animationDelay: "1.2s" }}
          onClick={() => window.print()}
        >
          Print Receipt
        </button>
      </div>

      {/* 🎬 ANIMATION CSS */}
      <style jsx>{`
        @keyframes receiptPrint {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .print-line {
          opacity: 0;
          animation: receiptPrint 0.35s ease forwards;
        }
      `}</style>
    </div>
  );
}