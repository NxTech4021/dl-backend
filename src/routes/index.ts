import express from "express";

import { auth } from "../lib/auth";

const router = express.Router();

import adminrouter from "./adminRoutes";
import playerRouter from "./playerRoutes";

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/api/admin", adminrouter);
router.use("/api/player", playerRouter);

// router.post("/api/")

export default router;
