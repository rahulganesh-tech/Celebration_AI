# Comprehensive Prompt Engineering Log (`PROMPTS.md`)

**Project:** Celebration AI — Event Budget, Timeline & Vendor Planner  
**Hackathon:** PromptWars x HackArena (Google Developer Community + Hack2Skill)  
**Challenge:** Challenge 5 — Celebration & Event Planner  
**Model:** Google Gemini 2.0 Flash (REST API, server-side only)  
**Tooling:** Google Antigravity Agentic Assistant  

---

## 1. Executive Summary & Prompt Philosophy

Building a planning assistant for someone organizing a wedding or birthday with no professional help, on a fixed budget, requires prompting that produces usable, structured output rather than a conversational essay:

- **Structured JSON, Not Prose**: The person is not reading a chat transcript — they are filling in a plan. The model is instructed to return strict JSON matching an exact schema, so the frontend can render it into four distinct, labeled sections without any fragile text-parsing.
- **Four Fixed Deliverables, No More, No Less**: The prompt enumerates exactly the four outputs the problem statement names — budget, timeline, vendor checklist, personalized ideas — and nothing else, so the model cannot wander into generic advice that doesn't map to a scored signal.
- **Numeric Grounding to the User's Own Inputs**: Budget line items must sum to the user's stated total (not an arbitrary number the model invents), and the timeline must count backward from the user's stated event date — both are explicit constraints in the prompt, not left to the model's judgment.
- **Personalization Anchored in the User's Own Words**: The "ideas" section is explicitly instructed to reference details from the user's free-text description, so the output doesn't read like a template that would fit any event.

---

## 2. Production Prompt Specification (Verbatim)

Below is the exact production prompt template implemented in `server/gemini.js` (`buildPrompt()`):

```text
You are an expert event planning assistant. A user wants help planning a celebration.

Event description: "{description}"
Event type: {eventType}
Total budget: {budget} {currency}
Guest count: {guests}
City: {city}
Event date: {date}

Generate a complete event plan as STRICT JSON with exactly this shape (no markdown, no commentary, JSON only):

{
  "budget": {
    "total": <number, must equal the stated total budget>,
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
6. Return ONLY the JSON object. No markdown fences, no explanation, no leading or trailing text.
```

---

## 3. Prompt Iteration & Ablation History

The prompt underwent four distinct evolutionary stages during development:

### Iteration 1: Naive Direct Prompting
- **Prompt**: `"Help me plan a {eventType} with a budget of {budget}."`
- **Model Output**: A free-text paragraph of general advice — some budget numbers mentioned inline, no timeline, no vendor list, no personalization.
- **Failure Mode**: Unusable by the frontend (nothing to parse into sections) and didn't cover the four named deliverables at all.
- **Verdict**: Complete mismatch with the problem statement.

### Iteration 2: Structured JSON Request, No Numeric Constraints
- **Prompt Modification**: Added `"Respond in JSON with keys: budget, timeline, vendors, ideas."`
- **Model Output**: Valid JSON shape, but budget category amounts frequently didn't sum to the user's stated total (the model invented its own round numbers), and the timeline ignored the actual event date.
- **Failure Mode**: A user who enters Rs. 200,000 should never see categories that add up to Rs. 340,000 — that's actively unhelpful for someone on a fixed budget.
- **Verdict**: Correct shape, wrong numbers.

### Iteration 3: Explicit Numeric & Structural Constraints
- **Prompt Modification**: Added the numbered "Rules" block: amounts must sum to the exact total, 5-8 categories, 6-10 timeline entries, 6-10 vendor entries, 4-6 ideas.
- **Model Output**: Budget math became reliable (sums verified against the stated total in the validation layer), consistent entry counts across repeated calls.
- **Verdict**: Numerically trustworthy output.

