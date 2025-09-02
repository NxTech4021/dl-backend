import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth";

const router = express.Router();

// router.get("/me", getMyData)

export default router;
