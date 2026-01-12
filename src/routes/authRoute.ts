import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth";
import { 
  verifyResetOtp, 
  checkEmailAvailability, 
  checkUsernameAvailability 
} from "../controllers/authController";
import { authLimiter } from "../middlewares/rateLimiter";

const router = express.Router();

// Custom auth endpoints (not handled by better-auth)
// Rate limited: 5 requests per 15 minutes per IP
router.post("/verify-reset-otp", authLimiter, verifyResetOtp);

// Email and username availability checks
// Rate limited to prevent abuse
router.post("/check-email", authLimiter, checkEmailAvailability);
router.post("/check-username", authLimiter, checkUsernameAvailability);

// router.get("/me", getMyData)

export default router;
