import express from "express";
import adminRouter from "./adminRoutes";
import playerRouter from "./playerRoutes";
import seasonRouter from "./seasonRoutes";
import divisionRoutes from "./divisionRoutes";
import leagueRoutes from "./leagueRoutes";
import sponsorRoutes from "./sponsorRoutes";
import categoryRoutes from "./categoryRoutes";
// import matchRoutes from "./matchRoutes";


const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/admin", adminRouter);

router.use("/player", playerRouter);

router.use("/league", leagueRoutes);
router.use("/division", divisionRoutes);
router.use("/season", seasonRouter);
router.use("/sponsor", sponsorRoutes);
router.use("/category", categoryRoutes);

// router.use("/match", matchRoutes);

// LeaderBoard

// Chat
// router.use("/chat", chatRoutes);

// Settings

// Notification?

// router.post("/api/")

export default router;
