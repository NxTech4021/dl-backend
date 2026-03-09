import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth";
import {
  verifyResetOtp,
  checkEmailAvailability,
  checkUsernameAvailability,
  googleNativeSignIn,
  appleNativeSignIn
} from "../controllers/authController";
import { authLimiter, availabilityCheckLimiter } from "../middlewares/rateLimiter";

const router = express.Router();

// Custom auth endpoints (not handled by better-auth)
// Rate limited: 5 requests per 15 minutes per IP
router.post("/verify-reset-otp", authLimiter, verifyResetOtp);

// Email and username availability checks
// Rate limited to prevent abuse
router.post("/check-email", availabilityCheckLimiter, checkEmailAvailability);
router.post("/check-username", availabilityCheckLimiter, checkUsernameAvailability);

// Native Google Sign-In (for iOS/Android SDK)
router.post("/google/native", authLimiter, googleNativeSignIn);

// Native Apple Sign-In (for iOS)
router.post("/apple/native", authLimiter, appleNativeSignIn);

// router.get("/me", getMyData)

export default router;
