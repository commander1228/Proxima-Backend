import { ChatRoom, Location, LocationType } from "@prisma/client";
import redis from "./setupRedis";
import { getDistance } from "geolib";

const USER_LOCATIONS_KEY = "user:locations";

// Save user location using Redis GEOADD
export async function saveUserLocation(
  userId: number,
  location: { latitude: number; longitude: number },
) {
  await redis.geoadd(
    USER_LOCATIONS_KEY,
    location.longitude,
    location.latitude,
    String(userId),
  );
}

// Get user location using GEOPOS
export async function getUserLocation(userId: string) {
  const pos = await redis.geopos(USER_LOCATIONS_KEY, userId);
  if (!pos || !pos[0]) return null;
  const [longitude, latitude] = pos[0];
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

export async function getNearbyUsers(
  latitude: number,
  longitude: number,
  radius: number,
): Promise<number[]> {
  const userIds = (await redis.georadius(
    USER_LOCATIONS_KEY,
    longitude,
    latitude,
    radius,
    "m",
  )) as string[];
  return userIds.map(Number);
}

export async function userInRangeOfLocation(
  userLatitude: number,
  userLongitude: number,
  location: Location,
) {
  if (
    location.latitude == null ||
    location.longitude == null ||
    location.size == null ||
    userLatitude == null ||
    userLongitude == null
  ) {
    throw new Error(
      "ChatRoom or user location is missing latitude, longitude, or size",
    );
  }

  const distance = getDistance(
    { latitude: Number(userLatitude), longitude: Number(userLongitude) },
    {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    },
  );
  return distance <= location.size;
}

export async function filterMutuallyNearbyUsers(
  userId: number,
  currentUserLocation: { latitude: number; longitude: number },
  nearbyUserIds: number[],
  userSocketMap: {
    [userId: number]: { socketId: string; proximityRadius: number };
  },
) {
  if (nearbyUserIds.length === 0) return [];

  // Batch all GEOPOS lookups in a single Redis pipeline instead of N sequential calls
  const pipeline = redis.pipeline();
  for (const id of nearbyUserIds) {
    pipeline.geopos(USER_LOCATIONS_KEY, String(id));
  }
  const results = await pipeline.exec();

  const mutuallyNearby: number[] = [];
  for (let i = 0; i < nearbyUserIds.length; i++) {
    const id = nearbyUserIds[i];
    const [err, pos] = results![i] as [Error | null, [string, string][] | null];
    if (err || !pos || !pos[0]) continue;

    const nearbyUserLocation = {
      latitude: Number(pos[0][1]),
      longitude: Number(pos[0][0]),
    };
    const nearbyUserRadius = userSocketMap[id]?.proximityRadius ?? 1609;

    const distance = getDistance(
      { latitude: nearbyUserLocation.latitude, longitude: nearbyUserLocation.longitude },
      { latitude: currentUserLocation.latitude, longitude: currentUserLocation.longitude },
    );

    if (distance <= nearbyUserRadius) {
      mutuallyNearby.push(id);
    }
  }

  return mutuallyNearby;
}

export async function removeUserLocation(userId: number) {
  try {
    await redis.zrem(USER_LOCATIONS_KEY, String(userId));
  } catch (error) {
    console.error("Error removing user location:", error);
  }
}

export async function getNearbyUsersCount(
  userId: number,
  radius: number,
  userSocketMap: {
    [userId: number]: { socketId: string; proximityRadius: number };
  },
) {
  const location = await getUserLocation(String(userId));
  if (!location) return 0;

  // Step 1: find everyone within MY radius (one-directional)
  const nearbyUserIds = await getNearbyUsers(
    location.latitude,
    location.longitude,
    radius,
  );

  // Filter out self and disconnected users early
  const candidates = nearbyUserIds.filter(
    (id) => id !== userId && userSocketMap[id] != null,
  );
  if (candidates.length === 0) return 0;

  // Step 2: batch all GEOPOS lookups in a single pipeline instead of N
  // sequential `getUserLocation` calls. Same pattern used in
  // filterMutuallyNearbyUsers — keeps Redis round-trips constant at 1.
  const pipeline = redis.pipeline();
  for (const id of candidates) {
    pipeline.geopos(USER_LOCATIONS_KEY, String(id));
  }
  const results = await pipeline.exec();

  let mutualCount = 0;
  for (let i = 0; i < candidates.length; i++) {
    const id = candidates[i];
    const [err, pos] = results![i] as [Error | null, [string, string][] | null];
    if (err || !pos || !pos[0]) continue;

    const otherLocation = {
      latitude: Number(pos[0][1]),
      longitude: Number(pos[0][0]),
    };
    const otherRadius = userSocketMap[id]?.proximityRadius ?? 1609;

    const distance = getDistance(
      { latitude: location.latitude, longitude: location.longitude },
      { latitude: otherLocation.latitude, longitude: otherLocation.longitude },
    );

    if (distance <= otherRadius) {
      mutualCount++;
    }
  }

  return mutualCount;
}

//left off here