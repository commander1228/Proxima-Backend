import { Vote } from "../models/voteTypes";

export class VoteDao {
  private model: any;

  constructor(model: any) {
    this.model = model;
  }

  async createOrUpdateVote(vote: Vote) {
    return this.model.upsert({
      where: {
        userId_targetId: { userId: vote.userId, targetId: vote.targetId },
      },
      update: { value: vote.value },
      create: {
        userId: vote.userId,
        targetId: vote.targetId,
        value: vote.value,
      },
    });
  }

  async removeVote(vote: Vote) {
    return this.model.delete({
      where: {
        userId_targetId: { userId:vote.userId, targetId: vote.targetId },
      },
    });
  }

  async getVote(vote: Vote) {
    return this.model.findUnique({
      where: {
        userId_targetId: { userId:vote.userId, targetId: vote.targetId },
      },
    });
  }

  /**
   * Get a user's vote value for a specific target.
   * Returns the vote value (1 or -1) or null if the user hasn't voted.
   */
  async getUserVoteValue(userId: number, targetId: number): Promise<number | null> {
    const vote = await this.model.findUnique({
      where: {
        userId_targetId: { userId, targetId },
      },
      select: { value: true },
    });
    return vote?.value ?? null;
  }

  /**
   * Get a user's votes for multiple targets in one query.
   * Returns a map of targetId → vote value.
   */
  async getUserVotesForTargets(userId: number, targetIds: number[]): Promise<Record<number, number>> {
    if (targetIds.length === 0) return {};

    const votes = await this.model.findMany({
      where: {
        userId,
        targetId: { in: targetIds },
      },
      select: { targetId: true, value: true },
    });

    const map: Record<number, number> = {};
    for (const v of votes) {
      map[v.targetId] = v.value;
    }
    return map;
  }

  async getVoteCount(targetId: number): Promise<number> {
    const result = await this.model.aggregate({
      where: { targetId },
      _sum: { value: true },
    });

    return result._sum.value ?? 0;
  }

  /**
   * Get vote counts for multiple targets in one query.
   * Returns a map of targetId → vote count sum.
   */
  async getVoteCountsBatch(targetIds: number[]): Promise<Record<number, number>> {
    if (targetIds.length === 0) return {};

    const results = await this.model.groupBy({
      by: ["targetId"],
      where: { targetId: { in: targetIds } },
      _sum: { value: true },
    });

    const map: Record<number, number> = {};
    for (const r of results) {
      map[r.targetId] = r._sum.value ?? 0;
    }
    return map;
  }
}