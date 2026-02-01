import { Server } from "socket.io";
import { userFromAccessToken } from "../services/authService";
import { setupChatSocket } from "./chatRoomSocket";
import { Socket } from "socket.io-client";

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("No token provided"));
      }

      const user = await userFromAccessToken(token);
      if (!user) {
        return next(new Error("User no longer exists"));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
     if (!user) {
        return (new Error("User no longer exists"));
      }

    console.log(`User ${user.displayId} connected via WebSocket`);

    setupChatSocket(io,socket,user);

    socket.on("disconnect", () => {
      console.log(`User ${user.displayId} disconnected`);
    });
  });
}
