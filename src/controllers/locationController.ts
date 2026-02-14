import { Request, Response } from "express";
import { LocationService } from "../services/LocationService";

const locationService = new LocationService();

export async function createLocation(req: Request, res: Response) {
  try {
    const {name,latitude,longitude,size,type} = req.body;

    const result = await locationService.createLocation(name,latitude,longitude,size,type);
    const locationList = await locationService.listLocations();
    return res.status(201).json({
      message: `location: ${result.location.name} has been created`,
      createdLocationId: result.location.id,
      defaultChatRoomId: result.defaultChatRoom.id,
      locationList,
    });
} catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function listLocations(req: Request, res: Response) {
  try {
    const locationList = await locationService.listLocations();

    return res.status(200).json({locationList});
  }catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function locationDetails(req: Request, res: Response) {
  try {
    const locationId = Number(req.params.locationId);

    if (!locationId || Number.isNaN(locationId)) {
      return res.status(400).json({ message: "invalid locationId" });
    }
    
    const payload = await locationService.getLocationDetails(locationId);

    return res.status(200).json(payload);
  }catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}