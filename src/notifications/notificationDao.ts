// =============================================================================
// NOTIFICATION DAO
// =============================================================================
// All database operations for the notification system.
// Follows the same DAO pattern used throughout the codebase.
// =============================================================================

import { prisma } from "../utils/prisma";
import redis from "../utils/setupRedis";
import { NotificationPayload } from "./notificationTypes";

const UNREAD_CACHE_TTL = 15;

function unreadCacheKey(userId: number) {
  return `cache:notif:unread:${userId}`;
}

async function invalidateUnreadCache(userId: number) {
  await redis.del(unreadCacheKey(userId));
}

// ─── Push Token Operations ───────────────────────────────────────────────────

/**
 * Register (or update) a push token for a user.
 * Uses upsert on the unique `token` field so re-registering the same
 * device just updates the userId and platform.
 */
export async function upsertPushToken(
  userId: number,
  token: string,
  platform: string = "unknown"
) {
  return prisma.pushToken.upsert({
    where: { token },
    update: { userId, platform, updatedAt: new Date() },
    create: { userId, token, platform },
  });
}

/** Remove a specific push token (e.g. on logout). */
export async function removePushToken(token: string) {
  return prisma.pushToken.deleteMany({ where: { token } });
}

/** Remove ALL push tokens for a user (e.g. on account deletion). */
export async function removeAllPushTokens(userId: number) {
  return prisma.pushToken.deleteMany({ where: { userId } });
}

/** Get all push tokens for a user (they may have multiple devices). */
export async function getPushTokensForUser(userId: number): Promise<string[]> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });
  return tokens.map((t) => t.token);
}

// ─── Notification CRUD ───────────────────────────────────────────────────────

/** Save a notification to the database (in-app notification log). */
export async function createNotification(payload: NotificationPayload) {
  const result = await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? undefined,
    },
  });
  await invalidateUnreadCache(payload.userId);
  return result;
}

/**
 * Get notifications for a user, newest first.
 * Supports cursor-based pagination via `before` (createdAt of last item).
 */
export async function getNotificationsForUser(
  userId: number,
  limit: number = 20,
  before?: Date
) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Count unread notifications for a user (for badge display). */
export async function getUnreadCount(userId: number): Promise<number> {
  const key = unreadCacheKey(userId);
  const cached = await redis.get(key);
  if (cached !== null) return Number(cached);

  const count = await prisma.notification.count({
    where: { userId, read: false },
  });
  await redis.setex(key, UNREAD_CACHE_TTL, count);
  return count;
}

/** Mark a single notification as read. */
export async function markAsRead(notificationId: number, userId: number) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
  await invalidateUnreadCache(userId);
  return result;
}

/** Mark ALL notifications as read for a user. */
export async function markAllAsRead(userId: number) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  await invalidateUnreadCache(userId);
  return result;
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Check if a notification with this dedup key has already been sent.
 * Returns true if it exists (meaning we should NOT send again).
 */
export async function hasBeenSent(
  ruleKey: string,
  userId: number
): Promise<boolean> {
  const existing = await prisma.notificationSentLog.findFirst({
    where: { ruleKey, userId },
  });
  return !!existing;
}

/** Record that a notification was sent (for deduplication). */
export async function recordSent(ruleKey: string, userId: number) {
  return prisma.notificationSentLog.create({
    data: { ruleKey, userId },
  });
}

// ─── User Activity Tracking ──────────────────────────────────────────────────

/** Update the user's lastActiveAt timestamp (call on login, app open, etc). */
export async function touchUserActivity(userId: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });
}

/**
 * Find all users who haven't been active for at least `hoursAgo` hours.
 * Only returns non-deleted, verified users who have at least one push token.
 */
export async function getInactiveUsers(hoursAgo: number = 48) {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  return prisma.user.findMany({
    where: {
      lastActiveAt: { lt: cutoff },
      deleted: false,
      isVerified: true,
      pushTokens: { some: {} }, // Only users with push tokens
    },
    select: { id: true, displayId: true, lastActiveAt: true },
  });
}
