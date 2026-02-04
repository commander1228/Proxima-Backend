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

  async createProximityMessage(
    senderId: number,
    content: string,
    latitude: number,
    longitude: number,
  ) {
    return await proximityMessageDao.createProximityMessage(
      senderId,
      content,
      latitude,
      longitude,
    );
  }
}
