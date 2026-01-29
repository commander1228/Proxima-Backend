import express from "express";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import authRoutes from "./routes/auth";
import chatRoomRoutes from "./routes/chatRoom";
import { setupSocket } from "./websocket/setupSocket";

dotenv.config();


const app = express();
const PORT = process.env.PORT || 8000;


const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map(origin => origin.trim());

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
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/chatroom", chatRoomRoutes);

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

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
