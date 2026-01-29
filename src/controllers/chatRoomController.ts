import { Request, Response } from "express";
import {
  createChatRoom,
  listChatRooms,
} from "../services/chatRoomService";

export async function create(req: Request, res: Response){
    try {
        const { name } = req.body;

        if(!name){
            return res.status(400).json({ message: "Chat room name is required" });
        }

        const createdChatRoom = await createChatRoom(name);
        const chatRoomList = await listChatRooms();
        res.status(201).json({
            createdChatRoom,
            chatRoomList,
        });
    } catch (error: any) {
        res.status(400).json({ message: error.message});
    }
}

export async function list(req: Request, res: Response){
    try {
        const chatRoomList = await listChatRooms();
        res.status(200).json(chatRoomList);
    } catch (error: any) {
        res.status(400).json({ message: error.message});
    }
}

