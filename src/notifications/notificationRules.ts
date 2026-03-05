// =============================================================================
// NOTIFICATION RULES
// =============================================================================
// This is the "scalable" heart of the notification system. Each rule is a
// self-contained object that declares:
//   - Which events it listens to
//   - How to evaluate whether to fire
//   - How to deduplicate (prevent spamming the same notification)
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  TO ADD A NEW NOTIFICATION:                                            │
// │                                                                        │
// │  1. Add the NotificationType in notificationTypes.ts                   │
// │  2. Add the NotificationEvent if it's a new trigger                    │
// │  3. Create a NotificationRule object below                             │
// │  4. Add it to the NOTIFICATION_RULES array at the bottom               │
// │  5. Emit the event from wherever the trigger happens (controller, etc) │
// │                                                                        │
// │  That's it — no need to touch the service, DAO, or push code.          │
// └─────────────────────────────────────────────────────────────────────────┘
//
// =============================================================================

import {
  NotificationRule,
  NotificationEvent,
  NotificationType,
  NotificationContext,
} from "./notificationTypes";

// ─── Rule 1: New Comment on Your Post ────────────────────────────────────────
// Fires when someone comments on a post you own.
// Does NOT fire if you comment on your own post.

const newCommentRule: NotificationRule = {
  name: "new_comment",
  events: [NotificationEvent.COMMENT_CREATED],
  enabled: true,

  evaluate(ctx: NotificationContext) {
    // Only fire if we have all the data we need
    if (!ctx.postOwnerId || !ctx.actorId || !ctx.postId) return null;

    // Don't notify users about their own comments
    if (ctx.actorId === ctx.postOwnerId) return null;

    return {
      userId: ctx.postOwnerId,
      type: NotificationType.NEW_COMMENT,
      title: "New comment on your post",
      body: ctx.postTitle
        ? `Someone commented on "${truncate(ctx.postTitle, 40)}"`
        : "Someone commented on your post",
      data: { postId: ctx.postId, commentId: ctx.commentId },
    };
  },

  // We DO want to send a notification for every new comment, so no dedup.
  // If you later want to batch them ("3 new comments"), add a dedup key
  // like `comment:post:${postId}:${hourBucket}` and aggregate.
  dedupeKey() {
    return null; // always send
  },
};

// ─── Rule 2: Karma Milestone ─────────────────────────────────────────────────
// Fires when a post reaches a positive karma milestone.
// Currently set to 15, but you can easily change KARMA_THRESHOLD below
// or extend to support multiple milestones (15, 50, 100, etc).

const KARMA_THRESHOLD = 15;

const karmaMilestoneRule: NotificationRule = {
  name: "karma_milestone",
  events: [NotificationEvent.POST_VOTED],
  enabled: true,

  evaluate(ctx: NotificationContext) {
    if (!ctx.postOwnerId || !ctx.postId || ctx.voteCount === undefined) {
      return null;
    }

    // Don't notify if they voted on their own post (shouldn't happen, but safe)
    if (ctx.actorId === ctx.postOwnerId) return null;

    // Check if the post just crossed the threshold
    // We check if current count is exactly the threshold. If a post gets
    // rapidly upvoted past the threshold, we'll still catch it because
    // we check >= and deduplicate.
    if (ctx.voteCount < KARMA_THRESHOLD) return null;

    return {
      userId: ctx.postOwnerId,
      type: NotificationType.KARMA_MILESTONE,
      title: "Your post is gaining traction! 🔥",
      body: ctx.postTitle
        ? `"${truncate(ctx.postTitle, 35)}" hit ${KARMA_THRESHOLD}+ karma!`
        : `Your post hit ${KARMA_THRESHOLD}+ karma!`,
      data: { postId: ctx.postId, milestone: KARMA_THRESHOLD },
    };
  },

  // Deduplicate per post per threshold — a post only triggers this ONCE.
  dedupeKey(ctx: NotificationContext) {
    if (!ctx.postId) return null;
    return `karma_milestone:post:${ctx.postId}:${KARMA_THRESHOLD}`;
  },
};

// ─── Rule 3: Inactive User Reminder ─────────────────────────────────────────
// Fires for users who haven't logged in for 48+ hours.
// This is evaluated by the scheduler, not by a user action.

const inactiveReminderRule: NotificationRule = {
  name: "inactive_reminder",
  events: [NotificationEvent.SCHEDULED_INACTIVE_CHECK],
  enabled: true,

  evaluate(ctx: NotificationContext) {
    if (!ctx.targetUserId) return null;

    // Pick a random friendly message to keep things fresh
    const messages = [
      {
        title: "We miss you! 👋",
        body: "Your campus community has been buzzing. Come see what's new!",
      },
      {
        title: "What's happening nearby? 🗺️",
        body: "People are chatting in your area — join the conversation!",
      },
      {
        title: "Come back and say hi! 😊",
        body: "Your neighbors have been active. Don't miss out on the fun!",
      },
      {
        title: "It's been a while! 🌟",
        body: "New posts are popping up around you. Check them out!",
      },
      {
        title: "Your community awaits! 💬",
        body: "Lots of new conversations happening nearby. Jump back in!",
      },
    ];

    const msg = messages[Math.floor(Math.random() * messages.length)];

    return {
      userId: ctx.targetUserId,
      type: NotificationType.INACTIVE_REMINDER,
      title: msg.title,
      body: msg.body,
      data: { screen: "feed" },
    };
  },

  // Only send one inactive reminder per 48-hour cycle per user.
  // The scheduler runs every hour, but this key ensures we don't spam.
  // We use a date bucket so the key expires naturally after the cycle.
  dedupeKey(ctx: NotificationContext) {
    if (!ctx.targetUserId) return null;
    // Create a bucket that changes every 48 hours
    const bucket = Math.floor(Date.now() / (48 * 60 * 60 * 1000));
    return `inactive_reminder:user:${ctx.targetUserId}:${bucket}`;
  },
};

// =============================================================================
// RULE REGISTRY
// =============================================================================
// All rules live in this array. The notification service iterates over it
// whenever an event is emitted. To add a rule, just push it here.
//
// You can also dynamically enable/disable rules at runtime by setting
// rule.enabled = false, or build an admin API for it later.
// =============================================================================

export const NOTIFICATION_RULES: NotificationRule[] = [
  newCommentRule,
  karmaMilestoneRule,
  inactiveReminderRule,
];

/**
 * Get all rules that listen to a specific event.
 * This is O(n) over the rules array, which is fine for < 100 rules.
 * If you ever have hundreds of rules, index by event for O(1) lookup.
 */
export function getRulesForEvent(event: NotificationEvent): NotificationRule[] {
  return NOTIFICATION_RULES.filter(
    (rule) => rule.enabled && rule.events.includes(event)
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}
