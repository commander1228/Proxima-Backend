import { ChatRoom } from "@prisma/client";
import { getUserLocation, userInRangeOfLocation } from "./redisUserLocation";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { getChatRoomById } from "../services/chatRoomService";
import { ChatRoomMessage } from "@prisma/client";
import { LocationDao } from "../dao/LocationDao";
import redis from "./setupRedis";

const chatRoomMessageService = new ChatRoomMessageService();
const locationDao = new LocationDao();

const CHATROOM_CACHE_TTL = 300; // 5 minutes in seconds — for Redis
const CHATROOM_CACHE_TTL_MS = 300_000; // 5 minutes in ms — for in-process cache
const CHATROOM_CACHE_MAX = 500;

function chatRoomCacheKey(roomId: number) {
  return `cache:chatroom:${roomId}`;
}

// ── In-process LRU cache ──────────────────────────────────────────────────────
// Map preserves insertion order; we re-insert on access to maintain LRU order,
// and evict the oldest entry (first key) when the cap is reached.

interface LocalCacheEntry {
  payload: { chatRoom: any; location: any };
  expiresAt: number;
}

const localCache = new Map<number, LocalCacheEntry>();

function localGet(roomId: number): { chatRoom: any; location: any } | null {
  const entry = localCache.get(roomId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localCache.delete(roomId);
    return null;
  }
  // Move to end to mark as recently used
  localCache.delete(roomId);
  localCache.set(roomId, entry);
  return entry.payload;
}

function localSet(roomId: number, payload: { chatRoom: any; location: any }): void {
  if (localCache.size >= CHATROOM_CACHE_MAX) {
    const firstKey = localCache.keys().next().value;
    if (firstKey !== undefined) localCache.delete(firstKey);
  }
  localCache.set(roomId, { payload, expiresAt: Date.now() + CHATROOM_CACHE_TTL_MS });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function getCachedChatRoomWithLocation(roomId: number) {
  // 1. In-process cache — zero network hops on hit
  const local = localGet(roomId);
  if (local) return local;

  // 2. Redis fallback — handles cold starts after a server restart
  const key = chatRoomCacheKey(roomId);
  const cached = await redis.get(key);
  if (cached) {
    const payload = JSON.parse(cached);
    localSet(roomId, payload);
    return payload;
  }

  // 3. DB — populate both caches
  const chatRoom = await getChatRoomById(roomId);
  if (!chatRoom) return null;

  const location = await locationDao.getLocationById(chatRoom.locationId);
  const payload = { chatRoom, location };
  localSet(roomId, payload);
  await redis.setex(key, CHATROOM_CACHE_TTL, JSON.stringify(payload));
  return payload;
}

/**
 * Waits briefly for a user's location to appear in Redis.
 *
 * This handles the race condition where joinRoom reaches the server before
 * updateLocation has been processed. Instead of failing immediately when
 * Redis has no entry, we retry a few times with short delays.
 *
 * Why server-side retry > client-side setTimeout:
 * The frontend used `setTimeout(150)` to "guess" how long the server needs,
 * but that breaks under network jitter or server load. By retrying here, the
 * server adapts to its own processing speed — no guesswork needed.
 */
async function getUserLocationWithRetry(
  userId: string,
  maxRetries = 3,
  delayMs = 200,
): Promise<{ latitude: number; longitude: number } | null> {
  for (let i = 0; i < maxRetries; i++) {
    const loc = await getUserLocation(userId);
    if (loc) return loc;
    if (i < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

export async function verifyChatRoomAndUserInRange(roomId: number, userId: number, isAdmin?: boolean) {
  const cached = await getCachedChatRoomWithLocation(roomId);

  if (!cached?.chatRoom) {
    throw new Error("Chat room not found");
  }

  if (isAdmin) return cached.chatRoom;

  const { chatRoom, location } = cached;

  if (location && location.latitude != null && location.longitude != null && location.size != null) {
    // Use retry instead of instant fail — handles the race where joinRoom
    // arrives before updateLocation has written to Redis
    const userLocation = await getUserLocationWithRetry(String(userId));
    if (!userLocation) {
      throw new Error("User location not found");
    }
    const isUserInRange = await userInRangeOfLocation(
      userLocation.latitude,
      userLocation.longitude,
      location,
    );
    if (!isUserInRange) {
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