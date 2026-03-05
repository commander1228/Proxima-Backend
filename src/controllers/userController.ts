import { Request, response, Response } from "express";
import {
  getUserByDisplayId,
  getUserById,
  getUserKarma,
  setUserDeleted,
  setUserDisplayId,
  userNameInUse,
  suspendUser,
  unsuspendUser,
  getSuspendedUsers,
} from "../services/userService";
import { getIo } from "../websocket/ioInstance";
import { updateUserProximityRadius, updateUserFeedRadius, setAnonymousModeDao, getNotificationPreferencesDao, updateNotificationPreferencesDao } from "../dao/userServiceDao";
import { muteLocationDao, unmuteLocationDao, getMutedLocationsDao } from "../dao/MutedLocationDao";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { ProximityMessageService } from "../services/ProximityMessageService";
import { PostDao } from "../dao/PostDao";
import { PostCommentService } from "../services/PostCommentService";

const chatRoomMessageService = new ChatRoomMessageService();
const proximityMessageService = new ProximityMessageService();
const postDao = new PostDao();
const postCommentService = new PostCommentService();

export async function deleteUser(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    // Admins can delete other users by passing userId in the body;
    // regular users always delete their own account.
    const targetId = user.isAdmin && req.body.userId ? req.body.userId : user.id;

    const userToDelete = await getUserById(targetId);

    if (!userToDelete) {
      return res.status(404).json({ message: "User Not Found" });
    }

    const result = await setUserDeleted(userToDelete);

    return res.status(200).json({
      message: `user ${userToDelete.displayId} has been deleted`,
      deletedUser: result.user,
      deletedCounts: result.deletedCounts,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function changeUsername(req: Request, res: Response) {
  try {
    const { newUserName } = req.body;
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    if (await userNameInUse(newUserName)) {
      return res.status(409).json({ message: "Username already in use" });
    }

    await setUserDisplayId(newUserName, user);

    return res.status(201).json({
      message: `userName has been changed to ${newUserName}`,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function userDetails(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    return res.status(200).json({
      id: user.id,
      username: user.displayId,
      email: user.email,
      created: user.createdAt,
      message: "user details retrieved",
      isAdmin: user.isAdmin,
      isEmailVerified: user.isVerified,
      feedRadius: user.preferences?.feedRadius ?? 3219,
      anonymousMode: user.preferences?.anonymousMode ?? true,
      notifComments: user.preferences?.notifComments ?? true,
      notifKarma: user.preferences?.notifKarma ?? true,
      notifInactiveReminder: user.preferences?.notifInactiveReminder ?? true,
      suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
      suspendedContentPreview: user.suspendedContentPreview ?? null,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function userStatistics(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    const [chatCount, proximityCount, userKarma] = await Promise.all([
      chatRoomMessageService.getMessageCountByUser(user.id),
      proximityMessageService.getMessageCountByUser(user.id),
      getUserKarma(user.id),
    ]);
    const messageCount = chatCount + proximityCount;

    return res.status(200).json({ messageCount, userKarma });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function changeUserProximityRadius(req: Request, res: Response) {
  try {
    const {newProximityRadius} = req.body;
    const user = req.user;

    if (typeof newProximityRadius !== "number"){
      throw new Error("Radius must be a number");
    }
    
  if(newProximityRadius >= 999999){
  throw new Error("Radius value too large");
  }
  if(newProximityRadius <= 10){
    throw new Error("Radius value too small");
  }

  if(!user){
    return res
        .status(401)
        .json({ message: "request from user that does not exist" });
  }

  await updateUserProximityRadius(user.id, newProximityRadius);

  return res.status(200).json({
    newProximityRadius: newProximityRadius,
    message: `user proximity radius setting has been changed to ${newProximityRadius}`,
  });
} catch (error: any) {
    return res.status(400).json({ message: error.message });
}
}

// ── Feed radius (how far out the feed searches for locations) ─────────────────
const FEED_RADIUS_MIN_M = 3_219;  // 2 miles
const FEED_RADIUS_MAX_M = 19_312; // 12 miles

export async function changeUserFeedRadius(req: Request, res: Response) {
  try {
    const { newFeedRadius } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }
    if (typeof newFeedRadius !== "number" || !Number.isFinite(newFeedRadius)) {
      return res.status(400).json({ message: "feedRadius must be a number" });
    }
    if (newFeedRadius < FEED_RADIUS_MIN_M) {
      return res.status(400).json({ message: `Minimum feed radius is ${FEED_RADIUS_MIN_M}m (2 miles)` });
    }
    if (newFeedRadius > FEED_RADIUS_MAX_M) {
      return res.status(400).json({ message: `Maximum feed radius is ${FEED_RADIUS_MAX_M}m (12 miles)` });
    }

    await updateUserFeedRadius(user.id, newFeedRadius);

    return res.status(200).json({
      feedRadius: newFeedRadius,
      message: `Feed radius updated to ${newFeedRadius}m`,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

// =============================================================================
// GET /user/posts — Return the authenticated user's posts
// =============================================================================

export async function getUserPosts(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }

    const posts = await postDao.getPostsByUser(user.id);
    return res.status(200).json({ posts });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

// =============================================================================
// GET /user/comments — Return the authenticated user's comments (on active posts)
// =============================================================================

export async function getUserComments(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }

    const comments = await postCommentService.getPostCommentsByUser(user.id);
    return res.status(200).json({ comments });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

// =============================================================================
// ANONYMOUS MODE
// =============================================================================

export async function toggleAnonymousMode(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }
    await setAnonymousModeDao(user.id, enabled);
    return res.status(200).json({ anonymousMode: enabled });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

// =============================================================================
// NOTIFICATION PREFERENCES
// =============================================================================

export async function updateNotificationPreferences(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { notifComments, notifKarma, notifInactiveReminder } = req.body;
    const update: Record<string, boolean> = {};
    if (typeof notifComments === "boolean") update.notifComments = notifComments;
    if (typeof notifKarma === "boolean") update.notifKarma = notifKarma;
    if (typeof notifInactiveReminder === "boolean") update.notifInactiveReminder = notifInactiveReminder;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No valid preference fields provided" });
    }

    await updateNotificationPreferencesDao(user.id, update);
    return res.status(200).json({ message: "Notification preferences updated" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

// =============================================================================
// MUTED LOCATIONS
// =============================================================================

export async function muteLocation(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }
    const { locationId, locationName } = req.body;
    if (!locationId || typeof locationId !== "number") {
      return res.status(400).json({ message: "locationId must be a number" });
    }
    await muteLocationDao(user.id, locationId, locationName ?? "");
    return res.status(200).json({ message: "Location muted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function unmuteLocation(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }
    const { locationId } = req.body;
    if (!locationId || typeof locationId !== "number") {
      return res.status(400).json({ message: "locationId must be a number" });
    }
    await unmuteLocationDao(user.id, locationId);
    return res.status(200).json({ message: "Location unmuted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getMutedLocations(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }
    const locations = await getMutedLocationsDao(user.id);
    return res.status(200).json({ locations });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function adminSuspendUser(req: Request, res: Response) {
  try {
    const { displayId, durationMinutes } = req.body;
    if (!displayId || typeof displayId !== "string") {
      return res.status(400).json({ message: "displayId is required" });
    }
    if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
      return res.status(400).json({ message: "durationMinutes must be a positive number" });
    }

    const targetUser = await getUserByDisplayId(displayId);
    if (!targetUser || targetUser.deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    await suspendUser(targetUser.id, durationMinutes);
    const suspendedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    const io = getIo();
    if (io) {
      io.to(`user:${targetUser.id}`).emit("accountSuspended", {
        suspendedUntil: suspendedUntil.toISOString(),
        contentPreview: null,
      });
    }

    return res.status(200).json({
      message: `User ${displayId} has been suspended`,
      suspendedUntil: suspendedUntil.toISOString(),
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function adminUnsuspendUser(req: Request, res: Response) {
  try {
    const { displayId } = req.body;
    if (!displayId || typeof displayId !== "string") {
      return res.status(400).json({ message: "displayId is required" });
    }

    const targetUser = await getUserByDisplayId(displayId);
    if (!targetUser || targetUser.deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    await unsuspendUser(targetUser.id);
    return res.status(200).json({ message: `User ${displayId} has been unsuspended` });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function adminGetSuspendedUsers(req: Request, res: Response) {
  try {
    const suspendedUsers = await getSuspendedUsers();
    return res.status(200).json({ suspendedUsers });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}