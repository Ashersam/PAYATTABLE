"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { getBill, createPayment, confirmPayment } from "@/services/api";
import DropIn from "@/components/DropIn";
import { getSymbol } from "@/services/helper";
import ProcessingScreen from "@/components/ProcessingScreen";
import SuccessAnimation from "@/components/SuccessAnimation";
import loadingAnim from "../../../animations/loading.json";
import Done from "../../../animations/done2.json";
import Lottie from "lottie-react";
import LoadingScreen from "@/components/LoadingScreen";
import PaymentTransition from "@/components/PaymentTransition";
import PaymentMethods from "@/components/PaymentMethods";
import HeaderCard from "@/components/HeaderCard";
import BillItems from "@/components/BillItems";
import BillSummary from "@/components/BillSummary";
import TipSelector from "@/components/TipSelector";
import SuccessPage from "@/app/success/SuccessContent";

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const pollingRef = useRef(null);
  const [bill, setBill] = useState(null);
  const [tip, setTip] = useState(0);
  const [intentId, setIntentId] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [dropinLoading, setDropinLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingSuccess, setProcessingSuccess] = useState(false);
  const [showFinalSuccess, setShowFinalSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isPaid, setIsPaid] = useState(false);
  const [noBill, setNoBill] = useState(false);

  const symbol = getSymbol(currency);

  // ✅ SINGLE FETCH (FIXED)
  useEffect(() => {
    if (params?.tableId) {
      getBill(params.tableId)
        .then((data) => {
          console.log(data)
          setBill(data);
          setNoBill(false);
          if (data?.error === "No active bill") {
            setBill(null);
            setNoBill(true);
          }
          if (data?.error === "Bill already paid") {
            setIsPaid(true);
          }
          if (data?.status === "PAID") {
            setIsPaid(true);
          }
        })
        .catch(() => {
          setBill(null);
          setNoBill(true);
        });
    }
  }, [params]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);


  const startPollingStatus = () => {
    if (pollingRef.current) return; // already polling

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/payment/status?billId=${bill.receipt_no}`
        );

        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "PAID") {
          clearInterval(pollingRef.current);
          pollingRef.current = null;

          setProcessingSuccess(false);
          setShowFinalSuccess(true);
          setIsPaid(true);

          setTimeout(() => {
            router.push(
              `/success?receiptNo=${bill.receipt_no}`
            );
          }, 2000);
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
  };

  // ✅ SUCCESS REDIRECT
  useEffect(() => {
    if (showFinalSuccess && bill) {
      setTimeout(() => {
        // router.push(
        //   `/success?amount=${bill.total}&currency=${bill.currency}`
        // );
        router.push(
          `/success?receiptNo=${bill.receipt_no}`
        );
      }, 1800);
    }
  }, [showFinalSuccess, bill]);

  // const handlePay = async () => {
  //   try {
  //     setProcessing(true);

  //     const res = await createPayment({
  //       billId: bill.receipt_no,
  //       tip: Number(tip || 0),
  //       currency: bill.currency,
  //     });

  //     console.log("💳 CREATE PAYMENT RESPONSE:", res);

  //     if (res?.error) {
  //       console.error("❌ Payment creation failed:", res.error);

  //       setProcessing(false);

  //       if (
  //         res.error === "Bill already paid"
  //       ) {
  //         setIsPaid(true);
  //       }

  //       return;
  //     }

  //     setIntentId(res.intent_id);
  //     setClientSecret(res.client_secret);
  //     setCurrency(res.currency);

  //   } catch (err) {
  //     console.error("❌ Payment error:", err);
  //     setProcessing(false);
  //   }
  // };

  const handlePay = async () => {
    try {
      setProcessing(true);

      const paymentAmount = Number(
        (payableAmount + Number(tip || 0)).toFixed(2)
      );

      console.log("💰 PAYMENT AMOUNT:", paymentAmount);
      console.log("🧾 RECEIPT:", bill.receipt_no);
      console.log("💵 TIP:", tip);

      const res = await createPayment({
        billId: bill.receipt_no,
        amount: paymentAmount,
        tip: Number(tip || 0),
        currency: bill.currency,
      });

      console.log("💳 CREATE PAYMENT RESPONSE:", res);

      if (!res || res.error) {
        console.error("❌ Payment creation failed:", res);
        setProcessing(false);
        return;
      }

      setIntentId(res.intent_id);
      setClientSecret(res.client_secret);
      setCurrency(res.currency || bill.currency);

    } catch (error) {
      console.error("❌ handlePay error:", error);
      setProcessing(false);
    }
  };

  // ✅ 1. NO BILL UI
  if (noBill) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded-xl shadow text-center">
          <h2 className="text-lg font-semibold">No Active Bill</h2>
          <p className="text-gray-500 mt-2">
            Table {params.tableId} has no open bill
          </p>
        </div>
      </div>
    );
  }

  // ✅ 2. LOADING UI (FIXED)
  if (!bill && !noBill) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading bill...</p>
      </div>
    );
  }

  // const base = Number(bill.total || 0); // POS total
  // const gst = Number((base * 0.05).toFixed(2));
  // const convenienceFee = Number((base * 0.01).toFixed(2));
  // const subtotal = Number((base + convenienceFee + gst).toFixed(2));
  // const totalWithTip = Number((subtotal + tip).toFixed(2));

  const subtotal = Number(bill.subtotal || 0);
  const payableAmount = Number(bill.balance || 0);
  const totalWithTip = Number(
    (payableAmount + Number(tip || 0)).toFixed(2)
  );

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-start p-4">
      {/* {processingSuccess && (
        <LoadingScreen text="Confirming Payment..." />
      )}

      {showFinalSuccess && <SuccessAnimation />} */}
      {(processingSuccess || showFinalSuccess) && (
        <PaymentTransition
          processing={processingSuccess}
          success={showFinalSuccess}
        />
      )}

      <div className="w-full max-w-md mx-auto bg-white rounded-[28px] shadow-[0_8px_35px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">

        {/* Header */}
        <HeaderCard
          tableId={params.tableId}
          receiptNo={bill.receipt_no}
          operatorName={bill.raptor.operatorname}
          openDate={bill.raptor.orderdate}
        />

        {/* RECEIPT */}

        <BillItems items={bill.items} symbol={symbol} />


        <BillSummary
          subtotal={Number(bill.subtotal || 0)}
          discount={Number(bill.discount || 0)}
          surcharge={Number(bill.surcharge || 0)}
          taxes={bill.taxes || []}
          total={Number(bill.balance || 0)}
          symbol={symbol}
        />

        <TipSelector total={subtotal} tip={tip} setTip={setTip} />
        {/* TOTAL SECTION */}
        <div className="px-5 mt-2 py-4 border-t bg-white">

          <div className="flex text-gray-700 justify-between items-center text-lg font-semibold">
            <span>Total</span>
            <span className="text-xl ">{symbol} {totalWithTip}</span>
          </div>

        </div>

        {/* PAYMENT */}
        <div className="p-5 pt-3">
          {!isPaid ? (
            <>
              {!intentId ? (
                <button
                  onClick={handlePay}
                  disabled={processing}
                  className="w-full bg-black text-white py-3 rounded-2xl font-semibold text-base shadow-md hover:opacity-90 transition active:scale-95 disabled:opacity-50"
                >
                  {processing
                    ? "Processing..."
                    : `Pay ${symbol} ${totalWithTip}`}
                </button>
              ) : (
                <div className="relative min-h-[220px]">

                  {/* Loader */}
                  {dropinLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white rounded-xl z-10">
                      <div className="w-32">
                        <Lottie animationData={loadingAnim} loop />
                        <p className="text-xs text-gray-400 text-center mt-2">
                          Loading payment...
                        </p>
                      </div>
                    </div>
                  )}

                  <DropIn
                    intentId={intentId}
                    total={totalWithTip}
                    tip={Number(tip)}
                    tableId={params.tableId}
                    clientSecret={clientSecret}
                    currency={currency}


                    onReady={() => {
                      setTimeout(() => {
                        setProcessing(false);
                        setDropinLoading(false);
                      }, 300);
                    }}

                    onSuccess={() => {
                      // 🔥 NO confirmPayment call here
                      setProcessingSuccess(true);

                      // start polling backend
                      startPollingStatus();
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <SuccessPage receiptNo={bill.receipt_no} />
          )}
        </div>
      </div>
    </div>
  );
}