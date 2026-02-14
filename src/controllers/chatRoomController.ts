import { Request, Response } from "express";
import { createRoom, listChatRooms, deleteRoom, getChatRoomById } from "../services/chatRoomService";

export async function createChatRoom(req: Request, res: Response) {
  try {
    const { name, locationId} = req.body;
    const user = req.user;

    if (!name) {
      return res.status(400).json({ message: "Chat room name is required" });
    }

    if(!user){
      throw new Error("invalid user");
    }
    if(!locationId)
    {
      return res.status(400).json({ message: "A location Id Is required" });
    }
    const chatRoomsInLocationList = await listChatRooms(locationId);
    return res.status(201).json({
      message: `chatroom: ${name} has been created`, 
      chatRoomsInLocationList,
    });
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


    const results = await deleteRoom(id);

    return res.status(201).json({
      message: `chatRoom: ${results.chatRoomName} has been deleted along with ${results.deletedCount} containted messages`,
    })
  } catch (error: any){
    return res.status(400).json({ message: error.message });
  }
}
