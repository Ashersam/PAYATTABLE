import express from "express";
import { createPayment, getEReceipt, getPaymentStatus, getReceipt } from "./payment.controller.js";
import { confirmPayment } from "./payment.controller.js";
import { handlePaymentSuccess } from "./webhook.controller.js";

const router = express.Router();

router.post("/", createPayment);
router.post("/confirm", confirmPayment);
router.post("/webhook/airwallex", handlePaymentSuccess);
router.get("/status", getPaymentStatus);
router.get("/receipt/:receiptNo", getReceipt);
router.get("/e-receipt/:receiptNo", getEReceipt);

export default router;