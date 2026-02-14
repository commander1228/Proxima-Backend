import {prisma} from "../utils/prisma";
import { CreatePostInput } from "../models/postTypes";

export class PostDao{
    async createPost(
        data: CreatePostInput
    ){
        return prisma.post.create({data});
    }

    async deletePost(id:number){
        return prisma.post.update({
            where: {id},
            data: {deleted : true}
        })
    }

    async getPostById(id:number){
        return prisma.post.findUnique({
            where: {id},
            include: {poster: {select: {displayId: true , id: true}}}
        });
    }

    async getPostsByLocation(locationId:number){
        return prisma.post.findMany({where: {locationId}});
    }

    async getPostsByUser(userId:number){
        return prisma.post.findMany({where : {posterId: userId}});
    }
}

