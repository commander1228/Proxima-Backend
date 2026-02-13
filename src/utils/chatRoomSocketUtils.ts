import { ChatRoom } from "@prisma/client";
import { getUserLocation,userInRangeOfChatRoom } from "./redisUserLocation";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { getChatRoomById } from "../services/chatRoomService";
import { ChatRoomMessage } from "@prisma/client";

const chatRoomMessageService = new ChatRoomMessageService();

export async function verifyChatRoomAndUserInRange(roomId:number,userId:number){
  const chatRoom = await getChatRoomById(roomId);

   if (!chatRoom) {
      throw new Error("Chat room not found");
    }

  if (chatRoom.longitude && chatRoom.latitude && chatRoom.size) {
     const userLocation = await getUserLocation(String(userId));
          if (!userLocation) {
            throw new Error("User location not found");
          }
          const isUserInRange = await userInRangeOfChatRoom(
            userLocation.latitude,
            userLocation.longitude,
            chatRoom,
          );
          if(!isUserInRange){
            throw new Error("user out of range to interact with this ChatRoomw");
          }
        }
        return chatRoom;
}

export async function getAndVerifyMessage(messageId:number):Promise<ChatRoomMessage>{
    const message = await chatRoomMessageService.getMessageById(messageId);

      if (!message) {
        throw new Error("Message not found");
      }

      if (message.deleted == true) {
        throw new Error("Message is deleted");
      }

      return message;
}