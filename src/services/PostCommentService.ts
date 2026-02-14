import { PostCommentDao } from "../dao/PostCommentDao";
import { PostDao } from "../dao/PostDao";
import { createPostCommentInput } from "../models/postTypes";
import { validatePost } from "../utils/postValidator";


const postCommentDao = new PostCommentDao();
const postDao = new PostDao();

export class PostCommentService {
    async createPostComment(data: createPostCommentInput){
    const { content } = validatePost(data.content);
    const post = await postDao.getPostById(data.postId);
    if(!post || post.deleted) throw new Error("Post Not Found");
    return await postCommentDao.createPostComment({
        commenterId: data.commenterId,
        postId: data.postId,
        content,
    });
    }

    async deletePostComment(id: number){
        return await postCommentDao.deletePostComment(id);
    }

    async getPostCommentById(id:number){
        return await postCommentDao.getPostCommentById(id);
    }

    async getPostCommentsByPost(postId:number){
        return await postCommentDao.getPostCommentsByPost(postId);
    }

    async getPostCommentsByUser(userId:number){
        return await postCommentDao.getPostCommentsByUser(userId);
    }
}