// =============================================================================
// PUSH SERVICE — Expo Push Notification Delivery
// =============================================================================
// Sends push notifications through Expo's push notification service.
// Expo handles the bridge to APNs (iOS) and FCM (Android) for you,
// so you don't need separate Apple/Google credentials for push delivery.
//
// HOW IT WORKS:
// ─────────────
// 1. The mobile app registers with Expo and gets an "ExpoPushToken"
// 2. The app sends this token to our backend (stored in PushToken table)
// 3. When we want to notify a user, we POST to Expo's API with their tokens
// 4. Expo routes the notification to APNs or FCM depending on the platform
//
// EXPO PUSH API:
// ──────────────
// POST https://exp.host/--/api/v2/push/send
// Body: [{ to: "ExponentPushToken[xxx]", title: "...", body: "..." }]
//
// No API key needed for < 600 notifications/second. If you scale beyond
// that, you can add an Expo access token in the Authorization header.
// =============================================================================

import logger from "../utils/logger";
import { NotificationPayload } from "./notificationTypes";
import { getPushTokensForUser, removePushToken } from "./notificationDao";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * A single message in the Expo push format.
 * See: https://docs.expo.dev/push-notifications/sending-notifications/
 */
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

/**
 * Send a push notification to all of a user's registered devices.
 *
 * This function is fire-and-forget — it logs errors but doesn't throw,
 * because a failed push should never block the main request flow.
 */
export async function sendPushToUser(payload: NotificationPayload): Promise<void> {
  try {
    const tokens = await getPushTokensForUser(payload.userId);

    if (tokens.length === 0) {
      logger.info(
        `[Push] No push tokens for user ${payload.userId}, skipping push`
      );
      return;
    }

    // Build one message per device token
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
      priority: "high",
      // Android notification channel — create this on the client side
      channelId: "default",
    }));

    // Expo supports batching up to 100 messages per request.
    // For now we send them all at once. If you have users with 100+
    // devices (unlikely), chunk them.
    await sendToExpo(messages);

    logger.info(
      `[Push] Sent "${payload.type}" to user ${payload.userId} (${tokens.length} device(s))`
    );
  } catch (error) {
    logger.error(`[Push] Failed to send to user ${payload.userId}:`, error);
  }
}

/**
 * Send a batch of push messages to Expo's API.
 *
 * Uses native fetch (available in Node 18+). If you're on an older Node
 * version, swap this for axios or node-fetch.
 */
async function sendToExpo(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // If you have an Expo access token for higher throughput:
        // "Authorization": `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[Push] Expo API error (${response.status}): ${errorText}`);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await response.json();

    // Check for individual ticket errors (e.g. invalid token)
    if (result?.data) {
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status === "error") {
          logger.warn(`[Push] Ticket error: ${ticket.message}`);
          if (ticket.details?.error === "DeviceNotRegistered") {
            const staleToken = messages[i]?.to;
            if (staleToken) {
              removePushToken(staleToken).catch((err: unknown) =>
                logger.warn(`[Push] Failed to remove stale token:`, err)
              );
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error("[Push] Network error sending to Expo:", error);
  }
}
