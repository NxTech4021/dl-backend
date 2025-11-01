import express from "express";
import adminRouter from "./adminRoutes";
import playerRouter from "./playerRoutes";
import seasonRouter from "./seasonRoutes";
import divisionRoutes from "./divisionRoutes";
import leagueRoutes from "./leagueRoutes";
import sponsorRoutes from "./sponsorRoutes";
import categoryRoutes from "./categoryRoutes";
import pairingRouter from "./pairingRoutes";
import onboardingRouter from "./onboarding";
import chatRoutes from "./threadRoutes";
import notificationRouter from "./notificationRoutes";
import matchRoutes from "./matchRoutes";


const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/admin", adminRouter);

router.use("/player", playerRouter);
router.use("/onboarding", onboardingRouter);

router.use("/league", leagueRoutes);
router.use("/division", divisionRoutes);
router.use("/season", seasonRouter);
router.use("/sponsor", sponsorRoutes);
router.use("/category", categoryRoutes);
router.use("/pairing", pairingRouter);

router.use("/match", matchRoutes);

// LeaderBoard

// Chat
router.use("/chat", chatRoutes);

// Settings

// Notification
router.use("/notifcation", notificationRouter);

// router.post("/api/")

export default router;
