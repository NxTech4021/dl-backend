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
import { getApiPrefix, getTrustedOrigins } from "./config/network";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler";
// import pinoHttp from "pino-http";
// import pino from "pino";
import { securityHeaders } from "./middlewares/security";

const app = express();

// Trust exactly 1 reverse-proxy hop (nginx in dev, ALB in prod). With `true`,
// Express takes the LEFTMOST X-Forwarded-For value as req.ip - allowing attackers
// to spoof the header and bypass ALL per-IP rate limiters (authLimiter,
// crashReportLimiter, generalLimiter, etc.). With `1`, Express takes the
// RIGHTMOST value (the one the proxy actually injected). Integration tests
// override this per-test via app.set('trust proxy', false) so they are unaffected.
app.set("trust proxy", 1);

// // Configure pino for clean, concise logging
// const pinoLogger = pino({
//   level: process.env.LOG_LEVEL || "info",
//   ...(process.env.NODE_ENV === "development" && {
//     transport: {
//       target: "pino-pretty",
//       options: {
//         colorize: true,
//         translateTime: "HH:MM:ss",
//         ignore: "pid,hostname",
//         singleLine: true,
//       },
//     },
//   }),
// });

// // Configure pino-http middleware
// const httpLogger = pinoHttp({
//   logger: pinoLogger,
//   // Customize serializers to reduce log noise
//   serializers: {
//     req: (req) => ({
//       method: req.method,
//       url: req.url,
//     }),
//     res: (res) => ({
//       statusCode: res.statusCode,
//     }),
//   },
//   // Custom log level based on status code
//   customLogLevel: (_req, res, err) => {
//     if (res.statusCode >= 500 || err) return "error";
//     if (res.statusCode >= 400) return "warn";
//     if (res.statusCode >= 300) return "silent"; // Don't log redirects/304s
//     return "info";
//   },
//   // Skip logging for noisy endpoints
//   autoLogging: {
//     ignore: (req) => {
//       const url = req.url || "";
//       return (
//         url === "/health" ||
//         url === "/favicon.ico" ||
//         url.startsWith("/socket.io")
//       );
//     },
//   },
// });

// Initialize notification service with socket.io for real-time notifications

// Apply security middlewares first
app.use(securityHeaders);

// TODO(AWS-M-38): generalLimiter intentionally not applied until Phase 2 when
// rate-limit-redis is wired to ElastiCache. In-memory rate limiting resets per
// Fargate task, making a naively-applied limit N-multiply across tasks. Must
// ship alongside Redis store. Track at docs/plans/2026-04-14-aws-migration-
// architecture-stress-tests.md (M-4 / M-38).
// app.use(generalLimiter);

// Dead middleware removed in pre-Phase 0 cleanup (2026-04-15):
//   - sanitizeInput: no-op (Express 5 req.query is read-only, middleware just called next())
//   - preventSQLInjection: false-positive regex blocked legitimate English ("UPDATE", "DELETE", etc.)
//                          Prisma's parameterized queries provide actual SQL injection protection.
//   - ipBlocker: counter branch was unreachable (suspiciousActivity map never written)
// AWS WAF managed rule sets will replace real defense-in-depth post-migration.
// Request logging is now handled by pino-http with clean, concise output

// Set up CORS
app.use(
  cors({
    origin: getTrustedOrigins(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // allowedHeaders: ["*"], // Allow all headers temporarily for debugging
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "expo-origin",
    "Cache-Control",
      "Cookie", // Required for better-auth
    ],
  })
);

// According to the official Express documentation for better-auth,
// the auth handler must be mounted BEFORE express.json().
// Express v5 requires the {*any} syntax for wildcard routes.
const authHandler = (req: Request, res: Response) => {
  try {
    void toNodeHandler(auth)(req, res);
  } catch (error) {
    // pinoLogger.error(
    //   { err: error, method: req.method, path: req.path },
    //   "Auth handler error"
    // );
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
// app.use(httpLogger);

// NOW create server + socket
const httpServer = createServer(app);

const io = socketHandler(httpServer);

app.use(socketMiddleware(io));

notificationService.setSocketIO(io);

// Mount API routes with configurable prefix
// Development: /api, Production: "" (nginx handles /api prefix)
const apiPrefix = getApiPrefix();
// pinoLogger.info({ apiPrefix: apiPrefix || "/" }, "API routes mounted");
// Mount router with the API prefix
app.use(apiPrefix, router); // remmeber to remove the apiPrefix when deploying to production

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// #3: Error handling middleware — MUST be registered AFTER all routes.
// notFoundHandler catches requests to unknown routes and returns JSON 404.
// errorHandler catches any unhandled errors (Prisma, validation, auth, etc.)
// and returns a consistent JSON error shape matching sendError().
// Express 5 automatically routes async rejections here — no asyncHandler needed.
app.use(notFoundHandler);
app.use(errorHandler);

export { httpServer, io };
export default app;

