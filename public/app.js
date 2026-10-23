// Celebration AI — frontend. Renders the plan form and results, calls
// POST /api/plan, and implements the budget rebalancer (the app's twist)
// entirely client-side with no AI call. See server/index.js for the API.

// Never suggest cutting more than this share of any single budget
// category — keeps rebalance suggestions sane instead of zeroing one out.
const REBALANCE_MAX_CUT_RATIO = 0.4;

// ---------- Sample / demo data (works with zero API key) ----------
const DEMO_INPUT = {
  eventType: "Wedding",
  description: "A warm, traditional wedding reception for 150 guests in Coimbatore, mid-December. Not too flashy, but memorable for the family.",
  budget: 300000,
  guests: 150,
  city: "Coimbatore",
  date: "2026-12-14"
};

const DEMO_PLAN = {
  summary: "A 150-guest traditional wedding reception in Coimbatore, balancing warmth and simplicity within a ₹3,00,000 budget.",
  budgetBreakdown: [
    { category: "Venue", amount: 90000 },
    { category: "Catering", amount: 90000 },
    { category: "Decor", amount: 40000 },
    { category: "Photography", amount: 35000 },
    { category: "Attire & Jewellery", amount: 25000 },
    { category: "Invitations & Misc", amount: 20000 }
  ],
  timeline: [
    { when: "8 weeks before", what: "Finalize venue, lock the date with the priest/officiant, send save-the-dates." },
    { when: "6 weeks before", what: "Book caterer and finalize the menu tasting; confirm guest count." },
    { when: "4 weeks before", what: "Book photographer/videographer; order invitations and start distributing." },
    { when: "2 weeks before", what: "Confirm decor theme and vendor timings; finalize seating plan." },
    { when: "3 days before", what: "Vendor reconfirmation calls; prep welcome kits for out-of-town guests." },
    { when: "Event day", what: "Arrive 3 hours early for decor setup; assign one family member per vendor as point of contact." }
  ],
  vendors: [
    { name: "Wedding hall / venue", note: "Visit 2-3 options, confirm power backup and parking." },
    { name: "Caterer", note: "Ask for a tasting session; confirm per-plate rate includes service." },
    { name: "Decorator", note: "Share reference photos; get a written quote with teardown time." },
    { name: "Photographer/videographer", note: "Check sample full-wedding albums, not just highlight reels." },
    { name: "Priest / officiant", note: "Confirm muhurtham timing well in advance." },
    { name: "Transport for guests", note: "Needed if venue is outside the city center." }
  ],
  ideas: [
    "Welcome drinks station with regional specialities as guests arrive",
    "A small photo corner with family heirlooms or old wedding photos",
    "Return gifts sourced from local artisans to keep costs down",
    "Live acoustic music during dinner instead of a full band"
  ]
};

// ---------- State ----------
let selectedType = "Wedding";
let currentBudgetTotal = 0;
let currentRows = []; // {category, amount}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const chipsWrap = $("eventChips");
const descEl = $("description");
const budgetEl = $("budget");
const guestsEl = $("guests");
const cityEl = $("city");
const dateEl = $("date");
const generateBtn = $("generateBtn");
const demoBtn = $("demoBtn");
const loading = $("loading");
const loadingText = $("loadingText");
const errorBox = $("errorBox");
const results = $("results");
const emptyState = $("emptyState");
const sourceBadge = $("sourceBadge");

chipsWrap.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  [...chipsWrap.children].forEach((c) => {
    c.classList.remove("active");
    c.setAttribute("aria-pressed", "false");
  });
  btn.classList.add("active");
  btn.setAttribute("aria-pressed", "true");
  selectedType = btn.dataset.type;
});

demoBtn.addEventListener("click", () => {
  selectedType = DEMO_INPUT.eventType;
  descEl.value = DEMO_INPUT.description;
  budgetEl.value = DEMO_INPUT.budget;
  guestsEl.value = DEMO_INPUT.guests;
  cityEl.value = DEMO_INPUT.city;
  dateEl.value = DEMO_INPUT.date;
  [...chipsWrap.children].forEach((c) => {
    const isActive = c.dataset.type === selectedType;
    c.classList.toggle("active", isActive);
    c.setAttribute("aria-pressed", String(isActive));
  });
  renderPlan(DEMO_PLAN, { budget: DEMO_INPUT.budget, source: "demo" });
});

