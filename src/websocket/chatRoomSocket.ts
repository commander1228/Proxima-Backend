import { Server, Socket } from "socket.io";
import { UserWithPreferences } from "../models/userTypes";
import { getLastFiftyMessages } from "../services/chatRoomService";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { updateUserKarma } from "../services/userService";
import { VoteService } from "../services/VoteService";
import { getAndVerifyMessage, verifyChatRoomAndUserInRange, getCachedChatRoomWithLocation } from "../utils/chatRoomSocketUtils";
import { VoteModel, Vote } from "../models/voteTypes";
import { constructVote, validateNotOwnPost } from "../utils/voteUtils";
import { validateImageUrl } from "../utils/validateImageUrl";
import { getCachedSuspensionStatus } from "../utils/redisSuspension";
import { enqueueMessageWrite } from "../jobs/messageWriteQueue";

function getUserCount(io: Server, roomId: string) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

const chatRoomMessageService = new ChatRoomMessageService();
const voteService = new VoteService(VoteModel.ChatRoomMessageVote);

let tempIdCounter = 0;
function nextTempId(): number {
  tempIdCounter = (tempIdCounter + 1) % 2_000_000_000;
  return tempIdCounter;
}

export function setupChatRoomSocket(
  io: Server,
  socket: Socket,
  user: UserWithPreferences,
  userSocketMap: { [userId: number]: { socketId: string; proximityRadius: number } },
  blockedUserIds: { set: Set<number> },
) {
  // Track rooms where this socket has already passed range verification.
  // Once a user successfully joins a room, we skip the full
  // verifyChatRoomAndUserInRange check on subsequent actions (send, vote,
  // delete) and just use the cached chatroom data. This avoids redundant
  // Redis + DB lookups on every single message send.
  const verifiedRooms = new Set<number>();

  // Cache suspension status in-memory for the lifetime of this socket
  // connection to avoid a Redis round-trip on every message send. Refreshed
  // every 30 seconds in case the status changes mid-session.
  let cachedSuspension: { suspended: boolean; until: Date | null } | null = null;
  let suspensionCachedAt = 0;
  const SUSPENSION_CACHE_TTL = 30_000;


  socket.on("joinRoom", async (roomId: number) => {
    try {
      const chatRoom = await verifyChatRoomAndUserInRange(roomId, user.id, user.isAdmin);
      verifiedRooms.add(roomId);

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
    } catch (error: any) {
      socket.emit("error", error.message || "An unexpected error has occurred");
    }
  });

  socket.on("leaveRoom", () => {
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        const numericId = Number(roomId);
        if (!isNaN(numericId)) verifiedRooms.delete(numericId);
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

  socket.on("sendMessage", async ({ roomId, content, imageUrl: rawImageUrl, replyToId, replyPreview, tempId: clientTempId }) => {
    try {
      const imageUrl = validateImageUrl(rawImageUrl) ?? undefined;

      if ((!content && !imageUrl) || (content && content.length > 2000)) {
        socket.emit("error", "Message too long");
        return;
      }

      const now = Date.now();
      if (!cachedSuspension || now - suspensionCachedAt > SUSPENSION_CACHE_TTL) {
        cachedSuspension = await getCachedSuspensionStatus(user.id);
        suspensionCachedAt = now;
      }
      if (cachedSuspension.suspended) {
        return socket.emit("suspended", { suspendedUntil: cachedSuspension.until!.toISOString() });
      }

      const wasAnonymous = user.preferences?.anonymousMode ?? true;

      if (!verifiedRooms.has(roomId)) {
        await verifyChatRoomAndUserInRange(roomId, user.id, user.isAdmin);
        verifiedRooms.add(roomId);
      }

      const tempId = nextTempId();
      const messageToSend = {
        chatRoomId: roomId,
        content,
        imageUrl: imageUrl ?? null,
        senderDisplayId: wasAnonymous ? "Anonymous" : user.displayId,
        timestamp: new Date().toISOString(),
        messageId: tempId,
        id: tempId,
        userId: user.id,
        isReply: replyToId != null,
        replyToId: replyToId ?? null,
        tempId: clientTempId ?? undefined,
        replyTo: replyToId != null && replyPreview
          ? {
              content: replyPreview.content,
              senderDisplayId: replyPreview.senderDisplayId,
              imageUrl: replyPreview.imageUrl ?? null,
            }
          : null,
      };

      // Broadcast immediately — before the DB write
      io.to(String(roomId)).emit("receiveMessage", messageToSend);

      // Persist via background queue — worker emits messageIdAssigned when done
      enqueueMessageWrite({
        type: "CHAT_MESSAGE",
        tempId,
        chatRoomId: roomId,
        userId: user.id,
        content,
        imageUrl,
        replyToId: replyToId ?? undefined,
        wasAnonymous,
      }).catch(() => {
        io.to(`user:${user.id}`).emit("messageFailed", { tempId });
      });
    } catch (error: any) {
      socket.emit("error", error.message || "An unexpected error has occurred");
    }
  });

  socket.on("deleteMessage", async ({ roomId, messageId }) => {
    try {
      // Fast path: skip full range re-verification if already verified
      let chatRoom;
      if (verifiedRooms.has(roomId)) {
        const cached = await getCachedChatRoomWithLocation(roomId);
        chatRoom = cached?.chatRoom;
        if (!chatRoom) throw new Error("Chat room not found");
      } else {
        chatRoom = await verifyChatRoomAndUserInRange(roomId, user.id, user.isAdmin);
        verifiedRooms.add(roomId);
      }
      const message = await getAndVerifyMessage(messageId);

      if (user.id !== message.senderId && !user.isAdmin) {
        return socket.emit("error", "Action not Authorized");
      }

      await chatRoomMessageService.deleteMessage(messageId);
      const updatedMessage = await chatRoomMessageService.getMessageById(messageId);
      io.to(String(chatRoom.id)).emit("updateMessage", updatedMessage);
    } catch (error: any) {
      socket.emit("error", error.message || "An unexpected error has occurred");
    }
  });

  socket.on("voteMessage", async ({ roomId, messageId, value }) => {
    try {
      // Fast path: skip full range re-verification if already verified
      let chatRoom;
      if (verifiedRooms.has(roomId)) {
        const cached = await getCachedChatRoomWithLocation(roomId);
        chatRoom = cached?.chatRoom;
        if (!chatRoom) throw new Error("Chat room not found");
      } else {
        chatRoom = await verifyChatRoomAndUserInRange(roomId, user.id, user.isAdmin);
        verifiedRooms.add(roomId);
      }
      const message = await getAndVerifyMessage(messageId);

      validateNotOwnPost(user.id, message.senderId);

      const existingVote = await voteService.getVote(
        constructVote(0, user.id, message.id)
      );
      const oldValue = existingVote?.value ?? 0;

      if (value == 0) {
        if (existingVote) {
          await voteService.removeVote(constructVote(0, user.id, message.id));
          await updateUserKarma(message.senderId, -oldValue);
        }
      } else {
        const vote: Vote = constructVote(value, user.id, message.id);
        await voteService.voteOnMessage(vote);
        const karmaDelta = value - oldValue;
        if (karmaDelta !== 0) {
          await updateUserKarma(message.senderId, karmaDelta);
        }
      }

      const voteCount = await voteService.getVoteCount(messageId);
      const updatedMessage = { ...message, voteCount };
      io.to(String(chatRoom.id)).emit("updateMessage", updatedMessage);
    } catch (error: any) {
      socket.emit("error", error.message || "An unexpected error has occurred");
    }
  });

  socket.on("typing", ({ roomId, isTyping }) => {
    socket.to(String(roomId)).emit("userTyping", {
      displayId: user.preferences?.anonymousMode ? "Anonymous" : user.displayId,
      isTyping,
    });
  });
}