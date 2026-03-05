import { ProximityMessage } from "@prisma/client";
import { AbstractMessageDao } from "./abstractClasses/abstractMessageDao";
import {prisma} from "../utils/prisma";

export class ProximityMessageDao extends AbstractMessageDao<ProximityMessage | null> {
  async getMessageById(messageId: number): Promise<ProximityMessage | null> {
    return prisma.proximityMessage.findUnique({
      where: { id: messageId },
    });
  }

  async updateMessage(
    messageId: number,
    content: string,
  ): Promise<ProximityMessage | null> {
    return prisma.proximityMessage.update({
      where: { id: messageId },
      data: { content },
    });
  }

  async deleteMessage(messageId: number): Promise<ProximityMessage | null> {
    return prisma.proximityMessage.update({
      where: { id: messageId },
      data: { deleted: true },
    });
  }

  async deleteMessageByUser(senderId: number): Promise<number> {
    return prisma.proximityMessage
      .updateMany({
        where: { senderId: senderId },
        data: { deleted: true },
      })
      .then((result) => result.count);
  }

  async getMessageCountByUser(senderId: number): Promise<number> {
    return prisma.proximityMessage.count({
      where: { senderId },
    });
  }

  async createProximityMessage(
    senderId: number,
    content: string,
    latitude: number,
    longitude: number,
    imageUrl?: string,
  ) {
    return prisma.proximityMessage.create({
      data: {
        senderId,
        content,
        imageUrl: imageUrl ?? null,
        latitude,
        longitude,
      },
      include: {
        sender: { select: { displayId: true } },
      },
    });
  }

  async createProximityMessageLean(
    senderId: number,
    content: string,
    latitude: number,
    longitude: number,
    imageUrl?: string,
    replyToId?: number,
  ) {
    return prisma.proximityMessage.create({
      data: {
        senderId,
        content,
        imageUrl: imageUrl ?? null,
        latitude,
        longitude,
        replyToId: replyToId ?? null,
      },
    });
  }

  async getReplyDataById(messageId: number) {
    return prisma.proximityMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        content: true,
        imageUrl: true,
        deleted: true,
        sender: { select: { displayId: true } },
      },
    });
  }
}
