import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { getFeed } from "../controllers/feedController";

const router = Router();

router.use(authenticateToken);

router.get("/", getFeed);

export default router;