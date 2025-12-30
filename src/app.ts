import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import { socketHandler } from "./utils/socketconnection";
import { notificationService } from "./services/notificationService";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { socketMiddleware } from "./middlewares/socketmiddleware";
import router from "./routes/index";
import { getApiPrefix } from "./config/network";
import pinoHttp from "pino-http";
import pino from "pino";
import {
  securityHeaders,
  sanitizeInput,
  preventSQLInjection,
  ipBlocker,
} from "./middlewares/security";

const app = express();

console.log("1");

app.set("trust proxy", true);

console.log("2");

console.log("3");

// Configure pino for clean, concise logging
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: true,
      },
    },
  }),
});

// Configure pino-http middleware
const httpLogger = pinoHttp({
  logger: pinoLogger,
  // Customize serializers to reduce log noise
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  // Custom log level based on status code
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    if (res.statusCode >= 300) return "silent"; // Don't log redirects/304s
    return "info";
  },
  // Skip logging for noisy endpoints
  autoLogging: {
    ignore: (req) => {
      const url = req.url || "";
      return (
        url === "/health" ||
        url === "/favicon.ico" ||
        url.startsWith("/socket.io")
      );
    },
  },
});

// Initialize notification service with socket.io for real-time notifications

// Apply security middlewares first
app.use(securityHeaders);
app.use(ipBlocker);
// app.use(generalLimiter); // Commented out for development
app.use(sanitizeInput);
app.use(preventSQLInjection);

// Request logging is now handled by pino-http with clean, concise output

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
      "http://192.168.100.3:8081",
      "exp://192.168.100.3:8081",
      "http://192.168.100.53:8081",
      "exp://192.168.100.53:8081",
      "http://172.20.10.3:8081",
      "exp://172.20.10.3:8081",
      "http://10.72.179.58:8081",
      "exp://10.72.179.58:8081",
      "http://10.72.180.20:8081",
      "exp://10.72.180.20:8081",
      "https://staging.appdevelopers.my",
    ], // Allow nginx proxy, direct access, and local IP
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
    // allowedHeaders: [
    //   "Content-Type",
    //   "Authorization",
    //   "X-Requested-With",
    //   "expo-origin",
    //   "Cache-Control",
    // ],
  })
);

// According to the official Express documentation for better-auth,
// the auth handler must be mounted BEFORE express.json().
// Express v5 requires the {*any} syntax for wildcard routes.
const authHandler = (req: Request, res: Response) => {
  try {
    void toNodeHandler(auth)(req, res);
  } catch (error) {
    pinoLogger.error(
      { err: error, method: req.method, path: req.path },
      "Auth handler error"
    );
    res.status(500).json({ error: "Authentication error" });
  }
};

// Register for both paths to work in both environments
app.all("/api/auth/{*any}", authHandler);
app.all("/auth/{*any}", authHandler);

// The JSON parser for any other routes you might add later.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(httpLogger);

// NOW create server + socket
const httpServer = createServer(app);
const io = socketHandler(httpServer);

app.use(socketMiddleware(io));

notificationService.setSocketIO(io);

// Mount API routes with configurable prefix
// Development: /api, Production: "" (nginx handles /api prefix)
const apiPrefix = getApiPrefix();
pinoLogger.info({ apiPrefix: apiPrefix || "/" }, "API routes mounted");
// Mount router with the API prefix
app.use(router);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

export { httpServer, io };
export default app;
