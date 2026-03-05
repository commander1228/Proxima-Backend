-- AddForeignKey
ALTER TABLE "ChatRoomMessage" ADD CONSTRAINT "ChatRoomMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatRoomMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
