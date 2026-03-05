import { Server } from "socket.io";
import { userFromAccessToken } from "../services/authService";
import { setupChatRoomSocket } from "./chatRoomSocket";
import { UserWithPreferences } from "../models/userTypes";
import { setupProximitySocket } from "./proximitySocket";
import { removeUserLocation } from "../utils/redisUserLocation";
import { clearSession } from "../utils/redisSession";
import { getCachedBlockRelatedUserIds } from "../dao/BlockDao";
import { blockEvents } from "../events/blockEvents";

const userSocketMap: {
  [userId: number]: {
    socketId: string;
    proximityRadius: number;
  };
} = {};

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("No token provided"));
      }

      const user = (await userFromAccessToken(token)) as UserWithPreferences;
      if (!user) {
        return next(new Error("User no longer exists"));
      }

      if (!user.isVerified) {
        return next(new Error("User email is not verified"));
      }
      if (user.deleted) {
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
      return new Error("User no longer exists");
    }

    userSocketMap[user.id] = {
      socketId: socket.id,
      proximityRadius: user.preferences?.proximityRadius ?? 1609,
    };

    // Join a personal room so the moderation worker can emit targeted events
    socket.join(`user:${user.id}`);

    console.log(`User ${user.displayId} connected via WebSocket`);

    // Per-connection block list cache — shared by chat and proximity handlers.
    // Refreshed immediately via blockEvents when a block/unblock happens.
    const blockedUserIds = { set: new Set<number>() };
    getCachedBlockRelatedUserIds(user.id).then((ids) => {
      blockedUserIds.set = new Set(ids);
    });
    const refreshBlockList = () => {
      getCachedBlockRelatedUserIds(user.id).then((ids) => {
        blockedUserIds.set = new Set(ids);
      });
    };
    blockEvents.on(`changed:${user.id}`, refreshBlockList);

    setupChatRoomSocket(io, socket, user, userSocketMap, blockedUserIds);
    setupProximitySocket(io, socket, user, userSocketMap, blockedUserIds);

    socket.on("disconnect", () => {
      blockEvents.off(`changed:${user.id}`, refreshBlockList);
      delete userSocketMap[user.id];
      clearSession(user.id).catch(() => {});
      console.log(`User ${user.displayId} disconnected`);
    });
  });
}