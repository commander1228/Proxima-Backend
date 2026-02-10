import { User, ChatRoomMessage, ChatRoomType } from "@prisma/client";
import {
  ChatRoomMessageService,
} from "./ChatRoomMessageService";
import {
  createRoomDao,
  deleteChatRoomDao,
  getAllChatRoomsDao,
  getChatRoomByIdDao,
  getChatRoomByNameDao,
} from "../dao/chatRoomDao";

const chatRoomMessageService = new ChatRoomMessageService();

export async function createRoom(name: string, user: User,latitude?: number, longitude?: number, size?: number, type?: ChatRoomType) {
  if (await chatRoomNameExists(name))
    throw new Error("A Chatroom of this name already exists");
  return await createRoomDao(name, user.id, longitude, latitude, size, type);
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

export async function listChatRooms() {
  return await getAllChatRoomsDao();
}

export async function getChatRoomById(id: number) {
  return await getChatRoomByIdDao(id);
}

export async function chatRoomNameExists(name: string) {
  const exists = await getChatRoomByNameDao(name);
  return !!exists;
}

export async function getChatRoomByType(type: ChatRoomType) {
  return await getChatRoomByType(type)
}

export async function getLastFiftyMessages(chatRoomId: number, userId: number) {
  const messages = await chatRoomMessageService.getLatestChatRoomMessagesByChatRoom(chatRoomId, 50);

  return messages.map((message: ChatRoomMessage) => ({
    ...message,
    isOwnMessage: message.senderId == userId,
  }));
}
