// =============================================================================
// MODERATION QUEUE (Redis-based)
// =============================================================================
// This module provides a simple FIFO (First-In, First-Out) job queue backed by
// a Redis list. It has two operations:
//
//   enqueue(job)  → Serializes the job to JSON and pushes it onto the LEFT
//                   side of the Redis list. This is O(1) and non-blocking.
//
//   dequeue()     → Pops from the RIGHT side of the list (FIFO order).
//                   Uses BRPOP which BLOCKS for up to 5 seconds waiting for
//                   a job. This means the worker doesn't spin in a tight loop
//                   burning CPU — it sleeps until work arrives.
//
// WHY REDIS LISTS?
// ────────────────
// You already have Redis running for user locations. Redis lists give you a
// production-quality job queue with zero additional infrastructure. When your
// app scales, you can swap this out for Bull, BullMQ, or AWS SQS — the
// interface (enqueue/dequeue) stays the same.
//
// RELIABILITY NOTE:
// ────────────────
// BRPOP removes the job from Redis the moment it's read. If the worker crashes
// mid-processing, that job is lost. For a moderation queue this is acceptable —
// the worst case is one post doesn't get checked. If you later need guaranteed
// delivery, switch to BRPOPLPUSH (moves to a "processing" list) or BullMQ.
// =============================================================================

import redis from "../utils/setupRedis";
import { ModerationJob } from "./moderationTypes";
import logger from "../utils/logger";

// The key name for our Redis list. All moderation jobs live here.
const QUEUE_KEY = "moderation:jobs";

/**
 * Push a new moderation job onto the queue.
 *
 * Called immediately after saving content to the database.
 * This is non-blocking and very fast (Redis LPUSH is O(1)).
 *
 * @param job - The moderation job containing content details and metadata
 */
export async function enqueueModerationJob(job: ModerationJob): Promise<void> {
  try {
    // LPUSH adds to the left side → BRPOP reads from the right = FIFO order
    await redis.lpush(QUEUE_KEY, JSON.stringify(job));
    logger.info(
      `[ModerationQueue] Enqueued ${job.contentType} #${job.contentId}`
    );
  } catch (error) {
    // If Redis is down, we log the error but DON'T crash the request.
    // The content stays as "pending" — you can add a periodic sweep later
    // to catch anything that fell through the cracks.
    logger.error("[ModerationQueue] Failed to enqueue job:", error);
  }
}

/**
 * Pop the next moderation job from the queue.
 *
 * Uses BRPOP which blocks for up to 5 seconds waiting for a job.
 * Returns null if the queue is empty after the timeout.
 *
 * @returns The next job to process, or null if queue is empty
 */
export async function dequeueModerationJob(): Promise<ModerationJob | null> {
  try {
    // BRPOP returns [key, value] or null after timeout.
    // The "5" means block for 5 seconds max before returning null.
    const result = await redis.brpop(QUEUE_KEY, 5);

    if (!result) {
      // Queue is empty — worker will loop and try again
      return null;
    }

    // result[0] = the key name, result[1] = the JSON string
    const job: ModerationJob = JSON.parse(result[1]);
    return job;
  } catch (error) {
    logger.error("[ModerationQueue] Failed to dequeue job:", error);
    return null;
  }
}

/**
 * Check how many jobs are waiting in the queue.
 * Useful for monitoring / health checks / dashboards.
 */
export async function getQueueLength(): Promise<number> {
  return redis.llen(QUEUE_KEY);
}