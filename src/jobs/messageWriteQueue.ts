import { Queue } from "bullmq";

// ── Job data types ────────────────────────────────────────────────────────────

export interface ChatMessageJobData {
  type: "CHAT_MESSAGE";
  tempId: number;
  chatRoomId: number;
  userId: number;
  content: string;
  imageUrl?: string;
  replyToId?: number;
  wasAnonymous: boolean;
}

export interface ProximityMessageJobData {
  type: "PROXIMITY_MESSAGE";
  tempId: number;
  userId: number;
  content: string;
  imageUrl?: string;
  latitude: number;
  longitude: number;
  replyToId?: number;
  recipientIds: number[];
  senderRadius: number;
}

export type MessageWriteJobData = ChatMessageJobData | ProximityMessageJobData;

// ── Shared connection options (used by both Queue and Worker) ─────────────────
// BullMQ manages its own ioredis connections internally — do not share the
// existing redis singleton, which may be in SUBSCRIBE or BRPOP state.

export const redisConnection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

// ── Queue ─────────────────────────────────────────────────────────────────────

export const messageWriteQueue = new Queue<MessageWriteJobData>("messageWrite", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 200 },
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  },
});

export async function enqueueMessageWrite(data: MessageWriteJobData): Promise<void> {
  await messageWriteQueue.add(data.type, data);
}
