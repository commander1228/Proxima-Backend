import { Router } from "express";
import { body } from "express-validator";
import { ContentType } from "@prisma/client";
import { authenticateToken } from "../middleware/authMiddleware";
import { validateRequest } from "../middleware/validateRequest";
import { submitReport } from "../controllers/reportController";

const router = Router();

// All report endpoints require an authenticated user
router.use(authenticateToken);

router.post(
  "/",
  [
    body("contentType")
      .isIn(Object.values(ContentType))
      .withMessage(
        `contentType must be one of: ${Object.values(ContentType).join(", ")}`,
      ),

    body("contentId")
      .isInt({ min: 1 })
      .withMessage("contentId must be a positive integer"),
  ],
  validateRequest,
  submitReport,
);

export default router;