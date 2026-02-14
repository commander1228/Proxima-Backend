import { Router } from "express";
import {
  authenticateToken,
  authenticateAdmin,
} from "../middleware/authMiddleware";
import { commentOnPost, createPost, postDetails } from "../controllers/postController";

const router = Router();

router.use(authenticateToken);

router.post("/",createPost);

router.get("/:postId",postDetails);

router.post("/:postId/comment",commentOnPost);

export default router;