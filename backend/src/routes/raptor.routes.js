import express from "express";
import { testRaptorToken } from "../controllers/raptor.controller.js";

const router = express.Router();

router.get("/token-test", testRaptorToken);

export default router;