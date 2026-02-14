import { ChatRoom } from "@prisma/client";
import { getUserLocation,userInRangeOfLocation} from "./redisUserLocation";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { getChatRoomById } from "../services/chatRoomService";
import { ChatRoomMessage } from "@prisma/client";
import { LocationService } from "../services/LocationService";
import { LocationDao } from "../dao/LocationDao";

const chatRoomMessageService = new ChatRoomMessageService();
const locationDao = new LocationDao();

export async function verifyChatRoomAndUserInRange(roomId:number,userId:number){
  const chatRoom = await getChatRoomById(roomId);

   if (!chatRoom) {
      throw new Error("Chat room not found");
    }

    const location = await locationDao.getLocationById(chatRoom.locationId);

  if (location && location.latitude != null && location.longitude != null && location.size != null) {
     const userLocation = await getUserLocation(String(userId));
          if (!userLocation) {
            throw new Error("User location not found");
          }
          const isUserInRange = await userInRangeOfLocation(
            userLocation.latitude,
            userLocation.longitude,
            location,
          );
          if(!isUserInRange){
            throw new Error("user out of range to interact with this ChatRoom");
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