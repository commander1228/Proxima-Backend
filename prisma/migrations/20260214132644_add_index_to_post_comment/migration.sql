-- CreateIndex
CREATE INDEX "Post_locationId_idx" ON "Post"("locationId");

-- CreateIndex
CREATE INDEX "PostComment_postId_idx" ON "PostComment"("postId");
