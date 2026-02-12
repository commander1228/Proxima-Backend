import { Server, Socket } from "socket.io";
import { ChatRoomMessage, User } from "@prisma/client";
import {
  getChatRoomById,
  getLastFiftyMessages,
} from "../services/chatRoomService";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { getUserLocation, userInRange } from "../utils/redisUserLocation";
import { updateUserKarma } from "../services/userService";

function getUserCount(io: Server, roomId: string) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

const chatRoomMessageService = new ChatRoomMessageService();

export function setupChatRoomSocket(io: Server, socket: Socket, user: User) {
  socket.on("joinRoom", async (roomId: number) => {
    const chatRoom = await getChatRoomById(roomId);
    if (!chatRoom) {
      socket.emit("error", "Chat room not found");
      return;
    }

    if (chatRoom.longitude && chatRoom.latitude && chatRoom.size) {
      const userLocation = await getUserLocation(String(user.id));
      if (!userLocation) {
        socket.emit("error", "User location not found");
        return;
      }
      const isUserInRange = await userInRange(
        userLocation.latitude,
        userLocation.longitude,
        chatRoom,
      );
      if (!isUserInRange) {
        socket.emit("error", "You are out of range to join this chat room");
        return;
      }
    }

    socket.join(String(roomId));

    const userCount = getUserCount(io, String(roomId));

    io.to(String(roomId)).emit("userJoined", {
      displayId: user.displayId,
      chatRoom: chatRoom.name,
      userCount,
      message: `${user.displayId} has joined room ${chatRoom.name}`,
    });

    const lastMessages = await getLastFiftyMessages(roomId, user.id);

    socket.emit("joinedRoom", { chatRoom, lastMessages });
  });

  socket.on("leaveRoom", () => {
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        const userCount = getUserCount(io, roomId) - 1;
        io.to(roomId).emit("userLeft", {
          userCount,
          displayId: user.displayId,
          message: `${user.displayId} has left the room`,
        });
         socket.leave(roomId);
      }
    });
  });

   socket.on("disconnecting", () => {
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        const userCount = getUserCount(io, roomId) - 1;
        io.to(roomId).emit("userLeft", {
          userCount,
          displayId: user.displayId,
          message: `${user.displayId} has left the room`,
        });
      }
    });
  });

  

  socket.on("sendMessage", async ({ roomId, content }) => {
    try {
      const message = await chatRoomMessageService.createChatRoomMessage(
        roomId,
        user.id,
        content,
      );

      const messageToSend = {
        ...message,
        chatRoomId: roomId,
        content: message.content,
        senderDisplayId: message.sender.displayId,
        timestamp: message.createdAt,
        messageId: message.id,
        karma: message.karma,
        userId:user.id,
      };

      io.to(String(roomId)).emit("receiveMessage", messageToSend);
    } catch (error: any) {
      socket.emit("error", "An unexpected error has occured");
    }
  });

  socket.on("deleteMessage", async ({ roomId, messageId }) => {
    try {
      const message = await chatRoomMessageService.getMessageById(messageId);

      if (!message) {
        return socket.emit("error", "Message not found");
      }

      if (user.id != message.senderId && !user.isAdmin) {
        return socket.emit("error", "Action not Authorized");
      }

      await chatRoomMessageService.deleteMessage(messageId);

      const updatedMessage = await chatRoomMessageService.getMessageById(
        messageId,
      );

      io.to(String(roomId)).emit("updateMessage", updatedMessage);
    } catch (error: any) {
      socket.emit("error", "An unexpected error has occured");
    }
  });

  socket.on("voteMessage", async ({ roomId, messageId, vote }) => {
    try {
      const message = await chatRoomMessageService.getMessageById(messageId);

      if (!message) {
        return socket.emit("error", "Message not found");
      }

      if (message.deleted) {
        return socket.emit("error", "Message is deleted");
      }

      if (vote !== 1 && vote !== -1) {
        return socket.emit("error", "Vote must be 1 or -1");
      }

      if (message.senderId === user.id) {
        return socket.emit("error", "Cannot vote on your own message");
      }

      // Check for existing vote
      const existingVote = await chatRoomMessageService.getVote(user.id, messageId);

      if (existingVote && existingVote.value === vote) {
        // Already voted the same direction — block
        return socket.emit("error", "Already voted");
      }

      // Calculate the actual karma change:
      //   No prior vote  → apply vote as-is (+1 or -1)
      //   Switching vote → undo old vote + apply new (net change is ±2)
      let karmaChange = vote;
      if (existingVote) {
        karmaChange = vote - existingVote.value; // e.g. 1 - (-1) = 2, or -1 - 1 = -2
      }

      // Save the vote record and update message karma
      await chatRoomMessageService.upsertVote(user.id, messageId, vote);
      const updatedMessage = await chatRoomMessageService.updateMessageKarma(messageId, karmaChange);

      // Update the message author's karma
      updateUserKarma(message.senderId, karmaChange);

      io.to(String(roomId)).emit("updateMessage", updatedMessage);
    } catch (error: any) {
      socket.emit("error", "An unexpected error has occurred");
    }
  });
}