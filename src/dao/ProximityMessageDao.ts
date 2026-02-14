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

  async createProximityMessage(
    senderId: number,
    content: string,
    latitude: number,
    longitude: number,
  ) {
    return prisma.proximityMessage.create({
      data: {
        senderId,
        content,
        latitude,
        longitude,
      },
      include: {
        sender: { select: { displayId: true } },
      },
    });
  }
}
