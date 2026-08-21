"use client";

import Lottie from "lottie-react";
import loadingAnim from "@/animations/payment.json";
import successAnim from "@/animations/success.json";

export default function PaymentTransition({ processing, success }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500">

      {/* LOADING */}
      <div
        className={`absolute transition-all duration-500 ${
          processing
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="bg-white rounded-3xl p-6 text-center shadow-xl w-[280px]">

          <div className="w-28 mx-auto">
            <Lottie animationData={loadingAnim} loop />
          </div>

          <p className="text-sm text-gray-600 mt-2">
            Confirming Payment...
          </p>
        </div>
      </div>

      {/* SUCCESS */}
      <div
        className={`absolute transition-all duration-500 ${
          success
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="bg-white rounded-3xl p-6 text-center shadow-xl w-[280px]">

          <div className="w-28 mx-auto">
            <Lottie animationData={successAnim} loop={false} />
          </div>

          <h2 className="text-lg font-semibold mt-2">
            Payment Successful
          </h2>
        </div>
      </div>

    </div>
  );
}