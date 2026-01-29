import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { create, list } from "../controllers/chatRoomController";

const router = Router();

router.use(authenticateToken);

router.post("/create", create);
router.post("/list", list);

export default router;