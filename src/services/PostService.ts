import { Post } from "@prisma/client";
import { PostDao } from "../dao/PostDao";
import { CreatePostInput } from "../models/postTypes";
import { validatePost } from "../utils/postValidator";
import { PostCommentService } from "./PostCommentService";

const postDao = new PostDao();
const postCommentService = new PostCommentService();

export class PostService {
  async createPost(data: CreatePostInput) {
    const { content, title } = validatePost(data.content, data.title);
    if (!title) {
      throw new Error("A title is required");
    }
    return await postDao.createPost({
      posterId: data.posterId,
      locationId: data.locationId,
      content,
      title,
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

  async getPostWithLocation(id:number) {
    if (!id || Number.isNaN(id)) {
      throw new Error("invalid post id");
    }
    return await postDao.getPostByIdWithLocation(id);
  }

  async getPostListByLocation(id:number){
    return await postDao.getPostsByLocation(id);
  }

  async getPostandPostCommentsById(id:number){
    const post = await postDao.getPostById(id);
    if(!post){
      throw new Error("Cannot Find Post");
    }

    const comments = await postCommentService.getPostCommentsByPost(post.id);

    return {
      id:post.id,
      title:post.title,
      posterId: post.posterId,
      posterDisplayId: post.poster.displayId,
      createdAt: post.createdAt,
      commentCount: comments.length,
      comments,
    };
  }

  async getPostAndPostCommentsByLocation(id: number) {
    const posts = await postDao.getPostsByLocation(id);

    const postComments = await Promise.all(
      posts.map((post) => postCommentService.getPostCommentsByPost(post.id)),
    );

    return posts.map((post: Post, idx) => ({
      ...post,
      comments: postComments[idx],
    }));
  }
}
