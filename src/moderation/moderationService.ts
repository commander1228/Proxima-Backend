// =============================================================================
// MODERATION SERVICE — OpenAI API Bridge
// =============================================================================
// This service is responsible for ONE thing: taking content (text and/or an
// image URL) and asking the OpenAI Moderation API whether it's safe.
//
// HOW THE OPENAI MODERATION API WORKS:
// ────────────────────────────────────
// You send it an array of "input" objects. Each object is either:
//   { type: "text",      text: "some user text" }
//   { type: "image_url", image_url: { url: "https://..." } }
//
// The API returns a result with:
//   - flagged:    boolean (true if ANY category is flagged)
//   - categories: object  (which categories triggered, e.g. { hate: true })
//   - category_scores: object (confidence scores, e.g. { hate: 0.93 })
//
// The "omni-moderation-latest" model supports both text AND images in a single
// call, which is perfect since your posts/messages can have both.
//
// COST: The moderation endpoint is FREE for most use cases (as of 2025).
// LATENCY: ~200-500ms per call, which is why we do it in the background.
// =============================================================================

import logger from "../utils/logger";
import { ModerationResult } from "./moderationTypes";

// The OpenAI model that supports both text and image moderation.
// "omni-moderation-latest" always points to the newest omni model.
const MODERATION_MODEL = "omni-moderation-latest";
const OPENAI_API_URL = "https://api.openai.com/v1/moderations";

/**
 * Call the OpenAI Moderation API to check a piece of content.
 *
 * This function accepts optional text and/or an imageUrl. It builds the
 * correct request payload and returns a normalized ModerationResult.
 *
 * @param text     - The text content to moderate (e.g. post body, message)
 * @param imageUrl - An S3 URL for an image to moderate (optional)
 * @returns ModerationResult with flagged status, categories, and scores
 *
 * @example
 * // Text only
 * const result = await moderateContent("I hate you so much");
 * // result.flagged === true, result.categories.hate === true
 *
 * @example
 * // Text + Image
 * const result = await moderateContent("Check this out", "https://s3.../img.jpg");
 *
 * @example
 * // Image only
 * const result = await moderateContent(undefined, "https://s3.../img.jpg");
 */
export async function moderateContent(
  text?: string,
  imageUrl?: string
): Promise<ModerationResult> {
  // ── Guard: Need at least one of text or image ──────────────────────────
  // If there's nothing to moderate, just return "safe" immediately.
  if (!text?.trim() && !imageUrl) {
    return {
      flagged: false,
      categories: {},
      categoryScores: {},
    };
  }

  // ── Build the input array ──────────────────────────────────────────────
  // The OpenAI API wants an array of input objects. We conditionally push
  // text and/or image objects based on what we have.
  const input: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];

  if (text?.trim()) {
    input.push({ type: "text", text: text.trim() });
  }

  if (imageUrl) {
    input.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  // ── Call the OpenAI Moderation API ─────────────────────────────────────
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // IMPORTANT: Store your OpenAI API key in .env as OPENAI_API_KEY
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input,
      }),
    });

    // ── Handle API errors ──────────────────────────────────────────────
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        `[ModerationService] OpenAI API returned ${response.status}: ${errorBody}`
      );
      // On API error, we FAIL OPEN — meaning we assume the content is safe.
      // This prevents a broken API from blocking ALL user content.
      // You could change this to FAIL CLOSED if you prefer stricter behavior.
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
      };
    }

    const data = (await response.json()) as {
     results?: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
     }>;
    };

    // ── Parse the response ─────────────────────────────────────────────
    // The API returns { results: [{ flagged, categories, category_scores }] }
    // We only send one logical piece of content per call, so we use results[0].
    const result = data.results?.[0];

    if (!result) {
      logger.warn("[ModerationService] No results in OpenAI response");
      return { flagged: false, categories: {}, categoryScores: {} };
    }

    return {
      flagged: result.flagged,
      categories: result.categories || {},
      categoryScores: result.category_scores || {},
    };
  } catch (error) {
    // Network error, timeout, etc. — fail open.
    logger.error("[ModerationService] Failed to call OpenAI API:", error);
    return {
      flagged: false,
      categories: {},
      categoryScores: {},
    };
  }
}