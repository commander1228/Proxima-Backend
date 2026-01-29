/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `ChatRoom` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_name_key" ON "ChatRoom"("name");
