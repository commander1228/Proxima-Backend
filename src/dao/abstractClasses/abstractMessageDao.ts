export abstract class AbstractMessageDao<T> {
  abstract getMessageById(messageId: number): Promise<T | null>;
  abstract updateMessage(messageId: number, content: string): Promise<T | null>;
  abstract deleteMessage(messageId: number): Promise<T | null>;
  abstract deleteMessageByUser(senderId: number): Promise<number>;
}