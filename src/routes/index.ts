import express from "express";

import { auth } from "../lib/auth";

const router = express.Router();

import adminrouter from "./adminRoutes";
import playerRouter from "./playerRoutes";
import paymentRoutes from "./paymentRoutes";
import leagueRoutes from "./leagueRoutes";

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/api/admin", adminrouter);
router.use("/api/player", playerRouter);
router.use("/api/payment", paymentRoutes);
router.use("/api/leagues", leagueRoutes);

// router.post("/api/")

export default router;
