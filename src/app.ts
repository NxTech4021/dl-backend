import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import onboardingRoutes from "./routes/onboarding";
import router from "./routes/index";
import pino from "pino-http";

const app = express();

// This is for debugging purposes only
app.use((req, res, next) => {
  console.log("--- INCOMING REQUEST ---");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Origin Header:", req.headers.origin);
  console.log("----------------------");
  next();
});

// Set up CORS - More permissive for development
app.use(
  cors({
    origin: [
      "http://localhost:3030",
      "http://localhost:82",
      "http://localhost:3001",
      "http://localhost:8081",
      "http://192.168.1.7:3001",
    ], // Allow nginx proxy, direct access, and local IP
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// According to the official Express documentation for better-auth,
// the auth handler must be mounted BEFORE express.json().
// The "/api/auth/*" pattern is recommended for Express v4.
// According to the official Express documentation for better-auth,
// the auth handler must be mounted BEFORE express.json().
// The "/api/auth/*" pattern is recommended for Express v4.
// OLD: app.all("/auth/*splat", toNodeHandler(auth));
// FIX: Updated to match frontend expectations - frontend calls /api/auth/*
app.all("/api/auth/*splat", toNodeHandler(auth));

// The JSON parser for any other routes you might add later.
app.use(express.json());
app.use(cookieParser());
app.use(pino());

// Keep main router at root level for health checks and other non-API routes
app.use(router);

// Mount onboarding routes
// TO-DO Move all the routes to one main routes file
// OLD: app.use("/onboarding", onboardingRoutes);
// FIX: Mount at /api/onboarding to match frontend expectations
app.use("/api/onboarding", onboardingRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

export default app;
