import redis from "./setupRedis";
import { checkUserSuspendedById } from "../dao/userServiceDao";

const SUSPENSION_TTL_SECONDS = 15;

function suspensionKey(userId: number): string {
  return `suspension:status:${userId}`;
}

export async function getCachedSuspensionStatus(
  userId: number,
): Promise<{ suspended: boolean; until: Date | null }> {
  const cached = await redis.get(suspensionKey(userId));

  if (cached !== null) {
    if (cached === "none") return { suspended: false, until: null };
    const until = new Date(cached);
    if (until > new Date()) return { suspended: true, until };
    return { suspended: false, until: null };
  }

  const result = await checkUserSuspendedById(userId);
  const value = result.until ? result.until.toISOString() : "none";
  await redis.set(suspensionKey(userId), value, "EX", SUSPENSION_TTL_SECONDS);
  return result;
}

export async function setSuspensionCache(userId: number, until: Date): Promise<void> {
  await redis.set(suspensionKey(userId), until.toISOString(), "EX", SUSPENSION_TTL_SECONDS);
}

export async function clearSuspensionCache(userId: number): Promise<void> {
  await redis.del(suspensionKey(userId));
}
