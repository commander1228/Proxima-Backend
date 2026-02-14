/*
  Warnings:

  - You are about to drop the column `creatorId` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `ChatRoom` table. All the data in the column will be lost.
  - Added the required column `locationId` to the `ChatRoom` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('NONE', 'CAMPUS', 'CITY', 'PARTY', 'EVENT', 'GLOBAL', 'BUILDING');

-- DropForeignKey
ALTER TABLE "ChatRoom" DROP CONSTRAINT "ChatRoom_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "ChatRoomMessage" DROP CONSTRAINT "ChatRoomMessage_chatRoomId_fkey";

-- DropForeignKey
ALTER TABLE "ChatRoomMessageVote" DROP CONSTRAINT "ChatRoomMessageVote_messageId_fkey";

-- DropForeignKey
ALTER TABLE "ChatRoomMessageVote" DROP CONSTRAINT "ChatRoomMessageVote_userId_fkey";

-- AlterTable
ALTER TABLE "ChatRoom" DROP COLUMN "creatorId",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "size",
DROP COLUMN "type",
ADD COLUMN     "locationId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User_Settings" ALTER COLUMN "proximityRadius" SET DEFAULT 1600;

-- DropEnum
DROP TYPE "ChatRoomType";

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "size" INTEGER NOT NULL DEFAULT 0,
    "type" "LocationType" NOT NULL DEFAULT 'NONE',
    "creatorId" INTEGER,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forum" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "locationId" INTEGER NOT NULL,

    CONSTRAINT "Forum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "posterId" INTEGER NOT NULL,
    "forumId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "commenterId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_latitude_longitude_idx" ON "Location"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Location_type_idx" ON "Location"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Forum_locationId_key" ON "Forum"("locationId");

-- CreateIndex
CREATE INDEX "ChatRoom_locationId_idx" ON "ChatRoom"("locationId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forum" ADD CONSTRAINT "Forum_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_commenterId_fkey" FOREIGN KEY ("commenterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMessage" ADD CONSTRAINT "ChatRoomMessage_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMessageVote" ADD CONSTRAINT "ChatRoomMessageVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMessageVote" ADD CONSTRAINT "ChatRoomMessageVote_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatRoomMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
