import { Server, Socket } from "socket.io";
import { User } from "@prisma/client";
import {getLastFiftyMessages} from "../services/chatRoomService";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { updateUserKarma } from "../services/userService";
import { ChatRoomMessageVoteService } from "../services/ChatRoomMessageVoteService";
import { getAndVerifyMessage,verifyChatRoomAndUserInRange } from "../utils/chatRoomSocketUtils";

function getUserCount(io: Server, roomId: string) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

const chatRoomMessageService = new ChatRoomMessageService();
const chatRoomMessageVoteService = new ChatRoomMessageVoteService();

export function setupChatRoomSocket(io: Server, socket: Socket, user: User) {
  socket.on("joinRoom", async (roomId: number) => {
    try{
      const chatRoom = await verifyChatRoomAndUserInRange(roomId,user.id);

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
  } catch (error:any){
    socket.emit("error", error.message || "An unexpected error has occurred");
  }
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

      const chatRoom = await verifyChatRoomAndUserInRange(roomId,user.id);

      const message = await chatRoomMessageService.createChatRoomMessage(
        chatRoom.id,
        user.id,
        content,
      );

      const messageToSend = {
        ...message,
        chatRoomId: chatRoom.id,
        content: message.content,
        senderDisplayId: message.sender.displayId,
        timestamp: message.createdAt,
        messageId: message.id,
        userId: user.id,
      };

      io.to(String(chatRoom.id)).emit("receiveMessage", messageToSend);
    } catch (error: any) {
      socket.emit("error", error.message || "An unexpected error has occured");
    }
  });

  socket.on("deleteMessage", async ({ roomId, messageId }) => {
    try {
      const chatRoom = await verifyChatRoomAndUserInRange(roomId,user.id);
      const message = await getAndVerifyMessage(messageId);

      if (user.id !== message.senderId && !user.isAdmin) {
        return socket.emit("error", "Action not Authorized");
      }

      await chatRoomMessageService.deleteMessage(messageId);

      const updatedMessage = await chatRoomMessageService.getMessageById(
        messageId,
      );

      io.to(String(chatRoom.id)).emit("updateMessage", updatedMessage);
    } catch (error: any) {
      socket.emit("error", error.message || "An unexpected error has occured");
    }
  });

  socket.on("voteMessage", async ({ roomId, messageId, vote }) => {
    try {
      const chatRoom = await verifyChatRoomAndUserInRange(roomId,user.id);
      const message = await getAndVerifyMessage(messageId);

      if (message.senderId === user.id) {
        return socket.emit("error", "You cannot vote on your own message");
      }

      if(vote == 0){
        await chatRoomMessageVoteService.removeVote(user.id,messageId)
      }else{

      await chatRoomMessageVoteService.voteOnMessage(user.id, messageId, vote);

      await updateUserKarma(message.senderId, vote);
      }
      const voteCount = await chatRoomMessageVoteService.getMessageVoteCount(
        messageId,
      );

      const updatedMessage = {
        ...message,
        voteCount,
      };

      io.to(String(chatRoom.id)).emit("updateMessage", updatedMessage);
    } catch (error: any) {
      socket.emit("error", error.message || "An unexpected error has occured");
    }
  });
}