generateBtn.addEventListener("click", generatePlan);

/**
 * Reads the form, calls POST /api/plan, and renders the result. On any
 * failure (network error, non-OK response, backend-signaled error) it
 * falls back to the same sample plan used by "Try Demo" instead of
 * leaving the user with a blank screen.
 * @returns {Promise<void>}
 */
async function generatePlan() {
  const description = descEl.value.trim();
  const budget = Number(budgetEl.value) || 0;

  errorBox.classList.remove("show");
  errorBox.textContent = "";

  if (!description) {
    errorBox.textContent = "Please describe your event first — a sentence or two is enough.";
    errorBox.classList.add("show");
    return;
  }

  loading.classList.add("show");
  loadingText.textContent = "Generating your plan…";
  generateBtn.disabled = true;
  results.classList.remove("show");
  emptyState.style.display = "none";

  const payload = {
    eventType: selectedType,
    description,
    budget,
    guests: Number(guestsEl.value) || 0,
    city: cityEl.value.trim(),
    date: dateEl.value
  };

  try {
    const resp = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (!resp.ok || data.error) {
      throw new Error(data.error || "Could not generate a plan right now.");
    }

    renderPlan(data.plan, { budget, source: data.source || "live" });
  } catch (err) {
    console.warn("Falling back to sample plan:", err.message);
    errorBox.textContent = "We couldn't reach the AI right now, so here's a sample plan for your event type. Your inputs weren't lost — try again anytime.";
    errorBox.classList.add("show");
    renderPlan(DEMO_PLAN, { budget: budget || DEMO_INPUT.budget, source: "fallback" });
  } finally {
    loading.classList.remove("show");
    generateBtn.disabled = false;
  }
}

// ---------- Render ----------
/**
 * Renders a full plan (live, demo, or fallback) into the results panel:
 * source badge, budget, timeline, vendors, and ideas.
 * @param {{budgetBreakdown: Array, timeline: Array, vendors: Array, ideas: Array}} plan
 * @param {{budget: number, source: "live"|"demo"|"fallback"}} meta
 */
