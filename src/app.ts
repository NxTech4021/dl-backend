import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import onboardingRoutes from "./routes/onboarding";
import router from "./routes/index";
import pino from "pino-http";
import {
  securityHeaders,
  sanitizeInput,
  preventSQLInjection,
  ipBlocker,
} from "./middleware/security";
import {
  generalLimiter,
  authLimiter,
  onboardingLimiter,
} from "./middleware/rateLimiter";

const app = express();

// Apply security middlewares first
app.use(securityHeaders);
app.use(ipBlocker);
// app.use(generalLimiter); // Commented out for development
app.use(sanitizeInput);
app.use(preventSQLInjection);

// This is for debugging purposes only
app.use((req, res, next) => {
  console.log("--- INCOMING REQUEST ---");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Origin Header:", req.headers.origin);
  console.log("----------------------");
  next();
});

// Set up CORS
app.use(
  cors({
    origin: [
      "http://localhost:3030",
      "http://localhost:82",
      "http://localhost",
      "http://localhost:3001",
      "http://localhost:8081",
      "http://192.168.1.3:3001", // Added current IP from logs
      "http://192.168.1.7:3001",
      "http://192.168.100.53:8081", // Mobile app origin
      "exp://192.168.100.53:8081", // Expo development server
      "http://172.20.10.3:8081", // New mobile app origin
      "exp://172.20.10.3:8081", // New Expo development server
    ], // Allow nginx proxy, direct access, and local IP
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "expo-origin",
      "Cache-Control",
    ],
  })
);

// Apply auth rate limiter to authentication routes
// app.use("/api/auth/{*any}", authLimiter); // Commented out for development

// According to the official Express documentaticlon for better-auth,
// the auth handler must be mounted BEFORE express.json().
// Express v5 requires the {*any} syntax for wildcard routes.
app.all("/auth/{*any}", (req, res, next) => {
  console.log(`🔐 Auth request: ${req.method} ${req.path}`);
  try {
    toNodeHandler(auth)(req, res, next);
  } catch (error) {
    console.error("❌ Auth handler error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
});

// The JSON parser for any other routes you might add later.
app.use(express.json());
app.use(cookieParser());
app.use(pino());

// Keep main router at root level for health checks and other non-API routes
app.use(router);

// Mount onboarding routes with rate limiting
app.use("/api/onboarding", onboardingLimiter, onboardingRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

export default app;
