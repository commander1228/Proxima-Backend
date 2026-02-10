import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validateRequest";
import { changeUsername, changeUserProximityRadius, deleteUser, userDetails, userStatistics } from "../controllers/userController";

const router = Router();

router.use(authenticateToken);

router.post("/delete", deleteUser);

//making sure user doesnt accidently leak their email
router.post(
  "/changeUsername",
  [
    body("newUserName")
      .not()
      .isEmail()
      .withMessage("username cannot be an email address dummy"),
  ],
  validateRequest,
  changeUsername,
);

router.post("/changeProximityRadius",changeUserProximityRadius)

router.get("/me",userDetails);

router.get("/stats", userStatistics);


export default router;
