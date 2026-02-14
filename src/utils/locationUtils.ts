//todo this should absorb chatroomsocketutils at some point
import { getUserLocation,userInRangeOfLocation} from "./redisUserLocation";
import { Location } from "@prisma/client";

export async function verifyLocationAndUserInRange(location:Location,userId:number){
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
          return isUserInRange 
        } throw new Error("the specified location does not support user location");
}