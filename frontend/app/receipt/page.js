"use client";

import { Suspense } from "react";
import ReceiptContent from "./ReceiptContent";

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div>Loading receipt...</div>}>
      <ReceiptContent />
    </Suspense>
  );
}