"use client";

import { useState } from "react";

export default function TipSelector({ total, tip, setTip, symbol = "$" }) {
  const percentages = [0, 3, 5, 10];

  const [showCustom, setShowCustom] = useState(false);

  const format = (n) => Number(n || 0).toFixed(2);

  const handlePercent = (p) => {
    const value = (total * p) / 100;

    setTip(Number(value.toFixed(2)));
    setShowCustom(false); // 🔥 hide custom input
  };

  return (
    <div className="mt-4 px-4 py-3 bg-white rounded-2xl shadow-sm">

      {/* TITLE */}
      <h3 className="text-sm font-semibold text-gray-800 mb-1">
        Say thanks to our staff
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Your generosity is appreciated
      </p>

      {/* % BUTTONS */}
      <div className="flex gap-2">
        {percentages.map((p) => {
          const value = (total * p) / 100;

          return (
            <button
              key={p}
              onClick={() => handlePercent(p)}
              className={`flex-1 py-2 rounded-xl text-sm transition
              ${tip === Number(value.toFixed(2)) && !showCustom
                ? "bg-orange-700 text-white shadow"
                : "bg-gray-100 text-gray-700"}`}
            >
              {p === 0 ? "Not now" : `${p}%`}
              {p !== 0 && (
                <div className="text-[11px] opacity-80">
                  {symbol} {format(value)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* CUSTOM TIP BUTTON */}
      {!showCustom && (
        <button
          onClick={() => setShowCustom(true)}
          className="mt-3 flex items-center gap-2 text-sm text-orange-600 font-medium"
        >
          ✏️ Pay custom tip
        </button>
      )}

      {/* CUSTOM INPUT */}
      {showCustom && (
        <div className="mt-3">
          <input
            type="number"
            step="0.01"
            placeholder="Enter custom tip"
            className="w-full border-2 rounded-xl p-3 text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            onChange={(e) =>
              setTip(Number(Number(e.target.value).toFixed(2)))
            }
          />

          <button
            onClick={() => setShowCustom(false)}
            className="mt-2 text-xs text-gray-400"
          >
            Cancel custom tip
          </button>
        </div>
      )}

      {/* FINAL TIP DISPLAY */}
      <div className="mt-3 text-sm text-gray-600">
        Tip: <span className="font-semibold">{symbol} {format(tip)}</span>
      </div>
    </div>
  );
}