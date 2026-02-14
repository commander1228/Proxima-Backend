import { User, ChatRoomMessage } from "@prisma/client";
import {
  ChatRoomMessageService,
} from "./ChatRoomMessageService";
import {
  createRoomDao,
  deleteChatRoomDao,
  getAllChatRoomsByLocationDao,
  getChatRoomByIdDao,
  getChatRoomByNameAndLocationDao,
} from "../dao/chatRoomDao";
import { ChatRoomMessageVoteService } from "./ChatRoomMessageVoteService";
import { LocationDao } from "../dao/LocationDao";

const chatRoomMessageService = new ChatRoomMessageService();
const chatRoomMessageVoteService = new ChatRoomMessageVoteService();
const locationDao = new LocationDao();

export async function createRoom(name: string, locationId:number) {
  const location = await locationDao.getLocationById(locationId);

  if (!location || location.deleted) throw new Error("Location does not exist");
  
  if (await chatRoomNameExistsInLocation(name,locationId))
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

export async function listChatRooms(locationId:number) {
  return await getAllChatRoomsByLocationDao(locationId);
}

export async function getChatRoomById(id: number) {
  return await getChatRoomByIdDao(id);
}

export async function chatRoomNameExistsInLocation(name: string,locationId:number) {
  const exists = await getChatRoomByNameAndLocationDao(name,locationId);
  return !!exists;
}

export async function getLastFiftyMessages(chatRoomId: number, userId: number) {
  const messages = await chatRoomMessageService.getLatestChatRoomMessagesByChatRoom(chatRoomId, 50);

  const voteCounts = await Promise.all (
    messages.map((message) =>
      chatRoomMessageVoteService.getMessageVoteCount(message.id)
  )
);

  return messages.map((message: ChatRoomMessage,idx) => ({
    ...message,
    isOwnMessage: message.senderId == userId,
    voteCount: voteCounts[idx]
  }));
}
