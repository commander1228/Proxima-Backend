import { Request, Response } from "express";
import { FeedbackService } from "../services/FeedbackService";
import { FeedbackCategory, Platform } from "@prisma/client";

const feedbackService = new FeedbackService();

export async function submitFeedback(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "unauthorized" });

    const { rating, comment, category,platform } = req.body as {
        rating?: number;
        comment?: string;
        category?: FeedbackCategory;
        platform?: Platform;
    };

    await feedbackService.submitFeedback(user.id, category ?? FeedbackCategory.OVERALL, rating, comment,platform);

    return res.status(200).json({ message: "feedback submitted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export function getFeedbackCategories(req: Request, res: Response) {
  return res.status(200).json({ categories: Object.values(FeedbackCategory) });
}