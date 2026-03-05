import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  registerToken,
  removeToken,
  listNotifications,
  unreadCount,
  markOneRead,
  markAllRead,
} from "../controllers/notificationController";

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

router.post("/register-token", registerToken);
router.delete("/remove-token", removeToken);
router.get("/list", listNotifications);
router.get("/unread-count", unreadCount);
router.post("/mark-read/:id", markOneRead);
router.post("/mark-all-read", markAllRead);

export default router;
