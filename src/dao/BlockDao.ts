import { prisma } from "../utils/prisma";
import redis from "../utils/setupRedis";

const BLOCK_CACHE_TTL = 60; // seconds

function blockCacheKey(userId: number) {
  return `cache:blocks:${userId}`;
}

/**
 * Cached version of getAllBlockRelatedUserIdsDao.
 * Returns from Redis cache if available (TTL: 60s), otherwise hits DB and caches the result.
 * Call invalidateCachedBlockList() whenever a user blocks or unblocks someone.
 */
export async function getCachedBlockRelatedUserIds(userId: number): Promise<number[]> {
  const key = blockCacheKey(userId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as number[];

  const ids = await getAllBlockRelatedUserIdsDao(userId);
  await redis.setex(key, BLOCK_CACHE_TTL, JSON.stringify(ids));
  return ids;
}

export async function invalidateCachedBlockList(userId: number) {
  await redis.del(blockCacheKey(userId));
}

export async function blockUserDao(blockerId: number, blockedId: number) {
  return prisma.userBlock.create({
    data: { blockerId, blockedId },
  });
}

export async function unblockUserDao(blockerId: number, blockedId: number) {
  return prisma.userBlock.deleteMany({
    where: { blockerId, blockedId },
  });
}

export async function isBlockedDao(blockerId: number, blockedId: number) {
  const block = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  return !!block;
}

/** Returns user IDs that the given user has blocked */
export async function getBlockedUserIdsDao(userId: number): Promise<number[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  return blocks.map((b) => b.blockedId);
}

/** Returns user IDs that have blocked the given user */
export async function getBlockerUserIdsDao(userId: number): Promise<number[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockedId: userId },
    select: { blockerId: true },
  });
  return blocks.map((b) => b.blockerId);
}

/**
 * Returns all user IDs that have ANY block relationship with the given user
 * (either direction). These users should be invisible to each other.
 */
export async function getAllBlockRelatedUserIdsDao(userId: number): Promise<number[]> {
  const [blocked, blockers] = await Promise.all([
    getBlockedUserIdsDao(userId),
    getBlockerUserIdsDao(userId),
  ]);
  return [...new Set([...blocked, ...blockers])];
}

/** Returns the full block list with display IDs for the /blocks endpoint */
export async function getBlockListDao(userId: number) {
  return prisma.userBlock.findMany({
    where: { blockerId: userId },
    include: {
      blocked: { select: { displayId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}