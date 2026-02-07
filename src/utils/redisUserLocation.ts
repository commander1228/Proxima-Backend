import redis from "./setupRedis";
import { getDistance } from "geolib";

const USER_LOCATIONS_KEY = "user:locations";

// Save user location using Redis GEOADD
export async function saveUserLocation(
  userId: number,
  location: { latitude: number; longitude: number },
  proximityRadius: number,
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
  const userIds = await redis.georadius(
    USER_LOCATIONS_KEY,
    longitude,
    latitude,
    radius,
    "m",
  ) as string[];
  return userIds.map(Number);
}

export async function filterMutuallyNearbyUsers(
  userId: number,
  currentUserLocation: { latitude: number; longitude: number },
  nearbyUserIds: number[],
  userSocketMap: { [userId: number]: { socketId: string; proximityRadius: number } },
) {
  const mutuallyNearby: number[] = [];
  for (const id of nearbyUserIds) {
    const nearbyUserLocation = await getUserLocation(String(id));
    const nearbyUserRadius = userSocketMap[id]?.proximityRadius ?? 2;
    if (!nearbyUserLocation) continue;

    const distance = getDistance(
      { latitude: nearbyUserLocation.latitude, longitude: nearbyUserLocation.longitude },
      {
        latitude: currentUserLocation.latitude,
        longitude: currentUserLocation.longitude,
      },
    );

    if (distance <= nearbyUserRadius) {
      mutuallyNearby.push(id);
    }
  }
  // Map user IDs to socket IDs and filter out any undefined
  return mutuallyNearby
    .map(id => userSocketMap[id]?.socketId)
    .filter(Boolean);
}



export async function getNearbyUsersCount(userId: number, radius: number) {
  const location = await getUserLocation(String(userId));
  if (!location) return 0;

  return (await getNearbyUsers(location.latitude, location.longitude, radius))
    .length;
}

//left off here
