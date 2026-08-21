"use client";

import Lottie from "lottie-react";
import successAnim from "../animations/success.json";

export default function SuccessAnimation() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500">

      <div className="bg-white rounded-3xl p-6 shadow-xl text-center w-[280px]">

        <Lottie animationData={successAnim} loop={false} />

        <h2 className="text-lg font-semibold text-gray-800 mt-2">
          Payment Successful
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Confirmed securely
        </p>

      </div>
    </div>
  );
}