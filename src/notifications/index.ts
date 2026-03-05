// =============================================================================
// NOTIFICATION MODULE — Barrel Export
// =============================================================================
// Import everything you need from one place:
//
//   import { emitNotificationAsync, startNotificationScheduler } from "./notifications";
//
// For controllers (the most common use case):
//   import { emitNotificationAsync } from "../notifications";
//   import { NotificationEvent } from "../notifications";
// =============================================================================

// Core service — the main entry point for triggering notifications
export { emitNotification, emitNotificationAsync } from "./notificationService";

// Scheduler — call startNotificationScheduler() in index.ts
export { startNotificationScheduler, stopNotificationScheduler } from "./notificationScheduler";

// DAO — for controllers that need direct DB access (push tokens, read/unread)
export {
  upsertPushToken,
  removePushToken,
  removeAllPushTokens,
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  touchUserActivity,
} from "./notificationDao";

// Types — for controllers that emit events
export {
  NotificationType,
  NotificationEvent,
  type NotificationPayload,
  type NotificationContext,
  type NotificationRule,
} from "./notificationTypes";

// Rules — for testing or admin endpoints
export { NOTIFICATION_RULES, getRulesForEvent } from "./notificationRules";
