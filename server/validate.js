// Input validation and sanitization for POST /api/plan. This is the single
// choke point where untrusted client input is type-checked, length-capped,
// and numerically bounded before it is interpolated into the Gemini prompt.
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_FREEFORM_LENGTH,
  MAX_BUDGET,
  MAX_GUESTS
} from "./config.js";

const ALLOWED_EVENT_TYPES = new Set([
  "Wedding", "Birthday", "Community Event", "Anniversary", "Housewarming"
]);

/**
 * Coerces a value to a trimmed string capped at maxLength. Non-strings
 * become an empty string rather than throwing, so a malformed payload can
 * never crash validation.
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
function clampString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/**
 * Coerces a value to a finite, non-negative number capped at max.
 * Anything non-numeric or negative becomes 0 rather than NaN or a
 * negative amount reaching the prompt.
 * @param {unknown} value
 * @param {number} max
 * @returns {number}
 */
function clampNumber(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/**
 * Validates and sanitizes an incoming /api/plan request body.
 * Returns { ok: true, data } or { ok: false, error }.
 * This is the single point where untrusted client input is shaped before
 * it is interpolated into the prompt sent to Gemini, and before it is
 * echoed back in error logs.
 */
export function validatePlanRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const description = clampString(payload.description, MAX_DESCRIPTION_LENGTH);
  if (!description) {
    return { ok: false, error: "Please describe your event." };
  }

  const rawEventType = clampString(payload.eventType, MAX_FREEFORM_LENGTH);
  const eventType = ALLOWED_EVENT_TYPES.has(rawEventType) ? rawEventType : "Event";

  return {
    ok: true,
    data: {
      eventType,
      description,
      budget: clampNumber(payload.budget, MAX_BUDGET),
      guests: clampNumber(payload.guests, MAX_GUESTS),
      city: clampString(payload.city, MAX_FREEFORM_LENGTH),
      date: clampString(payload.date, 40)
    }
  };
}
