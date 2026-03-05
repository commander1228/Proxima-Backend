import { Vote } from "../models/voteTypes";
import { VoteDao } from "../dao/VoteDao";
import { VoteModel } from "../models/voteTypes";
import { getVoteModel } from "../utils/voteUtils";

export class VoteService {
  private dao: VoteDao;

  constructor(modelType: VoteModel) {
    const model = getVoteModel(modelType);
    this.dao = new VoteDao(model);
  }

  async voteOnMessage(vote: Vote) {
    if (vote.value != 1 && vote.value != -1) {
      throw new Error("values not 1 or -1 not supported");
    }

    return await this.dao.createOrUpdateVote(vote);
  }

  async removeVote(vote:Vote) {
    return await this.dao.removeVote(vote);
  }

  async getVote(vote:Vote) {
    return await this.dao.getVote(vote);
  }

  async getUserVoteValue(userId: number, targetId: number): Promise<number | null> {
    return await this.dao.getUserVoteValue(userId, targetId);
  }

  async getUserVotesForTargets(userId: number, targetIds: number[]): Promise<Record<number, number>> {
    return await this.dao.getUserVotesForTargets(userId, targetIds);
  }

  async getVoteCount(targetId: number) {
    return await this.dao.getVoteCount(targetId);
  }

  async getVoteCountsBatch(targetIds: number[]): Promise<Record<number, number>> {
    return await this.dao.getVoteCountsBatch(targetIds);
  }
}