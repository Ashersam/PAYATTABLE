"use client";

import Lottie from "lottie-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


import successAnim from "../../animations/paymentsuccessful.json";

export default function SuccessPage() {
    const params = useSearchParams();
    const router = useRouter();

    const [date, setDate] = useState("");

    // const amount = params.get("amount");
    // const currency = params.get("currency");
    // const tableId = params.get("tableId");
    // const tip = params.get("tip");

    const receiptNo = params.get("receiptNo");

    const [receipt, setReceipt] = useState(null);

    useEffect(() => {
        if (!receiptNo) return;

        fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/payment/receipt/${receiptNo}`
        )
            .then((r) => r.json())
            .then(setReceipt);
    }, [receiptNo]);

    useEffect(() => {
        setDate(new Date().toLocaleString());
    }, []);

    if (!receipt) {
        return (
          <div className="min-h-screen flex items-center justify-center">
            Loading...
          </div>
        );
      }

    const getSymbol = (cur) => {
        switch (cur) {
            case "INR": return "₹";
            case "USD": return "$";
            case "SGD": return "$";
            case "EUR": return "€";
            default: return cur;
        }
    };

    const symbol = getSymbol(receipt.currency);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-blue-500 to-indigo-400 p-4">

            {/* Main Card */}
            <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-3xl shadow-2xl overflow-hidden">

                {/* Top Section */}
                <div className="text-center px-6 pt-8 pb-4">

                    {/* Animation */}
                    <div className="w-40 mx-auto">
                        <Lottie animationData={successAnim} loop={true} />
                    </div>

                    <h2 className="text-xl font-semibold text-gray-800 mt-2">
                        Payment Successful
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                        Your payment has been confirmed
                    </p>
                </div>

                {/* Receipt Section */}
                <div className="bg-gray-50 px-5 py-4">

                    <div className="bg-white rounded-xl p-4 shadow-sm border">

                        {/* Title */}
                        <p className="text-sm font-medium text-gray-700">
                            Order Payment
                        </p>

                        {/* Date */}
                        <p className="text-xs text-gray-400 mt-1">
                            {date || "Loading..."}
                        </p>

                        {/* Divider */}
                        <div className="border-t border-dashed my-3"></div>

                        {/* Amount */}
                        <div className="flex justify-between items-center text-base font-semibold text-gray-800">
                            <span>Total Paid</span>
                            <span className="text-lg">{symbol} {receipt.amount}</span>
                        </div>

                    </div>

                    {/* Security Note */}
                    <p className="text-xs text-gray-400 text-center mt-3">
                        Secured by encrypted payment
                    </p>

                </div>

                {/* Bottom Button */}
                <div className="p-5">
                    <button
                        onClick={() =>
                            router.push(`/receipt?receiptNo=${receiptNo}`)
                        }
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium shadow-md hover:opacity-90 transition active:scale-95"
                    >
                        Show Receipt
                    </button>
                </div>

            </div>
        </div>
    );
}