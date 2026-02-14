-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('OVERALL', 'CHAT', 'CHATROOM', 'UI', 'PERFORMANCE', 'BUG');

-- CreateTable
CREATE TABLE "FeedbackMessage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'OVERALL',
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackMessage_category_idx" ON "FeedbackMessage"("category");

-- CreateIndex
CREATE INDEX "FeedbackMessage_userId_idx" ON "FeedbackMessage"("userId");

-- AddForeignKey
ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
