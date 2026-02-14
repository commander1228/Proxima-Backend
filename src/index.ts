import express from "express";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import authRoutes from "./routes/auth";
import chatRoomRoutes from "./routes/chatRoom";
import userRoutes from "./routes/user";
import { setupSocket } from "./websocket/setupSocket";
import helmet from "helmet";
import logger from "./utils/logger";
import rateLimit from "express-rate-limit";
import feedbackRoutes from "./routes/feedback"

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP, please try again later."
  }
});

import { Request, Response, NextFunction } from "express";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8000;

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json());
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});



app.use("/api/", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/chatroom", chatRoomRoutes);
app.use("/api/user", userRoutes );
app.use("/api/feedback", feedbackRoutes );

app.get("/", (_req, res) => {
  res.json({ status: "Proxima API running" });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
setupSocket(io);

// Only start the server when this file is run directly. Tests and other
// consumers that import `app` should create and control the HTTP server
// themselves to avoid port conflicts.
if (require.main === module) {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
