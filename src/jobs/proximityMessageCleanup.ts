// =============================================================================
// PROXIMITY MESSAGE CLEANUP JOB
// =============================================================================
// Deletes ProximityMessage rows older than 24 hours on a recurring interval.
//
// Two-step delete:
//   1. Null out replyToId on old messages — prevents FK violations when the
//      parent message is deleted and children are in the same batch.
//   2. Delete all messages older than the TTL cutoff.
//
// Runs in the same Node.js process as the server — no extra service needed.
// =============================================================================

import { prisma } from "../utils/prisma";
import logger from "../utils/logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // run every hour
const MESSAGE_TTL_MS = 48 * 60 * 60 * 1000; // 48-hour TTL

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startProximityMessageCleanup(): void {
  if (cleanupInterval) {
    logger.warn("[ProximityCleanup] Already running, skipping start");
    return;
  }

  logger.info("[ProximityCleanup] Started — deleting proximity messages older than 48h every hour");

  runCleanup();
  cleanupInterval = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}

export function stopProximityMessageCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info("[ProximityCleanup] Stopped");
  }
}

async function runCleanup(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - MESSAGE_TTL_MS);

    // Step 1: Null out replyToId on old messages to avoid FK constraint violations
    await prisma.proximityMessage.updateMany({
      where: { createdAt: { lt: cutoff }, replyToId: { not: null } },
      data: { replyToId: null },
    });

    // Step 2: Delete all messages past the TTL
    const { count } = await prisma.proximityMessage.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (count > 0) {
      logger.info(`[ProximityCleanup] Deleted ${count} proximity message(s)`);
    }
  } catch (error) {
    logger.error("[ProximityCleanup] Cleanup failed:", error);
  }
}
