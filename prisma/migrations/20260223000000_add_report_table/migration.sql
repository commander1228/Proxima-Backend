-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('POST', 'POST_COMMENT', 'CHAT_MESSAGE', 'PROXIMITY_MESSAGE');

-- CreateTable
CREATE TABLE "Report" (
    "id"                     SERIAL NOT NULL,
    "reporterId"             INTEGER NOT NULL,
    "reportedUserId"         INTEGER NOT NULL,
    "reportedUserDisplayId"  TEXT NOT NULL,
    "contentType"            "ContentType" NOT NULL,
    "contentId"              INTEGER NOT NULL,
    "content"                TEXT,
    "imageUrl"               TEXT,
    "resolved"               BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one report per reporter per piece of content
CREATE UNIQUE INDEX "Report_reporterId_contentType_contentId_key"
    ON "Report"("reporterId", "contentType", "contentId");

-- CreateIndex: look up all reports on a specific piece of content
CREATE INDEX "Report_contentType_contentId_idx"
    ON "Report"("contentType", "contentId");

-- CreateIndex: look up all reports against a specific user
CREATE INDEX "Report_reportedUserId_idx"
    ON "Report"("reportedUserId");

-- CreateIndex: filter unresolved reports for admin triage
CREATE INDEX "Report_resolved_idx"
    ON "Report"("resolved");