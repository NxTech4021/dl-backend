import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth"; // kept from first version (adjust if you want "./auth")
import onboardingRoutes from "./routes/onboarding";
import router from "./routes/index"; // or "./routes/mainRoute" if that's your main router
import locationRoute from "./routes/locationRoute";
import locationsApi from "./routes/locations";
import pino from "pino-http";

const app = express();

// Debugging middleware
app.use((req, res, next) => {
  console.log("--- INCOMING REQUEST ---");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Origin Header:", req.headers.origin);
  console.log("----------------------");
  next();
});

// Set up CORS (merged origins + headers from both versions)
app.use(
  cors({
    origin: [
      "http://localhost:3030",
      "http://localhost:82",
      "http://localhost:3001",
      "http://localhost:8081",
      "http://192.168.1.7:3001",
      "http://192.168.100.53:8081", // Mobile app origin
      "exp://192.168.100.53:8081", // Expo dev server
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "expo-origin",
    ],
  })
);

// Auth handler must come BEFORE express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

// Global middlewares
app.use(express.json());
app.use(cookieParser());
app.use(pino());

// Main API routes
app.use("/api", router);

// Onboarding routes (deduplicated)
app.use("/api/onboarding", onboardingRoutes);

// Location routes
app.use("/api/users", locationRoute);

// Public locations search/reverse geocode routes
app.use("/api/locations", locationsApi);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

export default app;
