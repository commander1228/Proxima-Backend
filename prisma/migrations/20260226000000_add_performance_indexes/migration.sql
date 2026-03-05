-- Performance indexes migration
-- Fixes full table scans that slow down as data grows

-- ChatRoomMessage: the most critical fix.
-- getLatestChatRoomMessagesByChatRoom filters by chatRoomId and orders by
-- createdAt DESC. Without this index, every chatroom load is a full table scan.
CREATE INDEX IF NOT EXISTS "ChatRoomMessage_chatRoomId_createdAt_idx"
  ON "ChatRoomMessage"("chatRoomId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ChatRoomMessage_senderId_idx"
  ON "ChatRoomMessage"("senderId");

-- ChatRoomMessageVote: getVoteCountsBatch groups by targetId.
-- The existing @@unique([userId, targetId]) index has userId as the leading
-- column so it can't efficiently satisfy WHERE targetId IN (...).
CREATE INDEX IF NOT EXISTS "ChatRoomMessageVote_targetId_idx"
  ON "ChatRoomMessageVote"("targetId");

-- UserBlock: getBlockerUserIdsDao queries WHERE blockedId = ?.
-- The existing @@unique([blockerId, blockedId]) can't serve this lookup
-- efficiently because blockerId is the leading column.
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx"
  ON "UserBlock"("blockedId");

-- Location: getAllLocations does WHERE deleted = false — full scan without this.
CREATE INDEX IF NOT EXISTS "Location_deleted_idx"
  ON "Location"("deleted");

-- Location: getLocationByName does WHERE name = ? AND deleted = false.
CREATE INDEX IF NOT EXISTS "Location_name_deleted_idx"
  ON "Location"("name", "deleted");
