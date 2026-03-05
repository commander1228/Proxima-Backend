import { User, ProximityMessage } from "@prisma/client";
import { ProximityMessageDao } from "../dao/ProximityMessageDao";
import { AbstractMessageService } from "./abstractClasses/abstractMessageService";

const proximityMessageDao = new ProximityMessageDao();

export class ProximityMessageService extends AbstractMessageService<ProximityMessage | null> {
  constructor() {
    super(proximityMessageDao);
  }

  async getMessageById(messageId: number): Promise<ProximityMessage | null> {
    return proximityMessageDao.getMessageById(messageId);
  }

  async updateMessage(
    messageId: number,
    content: string,
  ): Promise<ProximityMessage | null> {
    return proximityMessageDao.updateMessage(messageId, content);
  }

  async deleteMessageByUser(senderId: number): Promise<number> {
    return proximityMessageDao.deleteMessageByUser(senderId);
  }

  async getMessageCountByUser(userId: number): Promise<number> {
    return proximityMessageDao.getMessageCountByUser(userId);
  }

  async createFast(
    senderId: number,
    content: string,
    latitude: number,
    longitude: number,
    imageUrl?: string,
    replyToId?: number,
  ) {
    return proximityMessageDao.createProximityMessageLean(
      senderId,
      content,
      latitude,
      longitude,
      imageUrl,
      replyToId,
    );
  }

  async getReplyDataById(messageId: number) {
    return proximityMessageDao.getReplyDataById(messageId);
  }

  async createProximityMessage(
    senderId: number,
    content: string,
    latitude: number,
    longitude: number,
    imageUrl?: string,
  ) {
    return await proximityMessageDao.createProximityMessage(
      senderId,
      content,
      latitude,
      longitude,
      imageUrl,
    );
  }
}
