import { Request, Response } from "express";
import { createRoom, listChatRooms, deleteRoom, getChatRoomById } from "../services/chatRoomService";
import { ChatRoomType } from "@prisma/client";

export async function createChatRoom(req: Request, res: Response) {
  try {
    const { name, latitude, longitude, size, type} = req.body;
    const user = req.user;

    if (!name) {
      return res.status(400).json({ message: "Chat room name is required" });
    }

    if(!user){
      throw new Error("invalid user");
    }
    if(!type)
    {
      const createdChatRoom = await createRoom(name, user, latitude, longitude, size, ChatRoomType.NONE);
    }else{
       const createdChatRoom = await createRoom(name, user, latitude, longitude, size, type);
    }
    const chatRoomList = await listChatRooms();
    return res.status(201).json({
      message: `chatroom: ${name} has been created`, 
      chatRoomList,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const chatRoomList = await listChatRooms();
   return res.status(200).json(chatRoomList);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteChatRoom(req: Request, res: Response){
  try{
    const { id } = req.body;

    if(!getChatRoomById(id)){
      return res.status(400).json({ message: "Chat room does not exist" });
    }


    const results = await deleteRoom(id)
    const chatRoomList = await listChatRooms();

    return res.status(201).json({
      message: `chatRoom: ${results.chatRoomName} has been deleted along with ${results.deletedCount} containted messages`,
      chatRoomList,
    })
  } catch (error: any){
    return res.status(400).json({ message: error.message });
  }
}

export async function getChatRoomTypes(req: Request, res: Response) {
  return res.status(200).json({ types: Object.values(ChatRoomType) });
}
