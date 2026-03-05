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
            where: {
                postId,
                deleted: false,
                commenter: { deleted: false },
            },
            orderBy:{createdAt: "desc"},
            select: {
                id: true,
                content: true,
                imageUrl: true,
                postId: true,
                commenterId: true,
                createdAt: true,
                wasAnonymous: true,
                commenter: { select: { displayId: true, id: true } },
            },
        });
    }

    async getCommentCountsBatch(postIds: number[]): Promise<Record<number, number>> {
        if (postIds.length === 0) return {};
        const results = await prisma.postComment.groupBy({
            by: ["postId"],
            where: { postId: { in: postIds }, deleted: false },
            _count: { id: true },
        });
        const map: Record<number, number> = {};
        for (const r of results) {
            map[r.postId] = r._count.id;
        }
        return map;
    }

    async getPostCommentsByUser(userId: number) {
        return prisma.postComment.findMany({
            where: {
                commenterId: userId,
                deleted:     false,
                post:        { deleted: false },
            },
            select: {
                id:        true,
                content:   true,
                imageUrl:  true,
                createdAt: true,
                post: {
                    select: { id: true, title: true, locationId: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
}