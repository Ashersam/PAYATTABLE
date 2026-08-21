import express from "express";
import { getBill } from "./bill.controller.js";

const router = express.Router();

// router.get("/", getBill);
router.get("/bill/:tableId", getBill);

export default router;