import { AbstractMessageDao } from "../../dao/abstractClasses/abstractMessageDao";

export abstract class AbstractMessageService<T> {
  protected dao: AbstractMessageDao<T>;

  constructor(dao: AbstractMessageDao<T>) {
    this.dao = dao;
  }

  async getMessageById(messageId: number): Promise<T | null> {
    return this.dao.getMessageById(messageId);
  }

  async updateMessage(messageId: number, content: string): Promise<T | null> {
    return this.dao.updateMessage(messageId, content);
  }

  async deleteMessage(messageId: number): Promise<T | null> {
    return this.dao.deleteMessage(messageId);
  }

  async deleteMessageByUser(senderId: number): Promise<number> {
    return this.dao.deleteMessageByUser(senderId);
  }
}