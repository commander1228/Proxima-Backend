// =============================================================================
// MODERATION WORKER — The Background "Bouncer"
// =============================================================================
//
// WHAT THIS DOES:
// ───────────────
// This worker runs an infinite loop inside your Node.js process:
//   1. Pop the next job from the Redis queue (blocks up to 5s if empty)
//   2. Call the OpenAI Moderation API with the content
//   3. If SAFE   → update moderationStatus to APPROVED
//   4. If TOXIC  → set deleted=true, moderationStatus=REJECTED, and emit a
//                   real-time WebSocket event so the content vanishes from
//                   everyone's screen instantly (the "ghost delete")
//   5. Write an audit log row to ModerationLog
//   6. Go back to step 1
//
// WHY AN IN-PROCESS WORKER?
// ─────────────────────────
// We run the worker inside the same Node.js process (not a separate service)
// because it needs access to the Socket.io server instance to emit real-time
// events. This is fine for moderate traffic. If you later need to scale:
//   - Move the worker to a separate process
//   - Use a shared Redis pub/sub channel for Socket.io events
//   - Or use Socket.io's Redis adapter (socket.io-redis)
//
// CONCURRENCY:
// ────────────
// By default we run a single worker loop. You can increase WORKER_CONCURRENCY
// to process multiple jobs in parallel. Each "worker" is just another async
// loop running concurrently via Promise.all.
// =============================================================================

import { Server } from "socket.io";
import { prisma } from "../utils/prisma";
import logger from "../utils/logger";
import { dequeueModerationJob } from "./moderationQueue";
import { moderateContent } from "./moderationService";
import { ModerationJob, ModeratableContentType } from "./moderationTypes";
import { suspendUser } from "../services/userService";

const SUSPENSION_DURATION_MINUTES = 240; // 4 hours per violation

// How many parallel worker loops to run. Start with 1, increase if your
// queue starts backing up (monitor via getQueueLength()).
const WORKER_CONCURRENCY = Number(process.env.MODERATION_WORKERS) || 1;

// Store a reference to the Socket.io server so we can emit events.
// This gets set when startModerationWorker() is called from index.ts.
let io: Server;

/**
 * Start the moderation worker. Call this ONCE from index.ts after creating
 * the Socket.io server.
 *
 * @param socketServer - The Socket.io Server instance from index.ts
 */
export function startModerationWorker(socketServer: Server): void {
  io = socketServer;

  logger.info(
    `[ModerationWorker] Starting ${WORKER_CONCURRENCY} worker(s)...`
  );

  // Spin up N concurrent worker loops
  for (let i = 0; i < WORKER_CONCURRENCY; i++) {
    workerLoop(i);
  }
}

// =============================================================================
// THE MAIN WORKER LOOP
// =============================================================================
// Each iteration: dequeue → moderate → act on result → log → repeat forever.

