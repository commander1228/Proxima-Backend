import prisma from "../utils/prisma";

export async function createRoomDao(name: string, userId: number) {
  return prisma.chatRoom.create({
    data: { name, creatorId: userId },
  });
}

export async function deleteChatRoomDao(id: number) {
  return prisma.chatRoom.update({ where: { id }, data: { deleted: true } });
}

export async function getChatRoomByIdDao(id: number) {
  return prisma.chatRoom.findUnique({ where: { id } });
}

export async function getChatRoomByNameDao(name: string) {
  return prisma.chatRoom.findFirst({ where: { name: name, deleted: false } });
}

export async function getAllChatRoomsDao() {
  return prisma.chatRoom.findMany({
    where: {deleted : false},
    select: { id: true, name: true},
    orderBy: { createdAt: "desc" },
  });
}
