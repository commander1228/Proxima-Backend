import * as Sentry from "@sentry/node";

// Initialize Sentry before anything else so it can instrument all modules.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV ?? "development",
});

import express from "express";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/auth";
import chatRoomRoutes from "./routes/chatRoom";
import locationRoutes from "./routes/location";
import userRoutes from "./routes/user";
import { setupSocket } from "./websocket/setupSocket";
import { setIo } from "./websocket/ioInstance";
import { startModerationWorker } from "./moderation";
import helmet from "helmet";
import logger from "./utils/logger";
import rateLimit from "express-rate-limit";
import feedbackRoutes from "./routes/feedback";
import postRoutes from "./routes/post";
import feedRoutes from "./routes/feed";
import uploadRouter from "./routes/upload";
import reportRoutes from "./routes/report";
import moderationRoutes from "./routes/moderation";
import notificationRoutes from "./routes/notification";
import { startNotificationScheduler } from "./notifications";
import { startProximityMessageCleanup } from "./jobs/proximityMessageCleanup";
import { startMessageWriteWorker } from "./jobs/messageWriteWorker";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8000;

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 750,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP, please try again later.",
  },
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
    return next();
  }
  express.json()(req, res, next);
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/chatroom", chatRoomRoutes);
app.use("/api/user", userRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/post", postRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/moderation", moderationRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/upload", uploadRouter);

app.get("/", (_req, res) => {
  res.json({ status: "Proxima API running" });
});

// ── Error handler (must be last) ──────────────────────────────────────────────
// Sentry must capture the error before we respond, so its handler comes first.
Sentry.setupExpressErrorHandler(app);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ── Server ────────────────────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
});
setIo(io);
setupSocket(io);
startMessageWriteWorker(io);

// ── Moderation Worker ─────────────────────────────────────────────────────────
// Start the background moderation worker. It receives the Socket.io server
// so it can emit real-time "ghost delete" events when toxic content is detected.
// The worker runs inside this same Node.js process — no separate service needed.
if (process.env.OPENAI_API_KEY) {
  startModerationWorker(io);
} else {
  console.warn(
    "[Moderation] OPENAI_API_KEY not set — moderation worker is DISABLED. " +
      "Content will be saved but not checked."
  );
}

// ── Notification Scheduler ───────────────────────────────────────────────────
// Starts the background scheduler that checks for inactive users and sends
// reminder push notifications. Runs in the same process — no extra service.
startNotificationScheduler();

// ── Proximity Message Cleanup ─────────────────────────────────────────────────
// Deletes proximity messages older than 48 hours. Runs hourly.
startProximityMessageCleanup();

if (require.main === module) {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

export default app;