import { LocationType } from "@prisma/client";

export type CreateLocationInput = {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  size?: number;
  type?: LocationType;
};