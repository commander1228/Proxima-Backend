import { Router } from "express";
import { authenticateToken, authenticateAdmin } from "../middleware/authMiddleware";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validateRequest";
import {
  changeUsername,
  changeUserProximityRadius,
  changeUserFeedRadius,
  deleteUser,
  userDetails,
  userStatistics,
  getUserPosts,
  getUserComments,
  toggleAnonymousMode,
  updateNotificationPreferences,
  muteLocation,
  unmuteLocation,
  getMutedLocations,
  adminSuspendUser,
  adminUnsuspendUser,
  adminGetSuspendedUsers,
} from "../controllers/userController";
import { blockUser, unblockUser, getBlockList } from "../controllers/blockController";

const router = Router();

router.use(authenticateToken);

router.post("/delete", deleteUser);

router.post(
  "/changeUsername",
  [
    body("newUserName")
      .not()
      .isEmail()
      .withMessage("Username cannot be an email address."),
  ],
  validateRequest,
  changeUsername,
);

router.post("/changeProximityRadius", changeUserProximityRadius);
router.post("/changeFeedRadius", changeUserFeedRadius);

router.get("/me", userDetails);

router.get("/stats", userStatistics);

// Content routes
router.get("/posts", getUserPosts);
router.get("/comments", getUserComments);

// Block routes
router.post("/block", blockUser);
router.post("/unblock", unblockUser);
router.get("/blocks", getBlockList);

// Anonymous mode
router.post("/anonymousMode", toggleAnonymousMode);

// Notification preferences
router.post("/notification-preferences", updateNotificationPreferences);

// Muted locations
router.post("/muteLocation", muteLocation);
router.post("/unmuteLocation", unmuteLocation);
router.get("/mutedLocations", getMutedLocations);

// Admin suspension
router.post("/admin/suspend", authenticateAdmin, adminSuspendUser);
router.post("/admin/unsuspend", authenticateAdmin, adminUnsuspendUser);
router.get("/admin/suspended", authenticateAdmin, adminGetSuspendedUsers);

export default router;