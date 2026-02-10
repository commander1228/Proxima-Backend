-- AlterTable
ALTER TABLE "ChatRoomMessage" ADD COLUMN     "karma" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;