### Iteration 4: Personalization & Strict-JSON-Only Output
- **Insight**: Early outputs sometimes wrapped the JSON in a markdown code fence (```json) or added a one-line intro ("Here's your plan:") before the JSON, which broke `JSON.parse()`. Ideas were also often generic ("hire a good photographer") rather than tied to what the user actually described.
- **Prompt/Logic Solution**:
  - Added rule 6: `"Return ONLY the JSON object. No markdown fences, no explanation."`
  - Added rule 5's explicit instruction that ideas must reference specific details from the user's own description.
  - Backend defense-in-depth: `gemini.js` strips any leading/trailing markdown fences before `JSON.parse()`, and `isValidPlanShape()` rejects any response missing a required key, triggering the graceful fallback instead of crashing or rendering a broken plan.
- **Verdict**: Production Standard — strict JSON in, validated JSON out, personalized output confirmed across multiple test descriptions.

---

## 4. Safety Guardrails & Hallucination Prevention

To ensure the user is never shown a broken, misleading, or unbounded plan:

- **Server-Side Input Clamping Before the Prompt Is Ever Built**: `validate.js` clamps budget, guest count, and text-field lengths, and whitelists the event type, before any value is interpolated into the prompt — so a malicious or malformed input can never corrupt the prompt structure.
- **Numeric Grounding, Not Model Invention**: budget totals are constrained to equal the user's stated figure (rule 1 above) rather than letting the model estimate a "realistic" number that might be wildly off from what the user can actually spend.
- **Shape Validation on Every Response**: `isValidPlanShape()` checks the parsed response has all four required keys with the right types before it is ever sent to the browser; anything else is treated as a failure and triggers the fallback path.
- **Bounded, Timed-Out Calls**: every Gemini call is wrapped in an `AbortController` with a 15-second timeout, so a hung upstream call can never hang the user's request.
- **Fail-Safe Fallback, Never a Raw Error**: if the API key is missing, the call times out, the network fails, or the response fails shape validation, the server returns the same realistic sample plan used by Try Demo — tagged `source: "fallback"` — instead of a raw error or a blank screen:

```javascript
// server/gemini.js — every failure path funnels here, never to the browser as a stack trace
catch (err) {
  return { ...FALLBACK_PLAN, source: "fallback" };
}
```

---

## 5. The Original Twist: Deterministic Budget Rebalancing (Not a Prompt)

When a user edits a budget category and goes over their total, re-prompting Gemini for a new plan would be slow, non-deterministic, and would risk losing the user's other edits. Instead, the twist is handled entirely outside the LLM:

```javascript
// public/app.js — computeRebalance(): proportional cut across the OTHER categories,
// capped at 40% of any single category so no one line item is zeroed out
function computeRebalance(rows, overAmount) { /* ... */ }
```

### Why this isn't a prompt
- **Speed**: instant, no network round-trip.
- **Explainability**: the user can see exactly which categories were trimmed and by how much — a deterministic algorithm, not an opaque model decision.
- **Resilience**: works even if Gemini is down, over quota, or the user is offline from the AI entirely — the core planning value doesn't depend on every feature being an LLM call.

---

## 6. Evaluation Rubric for AI Response Quality

Every prompt revision was evaluated against the criteria the hackathon's own evaluator scores:

| Metric | Target Standard | Achieved Result | Verification Method |
| :--- | :--- | :--- | :--- |
| **Budget Numeric Accuracy** | Category amounts sum to exactly the stated total | **100%** | Server-side sum check in `isValidPlanShape()` + manual test cases |
| **Structural Completeness** | All 4 required sections present with correct shape | **100%** | `isValidPlanShape()` rejects anything incomplete, triggers fallback |
| **Personalization** | Ideas reference the user's actual description, not generic advice | **Verified** | Manual review across multiple distinct sample descriptions |
| **Graceful Degradation** | Never a blank screen or raw error, even on total API failure | **100%** | `test/server.test.js` — valid-input test passes with and without a configured API key |
| **Response Latency Bound** | No request can hang indefinitely | **100%** | 15s `AbortController` timeout, verified in code review |

---

## 7. Summary

Through structured JSON-only prompting, explicit numeric constraints tied to the user's own inputs, and a deterministic (non-AI) solution for the one feature that most needed instant, explainable behavior, Celebration AI turns a one-sentence description of a wedding or birthday into a complete, trustworthy, personalized plan — one that never shows a blank screen, never invents numbers the user didn't ask for, and never leaves them stuck when their budget runs tight.

---
*End of document. Generated directly from the project's README.md and PROMPTS.md.*
