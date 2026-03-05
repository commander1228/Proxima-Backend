// =============================================================================
// NOTIFICATION CONTROLLER
// =============================================================================
// API endpoints for the notification system:
//
// POST   /api/notification/register-token   — Register a push token
// DELETE /api/notification/remove-token      — Remove a push token (logout)
// GET    /api/notification/list              — Get notification history
// GET    /api/notification/unread-count      — Get unread badge count
// POST   /api/notification/mark-read/:id     — Mark one notification as read
// POST   /api/notification/mark-all-read     — Mark all as read
// =============================================================================

import { withAuth } from "../utils/handler";
import {
  upsertPushToken,
  removePushToken,
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  touchUserActivity,
} from "../notifications";

// ─── Register Push Token ─────────────────────────────────────────────────────
// Called by the mobile app after getting an Expo push token.
// Also updates lastActiveAt since the user is clearly active.

export const registerToken = withAuth(async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "token is required" });
    }

    await upsertPushToken(req.user.id, token, platform ?? "unknown");
    await touchUserActivity(req.user.id);

    return res.status(200).json({ message: "Push token registered" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ─── Remove Push Token ───────────────────────────────────────────────────────
// Called on logout so the user stops receiving push notifications.

export const removeToken = withAuth(async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "token is required" });
    }

    await removePushToken(token);

    return res.status(200).json({ message: "Push token removed" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ─── List Notifications ──────────────────────────────────────────────────────
// Paginated list of the user's notifications, newest first.
// Pass `?before=<ISO date>` for cursor-based pagination.

export const listNotifications = withAuth(async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const before = req.query.before
      ? new Date(String(req.query.before))
      : undefined;

    const notifications = await getNotificationsForUser(
      req.user.id,
      limit,
      before
    );

    // Also touch activity since the user is checking notifications
    touchUserActivity(req.user.id).catch(() => {}); // fire-and-forget

    return res.status(200).json({ notifications });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ─── Unread Count ────────────────────────────────────────────────────────────
// Returns the number of unread notifications (for badge display).

export const unreadCount = withAuth(async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    return res.status(200).json({ count });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ─── Mark One as Read ────────────────────────────────────────────────────────

export const markOneRead = withAuth(async (req, res) => {
  try {
    const notificationId = Number(req.params.id);

    if (!notificationId || Number.isNaN(notificationId)) {
      return res.status(400).json({ message: "invalid notification id" });
    }

    await markAsRead(notificationId, req.user.id);

    return res.status(200).json({ message: "Marked as read" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// ─── Mark All as Read ────────────────────────────────────────────────────────

export const markAllRead = withAuth(async (req, res) => {
  try {
    await markAllAsRead(req.user.id);
    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});
