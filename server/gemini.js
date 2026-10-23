/**
 * @fileoverview Google Gemini 2.0 Flash REST API integration and graceful fallback generator.
 * Uses zero external dependencies (Node.js built-in fetch and AbortController).
 */

const { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT_MS } = require('./config');
const { isValidPlanShape } = require('./validate');

/**
 * Builds the exact production prompt template specified in PROMPTS.md.
 * @param {object} params - Event parameters.
 * @returns {string} Prompt string.
 */
function buildPrompt({ description, eventType, budget, guests, city, date, currency }) {
  return `You are an expert event planning assistant. A user wants help planning a celebration.

Event description: "${description}"
Event type: ${eventType}
Total budget: ${budget} ${currency}
Guest count: ${guests}
City: ${city}
Event date: ${date}

Generate a complete event plan as STRICT JSON with exactly this shape (no markdown, no commentary, JSON only):

{
  "budget": {
    "total": ${budget},
    "categories": [
      { "name": "<category>", "amount": <number>, "notes": "<short note>" }
    ]
  },
  "timeline": [
    { "when": "<e.g. '6 weeks before'>", "what": "<task description>" }
  ],
  "vendors": [
    { "name": "<vendor/task name>", "note": "<short practical note>" }
  ],
  "ideas": [
    "<one personalized idea referencing the user's own description>"
  ]
}

Rules:
1. Budget category amounts MUST sum to exactly the stated total budget.
2. Include 5-8 budget categories appropriate to the event type.
3. Timeline must have 6-10 entries, ordered from furthest-out to closest to the event date.
4. Vendor checklist must have 6-10 realistic, actionable entries.
5. Ideas must be 4-6 entries and must reference specific details from the user's description — not generic event advice.
6. Return ONLY the JSON object. No markdown fences, no explanation, no leading or trailing text.`;
}

/**
 * Generates an adapted, high-fidelity fallback plan matching the exact schema.
 * @param {object} input - User event input.
 * @returns {object} Valid complete plan object.
 */
function getFallbackPlan(input) {
  const total = Number(input.budget) || 1500000;
  const guests = Number(input.guests) || 250;
  const city = input.city || 'Jaipur';
  const desc = input.description || 'Family celebration';

  // Proportional breakdown summing exactly to stated total
  const percentages = [
    { name: 'Catering & Dining', pct: 0.40, notes: `Buffet & feast for ${guests} guests in ${city}` },
    { name: 'Venue & Banquet Hall', pct: 0.20, notes: 'Hall rental, seating, basic power backup' },
    { name: 'Decor & Lighting', pct: 0.15, notes: 'Stage backdrop, entrance arch, ambient lighting' },
    { name: 'Photography & Video', pct: 0.10, notes: 'Candid photography and cinematic highlight reel' },
    { name: 'Music, Sound & DJ', pct: 0.08, notes: 'Sound system, mic setup, and music controller' },
    { name: 'Contingency & Logistics', pct: 0.07, notes: 'Guest welcome gifts, transport buffer, emergency fund' }
  ];

  let runningSum = 0;
  const categories = percentages.map((cat, idx) => {
    let amount;
    if (idx === percentages.length - 1) {
      amount = total - runningSum;
    } else {
      amount = Math.round((total * cat.pct) / 1000) * 1000;
      runningSum += amount;
    }
    return {
      name: cat.name,
      amount,
      notes: cat.notes
    };
  });

  return {
    budget: {
      total,
      categories
    },
    timeline: [
      { when: '8 weeks before', what: `Finalize venue in ${city} and lock food tasting with caterer` },
      { when: '6 weeks before', what: `Send digital WhatsApp invitations for ${guests} guests and track RSVPs` },
      { when: '4 weeks before', what: 'Confirm photographer deliverables, song playlist, and event schedule' },
      { when: '2 weeks before', what: 'Finalize headcount with caterer and review generator power backup' },
      { when: '1 week before', what: 'Designate family point persons for vendor payments and guest arrivals' },
      { when: '1 day before', what: 'Rehearse ceremony timeline and inspect floral stage setup' },
      { when: 'Event Day', what: 'Execute welcome rituals, coordinate photography, and celebrate with guests' }
    ],
    vendors: [
      { name: 'Venue Coordinator', note: 'Verify diesel generator backup inclusion and clear sound curfew timing' },
      { name: 'Head Caterer', note: `Lock per-plate pricing for ${guests} pax in writing; confirm live counter timings` },
      { name: 'Decorator & Florist', note: 'Specify seasonal local flowers to avoid premium transport markups' },
      { name: 'Photographer / Videographer', note: 'Lock delivery deadline for raw reels (within 10 days) and teaser video' },
      { name: 'Sound / DJ Lead', note: 'Confirm acoustic permits and review venue power load capacity' },
      { name: 'Logistics Lead', note: 'Designate family payment coordinator with daily petty cash buffer' }
    ],
    ideas: [
      `Bulk source marigold and jasmine flowers directly from ${city}'s local mandi at dawn to cut decor cost by 40%`,
      'Place a customized QR code on every dining table linking to a shared drive for guests to upload candid photos',
      'Serve warm regional Kulhad Chai and local snacks at the welcome desk instead of costly packaged mocktails',
      'Create an animated video invitation with a Google Maps location pin to save printing and courier expenses',
      `Tailored to your note: "${desc.slice(0, 60)}..." — assign designated family leads for ritual coordination`
    ]
  };
}

/**
 * Strips markdown formatting fences and leading/trailing chatter from model output.
 * @param {string} text - Raw model output text.
 * @returns {string} Clean JSON string.
 */
function cleanModelResponse(text) {
  if (!text) return '';
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned.trim();
}

/**
 * Generates an event plan via Gemini 2.0 Flash or graceful fallback.
 * Guaranteed never to throw or return a blank response.
 * @param {object} input - Validated event input parameters.
 * @returns {Promise<object>} Complete plan with source indicator.
 */
async function generatePlan(input) {
  // If no API key configured, return adapted fallback immediately
  if (!GEMINI_API_KEY) {
    const fallback = getFallbackPlan(input);
    return { ...fallback, source: 'fallback' };
  }

  const prompt = buildPrompt(input);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Empty candidate text from Gemini');
    }

    const cleaned = cleanModelResponse(candidateText);
    const parsed = JSON.parse(cleaned);

    if (!isValidPlanShape(parsed)) {
      throw new Error('Gemini response failed shape validation');
    }

    return { ...parsed, source: 'gemini' };
  } catch (err) {
    clearTimeout(timeoutId);
    // Every failure path funnels here; never to the browser as a stack trace
    return { ...getFallbackPlan(input), source: 'fallback' };
  }
}

module.exports = {
  buildPrompt,
  getFallbackPlan,
  cleanModelResponse,
  generatePlan
};
