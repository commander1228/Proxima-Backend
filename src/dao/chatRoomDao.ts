import {prisma, DB} from "../utils/prisma";

export async function createRoomDao(name: string, locationId: number,db: DB = prisma) {
  return db.chatRoom.create({
    data: { name, locationId },
  });
}

export async function deleteChatRoomDao(id: number) {
  return prisma.chatRoom.update({ where: { id }, data: { deleted: true } });
}

export async function getChatRoomByIdDao(id: number) {
  return prisma.chatRoom.findUnique({ where: { id } });
}

export async function getChatRoomByNameAndLocationDao(
  name: string,
  locationId: number,
) {
  return prisma.chatRoom.findFirst({
    where: { name: name, deleted: false, locationId },
  });
}

export async function getAllChatRoomsByLocationDao(locationId: number) {
  return prisma.chatRoom.findMany({
    where: { deleted: false, locationId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
}
