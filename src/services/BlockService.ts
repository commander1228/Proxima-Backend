import {
  blockUserDao,
  unblockUserDao,
  isBlockedDao,
  getBlockedUserIdsDao,
  getBlockerUserIdsDao,
  getAllBlockRelatedUserIdsDao,
  getBlockListDao,
  invalidateCachedBlockList,
} from "../dao/BlockDao";
import { blockEvents } from "../events/blockEvents";

export class BlockService {
  async blockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) {
      throw new Error("You cannot block yourself");
    }
    const alreadyBlocked = await isBlockedDao(blockerId, blockedId);
    if (alreadyBlocked) {
      throw new Error("User is already blocked");
    }
    const result = await blockUserDao(blockerId, blockedId);
    await Promise.all([
      invalidateCachedBlockList(blockerId),
      invalidateCachedBlockList(blockedId),
    ]);
    blockEvents.emit(`changed:${blockerId}`);
    blockEvents.emit(`changed:${blockedId}`);
    return result;
  }

  async unblockUser(blockerId: number, blockedId: number) {
    const isBlocked = await isBlockedDao(blockerId, blockedId);
    if (!isBlocked) {
      throw new Error("User is not blocked");
    }
    const result = await unblockUserDao(blockerId, blockedId);
    await Promise.all([
      invalidateCachedBlockList(blockerId),
      invalidateCachedBlockList(blockedId),
    ]);
    blockEvents.emit(`changed:${blockerId}`);
    blockEvents.emit(`changed:${blockedId}`);
    return result;
  }

  async isBlocked(blockerId: number, blockedId: number) {
    return isBlockedDao(blockerId, blockedId);
  }

  async getBlockedUserIds(userId: number) {
    return getBlockedUserIdsDao(userId);
  }

  async getBlockerUserIds(userId: number) {
    return getBlockerUserIdsDao(userId);
  }

  /** All user IDs that should be invisible to this user (both directions) */
  async getAllBlockRelatedUserIds(userId: number) {
    return getAllBlockRelatedUserIdsDao(userId);
  }

  async getBlockList(userId: number) {
    return getBlockListDao(userId);
  }
}