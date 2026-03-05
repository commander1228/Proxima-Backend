import { Router } from "express";
import {
  authenticateToken,
  authenticateAdmin,
} from "../middleware/authMiddleware";
import {
  createChatRoom,
  deleteChatRoom,
  getChatRoomMessages,
} from "../controllers/chatRoomController";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validateRequest";

const router = Router();

router.use(authenticateToken);

router.post("/create", authenticateAdmin, createChatRoom);
router.post("/delete", authenticateAdmin, deleteChatRoom);
router.get("/:roomId/messages", getChatRoomMessages);

export default router;
