/*
  Warnings:

  - You are about to drop the `Forum` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ForumPost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Forum" DROP CONSTRAINT "Forum_locationId_fkey";

-- DropForeignKey
ALTER TABLE "ForumPost" DROP CONSTRAINT "ForumPost_forumId_fkey";

-- DropForeignKey
ALTER TABLE "ForumPost" DROP CONSTRAINT "ForumPost_posterId_fkey";

-- DropForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT "PostComment_postId_fkey";

-- DropTable
DROP TABLE "Forum";

-- DropTable
DROP TABLE "ForumPost";

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "posterId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
