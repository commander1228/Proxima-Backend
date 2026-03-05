// =============================================================================
// NOTIFICATION TYPES
// =============================================================================
// Central type definitions for the entire notification system.
// Every notification flows through these types, making it easy to add new
// notification types without touching existing code.
// =============================================================================

/**
 * Every notification has a "type" string. This enum defines all known types.
 * When you add a new notification trigger, add a new entry here first.
 *
 * WHY A CONST OBJECT INSTEAD OF A TS ENUM?
 * ─────────────────────────────────────────
 * TypeScript enums compile to reverse-mapped objects, which can cause
 * surprising runtime behavior. A `const` object with `as const` gives you
 * the same type safety with simpler JS output.
 */
export const NotificationType = {
  NEW_COMMENT: "NEW_COMMENT",
  KARMA_MILESTONE: "KARMA_MILESTONE",
  INACTIVE_REMINDER: "INACTIVE_REMINDER",
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

/**
 * The payload that gets created when a notification is triggered.
 * This is what gets saved to the database AND sent as a push notification.
 */
export interface NotificationPayload {
  userId: number;                  // Who receives this notification
  type: NotificationType;          // Which type of notification
  title: string;                   // Push notification title
  body: string;                    // Push notification body text
  data?: Record<string, any>;      // Deep-link data (e.g. { postId: 42 })
}

/**
 * Context passed to notification rules when they're evaluated.
 * Each trigger event provides different context — rules pick what they need.
 *
 * WHY ONE BIG CONTEXT INSTEAD OF PER-RULE TYPES?
 * ───────────────────────────────────────────────
 * Keeping a single context type means every rule function has the same
 * signature: (ctx: NotificationContext) => NotificationPayload | null.
 * This uniformity is what makes the rule engine scalable — you register
 * a function, the engine calls it, done. No adapter pattern needed.
 */
export interface NotificationContext {
  // ── Event trigger info ──
  event: NotificationEvent;

  // ── User who triggered the event (e.g. the commenter, voter) ──
  actorId?: number;

  // ── Target user who should receive the notification ──
  targetUserId?: number;

  // ── Post-related context ──
  postId?: number;
  postTitle?: string;
  postOwnerId?: number;

  // ── Comment-related context ──
  commentId?: number;

  // ── Karma/vote context ──
  newKarmaTotal?: number;
  voteCount?: number;
}

/**
 * Events that can trigger notification evaluation.
 * When you want to add a new trigger, add the event name here,
 * then create a rule that listens for it.
 */
export const NotificationEvent = {
  COMMENT_CREATED: "COMMENT_CREATED",
  POST_VOTED: "POST_VOTED",
  SCHEDULED_INACTIVE_CHECK: "SCHEDULED_INACTIVE_CHECK",
} as const;

export type NotificationEvent =
  (typeof NotificationEvent)[keyof typeof NotificationEvent];

/**
 * A notification rule definition. This is the core abstraction that makes
 * the system scalable — each rule is a self-contained module that:
 *
 * 1. Declares which events it listens to
 * 2. Has an `evaluate` function that decides whether to fire
 * 3. Has a `dedupeKey` function for preventing duplicate sends
 * 4. Can be enabled/disabled independently
 *
 * To add a new notification: create a rule object, register it. Done.
 */
export interface NotificationRule {
  /** Unique name for this rule (used in logs) */
  name: string;

  /** Which events trigger this rule's evaluation */
  events: NotificationEvent[];

  /** Is this rule currently active? Set to false to disable without removing */
  enabled: boolean;

  /**
   * Evaluate whether this rule should fire for the given context.
   * Return a NotificationPayload to send, or null to skip.
   */
  evaluate: (ctx: NotificationContext) => NotificationPayload | null;

  /**
   * Generate a unique key for deduplication.
   * If this key has been sent before, the notification won't be sent again.
   * Return null to skip deduplication (always send).
   *
   * Examples:
   *   "karma_milestone:post:42:15"  → only congratulate once per threshold
   *   "inactive_reminder:user:7"    → only remind once per cycle
   */
  dedupeKey: (ctx: NotificationContext) => string | null;
}
