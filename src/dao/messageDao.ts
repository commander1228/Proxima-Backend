import prisma from "../utils/prisma";

export async function createMessageDao(
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

export async function deleteMessageDao(messageId: number) {
  return prisma.message.update({
    where: { id: messageId },
    data: { deleted: true },
  });
}

export async function deleteMessagesByChatroomDao(chatroomId: number) {
  return prisma.message.updateMany({
    where: { chatRoomId: chatroomId },
    data: { deleted: true },
  });
}

export async function deleteMessagesByUserDao(userId: number) {
  return prisma.message.updateMany({
    where: { senderId: userId },
    data: { deleted: true },
  });
}

export async function getMessageByIdDao(messageId: number){
  return prisma.message.findUnique({
    where: {id : messageId },
  });
}

export async function getLatestMessagesByChatRoomDao(
  chatRoomId: number,
  count: number,
) {
  return prisma.message.findMany({
    where: { chatRoomId},
    orderBy: { createdAt: "desc" },
    take: count,
    include: {
      sender: { select: { displayId: true, deleted: true } },
    },
  });
}
