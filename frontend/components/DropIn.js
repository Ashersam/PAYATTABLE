"use client";

import { useEffect } from "react";

export default function DropIn({ intentId, clientSecret, currency, onSuccess, total, onReady, tableId, tip }) {
  useEffect(() => {
    if (!intentId || !clientSecret) return;

    let dropIn;

    async function init() {
      try {
        // ✅ dynamic import (avoids SSR issues)
        const Airwallex = await import("@airwallex/components-sdk");

        await Airwallex.init({
          env: "demo", // change to "prod" later
        });

        // ✅ correct method
        dropIn = await Airwallex.createElement("dropIn", {
          intent_id: intentId,
          client_secret: clientSecret,
          currency: currency
        });

        dropIn.mount("dropin");

        onReady && onReady();

        dropIn.on("success", async (event) => {
          console.log("✅ Payment Success", event);
          if (onSuccess) {
            onSuccess(event); // ✅ MUST pass event
          }
          // setTimeout(() => {
          //   window.location.href = `/success?amount=${total}&currency=${currency}&tableId=${tableId}&tip=${tip}`;
          // }, 1500);
          });

      } catch (err) {
        console.error("❌ DropIn Error:", err);
      }
    }

    init();

    return () => {
      // cleanup
      if (dropIn) {
        dropIn.destroy();
      }
    };
  }, [intentId, clientSecret]);

  return <div id="dropin" />;
}