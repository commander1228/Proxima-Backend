// =============================================================================
// NOTIFICATION SCHEDULER
// =============================================================================
// Runs periodic background jobs for notification rules that aren't triggered
// by user actions (like the 48-hour inactive reminder).
//
// Uses a simple setInterval approach. This works well for a single-server
// deployment. If you scale to multiple server instances, you'll want to
// move this to a dedicated worker process or use a distributed scheduler
// (e.g. node-cron + Redis lock, or a BullMQ repeatable job) to prevent
// duplicate runs.
//
// CURRENT JOBS:
// ─────────────
// 1. Inactive user reminder — runs every hour, checks for users who haven't
//    logged in for 48+ hours, and emits a SCHEDULED_INACTIVE_CHECK event
//    for each one. The dedup logic in the rule prevents spamming.
// =============================================================================

import { getInactiveUsers } from "./notificationDao";
import { emitNotification } from "./notificationService";
import { NotificationEvent } from "./notificationTypes";
import logger from "../utils/logger";

// How often to run the inactive check (in milliseconds)
const INACTIVE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// How many hours of inactivity before we send a reminder
const INACTIVE_THRESHOLD_HOURS = 48;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the notification scheduler.
 * Call this once when the server boots (in index.ts).
 */
export function startNotificationScheduler(): void {
  if (schedulerInterval) {
    logger.warn("[NotificationScheduler] Already running, skipping start");
    return;
  }

  logger.info(
    `[NotificationScheduler] Started — checking every ${INACTIVE_CHECK_INTERVAL_MS / 60000} min ` +
      `for users inactive > ${INACTIVE_THRESHOLD_HOURS}h`
  );

  // Run immediately on startup, then on interval
  runInactiveCheck();
  schedulerInterval = setInterval(runInactiveCheck, INACTIVE_CHECK_INTERVAL_MS);
}

/**
 * Stop the scheduler (useful for testing or graceful shutdown).
 */
export function stopNotificationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("[NotificationScheduler] Stopped");
  }
}

/**
 * The actual inactive user check.
 * Finds all users who haven't been active for INACTIVE_THRESHOLD_HOURS
 * and emits a notification event for each one.
 *
 * The dedup logic in the inactive_reminder rule ensures each user only
 * gets ONE reminder per 48-hour cycle, even if this check runs hourly.
 */
async function runInactiveCheck(): Promise<void> {
  try {
    const inactiveUsers = await getInactiveUsers(INACTIVE_THRESHOLD_HOURS);

    if (inactiveUsers.length === 0) {
      logger.info("[NotificationScheduler] No inactive users found");
      return;
    }

    logger.info(
      `[NotificationScheduler] Found ${inactiveUsers.length} inactive user(s)`
    );

    for (const user of inactiveUsers) {
      await emitNotification({
        event: NotificationEvent.SCHEDULED_INACTIVE_CHECK,
        targetUserId: user.id,
      });
    }
  } catch (error) {
    // Scheduler errors should never crash the server
    logger.error("[NotificationScheduler] Check failed:", error);
  }
}
