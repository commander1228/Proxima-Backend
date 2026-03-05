import { PostService } from "../services/PostService";
import { LocationService } from "../services/LocationService";
import { verifyLocationAndUserInRange } from "../utils/locationUtils";
import { withAuth } from "../utils/handler";
import { PostCommentService } from "../services/PostCommentService";
import { VoteModel } from "../models/voteTypes";
import { VoteService } from "../services/VoteService";
import { validateNotOwnPost, constructVote } from "../utils/voteUtils";
import { updateUserKarma } from "../services/userService";
import { validateImageUrl } from "../utils/validateImageUrl";
import { enqueueModerationJob } from "../moderation";
import { emitNotificationAsync, NotificationEvent } from "../notifications";


const postService = new PostService();
const locationService = new LocationService();
const postCommentService = new PostCommentService();
const postVoteService = new VoteService(VoteModel.PostVote);
const postCommentVoteService = new VoteService(VoteModel.PostCommentVote);

export const createPost = withAuth(async (req, res) => {
  try {
    const { locationId, title, content, imageUrl: rawImageUrl } = req.body;
    const user = req.user;
    const imageUrl = validateImageUrl(rawImageUrl) ?? undefined;

    const location = await locationService.getLocationById(locationId);
    if (!location) {
      return res.status(400).json({ message: "invalid locationId" });
    }

    if (
      location.latitude != null &&
      location.longitude != null &&
      location.size != null
    ) {
      if (
        !(await verifyLocationAndUserInRange(location, user.id)) &&
        !user.isAdmin
      ) {
        return res
          .status(403)
          .json({ message: "user out of range to post in this chatroom" });
      }
    } else {
      if (!user.isAdmin) {
        return res
          .status(400)
          .json({ message: "the specified location does not support user location" });
      }
    }

    const createdPost = await postService.createPost({
      posterId: user.id,
      locationId,
      title,
      content,
      imageUrl,
      wasAnonymous: user.preferences?.anonymousMode ?? true,
    });

    // ── Enqueue for AI moderation (runs in background) ────────────────
    // The post is already saved and will be returned below (optimistic).
    // We combine title + content for moderation since both are user input.
    enqueueModerationJob({
      contentType: "POST",
      contentId: createdPost.id,
      userId: user.id,
      text: [title, content].filter(Boolean).join("\n"),
      imageUrl: createdPost.imageUrl ?? undefined,
      socketMeta: {
        type: "POST",
        locationId,
      },
    });

    const postList = await postService.getPostListByLocationBatched(locationId, user.id);

    return res.status(201).json({
      message: `successfully posted`,
      createdPost,
      postList,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
});

export const postDetails = withAuth(async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const user = req.user;

    if (!postId || Number.isNaN(postId)) {
      return res.status(400).json({ message: "invalid post Id" });
    }

    const payload = await postService.getPostandPostCommentsById(postId, user.id);

    if (!payload) {
      return res.status(404).json({ message: "post not found" });
    }

    return res.status(200).json({ payload });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

export const commentOnPost = withAuth(async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const { content, imageUrl: rawImageUrl } = req.body;
    const user = req.user;
    const imageUrl = validateImageUrl(rawImageUrl) ?? undefined;

    if (!postId || Number.isNaN(postId)) {
      return res.status(400).json({ message: "invalid post Id" });
    }

    const post = await postService.getPostWithLocation(postId);

    if (!post?.location) {
      return res.status(400).json({ message: "invalid post location" });
    }

    if (
      post?.location?.latitude != null &&
      post?.location?.longitude != null &&
      post?.location?.size != null
    ) {
      if (
        !(await verifyLocationAndUserInRange(post?.location, user.id)) &&
        !user.isAdmin
      ) {
        return res
          .status(403)
          .json({ message: "user out of range to post in this chatroom" });
      }
    } else {
      if (!user.isAdmin) {
        return res
          .status(400)
          .json({ message: "the specified location does not support user location" });
      }
    }

    const createdComment = await postCommentService.createPostComment({
      commenterId: user.id,
      postId: post.id,
      content,
      imageUrl,
      wasAnonymous: user.preferences?.anonymousMode ?? true,
    });

    // ── Enqueue for AI moderation (runs in background) ────────────────
    // The comment is already saved and will be returned below (optimistic).
    enqueueModerationJob({
      contentType: "POST_COMMENT",
      contentId: createdComment.id,
      userId: user.id,
      text: content,
      imageUrl: createdComment.imageUrl ?? undefined,
      socketMeta: {
        type: "POST_COMMENT",
        postId: post.id,
      },
    });

    const updatedPost = await postService.getPostandPostCommentsById(post.id, user.id);

    // ── Notify post owner about the new comment ──────────────────────
    emitNotificationAsync({
      event: NotificationEvent.COMMENT_CREATED,
      actorId: user.id,
      postId: post.id,
      postTitle: post.title,
      postOwnerId: post.posterId,
      commentId: createdComment.id,
    });

    return res.status(201).json({
      message: "Post comment added",
      createdComment,
      updatedPost,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

export const voteOnPost = withAuth(async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const { vote } = req.body;
    const user = req.user;

    if (!postId || Number.isNaN(postId)) {
      return res.status(400).json({ message: "invalid post Id" });
    }

    const post = await postService.getPostWithLocation(postId);
    if (!post) {
      return res.status(404).json({ message: "post not found" });
    }

    try {
      validateNotOwnPost(user.id, post.posterId);
    } catch {
      return res.status(403).json({ message: "cannot vote on your own post" });
    }

    // Fetch existing vote first so we can compute the karma delta
    const existingVote = await postVoteService.getVote(
      constructVote(0, user.id, postId)
    );
    const oldValue = existingVote?.value ?? 0;

    const constructedVote = constructVote(vote.value, user.id, postId);
    await postVoteService.voteOnMessage(constructedVote);

    // Apply karma delta to the post author (handles first vote, switching, and no-ops)
    const karmaDelta = vote.value - oldValue;
    if (karmaDelta !== 0) {
      await updateUserKarma(post.posterId, karmaDelta);
    }

    // ── Check for karma milestone notification ───────────────────────
    // We need the current vote count to see if we crossed a threshold.
    const currentVoteCount = await postVoteService.getVoteCount(postId);
    emitNotificationAsync({
      event: NotificationEvent.POST_VOTED,
      actorId: user.id,
      postId: postId,
      postTitle: post.title,
      postOwnerId: post.posterId,
      voteCount: currentVoteCount,
    });

    return res.status(201).json({ message: "voted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

export const voteOnComment = withAuth(async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const { vote } = req.body;
    const user = req.user;

    if (!commentId || Number.isNaN(commentId)) {
      return res.status(400).json({ message: "invalid comment Id" });
    }

    const comment = await postCommentService.getPostCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "comment not found" });
    }

    try {
      validateNotOwnPost(user.id, comment.commenterId);
    } catch {
      return res.status(403).json({ message: "cannot vote on your own comment" });
    }

    // Fetch existing vote first so we can compute the karma delta
    const existingVote = await postCommentVoteService.getVote(
      constructVote(0, user.id, commentId)
    );
    const oldValue = existingVote?.value ?? 0;

    const constructedVote = constructVote(vote.value, user.id, commentId);
    await postCommentVoteService.voteOnMessage(constructedVote);

    // Apply karma delta to the comment author
    const karmaDelta = vote.value - oldValue;
    if (karmaDelta !== 0) {
      await updateUserKarma(comment.commenterId, karmaDelta);
    }

    return res.status(201).json({ message: "voted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

export const deletePostVote = withAuth(async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const user = req.user;

    if (!postId || Number.isNaN(postId)) {
      return res.status(400).json({ message: "invalid post Id" });
    }

    const post = await postService.getPostWithLocation(postId);
    if (!post) {
      return res.status(404).json({ message: "post not found" });
    }

    const existingVote = await postVoteService.getVote(
      constructVote(0, user.id, postId)
    );

    if (!existingVote) {
      return res.status(200).json({ message: "no vote to remove" });
    }

    await postVoteService.removeVote(constructVote(0, user.id, postId));

    // Reverse exactly the karma that was applied when the vote was cast
    await updateUserKarma(post.posterId, -existingVote.value);

    return res.status(200).json({ message: "vote removed successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

export const deleteCommentVote = withAuth(async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const user = req.user;

    if (!commentId || Number.isNaN(commentId)) {
      return res.status(400).json({ message: "invalid comment Id" });
    }

    const comment = await postCommentService.getPostCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "comment not found" });
    }

    const existingVote = await postCommentVoteService.getVote(
      constructVote(0, user.id, commentId)
    );

    if (!existingVote) {
      return res.status(200).json({ message: "no vote to remove" });
    }

    await postCommentVoteService.removeVote(constructVote(0, user.id, commentId));

    // Reverse exactly the karma that was applied when the vote was cast
    await updateUserKarma(comment.commenterId, -existingVote.value);

    return res.status(200).json({ message: "vote removed successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// =============================================================================
// DELETE POST
// =============================================================================

export const deletePost = withAuth(async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const user = req.user;

    const post = await postService.getPostById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.posterId !== user.id && !user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    await postService.deletePost(postId);
    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// =============================================================================
// DELETE OWN COMMENT
// =============================================================================

export const deleteComment = withAuth(async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const user = req.user;

    if (!commentId || Number.isNaN(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await postCommentService.getPostCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.commenterId !== user.id && !user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    await postCommentService.deletePostComment(commentId);
    return res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});