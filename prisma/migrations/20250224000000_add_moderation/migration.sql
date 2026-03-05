-- =============================================================================
-- MIGRATION: Add AI Moderation Support
-- =============================================================================
-- This migration does three things:
--   1. Creates the ModerationStatus enum (PENDING, APPROVED, REJECTED)
--   2. Adds a moderationStatus column to every content table
--   3. Creates the ModerationLog table for audit trail
--
-- IMPORTANT: The default is PENDING, so all EXISTING rows will be marked as
-- PENDING. If you want to retroactively approve them, run:
--   UPDATE "Post" SET "moderationStatus" = 'APPROVED';
--   UPDATE "PostComment" SET "moderationStatus" = 'APPROVED';
--   UPDATE "ChatRoomMessage" SET "moderationStatus" = 'APPROVED';
--   UPDATE "ProximityMessage" SET "moderationStatus" = 'APPROVED';
-- =============================================================================

-- Step 1: Create the enum type
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Step 2: Add moderationStatus to all content tables with a default of PENDING
ALTER TABLE "Post"
  ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "PostComment"
  ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "ChatRoomMessage"
  ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "ProximityMessage"
  ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

-- Step 3: Create the ModerationLog audit table
CREATE TABLE "ModerationLog" (
    "id"          SERIAL       NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId"   INTEGER      NOT NULL,
    "userId"      INTEGER      NOT NULL,
    "flagged"     BOOLEAN      NOT NULL,
    "categories"  JSONB,
    "scores"      JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- Step 4: Add indexes for efficient querying
CREATE INDEX "ModerationLog_contentType_contentId_idx"
  ON "ModerationLog"("contentType", "contentId");

CREATE INDEX "ModerationLog_userId_idx"
  ON "ModerationLog"("userId");

CREATE INDEX "ModerationLog_flagged_idx"
  ON "ModerationLog"("flagged");

-- Step 5 (Optional): Approve all existing content so it doesn't show as PENDING
-- Uncomment these lines if you want existing content to be marked APPROVED:
-- UPDATE "Post" SET "moderationStatus" = 'APPROVED';
-- UPDATE "PostComment" SET "moderationStatus" = 'APPROVED';
-- UPDATE "ChatRoomMessage" SET "moderationStatus" = 'APPROVED';
-- UPDATE "ProximityMessage" SET "moderationStatus" = 'APPROVED';