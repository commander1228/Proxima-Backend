import prisma from "../utils/prisma";
import { FeedbackMessage, FeedbackCategory, Platform } from "@prisma/client";

export class FeedbackDao {
  createFeedback(
    userId: number,
    category: FeedbackCategory,
    rating: number | null,
    comment: string | null,
    platform: Platform | null
  ): Promise<FeedbackMessage> {
    return prisma.feedbackMessage.create({
      data: { userId, category, rating, comment,platform },
    });
  }

  getFeedbackByUser(userId: number): Promise<FeedbackMessage[]> {
    return prisma.feedbackMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }
}