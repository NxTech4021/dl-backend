import express from "express";
import adminRouter from "./adminRoutes";
import playerRouter from "./playerRoutes";
import seasonRouter from "./seasonRoutes";
import leagueRouter from "./leagueRoutes";
import onboardingRoutes from "./onboarding";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/admin", adminRouter);

router.use("/player", playerRouter);
router.use("/league", leagueRouter);

router.use("/season", seasonRouter);

router.use("/onboarding", onboardingRoutes);

// LeaderBoard

// Chat

// Settings

// Notification?

// router.post("/api/")

export default router;
