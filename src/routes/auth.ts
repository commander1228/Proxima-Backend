import { Router } from "express";
import {
  register,
  login,
  refresh,
  sendOneTimeVerificationCode,
  verifyCode,
} from "../controllers/authController";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validateRequest";

const router = Router();

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("displayId")
      .isString()
      .isLength({ min: 3, max: 32 })
      .withMessage("Display ID must be 3-32 chars"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 chars"),
    validateRequest,
  ],
  register,
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 chars"),
    validateRequest,
  ],
  login,
);

router.post("/send-code", sendOneTimeVerificationCode);

router.post("verify-code", verifyCode);

router.post("/refresh", refresh);

export default router;
