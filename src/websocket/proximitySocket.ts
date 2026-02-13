import { Server, Socket } from "socket.io";
import {
  getNearbyUsers,
  getNearbyUsersCount,
  saveUserLocation,
  getUserLocation,
  filterMutuallyNearbyUsers,
  removeUserLocation
} from "../utils/redisUserLocation";
import { UserWithPreferences } from "../models/userTypes";
import { ProximityMessageService } from "../services/ProximityMessageService";

const proximityMessageService = new ProximityMessageService();

export function setupProximitySocket(
  io: Server,
  socket: Socket,
  user: UserWithPreferences,
  userSocketMap: {
    [userId: number]: {
      socketId: string;
      proximityRadius: number;
    };
  },
) {
  socket.on("updateLocation", async ({ latitude, longitude }) => {
    try {
      await saveUserLocation(user.id, { latitude, longitude });
      const nearbyCount = await getNearbyUsersCount(
        user.id,
        userSocketMap[user.id]?.proximityRadius ?? 10000,
      );
      socket.emit("nearbyUserCount", { count: nearbyCount });
    } catch (error: any) {
      socket.emit("error", "An unexpected error has occured");
    }
  });

  socket.on(
    "sendProximityMessage",
    async ({ latitude, longitude, content }) => {
      try {
        console.log("[sendProximityMessage] Received:", {
          latitude,
          longitude,
          content,
          userId: user.id,
        });
        const message = await proximityMessageService.createProximityMessage(
          user.id,
          content,
          latitude,
          longitude,
        );
        if (!message) {
          console.error("[sendProximityMessage] Failed to create message", {
            userId: user.id,
            content,
            latitude,
            longitude,
          });
          return socket.emit("error", "Failed to create proximity message");
        }
        console.log("[sendProximityMessage] Created message:", message);

        const currentUserLocation = await getUserLocation(String(user.id));
        if (!currentUserLocation) {
          console.error("[sendProximityMessage] No user location found", {
            userId: user.id,
          });
          return socket.emit("error", "Action not Authorized");
        }

        const messageToSend = {
          ...message,
          content: message.content,
          senderDisplayId: message.sender.displayId,
          timestamp: message.createdAt,
          messageId: message.id,
          userId: user.id,
        };

        const nearbyUsers = await getNearbyUsers(
          currentUserLocation.latitude,
          currentUserLocation.longitude,
          user.preferences?.proximityRadius ?? 500,
        );
        console.log("[sendProximityMessage] nearbyUsers:", nearbyUsers);
        console.log("[sendProximityMessage] userSocketMap:", userSocketMap);

        if (!nearbyUsers || nearbyUsers.length === 0) {
          console.warn("[sendProximityMessage] No nearby users found", {
            userId: user.id,
          });
          return socket.emit("error", "no one nearby");
        }

        const usersToBroadCastTo = await filterMutuallyNearbyUsers(
          user.id,
          currentUserLocation,
          nearbyUsers,
          userSocketMap,
        );
        console.log(
          "[sendProximityMessage] usersToBroadCastTo (mutuallyNearby socketIds):",
          usersToBroadCastTo,
        );
        console.log(
          "[sendProximityMessage] Broadcasting message content:",
          content,
        );

        if (Array.isArray(usersToBroadCastTo)) {
          usersToBroadCastTo.forEach((socketId) => {
            io.to(socketId).emit("receiveProximityMessage", messageToSend);
          });
        } else if (typeof usersToBroadCastTo === "string") {
          io.to(usersToBroadCastTo).emit(
            "receiveProximityMessage",
            messageToSend,
          );
        }
      } catch (error: any) {
        console.error("[sendProximityMessage] Error:", error);
        socket.emit("error", "An unexpected error has occured");
      }
    },
  );

  socket.on("disconnect", () => {
        removeUserLocation(user.id);
        console.log(`User ${user.displayId} has been removed from redis server`);
      });
}
