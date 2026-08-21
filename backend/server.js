import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import billRoutes from "./src/modules/bill/bill.routes.js";
import paymentRoutes from "./src/modules/payment/payment.routes.js";
import raptorRoutes from "./src/routes/raptor.routes.js";


dotenv.config();

const app = express();

// 🔐 security
app.use(helmet());

// 🌐 CORS (you can tighten later)
app.use(cors());

app.use("/raptor", raptorRoutes);

// Webhook route must receive raw body
app.use(
  "/payment/webhook/airwallex",
  express.raw({ type: "application/json" })
);

// All other APIs
app.use(express.json());

// rate limit (BEFORE routes)
app.use("/payment", rateLimit({
  windowMs: 60 * 1000,
  max: 500,
}));

// protect webhook (IMPORTANT)
app.use("/payment/webhook", rateLimit({
  windowMs: 60 * 1000,
  max: 100,
}));

// 📦 routes
app.use("/bill", billRoutes);
app.use("/payment", paymentRoutes);

app.listen(process.env.PORT, () =>
  console.log(`Server running on ${process.env.PORT}`)
);