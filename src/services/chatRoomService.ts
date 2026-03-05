import { ChatRoomMessageService } from "./ChatRoomMessageService";
import {
  createRoomDao,
  deleteChatRoomDao,
  getAllChatRoomsByLocationDao,
  getChatRoomByIdDao,
  getChatRoomByNameAndLocationDao,
} from "../dao/chatRoomDao";
import { VoteService } from "./VoteService";
import { LocationDao } from "../dao/LocationDao";
import { VoteModel } from "../models/voteTypes";
import { getCachedBlockRelatedUserIds } from "../dao/BlockDao";

const chatRoomMessageService = new ChatRoomMessageService();
const voteService = new VoteService(VoteModel.ChatRoomMessageVote);
const locationDao = new LocationDao();

export async function createRoom(name: string, locationId: number) {
  const location = await locationDao.getLocationById(locationId);
  if (!location || location.deleted) throw new Error("Location does not exist");
  if (await chatRoomNameExistsInLocation(name, locationId))
    throw new Error("A Chatroom of this name already exists");
  return await createRoomDao(name, locationId);
}

export async function deleteRoom(id: number) {
  const chatroom = await getChatRoomById(id);
  if (!chatroom) throw new Error("Chatroom does not exist");
  await deleteChatRoomDao(id);
  const deleteResult = await chatRoomMessageService.deleteChatRoomMessagesByChatroom(id);
  return {
    deletedCount: deleteResult.count,
    chatRoomName: chatroom.name,
  };
}

export async function listChatRooms(locationId: number) {
  return await getAllChatRoomsByLocationDao(locationId);
}

export async function getChatRoomById(id: number) {
  return await getChatRoomByIdDao(id);
}

export async function chatRoomNameExistsInLocation(name: string, locationId: number) {
  const exists = await getChatRoomByNameAndLocationDao(name, locationId);
  return !!exists;
}

export async function getLastFiftyMessages(chatRoomId: number, userId: number) {
  const messages = await chatRoomMessageService.getLatestChatRoomMessagesByChatRoom(chatRoomId, 50);

  // Get all user IDs with a block relationship with the viewer — filter their messages out
  const blockedUserIds = new Set(await getCachedBlockRelatedUserIds(userId));

  const visibleMessages = messages.filter(
    (message) => !blockedUserIds.has(message.senderId)
  );

  const messageIds = visibleMessages.map((m) => m.id);

  // Two queries total instead of 2×N — fetch all vote data in batch
  const [voteCountMap, userVoteMap] = await Promise.all([
    voteService.getVoteCountsBatch(messageIds),
    voteService.getUserVotesForTargets(userId, messageIds),
  ]);

  return visibleMessages.map((message: any) => ({
    ...message,
    isOwnMessage: message.senderId === userId,
    voteCount: voteCountMap[message.id] ?? 0,
    userVote: userVoteMap[message.id] ?? null,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.content,
          imageUrl: message.replyTo.imageUrl ?? null,
          senderDisplayId: message.replyTo.sender?.displayId ?? "Unknown",
        }
      : null,
  }));
}