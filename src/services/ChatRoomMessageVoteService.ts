import { ChatRoomMessageVoteDao } from "../dao/ChatRoomMessageVoteDao";
import { ChatRoomMessageService } from "./ChatRoomMessageService";

const chatRoomMessageVoteDao = new ChatRoomMessageVoteDao();
const chatRoomMessageService = new ChatRoomMessageService();

export class ChatRoomMessageVoteService {
  async voteOnMessage(userId: number, messageId: number, value: number) {
    if (value != 1 && value != -1) {
      throw new Error("values not 1 or -1 not supported");
    }

    const message = await chatRoomMessageService.getMessageById(messageId);

    if (message == null || message.senderId == userId) {
      throw new Error("user cannot vote on this message");
    }

    return await chatRoomMessageVoteDao.createOrUpdateMessageVote(
      userId,
      messageId,
      value,
    );
  }

  async removeVote(userId: number, messageId: number) {
    return await chatRoomMessageVoteDao.removeVote(userId, messageId);
  }

  async getVote(userId: number, messageId: number) {
    return await chatRoomMessageVoteDao.getVote(userId, messageId);
  }

  async getMessageVoteCount(messageId: number) {
    return await chatRoomMessageVoteDao.getMessageVoteCount(messageId);
  }
}
