import express from "express";
import adminRouter from "./adminRoutes";
import playerRouter from "./playerRoutes";
import seasonRouter from "./seasonRoutes";
import divisionRoutes from "./divisionRoutes";
import matchRoutes from "./matchRoutes";


const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/api/admin", adminRouter);
router.use("/api/player", playerRouter);

// Divisions, Leagues,  Matches & Seasons

// router.use("/api/league", playerRouter);
router.use("/api/division", divisionRoutes);
router.use("/api/match", matchRoutes);
router.use("/api/season", seasonRouter);

// LeaderBoard 

// Chat 


// Settings 

// Notification?


// router.post("/api/")

export default router;
