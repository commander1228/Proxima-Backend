import { prisma } from "../utils/prisma";
import redis from "../utils/setupRedis";

export async function createUserDao(
  email: string,
  displayId: string,
  password: string,
) {
  return await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { email, displayId, password },
    });

    await tx.user_Settings.create({
      data: { userId: createdUser.id },
    });

    return createdUser;
  });
}

/**
 * Soft-delete a user AND all of their content in a single atomic transaction.
 *
 * What gets marked deleted:
 *  - The User record itself
 *  - All Posts they created
 *  - All PostComments they wrote
 *  - All ChatRoomMessages they sent
 *  - All ProximityMessages they sent
 *
 * What gets hard-deleted (cleanup - no longer needed):
 *  - Their votes (PostVote, PostCommentVote, ChatRoomMessageVote)
 *  - Their push tokens
 *  - Their notifications + sent logs
 *  - Their blocks (given and received)
 *  - Their user settings
 *
 * Returns the updated user plus counts of affected rows for logging.
 */
export async function setUserDeletedDao(id: number) {
  return prisma.$transaction(async (tx) => {
    // ── 1. Soft-delete all user-generated content ────────────────────────

    const [posts, comments, chatMessages, proximityMessages] =
      await Promise.all([
        tx.post.updateMany({
          where: { posterId: id, deleted: false },
          data: { deleted: true },
        }),
        tx.postComment.updateMany({
          where: { commenterId: id, deleted: false },
          data: { deleted: true },
        }),
        tx.chatRoomMessage.updateMany({
          where: { senderId: id, deleted: false },
          data: { deleted: true },
        }),
        tx.proximityMessage.updateMany({
          where: { senderId: id, deleted: false },
          data: { deleted: true },
        }),
      ]);

    // ── 2. Hard-delete ephemeral / relational data ───────────────────────

    await Promise.all([
      tx.postVote.deleteMany({ where: { userId: id } }),
      tx.postCommentVote.deleteMany({ where: { userId: id } }),
      tx.chatRoomMessageVote.deleteMany({ where: { userId: id } }),
      tx.pushToken.deleteMany({ where: { userId: id } }),
      tx.notification.deleteMany({ where: { userId: id } }),
      tx.notificationSentLog.deleteMany({ where: { userId: id } }),
      tx.userBlock.deleteMany({
        where: { OR: [{ blockerId: id }, { blockedId: id }] },
      }),
      tx.user_Settings.deleteMany({ where: { userId: id } }),
    ]);

    // ── 3. Mark the user record as deleted ───────────────────────────────

    const deletedUser = await tx.user.update({
      where: { id },
      data: {
        deleted: true,
        // Scrub PII so the email can't be linked back to the person
        email: `deleted_${id}_${Date.now()}@removed.local`,
        password: "ACCOUNT_DELETED",
        displayId: `deleted_user_${id}`,
        karma: 0,
      },
    });

    return {
      user: deletedUser,
      deletedCounts: {
        posts: posts.count,
        comments: comments.count,
        chatMessages: chatMessages.count,
        proximityMessages: proximityMessages.count,
      },
    };
  });
}

export async function setUserDisplayIdDao(name: string, id: number) {
  return prisma.user.update({
    where: { id },
    data: { displayId: name },
  });
}

export async function getUserByIdDao(id: number) {
  return prisma.user.findUnique({
    where: { id },
    include: { preferences: true },
  });
}

export async function getUserByEmailDao(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserByDisplayIdDao(displayId: string) {
  return prisma.user.findFirst({ where: { displayId, deleted: false } });
}

export async function updateUserProximityRadius(id: number, radius: number) {
  return await prisma.user_Settings.update({
    where: { userId: id },
    data: { proximityRadius: radius },
  });
}

export async function updateUserFeedRadius(id: number, radius: number) {
  return await prisma.user_Settings.update({
    where: { userId: id },
    data: { feedRadius: radius },
  });
}

export async function updateUserKarmaDao(id: number, karmaChange: number) {
  return await prisma.user.update({
    where: { id },
    data: {
      karma: {
        increment: karmaChange,
      },
    },
  });
}

export async function setUserVerifiedDao(id: number) {
  return await prisma.user.update({
    where: { id },
    data: { isVerified: true },
  });
}

// ─── Suspension ───────────────────────────────────────────────────────────────

export async function suspendUserDao(id: number, until: Date, contentPreview?: string | null) {
  const user = await prisma.user.update({
    where: { id },
    data: {
      suspendedUntil: until,
      suspendedContentPreview: contentPreview ?? null,
    },
  });
  await redis.set(`suspension:status:${id}`, until.toISOString(), "EX", 15);
  return user;
}

export async function checkUserSuspendedById(userId: number): Promise<{ suspended: boolean; until: Date | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedUntil: true },
  });
  if (!user?.suspendedUntil) return { suspended: false, until: null };
  if (user.suspendedUntil > new Date()) return { suspended: true, until: user.suspendedUntil };
  await prisma.user.update({ where: { id: userId }, data: { suspendedUntil: null, suspendedContentPreview: null } });
  return { suspended: false, until: null };
}

export async function unsuspendUserDao(id: number) {
  const user = await prisma.user.update({
    where: { id },
    data: { suspendedUntil: null, suspendedContentPreview: null },
  });
  await redis.del(`suspension:status:${id}`);
  return user;
}

export async function setAnonymousModeDao(userId: number, enabled: boolean) {
  return prisma.user_Settings.update({
    where: { userId },
    data: { anonymousMode: enabled },
  });
}

export async function getNotificationPreferencesDao(userId: number) {
  const settings = await prisma.user_Settings.findUnique({
    where: { userId },
    select: { notifComments: true, notifKarma: true, notifInactiveReminder: true },
  });
  return settings ?? { notifComments: true, notifKarma: true, notifInactiveReminder: true };
}

export async function updateNotificationPreferencesDao(
  userId: number,
  prefs: { notifComments?: boolean; notifKarma?: boolean; notifInactiveReminder?: boolean }
) {
  return prisma.user_Settings.update({
    where: { userId },
    data: prefs,
  });
}

export async function getSuspendedUsersDao() {
  return prisma.user.findMany({
    where: {
      suspendedUntil: { gt: new Date() },
      deleted: false,
    },
    select: {
      id: true,
      displayId: true,
      email: true,
      suspendedUntil: true,
    },
  });
}