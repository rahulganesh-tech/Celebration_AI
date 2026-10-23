// Builds the event-planning prompt and calls the Gemini API server-side.
// The API key never leaves this module — see server/index.js's module layout
// comment for how requests reach this file.
import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  GEMINI_TEMPERATURE,
  GEMINI_ERROR_SNIPPET_LENGTH
} from "./config.js";

/**
 * Builds the prompt sent to Gemini. Pure function, no I/O — easy to unit
 * test and to reproduce outside the server (see PROMPTS.md).
 */
export function buildPrompt({ eventType, description, budget, guests, city, date }) {
  return `You are an expert Indian event planner. A user wants help planning their event.

Event type: ${eventType}
Description: ${description}
Total budget (INR): ${budget || "not specified"}
Guest count: ${guests || "not specified"}
City: ${city || "not specified"}
Date: ${date || "not specified"}

Return ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:
{
  "summary": "one sentence summary of the plan",
  "budgetBreakdown": [{"category": "string", "amount": number}],
  "timeline": [{"when": "string", "what": "string"}],
  "vendors": [{"name": "string", "note": "string"}],
  "ideas": ["string", "string", "string", "string"]
}

Rules:
- budgetBreakdown amounts must be realistic for an Indian ${city || "Indian"} ${eventType}, in INR, and should sum to approximately the total budget if one was given.
- Include 5-7 budget categories, 5-7 timeline milestones (counting backward from the event date if given), 5-7 vendor checklist items, and 4-6 personalized ideas that reference specifics from the description.
- Keep language simple and practical, as if advising a family with no professional planner.`;
}

/**
 * Checks that a parsed Gemini response has every required array field with
 * at least one entry. Anything that fails this is treated as a failure and
 * routed to the fallback plan, never rendered as-is.
 * @param {unknown} plan
 * @returns {boolean}
 */
function isValidPlanShape(plan) {
  return (
    plan &&
    Array.isArray(plan.budgetBreakdown) && plan.budgetBreakdown.length > 0 &&
    Array.isArray(plan.timeline) && plan.timeline.length > 0 &&
    Array.isArray(plan.vendors) && plan.vendors.length > 0 &&
    Array.isArray(plan.ideas)
  );
}

/**
 * Calls the Gemini API server-side and returns a validated plan object.
 * Throws on any failure (missing key, network error, timeout, malformed
 * response) — callers are expected to catch and fall back gracefully.
 * Never called from, and never exposes the API key to, the browser.
 */
export async function callGemini(payload) {
  if (!GEMINI_API_KEY) {
    throw new Error("No Gemini API key configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = buildPrompt(payload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: GEMINI_TEMPERATURE, responseMimeType: "application/json" }
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Gemini API timed out after ${GEMINI_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Gemini API error ${resp.status}: ${text.slice(0, GEMINI_ERROR_SNIPPET_LENGTH)}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  const plan = JSON.parse(cleaned);

  if (!isValidPlanShape(plan)) {
    throw new Error("Malformed plan shape from Gemini");
  }

  return plan;
}
