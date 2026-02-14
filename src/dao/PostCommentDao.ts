import {prisma} from "../utils/prisma";
import { createPostCommentInput } from "../models/postTypes";

export class PostCommentDao{
    async createPostComment(
        data: createPostCommentInput
    ){
        return prisma.postComment.create({data});
    }

    async deletePostComment(id: number){
        return prisma.postComment.update({
            where: {id},
            data: {deleted:true}
        });
    }

    async getPostCommentById(id: number){
        return prisma.postComment.findUnique({
            where: {id}
        });
    }

    async getPostCommentsByPost(postId: number){
        return prisma.postComment.findMany({
            where: {postId,deleted: false},
            orderBy:{createdAt: "desc"},
            include: {commenter: {select: {displayId: true,id : true}}}
        });
    }

    async getPostCommentsByUser(userId:number){
        return prisma.postComment.findMany({
            where: {commenterId : userId, deleted:false},
            orderBy:{createdAt: "desc"}
        });
    }
}