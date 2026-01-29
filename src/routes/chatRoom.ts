import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { create, list } from "../controllers/chatRoomController";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validateRequest";

const router = Router();

router.use(authenticateToken);

router.post(
  "/create",
  [
    body("name")
      .isString()
      .isLength({ min: 3, max: 32 })
      .withMessage("Chat room name must be 3-32 chars"),
    validateRequest,
  ],
  create,
);
router.get("/list", list);

export default router;
