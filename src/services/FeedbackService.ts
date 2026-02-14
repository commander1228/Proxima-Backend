import { FeedbackCategory, Platform } from "@prisma/client";
import { FeedbackDao } from "../dao/FeedbackDao";

const feedbackDao = new FeedbackDao();

export class FeedbackService {
  async submitFeedback(
    userId: number,
    category: FeedbackCategory,
    rating: number | undefined,
    comment: string | undefined,
    platform:Platform | undefined
  ) {
    // not really sure if this is needed, but some documentations have used it
    const cleanComment = comment?.trim();
    if (rating === undefined && (!cleanComment || cleanComment.length === 0)) {
      throw new Error("Provide a rating or a comment.");
    }

    return feedbackDao.createFeedback(
      userId,
      category,
      rating ?? null,
      cleanComment ?? null,
      platform ?? null
    );
  }
}