import { User, ChatRoomMessage } from "@prisma/client";
import { ChatRoomMessageDao } from "../dao/ChatRoomMessageDao";
import { AbstractMessageService } from "./abstractClasses/abstractMessageService";
import { AbstractMessageDao } from "../dao/abstractClasses/abstractMessageDao";

const chatRoomMessageDao = new ChatRoomMessageDao();

export class ChatRoomMessageService extends AbstractMessageService<ChatRoomMessage | null> {
  constructor() {
    super(chatRoomMessageDao);
  }

  async getMessageById(messageId: number): Promise<ChatRoomMessage | null> {
    return chatRoomMessageDao.getMessageById(messageId);
  }

  async updateMessage(
    messageId: number,
    content: string,
  ): Promise<ChatRoomMessage | null> {
    return chatRoomMessageDao.updateMessage(messageId, content);
  }

  async deleteMessageByUser(senderId: number): Promise<number> {
    return chatRoomMessageDao.deleteMessageByUser(senderId);
  }

  async createChatRoomMessage(
    chatRoomId: number,
    senderId: number,
    content: string,
  ) {
    return await chatRoomMessageDao.createChatRoomMessage(
      chatRoomId,
      senderId,
      content,
    );
  }

  async deleteChatRoomMessagesByChatroom(chatroomId: number) {
    return await chatRoomMessageDao.deleteChatRoomMessagesByChatroom(
      chatroomId,
    );
  }

  updateMessageKarma(messageId:number, karmaChange:number):Promise<ChatRoomMessage | null> {
   return chatRoomMessageDao.updateMessageKarma(messageId, karmaChange); 
  }

  async getLatestChatRoomMessagesByChatRoom(
    chatRoomId: number,
    count: number,
  ): Promise<(ChatRoomMessage & { sender: { displayId: string } })[]> {
    const messages =
      await chatRoomMessageDao.getLatestChatRoomMessagesByChatRoom(
        chatRoomId,
        count,
      );
    return messages.map((ChatRoomMessage) => ({
      ...ChatRoomMessage,
      content: ChatRoomMessage.deleted
        ? "ChatRoomMessage Has Been Deleted"
        : ChatRoomMessage.content,
      sender: {
        ...ChatRoomMessage.sender,
        displayId: ChatRoomMessage.sender.deleted
          ? "User no Longer exists"
          : ChatRoomMessage.sender.displayId,
      },
    }));
  }

  async getMessageCountByUser(userId: number) {
    return await chatRoomMessageDao.getMessageCountByUser(userId);
  }
}
