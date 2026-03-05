// =============================================================================
// MODERATION TYPES
// =============================================================================
// These types define the "job ticket" that flows through the moderation pipeline.
//
// Think of it like a fast-food order slip:
//   - contentType tells the worker WHICH database table to look up
//   - contentId   tells the worker WHICH row to check
//   - text/imageUrl are the actual content to send to OpenAI
//   - userId      is needed so we can log who posted it
//   - socketMeta  carries extra info the worker needs to emit real-time
//                 "ghost delete" events back to the correct Socket.io room
// =============================================================================

/**
 * The four content types your app produces. These match the Prisma
 * `ContentType` enum so we can reuse them in the ModerationLog table.
 */
export type ModeratableContentType =
  | "POST"
  | "POST_COMMENT"
  | "CHAT_MESSAGE"
  | "PROXIMITY_MESSAGE";

/**
 * Extra metadata the worker needs to perform the "ghost delete" via WebSocket.
 *
 * - For CHAT_MESSAGE:       { chatRoomId: number }
 *     → worker emits "messageModerated" to that chat room
 *
 * - For PROXIMITY_MESSAGE:  { latitude, longitude, senderRadius }
 *     → worker looks up nearby users and emits "proximityMessageModerated"
 *
 * - For POST / POST_COMMENT: no socketMeta needed because those are
 *   fetched via REST — the next GET will simply not return deleted content.
 *   (But we still emit a "postModerated" / "commentModerated" event so
 *    the frontend can optimistically remove it without waiting for a refresh.)
 */
export interface ChatRoomSocketMeta {
  type: "CHAT_MESSAGE";
  chatRoomId: number;
}

export interface ProximitySocketMeta {
  type: "PROXIMITY_MESSAGE";
  latitude: number;
  longitude: number;
  senderRadius: number;
}

export interface PostSocketMeta {
  type: "POST";
  locationId: number;
}

export interface CommentSocketMeta {
  type: "POST_COMMENT";
  postId: number;
}

export type SocketMeta =
  | ChatRoomSocketMeta
  | ProximitySocketMeta
  | PostSocketMeta
  | CommentSocketMeta;

/**
 * A ModerationJob is what gets serialized to JSON and pushed into the
 * Redis queue. The worker pops one of these, calls OpenAI, and acts on it.
 */
export interface ModerationJob {
  contentType: ModeratableContentType;
  contentId: number;         // Primary key in the corresponding table
  userId: number;            // Who created the content (for audit log)
  text?: string;             // The text to moderate (may be empty for image-only)
  imageUrl?: string;         // The S3 URL of the image to moderate (optional)
  socketMeta?: SocketMeta;   // Info needed for real-time "ghost delete"
}

/**
 * The result that comes back from the OpenAI moderation API,
 * normalized into a simple shape for our worker to act on.
 */
export interface ModerationResult {
  flagged: boolean;           // true = at least one category was flagged
  categories: Record<string, boolean>;  // e.g. { "hate": true, "violence": false }
  categoryScores: Record<string, number>; // e.g. { "hate": 0.93, "violence": 0.01 }
}