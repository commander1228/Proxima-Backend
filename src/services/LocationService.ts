
import { ChatRoom, Location, LocationType } from "@prisma/client";
import { LocationDao } from "../dao/LocationDao";
import { listChatRooms } from "./chatRoomService";
import {prisma} from "../utils/prisma";
import { createRoomDao } from "../dao/chatRoomDao";
import { PostService } from "./PostService";

const locationDao = new LocationDao();
const postService = new PostService();

export class LocationService {
  async createLocation(
    name: string,
    latitude: number | null = null,
    longitude: number | null = null,
    size: number = 0,
    type: LocationType = LocationType.NONE,
  ):Promise <{location: Location, defaultChatRoom: ChatRoom}>{
    if (!name) throw new Error("Location name is required");

    if (await this.isLocationNameInUse(name)) {
      throw new Error("Location name is already in use");
    }
    if (latitude !== null && longitude !== null) {
      await this.verifyGeo(latitude!, longitude!);
    }

    try{
        const result = await prisma.$transaction(async (tx) => {
            const location = await locationDao.createLocation(tx,{name,latitude,longitude,size,type});
            const room = await createRoomDao("General",location.id,tx);
            return { location,defaultChatRoom: room}
        });
        return result;
    }catch(error:any){
        throw error;
    }
}

  async deleteLocation(id: number) {
    return await locationDao.deleteLocation(id);
  }

  async getLocationById(id: number) {
    const location =  await locationDao.getLocationById(id);
    if(location?.deleted == true || location == null){
        throw new Error("location does not exist");
    }
    return location
  }

  async getLocationDetails(id: number) {
    const location = await this.getLocationById(id);

    const locationChatRooms = await listChatRooms(location.id);
    const locationPosts = await postService.getPostListByLocation(id);

    return {
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        size: location.size,
        type: location.type,
        chatRooms: locationChatRooms,
        locationPosts: locationPosts
    }
  }

  async updateLocation(
    id: number,
    updates: {
      name?: string;
      latitude?: number | null;
      longitude?: number | null;
      size?: number;
      type?: LocationType;
    },
  ) {
    if (!(await this.locationExists(id))) {
      throw new Error("Location does not exist");
    }
    if (updates.name !== undefined) {
      if (await locationDao.getLocationByNameExcludingId(updates.name, id)) {
        throw new Error("Location name is already in use");
      }
    }
    if (updates.latitude !== undefined && updates.longitude !== undefined) {
      await this.verifyGeo(updates.latitude!, updates.longitude!);
    }
    if (
      updates.size !== undefined &&
      (updates.size < 0 || updates.size > 18000)
    ) {
      throw new Error("Location size cannot be negative or greater than 18000");
    }

    return await locationDao.updateLocation(id, updates);
  }

  async isLocationNameInUse(name: string) {
    const result = await locationDao.getLocationByName(name);
    return !!result;
  }

  async locationExists(locationId: number) {
    const location = await locationDao.getLocationById(locationId);
    return !!location && !location.deleted;
  }

  async listLocations() {
    return await locationDao.getAllLocations();
  }

  async getLocationChatrooms(locationId: number) {
    if (!(await this.locationExists(locationId))) {
      throw new Error(" Location does not exist");
    }
    return await listChatRooms(locationId);
  }

  async verifyGeo(latitude: number, longitude: number) {
    if (latitude < -90 || latitude > 90) {
      throw new Error("Latitude must be between -90 and 90");
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error("Longitude must be between -180 and 180");
    }
    return true;
  }
}
