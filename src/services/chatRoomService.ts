import { User, Message } from "@prisma/client";
import {
  deleteMessagesByChatroom,
  getLastestMessagesByChatRoom,
} from "./messageService";
import {
  createRoomDao,
  deleteChatRoomDao,
  getAllChatRoomsDao,
  getChatRoomByIdDao,
  getChatRoomByNameDao,
} from "../dao/chatRoomDao";

export async function createRoom(name: string, user: User) {
  if (await chatRoomNameExists(name))
    throw new Error("A Chatroom of this name already exists");
  return await createRoomDao(name, user.id);
}

export async function deleteRoom(id: number) {
  const chatroom = await getChatRoomById(id);
  if (!chatroom) throw new Error("Chatroom does not exist");
  await deleteChatRoomDao(id);
  const deleteResult = await deleteMessagesByChatroom(id);

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

export async function getLastFiftyMessages(chatRoomId: number, userId: number) {
  const messages = await getLastestMessagesByChatRoom(chatRoomId, 50);

  return messages.map((message: Message) => ({
    ...message,
    isOwnMessage: message.senderId == userId,
  }));
}
