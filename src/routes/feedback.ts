import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validateRequest";
import { submitFeedback, getFeedbackCategories } from "../controllers/feedbackController";
import { FeedbackCategory } from "@prisma/client";

const router = Router();

router.use(authenticateToken);

router.post(
  "/",
  [
    body("category")
      .optional()
      .isIn(Object.values(FeedbackCategory))
      .withMessage("invalid feedback category"),

    body("rating")
      .optional()
      .toInt()
      .isInt({ min: 1, max: 5 })
      .withMessage("rating must be 1-5"),

    body("comment")
      .optional()
      .isString()
      .withMessage("comment must be a string")
      .isLength({ max: 500 })
      .withMessage("comment must be at most 500 characters"),

    body().custom((_, { req }) => {
      const rating = req.body?.rating;
      const comment = req.body?.comment;
      const hasRating = rating !== undefined && rating !== null;
      const hasComment = typeof comment === "string" && comment.trim().length > 0;
      if (!hasRating && !hasComment) throw new Error("Provide a rating or a comment.");
      return true;
    }),
  ],
  validateRequest,
  submitFeedback
);

router.get("/categories", getFeedbackCategories);

export default router;
