import { Server } from "socket.io";
import { userFromAccessToken } from "../services/authService";
import { setupChatRoomSocket } from "./chatRoomSocket";
import { UserWithPreferences } from "../models/userTypes";
import { setupProximitySocket } from "./proximitySocket";
import { User_Settings } from "@prisma/client";

const userSocketMap : {[userId:number]: {
  socketId: string,
  proximityRadius: number
}} = {};

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("No token provided"));
      }

      const user = await userFromAccessToken(token) as UserWithPreferences;
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
    const user = socket.user as UserWithPreferences;
     if (!user) {
        return (new Error("User no longer exists"));
      }

      userSocketMap [user.id] = {
        socketId: socket.id,
        proximityRadius: user.preferences?.proximityRadius ?? 2,
      }

    console.log(`User ${user.displayId} connected via WebSocket`);

    setupChatRoomSocket(io,socket,user);
    setupProximitySocket(io,socket,user,userSocketMap);

    socket.on("disconnect", () => {
      delete userSocketMap[user.id]
      console.log(`User ${user.displayId} disconnected`);
    });
  });
}
