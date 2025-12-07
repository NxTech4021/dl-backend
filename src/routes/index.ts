import express from "express";
import adminRouter from "./adminRoutes";
import playerRouter from "./playerRoutes";
import seasonRouter from "./seasonRoutes";
import divisionRoutes from "./divisionRoutes";
import teamChangeRequestRoutes from "./teamChangeRequestRoutes";
import leagueRoutes from "./leagueRoutes";
import sponsorRoutes from "./sponsorRoutes";
import categoryRoutes from "./categoryRoutes";
import pairingRouter from "./pairingRoutes";
import onboardingRouter from "./onboarding";
import chatRoutes from "./threadRoutes";
import notificationRouter from "./notificationRoutes";
import notificationPreferenceRouter from "./notificationPreferenceRoutes";
import matchRoutes from "./matchRoutes";
import bugRouter from "./bugRoutes";
import ratingRoutes from "./ratingRoutes";
import standingsRoutes from "./standingsRoutes";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running..." });
});

router.use("/admin", adminRouter);

router.use("/player", playerRouter);
router.use("/onboarding", onboardingRouter);

router.use("/league", leagueRoutes);
router.use("/division", divisionRoutes);
router.use("/team-change-requests", teamChangeRequestRoutes);
router.use("/season", seasonRouter);
router.use("/sponsor", sponsorRoutes);
router.use("/category", categoryRoutes);
router.use("/pairing", pairingRouter);

router.use("/match", matchRoutes);

// Ratings & Standings
router.use("/ratings", ratingRoutes);
router.use("/standings", standingsRoutes);

// Chat
router.use("/chat", chatRoutes);

// Settings

// Notification
router.use("/notifications", notificationRouter);
router.use("/notification-preferences", notificationPreferenceRouter);

// Bug Tracking
router.use("/bug", bugRouter);

// router.post("/api/")

export default router;
