import express from "express";
import cors from "cors";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import { socketHandler } from "./utils/socketconnection";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { socketMiddleware } from "./middlewares/socketmiddleware";
import router from "./routes/index";
import { getApiPrefix } from "./config/network";
import pino from "pino-http";
import {
  securityHeaders,
  sanitizeInput,
  preventSQLInjection,
  ipBlocker,
} from "./middlewares/security";
// Rate limiters are commented out for development
// import {
//   generalLimiter,
//   authLimiter,
//   onboardingLimiter,
// } from "./middlewares/rateLimiter";

const app = express();

app.set("trust proxy", 1);

const httpServer = createServer(app);
const io = socketHandler(httpServer);

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
      "http://10.72.179.58:8081", // Previous network IP
      "exp://10.72.179.58:8081", // Previous Expo origin
      "http://10.72.180.20:8081", // Current network IP
      "exp://10.72.180.20:8081", // Current Expo origin
      "https://staging.appdevelopers.my",
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

// According to the official Express documentaticlon for better-auth,
// the auth handler must be mounted BEFORE express.json().
// Express v5 requires the {*any} syntax for wildcard routes.
app.all("/api/auth/{*any}", (req, res) => {
  console.log(`🔐 Auth request: ${req.method} ${req.path}`);
  try {
    void toNodeHandler(auth)(req, res);
  } catch (error) {
    console.error("❌ Auth handler error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
});

// The JSON parser for any other routes you might add later.
app.use(express.json());
app.use(cookieParser());
app.use(pino());

app.use(socketMiddleware(io));

// Mount API routes with configurable prefix
// Development: /api, Production: "" (nginx handles /api prefix)
const apiPrefix = getApiPrefix();
console.log(`📡 API routes mounted at: ${apiPrefix || "(root)"}`);
app.use(router);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

export { httpServer, io };
export default app;
