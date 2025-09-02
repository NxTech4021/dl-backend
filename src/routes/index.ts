import express from "express";

import { auth } from "../lib/auth";

const router = express.Router();

import adminrouter from "./adminRoutes";

router.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

router.use("/admin", adminrouter);

// router.post("/api/")

export default router;
