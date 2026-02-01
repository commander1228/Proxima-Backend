import prisma from "../utils/prisma";

export async function createUserDao(
  email: string,
  displayId: string,
  password: string,
) {
  return prisma.user.create({
    data: { email, displayId, password },
  });
}

export async function setUserDeletedDao(id: number) {
  return prisma.user.update({
    where: { id },
    data: { deleted: true },
  });
}

export async function setUserDisplayIdDao(name: string, id: number){
  return prisma.user.update({
    where: { id },
    data: {displayId: name}
  })
}

export async function getUserByIdDao(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByEmailDao(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserByDisplayIdDao(displayId: string) {
  return prisma.user.findFirst({ where: { displayId, deleted: false } });
}
