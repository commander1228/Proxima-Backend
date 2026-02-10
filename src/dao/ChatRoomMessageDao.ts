import prisma from "../utils/prisma";
import { ChatRoomMessage } from "@prisma/client";
import { AbstractMessageDao } from "./abstractClasses/abstractMessageDao";

export class ChatRoomMessageDao extends AbstractMessageDao<ChatRoomMessage | null> {
  async getMessageById(messageId: number): Promise<ChatRoomMessage | null> {
    return prisma.chatRoomMessage.findUnique({
      where: { id: messageId },
    });
  }

  async updateMessage(
    messageId: number,
    content: string,
  ): Promise<ChatRoomMessage | null> {
    return prisma.chatRoomMessage.update({
      where: { id: messageId },
      data: { content },
    });
  }

  async deleteMessage(messageId: number): Promise<ChatRoomMessage | null> {
    return prisma.chatRoomMessage.update({
      where: { id: messageId },
      data: { deleted: true },
    });
  }

  async deleteMessageByUser(senderId: number): Promise<number> {
    return prisma.chatRoomMessage
      .updateMany({
        where: { senderId: senderId },
        data: { deleted: true },
      })
      .then((result) => result.count);
  }

    async getMessagesByUser(senderId: number): Promise<ChatRoomMessage[]> {
    return prisma.chatRoomMessage
      .findMany({
        where: { senderId: senderId },
      });
  }

  async getMessageCountByUser(senderId: number): Promise<number> {
    return prisma.chatRoomMessage
      .findMany({
        where: { senderId: senderId },
      })
      .then((result)=> result.length);
  }

  async createChatRoomMessage(
    chatRoomId: number,
    senderId: number,
    content: string,
  ) {
    return prisma.chatRoomMessage.create({
      data: {
        chatRoomId,
        senderId,
        content,
      },
      include: {
        sender: { select: { displayId: true } },
      },
    });
  }

  updateMessageKarma(messageId:number, karmaChange:number):Promise<ChatRoomMessage | null> {
    return prisma.chatRoomMessage.update({
      where: { id: messageId },
      data: {
        karma: {
          increment: karmaChange,
        },
      },
    });
  }


  async deleteChatRoomMessagesByChatroom(chatroomId: number) {
    return prisma.chatRoomMessage.updateMany({
      where: { chatRoomId: chatroomId },
      data: { deleted: true },
    });
  }

  async getLatestChatRoomMessagesByChatRoom(chatRoomId: number, count: number) {
    return prisma.chatRoomMessage.findMany({
      where: { chatRoomId },
      orderBy: { createdAt: "desc" },
      take: count,
      include: {
        sender: { select: { displayId: true, deleted: true } },
      },
    });
  }
}
