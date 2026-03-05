import { getDistance } from "geolib";
import { getUserLocation } from "../utils/redisUserLocation";
import { LocationDao } from "../dao/LocationDao";
import { PostService } from "./PostService";
import { getMutedLocationIdsDao } from "../dao/MutedLocationDao";
import { prisma } from "../utils/prisma";
import redis from "../utils/setupRedis";

const locationDao = new LocationDao();
const postService = new PostService();

const DEFAULT_FEED_RADIUS_M = 8047; // 5 miles

// Cache the full location list to avoid hitting Postgres on every feed request.
// Locations are created/deleted infrequently, so a 2-minute TTL is safe.
const LOCATIONS_CACHE_KEY = "cache:all_locations";
const LOCATIONS_CACHE_TTL = 120; // seconds

export type InRangeLocation = {
  id: number;
  name: string;
};

export type FeedResult = {
  posts: Awaited<ReturnType<PostService["getFeedPosts"]>>["posts"];
  hasMore: boolean;
  inRangeLocations?: InRangeLocation[];
};

export class FeedService {
  async getFeedForUser(userId: number, before?: Date): Promise<FeedResult> {
    // ── 1–3. Fetch user position, preferences, locations, and muted IDs in parallel
    const [userPos, prefs, allLocations, mutedIds] = await Promise.all([
      getUserLocation(String(userId)),
      prisma.user_Settings.findUnique({ where: { userId } }),
      redis.get(LOCATIONS_CACHE_KEY).then(async (cached) => {
        if (cached) return JSON.parse(cached);
        const locations = await locationDao.getAllLocations();
        await redis.setex(LOCATIONS_CACHE_KEY, LOCATIONS_CACHE_TTL, JSON.stringify(locations));
        return locations;
      }),
      getMutedLocationIdsDao(userId),
    ]);

    if (!userPos) {
      throw new Error("User location not found — make sure location tracking is active");
    }

    const feedRadius = prefs?.feedRadius ?? DEFAULT_FEED_RADIUS_M;

    // ── 4. Filter: location centre must be within user's feed radius ─────────
    const inRange: InRangeLocation[] = [];
    for (const loc of allLocations) {
      if (loc.latitude == null || loc.longitude == null) continue;

      const distMetres = getDistance(
        { latitude: userPos.latitude, longitude: userPos.longitude },
        { latitude: Number(loc.latitude), longitude: Number(loc.longitude) }
      );

      if (distMetres <= feedRadius) {
        inRange.push({ id: loc.id, name: loc.name });
      }
    }

    // ── 5. Filter out muted locations ─────────────────────────────────────────
    const visibleLocations = inRange.filter((l) => !mutedIds.has(l.id));

    // ── 6. Posts + result ───────────────────────────────────────────────────
    const locationIds = visibleLocations.map((l) => l.id);
    const { posts, hasMore } = await postService.getFeedPosts(locationIds, userId, before);

    return {
      posts,
      hasMore,
      ...(before ? {} : { inRangeLocations: visibleLocations }),
    };
  }
}