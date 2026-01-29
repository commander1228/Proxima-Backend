import { Server, Socket } from "socket.io";
import {
  createMessage,
  getChatRoomById,
  getLastFiftyMessages,
} from "../services/chatRoomService";
import { emit } from "process";

function getUserCount(io: Server, roomId: string) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

export function setupChatSocket(io: Server, socket: Socket) {
  const user = (socket as any).user;

  socket.on("joinRoom", async (roomId: number) => {
    const chatRoom = await getChatRoomById(roomId);
    if (!chatRoom) {
      socket.emit("error", "Chat room not found");
      return;
    }

    socket.join(String(roomId));

    const userCount = getUserCount(io, String(roomId));

    io.to(String(roomId)).emit("userJoined", {
      displayId: user.displayId,
      chatRoom: chatRoom.name,
      userCount,
      message: `${user.displayId} has joined room ${chatRoom.name}`,
    });

    const lastMessages = await getLastFiftyMessages(roomId);

    io.emit("messageHistory", {});

    socket.emit("joinedRoom", { chatRoom, lastMessages });
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
    const message = await createMessage(roomId, user.id, content);

    io.to(String(roomId)).emit("receiveMessage", {
      roomId,
      content: message.content,
      senderDisplayId: message.sender.displayId,
      timestamp: message.createdAt,
      message: `${message.content}`,
    });
  });
}
