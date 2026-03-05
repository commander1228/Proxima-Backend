import redis from "./setupRedis";

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function sessionKey(userId: number): string {
  return `session:${userId}`;
}

export async function setSession(userId: number): Promise<void> {
  await redis.set(sessionKey(userId), "1", "EX", SESSION_TTL_SECONDS);
}

export async function clearSession(userId: number): Promise<void> {
  await redis.del(sessionKey(userId));
}

export async function hasSession(userId: number): Promise<boolean> {
  const result = await redis.get(sessionKey(userId));
  return result !== null;
}
