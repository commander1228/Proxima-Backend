/**
 * ReportService.ts
 * ================
 * Business logic for the reporting system.
 *
 * The reporter only sends { contentType, contentId }.
 * The service fetches the real content from the database to snapshot:
 *   - who authored it (reportedUserId + reportedUserDisplayId)
 *   - the text content
 *   - any attached imageUrl
 *
 * This means the client cannot spoof who is being reported or what they said.
 */

import { ContentType } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { ReportDao } from "../dao/ReportDao";

const reportDao = new ReportDao();

// ─── Content resolution ───────────────────────────────────────────────────────
// Each helper looks up the piece of content and returns a normalised object
// containing the fields we need to snapshot.  Returns null if not found.

type ContentSnapshot = {
  authorId:        number;
  authorDisplayId: string;
  content:         string | null;
  imageUrl:        string | null;
};

async function resolvePost(id: number): Promise<ContentSnapshot | null> {
  const post = await prisma.post.findUnique({
    where:   { id, deleted: false },
    include: { poster: { select: { id: true, displayId: true } } },
  });
  if (!post) return null;
  return {
    authorId:        post.poster.id,
    authorDisplayId: post.poster.displayId,
    content:         post.content ?? null,
    imageUrl:        post.imageUrl ?? null,
  };
}

async function resolvePostComment(id: number): Promise<ContentSnapshot | null> {
  const comment = await prisma.postComment.findUnique({
    where:   { id, deleted: false },
    include: { commenter: { select: { id: true, displayId: true } } },
  });
  if (!comment) return null;
  return {
    authorId:        comment.commenter.id,
    authorDisplayId: comment.commenter.displayId,
    content:         comment.content ?? null,
    imageUrl:        comment.imageUrl ?? null,
  };
}

async function resolveChatMessage(id: number): Promise<ContentSnapshot | null> {
  const msg = await prisma.chatRoomMessage.findUnique({
    where:   { id, deleted: false },
    include: { sender: { select: { id: true, displayId: true } } },
  });
  if (!msg) return null;
  return {
    authorId:        msg.sender.id,
    authorDisplayId: msg.sender.displayId,
    content:         msg.content ?? null,
    imageUrl:        msg.imageUrl ?? null,
  };
}

async function resolveProximityMessage(id: number): Promise<ContentSnapshot | null> {
  const msg = await prisma.proximityMessage.findUnique({
    where:   { id, deleted: false },
    include: { sender: { select: { id: true, displayId: true } } },
  });
  if (!msg) return null;
  return {
    authorId:        msg.sender.id,
    authorDisplayId: msg.sender.displayId,
    content:         msg.content ?? null,
    imageUrl:        msg.imageUrl ?? null,
  };
}

async function resolveContent(
  contentType: ContentType,
  contentId:   number,
): Promise<ContentSnapshot | null> {
  switch (contentType) {
    case ContentType.POST:
              return resolvePost(contentId);
    case ContentType.POST_COMMENT:
              return resolvePostComment(contentId);
    case ContentType.CHAT_MESSAGE:
              return resolveChatMessage(contentId);
    case ContentType.PROXIMITY_MESSAGE:
              return resolveProximityMessage(contentId);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ReportService {
  /**
   * Creates a report.
   *
   * Throws if:
   *   - The reporter tries to report their own content
   *   - The content doesn't exist (or is deleted)
   *   - The reporter has already reported this content
   */
  async createReport(
    reporterId:  number,
    contentType: ContentType,
    contentId:   number,
  ) {
    // ── 1. Resolve the content being reported ─────────────────────────
    const snapshot = await resolveContent(contentType, contentId);
    if (!snapshot) {
      throw new Error("Content not found");
    }

    // ── 2. Prevent self-reports ───────────────────────────────────────
    if (snapshot.authorId === reporterId) {
      throw new Error("You cannot report your own content");
    }

    // ── 3. Enforce one-report-per-content-per-user ────────────────────
    const already = await reportDao.hasReported(reporterId, contentType, contentId);
    if (already) {
      throw new Error("You have already reported this content");
    }

    // ── 4. Persist the snapshot ───────────────────────────────────────
    return reportDao.createReport({
      reporterId,
      reportedUserId:        snapshot.authorId,
      reportedUserDisplayId: snapshot.authorDisplayId,
      contentType,
      contentId,
      content:  snapshot.content,
      imageUrl: snapshot.imageUrl,
    });
  }
}