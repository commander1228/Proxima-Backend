// =============================================================================
// MODERATION ADMIN ROUTES
// =============================================================================
// These routes let admins (you!) monitor and manage the moderation system.
//
// Available endpoints:
//   GET  /api/moderation/health       → Queue length + worker status
//   GET  /api/moderation/logs         → Paginated moderation audit logs
//   GET  /api/moderation/logs/flagged → Only flagged (rejected) content
//   POST /api/moderation/override/:id → Manually approve a false positive
//
// All routes require authentication + admin privileges.
// =============================================================================

import express from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { withAuth } from "../utils/handler";
import { prisma } from "../utils/prisma";
import { getQueueLength } from "../moderation";

const router = express.Router();

// All moderation admin routes require authentication
router.use(authenticateToken);

// =============================================================================
// GET /health — Check the health of the moderation system
// =============================================================================
// Returns the current queue length so you can see if jobs are backing up.
// If queueLength stays high, you might need more workers (MODERATION_WORKERS).

router.get(
  "/health",
  withAuth(async (req, res) => {
    // Only admins can access moderation tools
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const queueLength = await getQueueLength();

    return res.status(200).json({
      status: "ok",
      queueLength,          // How many jobs are waiting to be processed
      workerCount: Number(process.env.MODERATION_WORKERS) || 1,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
    });
  })
);

// =============================================================================
// GET /logs — Paginated moderation audit logs
// =============================================================================
// Query params:
//   ?page=1        (default: 1)
//   ?limit=50      (default: 50, max: 100)
//   ?flagged=true  (optional: filter to only flagged content)
//   ?contentType=POST  (optional: filter by content type)

router.get(
  "/logs",
  withAuth(async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Build dynamic where clause based on query params
    const where: any = {};

    // Filter by flagged status if provided
    if (req.query.flagged === "true") {
      where.flagged = true;
    } else if (req.query.flagged === "false") {
      where.flagged = false;
    }

    // Filter by content type if provided
    if (req.query.contentType) {
      where.contentType = req.query.contentType;
    }

    const [logs, total] = await Promise.all([
      prisma.moderationLog.findMany({
        where,
        orderBy: { processedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.moderationLog.count({ where }),
    ]);

    return res.status(200).json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

// =============================================================================
// GET /logs/flagged — Shortcut to see only flagged content
// =============================================================================
// Same as /logs?flagged=true but more convenient.

router.get(
  "/logs/flagged",
  withAuth(async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.moderationLog.findMany({
        where: { flagged: true },
        orderBy: { processedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.moderationLog.count({ where: { flagged: true } }),
    ]);

    return res.status(200).json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

// =============================================================================
// POST /override/:logId — Manually approve a false positive
// =============================================================================
// If the AI wrongly flagged something, an admin can reverse the decision.
// This un-deletes the content and updates the moderation status to APPROVED.

router.post(
  "/override/:logId",
  withAuth(async (req, res) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const logId = Number(req.params.logId);
    if (!logId || Number.isNaN(logId)) {
      return res.status(400).json({ message: "Invalid log ID" });
    }

    // Find the moderation log entry
    const log = await prisma.moderationLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return res.status(404).json({ message: "Moderation log not found" });
    }

    if (!log.flagged) {
      return res.status(400).json({ message: "This content was not flagged" });
    }

    // Un-delete the content and set status to APPROVED
    switch (log.contentType) {
      case "POST":
        await prisma.post.update({
          where: { id: log.contentId },
          data: { deleted: false, moderationStatus: "APPROVED" },
        });
        break;
      case "POST_COMMENT":
        await prisma.postComment.update({
          where: { id: log.contentId },
          data: { deleted: false, moderationStatus: "APPROVED" },
        });
        break;
      case "CHAT_MESSAGE":
        await prisma.chatRoomMessage.update({
          where: { id: log.contentId },
          data: { deleted: false, moderationStatus: "APPROVED" },
        });
        break;
      case "PROXIMITY_MESSAGE":
        await prisma.proximityMessage.update({
          where: { id: log.contentId },
          data: { deleted: false, moderationStatus: "APPROVED" },
        });
        break;
    }

    return res.status(200).json({
      message: `Content ${log.contentType} #${log.contentId} has been manually approved`,
    });
  })
);

export default router;