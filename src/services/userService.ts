import { User } from "@prisma/client";
import {
  createUserDao,
  setUserDeletedDao,
  getUserByDisplayIdDao,
  getUserByEmailDao,
  getUserByIdDao,
  setUserDisplayIdDao,
  updateUserProximityRadius,
  updateUserKarmaDao,
  setUserVerifiedDao,
  suspendUserDao,
  unsuspendUserDao,
  getSuspendedUsersDao,
  checkUserSuspendedById,
} from "../dao/userServiceDao";

export async function createUser(
  email: string,
  displayId: string,
  password: string,
) {
  return await createUserDao(email, displayId, password);
}

export async function setUserDeleted(user: User) {
  return await setUserDeletedDao(user.id);
}

export async function setUserDisplayId(name: string, user: User) {
  return await setUserDisplayIdDao(name, user.id);
}

export async function setUserProximityRadius(
  userId: number,
  newRadius: number,
) {
  return await updateUserProximityRadius(userId, newRadius);
}

export async function userExists(
  email: string,
  displayId: string,
): Promise<boolean> {
  return !!(await getUserByEmail(email)) || (await userNameInUse(displayId));
}

export async function getUserByEmail(email: string) {
  return await getUserByEmailDao(email);
}

export async function getUserById(id: number) {
  return await getUserByIdDao(id);
}

export async function getUserByDisplayId(name: string) {
  return await getUserByDisplayIdDao(name);
}

export async function userNameInUse(name: string): Promise<boolean> {
  const user = await getUserByDisplayIdDao(name);
  return !!user && !user.deleted;
}

export async function updateUserKarma(userId: number, vote: number) {
  return await updateUserKarmaDao(userId, vote);
}

export async function getUserKarma(userId: number) {
  const user = await getUserById(userId);
  return user?.karma;
}

export async function setUserVerified(userId: number) {
  return await setUserVerifiedDao(userId);
}

// ─── Suspension ───────────────────────────────────────────────────────────────

/**
 * Suspend a user until the given date.
 * @param durationMinutes  How long the suspension should last.
 */
export async function suspendUser(userId: number, durationMinutes: number, contentPreview?: string | null) {
  const until = new Date(Date.now() + durationMinutes * 60 * 1000);
  return suspendUserDao(userId, until, contentPreview);
}

export async function isUserSuspendedById(userId: number): Promise<{ suspended: boolean; until: Date | null }> {
  return checkUserSuspendedById(userId);
}

/** Immediately lift a suspension. */
export async function unsuspendUser(userId: number) {
  return unsuspendUserDao(userId);
}

/** Return all currently-suspended users (suspendedUntil > now). */
export async function getSuspendedUsers() {
  return getSuspendedUsersDao();
}

/**
 * Returns true if the user is currently suspended.
 * Performs a lazy auto-lift: if suspendedUntil is in the past the field
 * is cleared and false is returned so the user isn't penalised again.
 */
export async function isUserSuspended(user: { id: number; suspendedUntil: Date | null }): Promise<boolean> {
  if (!user.suspendedUntil) return false;
  if (user.suspendedUntil > new Date()) return true;
  // Suspension has expired — lift it lazily
  await unsuspendUserDao(user.id);
  return false;
}