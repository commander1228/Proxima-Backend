import prisma from "../utils/prisma";

export async function createUserDao(
  email: string,
  displayId: string,
  password: string,
) {
  const createdUser = await prisma.user.create({
    data: { email, displayId, password },
  });

  const createUserSettings = await prisma.user_Settings.create({
    data: { userId: createdUser.id, proximityRadius: 1600 },
  });

  return createdUser;
}

export async function setUserDeletedDao(id: number) {
  return prisma.user.update({
    where: { id },
    data: { deleted: true },
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
