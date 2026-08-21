"use client";

import Lottie from "lottie-react";
import loadingAnim from "../animations/payment.json";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500">

      <div className="bg-white/90 backdrop-blur rounded-3xl p-6 shadow-xl text-center w-[280px]">

        <Lottie animationData={loadingAnim} loop={true} />

        <h2 className="text-sm font-medium text-gray-700 mt-2">
          Processing Payment...
        </h2>

        <p className="text-xs text-gray-400 mt-1">
          Please wait
        </p>

      </div>
    </div>
  );
}