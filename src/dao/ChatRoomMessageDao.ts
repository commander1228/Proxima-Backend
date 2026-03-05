import {prisma} from "../utils/prisma";
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
        where: { senderId: senderId, deleted: false },
      });
  }

async getMessageCountByUser(senderId: number): Promise<number> {
  return prisma.chatRoomMessage.count({
    where: { senderId },
  });
}

  async createChatRoomMessage(
    chatRoomId: number,
    senderId: number,
    content: string,
    imageUrl?: string,
    replyToId?: number,
    wasAnonymous?: boolean,
  ) {
    return prisma.chatRoomMessage.create({
      data: {
        chatRoomId,
        senderId,
        content,
        imageUrl: imageUrl ?? null,
        isReply: replyToId != null,
        replyToId: replyToId ?? null,
        wasAnonymous: wasAnonymous ?? false,
      },
      include: {
        sender: { select: { displayId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            deleted: true,
            imageUrl: true,
            sender: { select: { displayId: true } },
          },
        },
      },
    });
  }


  async createChatRoomMessageLean(
    chatRoomId: number,
    senderId: number,
    content: string,
    imageUrl?: string,
    replyToId?: number,
    wasAnonymous?: boolean,
  ) {
    return prisma.chatRoomMessage.create({
      data: {
        chatRoomId,
        senderId,
        content,
        imageUrl: imageUrl ?? null,
        isReply: replyToId != null,
        replyToId: replyToId ?? null,
        wasAnonymous: wasAnonymous ?? false,
      },
    });
  }

  async getReplyDataById(replyToId: number) {
    return prisma.chatRoomMessage.findUnique({
      where: { id: replyToId },
      select: {
        id: true,
        content: true,
        deleted: true,
        imageUrl: true,
        wasAnonymous: true,
        chatRoomId: true,
        sender: { select: { displayId: true } },
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
      where: {
        chatRoomId,
        deleted: false,
        sender: { deleted: false },
      },
      orderBy: { createdAt: "desc" },
      take: count,
      select: {
        id: true,
        createdAt: true,
        content: true,
        imageUrl: true,
        chatRoomId: true,
        senderId: true,
        isReply: true,
        replyToId: true,
        deleted: true,
        wasAnonymous: true,
        moderationStatus: true,
        sender: { select: { displayId: true, deleted: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            deleted: true,
            imageUrl: true,
            wasAnonymous: true,
            sender: { select: { displayId: true } },
          },
        },
      },
    });
  }
}