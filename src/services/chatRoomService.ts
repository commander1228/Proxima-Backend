import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export async function createChatRoom(name: string) {
  const existing = await prisma.chatRoom.findUnique({ where: { name } });
  if (existing) throw new Error("A Chatroom of this name already exists");
  return prisma.chatRoom.create({
    data: { name },
  });
}

export async function listChatRooms() {
  return prisma.chatRoom.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getChatRoomById(id: number) {
  return prisma.chatRoom.findUnique({
    where: { id },
  });
}

export async function getLastFiftyMessages(chatRoomId: number) {
  return prisma.message.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender: { select: { displayId: true } },
    },
  });
}

export async function createMessage(
  chatRoomId: number,
  senderId: number,
  content: string,
) {
  return prisma.message.create({
    data: {
      chatRoomId,
      senderId,
      content,
    },
    include: {
      sender: { select: { displayId: true } },
    },
  });
}
