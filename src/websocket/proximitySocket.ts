import { Server, Socket } from "socket.io";
import {
  getNearbyUsers,
  getNearbyUsersCount,
  saveUserLocation,
  getUserLocation,
  filterMutuallyNearbyUsers,
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
      await saveUserLocation(
        user.id,
        { latitude, longitude },
        user.preferences?.proximityRadius ?? 2,
      );

      return getNearbyUsersCount(
        user.id,
        user.preferences?.proximityRadius ?? 2,
      ).then((count) => {
        socket.emit("nearbyUserCount", { count });
      });
    } catch (error: any) {
      socket.emit("error", "An unexpected error has occured");
    }
  });

  socket.on(
    "sendProximityMessage",
    async ({ latitude, longitude, content }) => {
      try {
        const message = await proximityMessageService.createProximityMessage(
          latitude,
          longitude,
          content,
          user.id,
        );

        const currentUserLocation = await getUserLocation(String(user.id));
        if (!currentUserLocation) {
          return socket.emit("error", "Action not Authorized");
        }

        const messageToSend = {
          ...message,
          content: message.content,
          senderDisplayId: message.sender.displayId,
          timestamp: message.createdAt,
          messageId: message.id,
          isOwnMessage: message.senderId == user.id,
        };

        const nearbyUsers = await getNearbyUsers(
          currentUserLocation.latitude,
          currentUserLocation.longitude,
          user.preferences?.proximityRadius ?? 2,
        );

        if (!nearbyUsers) {
          return socket.emit("error", "no one nearby");
        }

        const usersToBroadCastTo = await filterMutuallyNearbyUsers(
          user.id,
          currentUserLocation,
          nearbyUsers,
          userSocketMap,
        );

        io.to(usersToBroadCastTo).emit(
          "receiveProximityMessage",
          messageToSend,
        );
      } catch (error: any) {
        socket.emit("error", "An unexpected error has occured");
      }
    },
  );
}
