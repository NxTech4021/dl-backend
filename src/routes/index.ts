import express from "express";
import adminRouter from "./adminRoutes";
import playerRouter from "./playerRoutes";
import seasonRouter from "./seasonRoutes";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/admin", adminRouter);
router.use("/player", playerRouter);

// Divisions, Leagues,  Matches & Seasons

// router.use("/api/league", playerRouter);
// router.use("/api/division", playerRouter);
// router.use("/api/match", playerRouter);
router.use("/season", seasonRouter);

// LeaderBoard

// Chat

// Settings

// Notification?

// router.post("/api/")

export default router;
