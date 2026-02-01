import { User, Message } from "@prisma/client";
import {
  createMessageDao,
  deleteMessageDao,
  deleteMessagesByChatroomDao,
  deleteMessagesByUserDao,
  getLatestMessagesByChatRoomDao,
  getMessageByIdDao,
} from "../dao/messageDao";

export async function createMessage(
  chatRoomId: number,
  senderId: number,
  content: string,
) {
  return await createMessageDao(chatRoomId, senderId, content);
}

export async function deleteMessage(message: Message) {
  return await deleteMessageDao(message.id);
}

export async function deleteMessagesByChatroom(chatroomId: number) {
  return await deleteMessagesByChatroomDao(chatroomId);
}

export async function deleteMessagesByUser(user: User) {
  return await deleteMessagesByUserDao(user.id);
}

export async function getMessageById(messageId: number) {
  const message = await getMessageByIdDao(messageId);
  if (!message) return null;

  if (message.deleted) {
    message.content = " Message Has Been Deleted";
  }

  return message;
}

export async function getLastestMessagesByChatRoom(
  chatRoomId: number,
  count: number,
): Promise<(Message & { sender: { displayId: string } })[]> {
  const messages = await getLatestMessagesByChatRoomDao(chatRoomId, count);
  return messages.map((message) => ({
    ...message,
    content: message.deleted ? "Message Has Been Deleted" : message.content,
    sender: {
      ...message.sender,
      displayId: message.sender.deleted
        ? "User no Longer exists"
        : message.sender.displayId,
    },
  }));
}
