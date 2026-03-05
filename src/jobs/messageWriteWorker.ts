import { Worker } from "bullmq";
import { Server } from "socket.io";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";
import { ProximityMessageService } from "../services/ProximityMessageService";
import { enqueueModerationJob } from "../moderation";
import { redisConnection, type MessageWriteJobData } from "./messageWriteQueue";
import logger from "../utils/logger";

const chatRoomMessageService = new ChatRoomMessageService();
const proximityMessageService = new ProximityMessageService();

export function startMessageWriteWorker(io: Server): void {
  const worker = new Worker<MessageWriteJobData>(
    "messageWrite",
    async (job) => {
      const data = job.data;

      if (data.type === "CHAT_MESSAGE") {
        const message = await chatRoomMessageService.createFast(
          data.chatRoomId,
          data.userId,
          data.content,
          data.imageUrl,
          data.replyToId,
          data.wasAnonymous,
        );

        io.to(String(data.chatRoomId)).emit("messageIdAssigned", {
          tempId: data.tempId,
          realId: message.id,
        });

        await enqueueModerationJob({
          contentType: "CHAT_MESSAGE",
          contentId: message.id,
          userId: data.userId,
          text: data.content,
          imageUrl: message.imageUrl ?? undefined,
          socketMeta: {
            type: "CHAT_MESSAGE",
            chatRoomId: data.chatRoomId,
          },
        });
      } else {
        const message = await proximityMessageService.createFast(
          data.userId,
          data.content,
          data.latitude,
          data.longitude,
          data.imageUrl,
          data.replyToId,
        );

        data.recipientIds.forEach((id) => {
          io.to(`user:${id}`).emit("proximityMessageIdAssigned", {
            tempId: data.tempId,
            realId: message.id,
          });
        });

        await enqueueModerationJob({
          contentType: "PROXIMITY_MESSAGE",
          contentId: message.id,
          userId: data.userId,
          text: data.content,
          imageUrl: message.imageUrl ?? undefined,
          socketMeta: {
            type: "PROXIMITY_MESSAGE",
            latitude: data.latitude,
            longitude: data.longitude,
            senderRadius: data.senderRadius,
          },
        });
      }
    },
    { connection: redisConnection, concurrency: 10 },
  );

  worker.on("failed", (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      const data = job.data;
      const event = data.type === "CHAT_MESSAGE" ? "messageFailed" : "proximityMessageFailed";
      io.to(`user:${data.userId}`).emit(event, { tempId: data.tempId });
      logger.error(`[MessageWriteWorker] Final failure for ${data.type} tempId=${data.tempId}:`, err);
    }
  });
}
