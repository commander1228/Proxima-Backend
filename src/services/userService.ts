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
