import prisma from "../utils/prisma";

export class ChatRoomMessageVoteDao {
  async createOrUpdateMessageVote(
    userId: number,
    messageId: number,
    value: number,
  ) {
    return prisma.chatRoomMessageVote.upsert({
      where: {
        userId_messageId: { userId, messageId },
      },
      update: { value },
      create: {
        userId,
        messageId,
        value,
      },
    });
  }

  async removeVote(userId: number, messageId: number) {
    return prisma.chatRoomMessageVote.delete({
      where: {
        userId_messageId: { userId, messageId },
      },
    });
  }

  async getVote(userId: number, messageId: number) {
    return prisma.chatRoomMessageVote.findUnique({
        where: {
            userId_messageId:{ userId, messageId},
        },
    });
  }

  async getMessageVoteCount(messageId:number): Promise<number> {
    const result = await prisma.chatRoomMessageVote.aggregate({
        where: {messageId},
        _sum: {value:true},
    });

    return result._sum.value ?? 0;
  }

}
