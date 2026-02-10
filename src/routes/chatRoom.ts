import { Router } from "express";
import {
  authenticateToken,
  authenticateAdmin,
} from "../middleware/authMiddleware";
import { createChatRoom, list, deleteChatRoom, getChatRoomTypes } from "../controllers/chatRoomController";
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
  authenticateAdmin,
  createChatRoom,
);

router.post("/delete", authenticateAdmin, deleteChatRoom);

router.get("/list", list);

router.get("/types", getChatRoomTypes);

export default router;