async function workerLoop(workerId: number): Promise<void> {
  logger.info(`[ModerationWorker #${workerId}] Worker loop started`);

  // This runs forever. If it crashes, we catch the error and keep going.
  while (true) {
    try {
      // ── Step 1: Pop the next job from the Redis queue ──────────────
      // dequeueModerationJob() uses BRPOP which blocks for 5s if empty,
      // so this loop doesn't spin and waste CPU.
      const job = await dequeueModerationJob();

      if (!job) {
        // Queue was empty after 5s timeout — just loop again
        continue;
      }

      logger.info(
        `[ModerationWorker #${workerId}] Processing ${job.contentType} #${job.contentId}`
      );

      // ── Step 2: Call the OpenAI Moderation API ─────────────────────
      const result = await moderateContent(job.text, job.imageUrl);

      // ── Step 3: Act on the result ──────────────────────────────────
      // Use score-based thresholds for hate/harassment/violence so borderline
      // content (arguments, edgy humour, mild language) doesn't trigger a ban.
      // Everything else uses OpenAI's default binary flag.
      const s = result.categoryScores;
      const shouldReject =
        // High-confidence hate speech only (raised from OpenAI default ~0.7)
        (s["hate"] ?? 0) > 0.90 ||
        (s["hate/threatening"] ?? 0) > 0.85 ||
        // Raised harassment threshold — banter/arguments won't trigger
        (s["harassment"] ?? 0) > 0.90 ||
        (s["harassment/threatening"] ?? 0) > 0.85 ||
        // Violence: only flag very graphic content
        (s["violence"] ?? 0) > 0.90 ||
        (s["violence/graphic"] ?? 0) > 0.85 ||
        // Sexual content — keep at OpenAI default sensitivity
        result.categories["sexual"] === true ||
        result.categories["sexual/minors"] === true ||
        // Self-harm — keep at default sensitivity
        result.categories["self-harm"] === true ||
        result.categories["self-harm/intent"] === true ||
        result.categories["self-harm/instructions"] === true;

      if (shouldReject) {
        // TOXIC CONTENT → Ghost Delete
        await handleRejection(job);
        logger.warn(
          `[ModerationWorker #${workerId}] REJECTED ${job.contentType} #${job.contentId} ` +
            `— flagged categories: ${JSON.stringify(result.categories)}`
        );
      } else {
        // SAFE CONTENT → Approve
        await handleApproval(job);
        logger.info(
          `[ModerationWorker #${workerId}] APPROVED ${job.contentType} #${job.contentId}`
        );
      }

      // ── Step 4: Write the audit log ────────────────────────────────
      // This creates a row in ModerationLog so you have a full history
      // of every moderation decision for debugging and compliance.
      await writeModerationLog(job, result.flagged, result.categories, result.categoryScores);
    } catch (error) {
      // If anything goes wrong (DB error, unexpected crash), log it
      // and keep the loop running. One bad job shouldn't kill the worker.
      logger.error(`[ModerationWorker #${workerId}] Error:`, error);

      // Brief pause to avoid hammering if there's a systemic issue
      await sleep(1000);
    }
  }
}

// =============================================================================
// APPROVAL HANDLER
// =============================================================================
// When OpenAI says the content is safe, we just flip the status to APPROVED.
// The content was already visible (optimistic display), so nothing else changes.

async function handleApproval(job: ModerationJob): Promise<void> {
  await updateModerationStatus(job.contentType, job.contentId, "APPROVED");
}

// =============================================================================
// REJECTION HANDLER — The "Ghost Delete"
// =============================================================================
// When OpenAI says the content is toxic:
//   1. Flip deleted=true AND moderationStatus=REJECTED in a single DB write
//   2. Emit a real-time WebSocket event so the content vanishes from all
//      connected clients instantly
//
// After this, any REST endpoint that filters `deleted: false` (which your
// existing code already does) will automatically exclude this content.

