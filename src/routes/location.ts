import { Router } from "express";
import {
  authenticateToken,
  authenticateAdmin,
} from "../middleware/authMiddleware";
import { createLocation, listLocations, locationDetails } from "../controllers/locationController"
import { LocationType } from "@prisma/client";

const router = Router();

router.use(authenticateToken);

router.post("/",authenticateAdmin,createLocation);

router.get("/",listLocations);

router.get("/types",(req,res) =>{
  return res.json({ types: Object.values(LocationType)});
});

router.get("/:locationId",locationDetails);

export default router;