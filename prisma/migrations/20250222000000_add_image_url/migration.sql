-- AlterTable: add imageUrl to ChatRoomMessage
ALTER TABLE "ChatRoomMessage" ADD COLUMN "imageUrl" TEXT;

-- AlterTable: add imageUrl to ProximityMessage
ALTER TABLE "ProximityMessage" ADD COLUMN "imageUrl" TEXT;

-- AlterTable: add imageUrl to Post
ALTER TABLE "Post" ADD COLUMN "imageUrl" TEXT;