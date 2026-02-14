/*
  Warnings:

  - Added the required column `platform` to the `FeedbackMessage` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID', 'OTHER');

-- AlterTable
ALTER TABLE "FeedbackMessage" ADD COLUMN     "platform" "Platform" NOT NULL;
