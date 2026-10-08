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
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [noItems, setNoItems] = useState(false);

  const symbol = getSymbol(currency);

  // ✅ SINGLE FETCH (FIXED)
  useEffect(() => {
    if (params?.tableId) {
      getBill(params.tableId)
        .then((data) => {
          console.log("Bill response:", data);

          // Reset states
          setNoBill(false);
          setAlreadyPaid(false);
          setNoItems(false);

          // --------------------------------
          // NO ACTIVE BILL
          // --------------------------------
          if (data?.error === "No active bill") {
            setBill(null);
            setNoBill(true);
            return;
          }

          // --------------------------------
          // ALREADY PAID
          // --------------------------------
          if (data?.error === "Bill already paid") {
            setBill(null);
            setAlreadyPaid(true);
            return;
          }

          if (data?.status === "PAID") {
            setBill(null);
            setAlreadyPaid(true);
            return;
          }

          // --------------------------------
          // BILL EXISTS BUT NO ITEMS
          // --------------------------------
          if (
            data &&
            Array.isArray(data.items) &&
            data.items.length === 0
          ) {
            setBill(null);
            setNoItems(true);
            return;
          }

          // --------------------------------
          // BILL WITH ITEMS
          // --------------------------------
          setBill(data);
        })
        .catch((error) => {
          console.error("Failed to load bill:", error);

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


  const handlePay = async () => {
    try {
      setProcessing(true);

      const paymentAmount = Number(
        (payableAmount + Number(tip || 0)).toFixed(2)
      );

      const res = await createPayment({
        billId: bill.receipt_no,
        amount: paymentAmount,
        tip: Number(tip || 0),
        currency: bill.currency,
      });

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

  /* =========================================
   NO ITEMS UI
   ========================================= */

if (noItems) {
  return (
    <div className="no-items-page">

      <div className="no-items-card">

        {/* Top accent */}
        <div className="no-items-accent" />

        {/* Animated icon */}
        <div className="no-items-icon-wrapper">

          <div className="no-items-icon-pulse" />

          <div className="no-items-icon">
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Plate */}
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />

              {/* Fork / plate detail */}
              <path
                d="M8.5 8.5V12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              <path
                d="M10 8.5V12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              <path
                d="M9.25 12V15.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              <path
                d="M15.5 8.5V15.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              <path
                d="M15.5 8.5C14.4 9.2 14.2 10.8 15.5 11.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div className="no-items-content">

          <h1>
            No Items Found
          </h1>

          <p className="no-items-description">
            There are currently no items
            <br />
            added to this table.
          </p>

        </div>

        {/* Table */}
        <div className="no-items-table">

          <span className="no-items-table-label">
            TABLE
          </span>

          <span className="no-items-table-number">
            {params.tableId}
          </span>

        </div>

        {/* Main message */}
        <div className="no-items-message">

          <p>
            Please place an order to continue.
          </p>

          <span>
            Once items are added to your table,
            <br />
            your bill will appear here.
          </span>

        </div>

        {/* Divider */}
        <div className="no-items-divider" />

        {/* Help */}
        <div className="no-items-help">

          <span className="no-items-help-label">
            Need assistance?
          </span>

          <span className="no-items-help-text">
            Please ask our staff for help.
          </span>

        </div>

      </div>

      {/* Footer */}
      <div className="no-items-brand">
        Scan to Pay
      </div>

    </div>
  );
}
  // ✅ 1. NO BILL UI
  if (noBill) {
    return (
      <div className="no-bill-page">
        <div className="no-bill-card">

          {/* Top accent */}
          <div className="no-bill-accent" />

          {/* Animated icon */}
          <div className="no-bill-icon-wrapper">
            <div className="no-bill-icon-pulse" />

            <div className="no-bill-icon">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />

                <path
                  d="M8.8 12.2L10.8 14.2L15.4 9.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="no-bill-content">
            <h1>No Outstanding Bill</h1>

            <p className="no-bill-description">
              There is currently no unpaid bill
              <br />
              for this table.
            </p>
          </div>

          {/* Table information */}
          <div className="no-bill-table">
            <span className="no-bill-table-label">
              TABLE
            </span>

            <span className="no-bill-table-number">
              {params.tableId}
            </span>
          </div>

          {/* Information */}
          <p className="no-bill-info">
            If you have just placed an order,
            <br />
            please wait a moment and try again.
          </p>

          {/* Divider */}
          <div className="no-bill-divider" />

          {/* Assistance */}
          <div className="no-bill-help">
            <span className="no-bill-help-label">
              Need assistance?
            </span>

            <span className="no-bill-help-text">
              Please ask our staff for help.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="no-bill-brand">
          Scan to Pay
        </div>
      </div>
    );
  }

  if (alreadyPaid) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-5">
        <div className="w-full max-w-md">

          <div className="bg-white rounded-[28px] shadow-[0_12px_45px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">

            <div className="h-1.5 bg-black" />

            <div className="px-7 py-10 text-center">

              {/* Success Icon */}
              <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-[#f1f8f3] flex items-center justify-center">
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="text-green-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m7 12 3.2 3.2L17 8.5"
                  />
                </svg>
              </div>

              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-gray-900">
                Payment Already Completed
              </h1>

              <p className="mt-3 text-[15px] leading-6 text-gray-500">
                This bill has already been paid.
                <br />
                No further payment is required.
              </p>

              <div className="mt-7 py-4 px-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                  Table
                </p>

                <p className="mt-1 text-base font-semibold text-gray-800">
                  {params.tableId}
                </p>
              </div>

              <div className="mt-7 pt-5 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Thank you for dining with us.
                </p>

                <p className="mt-1 text-sm font-medium text-gray-700">
                  We hope you enjoyed your meal.
                </p>
              </div>

            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Scan to Pay
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