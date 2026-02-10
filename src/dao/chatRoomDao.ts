import prisma from "../utils/prisma";
import { ChatRoomType } from "@prisma/client";

export async function createRoomDao(name: string, userId: number,longitude?: number, latitude?: number, size?: number, type?: ChatRoomType) {
  return prisma.chatRoom.create({
    data: { name, creatorId: userId, longitude, latitude, size, type },
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

export async function getChatRoomByType(type: ChatRoomType) {
  return prisma.chatRoom.findMany({ where: { type: type, deleted: false } })
}

export async function getAllChatRoomsDao() {
  return prisma.chatRoom.findMany({
    where: {deleted : false},
    select: { id: true, name: true,longitude: true, latitude: true, size: true, type: true },
    orderBy: { createdAt: "desc" },
  });
}