async function handleRejection(job: ModerationJob): Promise<void> {
  // ── 1. Update the database (single atomic write) ─────────────────────
  await rejectContent(job.contentType, job.contentId);

  // ── 2. Suspend the user for 4 hours ──────────────────────────────────
  const contentPreview = job.text
    ? job.text.length > 300 ? job.text.slice(0, 300) + "…" : job.text
    : null;

  const suspendedUntil = new Date(Date.now() + SUSPENSION_DURATION_MINUTES * 60 * 1000);
  await suspendUser(job.userId, SUSPENSION_DURATION_MINUTES, contentPreview);

  // ── 3. Notify the user in real-time (if they're connected) ───────────
  if (io) {
    io.to(`user:${job.userId}`).emit("accountSuspended", {
      suspendedUntil: suspendedUntil.toISOString(),
      contentPreview,
    });
    logger.info(`[ModerationWorker] Suspended user #${job.userId} until ${suspendedUntil.toISOString()}`);
  }

  // ── 4. Emit real-time "ghost delete" via WebSocket ───────────────────
  if (job.socketMeta && io) {
    emitGhostDelete(job);
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Atomically set deleted=true AND moderationStatus=REJECTED in one update.
 * Replaces the previous two-step updateModerationStatus + softDeleteContent
 * pattern to prevent a crash leaving content in a half-rejected state.
 */
async function rejectContent(
  contentType: ModeratableContentType,
  contentId: number
): Promise<void> {
  const data = { deleted: true, moderationStatus: "REJECTED" as const };

  switch (contentType) {
    case "POST":
      await prisma.post.update({ where: { id: contentId }, data });
      break;
    case "POST_COMMENT":
      await prisma.postComment.update({ where: { id: contentId }, data });
      break;
    case "CHAT_MESSAGE":
      await prisma.chatRoomMessage.update({ where: { id: contentId }, data });
      break;
    case "PROXIMITY_MESSAGE":
      await prisma.proximityMessage.update({ where: { id: contentId }, data });
      break;
  }
}

/**
 * Update the moderationStatus field on the correct table.
 * Used for approvals only — rejections go through rejectContent() above.
 */
async function updateModerationStatus(
  contentType: ModeratableContentType,
  contentId: number,
  status: "APPROVED" | "REJECTED"
): Promise<void> {
  switch (contentType) {
    case "POST":
      await prisma.post.update({ where: { id: contentId }, data: { moderationStatus: status } });
      break;
    case "POST_COMMENT":
      await prisma.postComment.update({ where: { id: contentId }, data: { moderationStatus: status } });
      break;
    case "CHAT_MESSAGE":
      await prisma.chatRoomMessage.update({ where: { id: contentId }, data: { moderationStatus: status } });
      break;
    case "PROXIMITY_MESSAGE":
      await prisma.proximityMessage.update({ where: { id: contentId }, data: { moderationStatus: status } });
      break;
  }
}

/**
 * Write a row to the ModerationLog table for auditing.
 * This records every moderation decision — whether flagged or not.
 */
async function writeModerationLog(
  job: ModerationJob,
  flagged: boolean,
  categories: Record<string, boolean>,
  scores: Record<string, number>
): Promise<void> {
  try {
    await prisma.moderationLog.create({
      data: {
        contentType: job.contentType,
        contentId: job.contentId,
        userId: job.userId,
        flagged,
        categories: categories as any,  // Prisma Json type accepts plain objects
        scores: scores as any,
      },
    });
  } catch (error) {
    // Don't let a logging failure crash the worker
    logger.error("[ModerationWorker] Failed to write audit log:", error);
  }
}

// =============================================================================
// REAL-TIME "GHOST DELETE" EVENTS
// =============================================================================
// When toxic content is detected, we emit WebSocket events so every connected
// client can remove the content from their screen instantly.
//
// EVENT NAMES (pick these up on your frontend):
//   "messageModerated"          → a chatroom message was removed
//   "proximityMessageModerated" → a proximity message was removed
//   "postModerated"             → a post was removed
//   "commentModerated"          → a post comment was removed
//
// Each event carries the ID of the removed content so the frontend can
// filter it out of its local state.

function emitGhostDelete(job: ModerationJob): void {
  const meta = job.socketMeta;
  if (!meta) return;

  switch (meta.type) {
    case "CHAT_MESSAGE":
      // Emit to everyone in the specific chatroom.
      // The frontend should listen for "messageModerated" and remove
      // the message with the matching messageId from the chat.
      io.to(String(meta.chatRoomId)).emit("messageModerated", {
        messageId: job.contentId,
        reason: "Content removed by automated moderation",
      });
      logger.info(
        `[GhostDelete] Emitted messageModerated for message #${job.contentId} in room ${meta.chatRoomId}`
      );
      break;

    case "PROXIMITY_MESSAGE":
      // For proximity messages, we broadcast to ALL connected sockets.
      // The frontend should check if the messageId matches and remove it.
      // (A more targeted approach would look up nearby users via Redis,
      //  but broadcasting is simpler and proximity messages are ephemeral.)
      io.emit("proximityMessageModerated", {
        messageId: job.contentId,
        reason: "Content removed by automated moderation",
      });
      logger.info(
        `[GhostDelete] Emitted proximityMessageModerated for message #${job.contentId}`
      );
      break;

    case "POST":
      // Broadcast post removal. Frontend feed screens should listen for
      // "postModerated" and remove the post from their local state.
      io.emit("postModerated", {
        postId: job.contentId,
        locationId: meta.locationId,
        reason: "Content removed by automated moderation",
      });
      logger.info(
        `[GhostDelete] Emitted postModerated for post #${job.contentId}`
      );
      break;

    case "POST_COMMENT":
      // Broadcast comment removal. Frontend post detail screens should
      // listen for "commentModerated" and remove the comment.
      io.emit("commentModerated", {
        commentId: job.contentId,
        postId: meta.postId,
        reason: "Content removed by automated moderation",
      });
      logger.info(
        `[GhostDelete] Emitted commentModerated for comment #${job.contentId}`
      );
      break;
  }
}

// =============================================================================
// UTILITY
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}