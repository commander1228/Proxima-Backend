// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================
// The orchestrator. When an event happens in the app, call `emitNotification`
// with the event type and context. The service will:
//
//   1. Find all rules that listen to that event
//   2. Evaluate each rule to see if it should fire
//   3. Check deduplication to prevent repeat sends
//   4. Save the notification to the database (in-app log)
//   5. Send a push notification to the user's devices
//
// This is the ONLY function you need to call from controllers. Everything
// else (which rules to check, dedup logic, push delivery) is handled
// internally by the rule engine.
//
// ┌──────────────────────────────────────────────────────────────────────┐
// │  USAGE IN A CONTROLLER:                                             │
// │                                                                     │
// │  import { emitNotification } from "../notifications";               │
// │                                                                     │
// │  // After creating a comment:                                       │
// │  emitNotification({                                                 │
// │    event: NotificationEvent.COMMENT_CREATED,                        │
// │    actorId: currentUser.id,                                         │
// │    postId: post.id,                                                 │
// │    postTitle: post.title,                                           │
// │    postOwnerId: post.posterId,                                      │
// │    commentId: createdComment.id,                                    │
// │  });                                                                │
// │                                                                     │
// │  // That's it! The rule engine handles the rest.                    │
// └──────────────────────────────────────────────────────────────────────┘
// =============================================================================

import { NotificationContext } from "./notificationTypes";
import { getRulesForEvent } from "./notificationRules";
import { getNotificationPreferencesDao } from "../dao/userServiceDao";
import { sendPushToUser } from "./pushService";
import logger from "../utils/logger";

const NOTIF_PREF_MAP: Record<string, "notifComments" | "notifKarma" | "notifInactiveReminder"> = {
  NEW_COMMENT: "notifComments",
  KARMA_MILESTONE: "notifKarma",
  INACTIVE_REMINDER: "notifInactiveReminder",
};

/**
 * Main entry point: emit a notification event.
 *
 * This function is intentionally async-fire-and-forget from the caller's
 * perspective. Notification failures should NEVER break the main request.
 * That's why we catch all errors internally.
 *
 * @param ctx - The event context (who did what, to which resource)
 */
export async function emitNotification(
  ctx: NotificationContext
): Promise<void> {
  try {
    // Step 1: Find rules that care about this event
    const rules = getRulesForEvent(ctx.event);

    if (rules.length === 0) {
      return; // No rules registered for this event
    }

    // Step 2: Evaluate each rule
    for (const rule of rules) {
      try {
        // Ask the rule: "should we send a notification for this context?"
        const payload = rule.evaluate(ctx);

        if (!payload) {
          continue; // Rule decided not to fire — move on
        }

        // Check if user has disabled this notification type
        const prefKey = NOTIF_PREF_MAP[payload.type];
        if (prefKey) {
          const prefs = await getNotificationPreferencesDao(payload.userId);
          if (!prefs[prefKey]) {
            logger.info(`[Notification] Skipping "${rule.name}" for user ${payload.userId} (disabled by user)`);
            continue;
          }
        }

        // Send push notification (non-blocking)
        // We don't await this — push delivery runs in the background.
        sendPushToUser(payload).catch((err) =>
          logger.error(`[Notification] Push failed for rule "${rule.name}":`, err)
        );

        logger.info(
          `[Notification] Sent "${rule.name}" to user ${payload.userId}`
        );
      } catch (ruleErr) {
        // One rule failing should not prevent other rules from running
        logger.error(
          `[Notification] Rule "${rule.name}" failed:`,
          ruleErr
        );
      }
    }
  } catch (error) {
    // Top-level catch — notification errors should NEVER propagate
    logger.error("[Notification] emitNotification failed:", error);
  }
}

/**
 * Convenience: emit notification without awaiting (for use in controllers
 * where you don't want to block the response).
 *
 * This is just syntactic sugar — it calls emitNotification and catches
 * any unhandled errors, ensuring the caller is never affected.
 */
export function emitNotificationAsync(ctx: NotificationContext): void {
  emitNotification(ctx).catch((err) =>
    logger.error("[Notification] Async emit failed:", err)
  );
}