function renderPlan(plan, { budget, source }) {
  results.classList.add("show");
  emptyState.style.display = "none";

  sourceBadge.textContent = source === "live" ? "Live · Gemini" : source === "demo" ? "Demo" : "Sample (offline)";
  sourceBadge.className = "badge " + (source === "live" ? "live" : "demo");

  currentBudgetTotal = budget || plan.budgetBreakdown.reduce((s, r) => s + r.amount, 0);
  currentRows = plan.budgetBreakdown.map((r) => ({ category: r.category, amount: r.amount }));

  renderBudget();
  renderTimeline(plan.timeline || []);
  renderVendors(plan.vendors || []);
  renderIdeas(plan.ideas || []);

  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Formats a number as an Indian-grouped rupee amount (e.g. 150000 -> "₹1,50,000").
 * @param {number} n
 * @returns {string}
 */
function fmtMoney(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/**
 * Renders the editable budget-category rows from `currentRows` against
 * `currentBudgetTotal`, wires each amount input to live-update its own bar
 * and percentage, and re-checks for an over-budget state after every edit.
 */
function renderBudget() {
  $("budgetTotalAmt").textContent = fmtMoney(currentBudgetTotal);
  const wrap = $("budgetRows");
  wrap.innerHTML = "";

  const spent = currentRows.reduce((s, r) => s + r.amount, 0);

  currentRows.forEach((row, idx) => {
    const pct = currentBudgetTotal > 0 ? (row.amount / currentBudgetTotal) * 100 : 0;
    const over = spent > currentBudgetTotal && currentBudgetTotal > 0;
    const div = document.createElement("div");
    div.className = "budget-row";
    div.innerHTML = `
<div class="cat">${row.category}</div>
<div class="bar-track"><div class="bar-fill ${over ? "over" : ""}" style="width:${Math.min(pct, 100)}%"></div></div>
<input class="amt-input" type="number" min="0" value="${row.amount}" data-idx="${idx}">
<div class="pct">${pct.toFixed(0)}%</div>
`;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll(".amt-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      currentRows[idx].amount = Number(e.target.value) || 0;
      checkOverBudget();

      // re-render bars/percentages without losing focus
      const spentNow = currentRows.reduce((s, r) => s + r.amount, 0);
      const overNow = spentNow > currentBudgetTotal && currentBudgetTotal > 0;
      [...wrap.querySelectorAll(".budget-row")].forEach((rowEl, i) => {
        const pct = currentBudgetTotal > 0 ? (currentRows[i].amount / currentBudgetTotal) * 100 : 0;
        rowEl.querySelector(".bar-fill").style.width = Math.min(pct, 100) + "%";
        rowEl.querySelector(".bar-fill").classList.toggle("over", overNow);
        rowEl.querySelector(".pct").textContent = pct.toFixed(0) + "%";
      });
    });
  });

  checkOverBudget();
}

// ---------- Budget Rebalancer (the twist) ----------
/**
 * Compares total spend against the budget; when over, computes and shows a
 * rebalance suggestion (via computeRebalance) with a one-click "Apply"
 * action. Hides the rebalance panel when back within budget.
 */
function checkOverBudget() {
  const rebalanceBox = $("rebalanceBox");
  const spent = currentRows.reduce((s, r) => s + r.amount, 0);
  const over = spent - currentBudgetTotal;

  if (over <= 0 || currentBudgetTotal <= 0) {
    rebalanceBox.classList.remove("show");
    return;
  }

  const suggestion = computeRebalance(currentRows, over);
  const list = $("rebalanceList");
  list.innerHTML = "";
  suggestion.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s.category}: ${fmtMoney(s.from)} → ${fmtMoney(s.to)} (cut ${fmtMoney(s.from - s.to)})`;
    list.appendChild(li);
  });

  rebalanceBox.classList.add("show");

  $("applyRebalance").onclick = () => {
    suggestion.forEach((s) => {
      const row = currentRows.find((r) => r.category === s.category);
      if (row) row.amount = s.to;
    });
    renderBudget();
  };
}

/**
 * Deterministic, client-side budget rebalancer (the app's original twist).
 * Cuts proportionally from every category, weighted by its own share of
 * total spend, capped at 40% of any single category so no line item is
 * ever zeroed out. Pure function — same inputs always give the same
 * suggestion, and it never calls the AI.
 * @param {Array<{category: string, amount: number}>} rows
 * @param {number} overAmount - amount currently over budget.
 * @returns {Array<{category: string, from: number, to: number}>}
 */
function computeRebalance(rows, overAmount) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total <= 0) return [];

  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  let remaining = overAmount;
  const cuttable = sorted.filter((r) => r.amount > 0);
  const weightTotal = cuttable.reduce((s, r) => s + r.amount, 0);

  const suggestion = [];
  cuttable.forEach((row, idx) => {
    const isLast = idx === cuttable.length - 1;
    let cut = isLast ? remaining : Math.round((row.amount / weightTotal) * overAmount);
    cut = Math.min(cut, Math.round(row.amount * REBALANCE_MAX_CUT_RATIO));
    cut = Math.max(cut, 0);
    remaining -= cut;
    if (cut > 0) {
      suggestion.push({ category: row.category, from: row.amount, to: row.amount - cut });
    }
  });

  return suggestion;
}

/**
 * Renders the timeline section as a list of "when / what" rows.
 * @param {Array<{when: string, what: string}>} items
 */
function renderTimeline(items) {
  const wrap = $("timelineRows");
  wrap.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "timeline-item";
    div.innerHTML = `<div class="timeline-when">${item.when}</div><div class="timeline-what">${item.what}</div>`;
    wrap.appendChild(div);
  });
}

/**
 * Renders the vendor checklist as checkable rows, each with a name and a
 * practical note.
 * @param {Array<{name: string, note?: string}>} items
 */
function renderVendors(items) {
  const wrap = $("vendorRows");
  wrap.innerHTML = "";
  items.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "vendor-row";
    div.innerHTML = `
<input type="checkbox" id="vendor-${i}">
<label for="vendor-${i}">
<div class="vname">${item.name}</div>
<div class="vnote">${item.note || ""}</div>
</label>
`;
    wrap.appendChild(div);
  });
}

/**
 * Renders the personalized-ideas pills. Idea text is HTML-escaped before
 * insertion since it originates from the Gemini response.
 * @param {string[]} items
 */
function renderIdeas(items) {
  const wrap = $("ideaRows");
  wrap.innerHTML = "";
  items.forEach((idea) => {
    const span = document.createElement("span");
    span.className = "idea-pill";
    span.innerHTML = '<span aria-hidden="true">💡</span> ' + idea.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    wrap.appendChild(span);
  });
}
