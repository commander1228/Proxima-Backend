import { Post } from "@prisma/client";
import { PostDao } from "../dao/PostDao";
import { CreatePostInput } from "../models/postTypes";
import { validatePost } from "../utils/postValidator";
import { PostCommentService } from "./PostCommentService";
import { VoteService } from "./VoteService";
import { VoteModel } from "../models/voteTypes";
import { getCachedBlockRelatedUserIds } from "../dao/BlockDao";

const postDao = new PostDao();
const postCommentService = new PostCommentService();
const postVoteService = new VoteService(VoteModel.PostVote);
const postCommentVoteService = new VoteService(VoteModel.PostCommentVote);

export class PostService {
  async createPost(data: CreatePostInput) {
    const { content, title } = validatePost(data.content, data.title, data.imageUrl);

    if (!title) {
      throw new Error("A title is required");
    }
    return await postDao.createPost({
      posterId: data.posterId,
      locationId: data.locationId,
      content: content ?? "",
      imageUrl: data.imageUrl,
      title,
      wasAnonymous: data.wasAnonymous ?? false,
    });
  }

  async deletePost(id: number) {
    return await postDao.deletePost(id);
  }

  async getPostById(id: number) {
    if (!id || Number.isNaN(id)) {
      throw new Error("invalid post id");
    }
    return await postDao.getPostById(id);
  }

  async getPostWithLocation(id: number) {
    if (!id || Number.isNaN(id)) {
      throw new Error("invalid post id");
    }
    return await postDao.getPostByIdWithLocation(id);
  }

  /** Returns posts for a location, filtered to hide posts from blocked users */
  async getPostListByLocation(locationId: number, viewerUserId?: number) {
    const posts = await postDao.getPostsByLocation(locationId);

    // If we have a viewer, filter out posts from users they've blocked (or who blocked them)
    const blockedUserIds = viewerUserId
      ? new Set(await getCachedBlockRelatedUserIds(viewerUserId))
      : new Set<number>();

    const visiblePosts = posts.filter((post) => !blockedUserIds.has(post.posterId));

    const postsWithVotes = await Promise.all(
      visiblePosts.map(async (post) => {
        const voteCount = await postVoteService.getVoteCount(post.id);
        return { ...post, voteCount };
      })
    );

    return postsWithVotes;
  }

  /**
   * Batched version of getPostListByLocation — fetches ALL vote counts in a
   * single groupBy query instead of N individual aggregate queries.
   *
   * Why this matters: the original method runs `getVoteCount(post.id)` inside
   * a `Promise.all(map(...))`, which fires one SQL aggregate per post (N+1
   * pattern). For 20 posts that's 20 round-trips. This version uses
   * `getVoteCountsBatch()` to do it in one query. The difference scales
   * linearly with the number of posts — 100 posts = 100× slower vs 1 query.
   */
  async getPostListByLocationBatched(locationId: number, viewerUserId?: number) {
    const posts = await postDao.getPostsByLocation(locationId);

    const blockedUserIds = viewerUserId
      ? new Set(await getCachedBlockRelatedUserIds(viewerUserId))
      : new Set<number>();

    const visiblePosts = posts.filter((post) => !blockedUserIds.has(post.posterId));

    if (visiblePosts.length === 0) return [];

    // ONE query for ALL vote counts instead of N individual queries
    const postIds = visiblePosts.map((p) => p.id);
    const voteCountMap = await postVoteService.getVoteCountsBatch(postIds);

    return visiblePosts.map((post) => ({
      id: post.id,
      posterId: post.posterId,
      title: post.title,
      content: post.content,
      createdAt: post.createdAt,
      imageUrl: post.imageUrl ?? null,
      voteCount: voteCountMap[post.id] ?? 0,
    }));
  }

  async getFeedPosts(locationIds: number[], viewerUserId: number, before?: Date) {
    const { posts: rawPosts, hasMore } = await postDao.getPostsByLocationIds(locationIds, before);

    // Filter blocked users and soft-deleted posters in JS — avoids a filtering JOIN in SQL
    const blockedIds = new Set(await getCachedBlockRelatedUserIds(viewerUserId));
    const visible = rawPosts.filter(
      (p) => !blockedIds.has(p.posterId) && !p.poster.deleted,
    );

    if (visible.length === 0) return { posts: [], hasMore };

    const postIds = visible.map((p) => p.id);

    // 3 queries in parallel: comment counts + vote sums + user's own votes
    const [commentCountMap, voteCountMap, userVoteMap] = await Promise.all([
      postCommentService.getCommentCountsBatch(postIds),
      postVoteService.getVoteCountsBatch(postIds),
      postVoteService.getUserVotesForTargets(viewerUserId, postIds),
    ]);

    const posts = visible.map((p) => ({
      id:              p.id,
      title:           p.title,
      content:         p.content ?? "",
      imageUrl:        p.imageUrl ?? null,
      posterId:        p.posterId,
      posterDisplayId: p.wasAnonymous ? "Anonymous" : p.poster.displayId,
      locationId:      p.locationId,
      locationName:    p.location.name,
      createdAt:       p.createdAt,
      voteCount:       voteCountMap[p.id] ?? 0,
      userVote:        userVoteMap[p.id] ?? null,
      commentCount:    commentCountMap[p.id] ?? 0,
    }));

    return { posts, hasMore };
  }

  /** Returns a post and its comments, with blocked users' comments filtered out */
  async getPostandPostCommentsById(id: number, userId?: number) {
    const post = await postDao.getPostById(id);
    if (!post) {
      throw new Error("Cannot Find Post");
    }

    const postVotes = await postVoteService.getVoteCount(post.id);

    let userPostVote: number | null = null;
    if (userId) {
      userPostVote = await postVoteService.getUserVoteValue(userId, post.id);
    }

    const allComments = await postCommentService.getPostCommentsByPost(post.id);

    // Filter out comments from blocked users
    const blockedUserIds = userId
      ? new Set(await getCachedBlockRelatedUserIds(userId))
      : new Set<number>();

    const comments = allComments.filter(
      (comment) => !blockedUserIds.has(comment.commenterId)
    );

    const commentVotes = comments.length > 0
      ? await postCommentVoteService.getVoteCountsBatch(comments.map((c) => c.id))
      : {} as Record<number, number>;

    let userCommentVotes: Record<number, number> = {};
    if (userId && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      userCommentVotes = await postCommentVoteService.getUserVotesForTargets(userId, commentIds);
    }

    const commentsWithVotes = comments.map((comment) => ({
      ...comment,
      voteCount: commentVotes[comment.id] ?? 0,
      userVote: userCommentVotes[comment.id] ?? null,
    }));

    const commentsWithAnonymousMasking = commentsWithVotes.map((c) => ({
      ...c,
      commenter: {
        ...c.commenter,
        displayId: (c as any).wasAnonymous ? "Anonymous" : c.commenter.displayId,
      },
    }));

    return {
      id: post.id,
      title: post.title,
      content: post.content ?? "",
      imageUrl: post.imageUrl,
      posterId: post.posterId,
      posterDisplayId: (post as any).wasAnonymous ? "Anonymous" : post.poster.displayId,
      postVotes: postVotes,
      userPostVote: userPostVote,
      createdAt: post.createdAt,
      commentCount: comments.length,
      comments: commentsWithAnonymousMasking,
    };
  }
}