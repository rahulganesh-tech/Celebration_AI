/**
 * @fileoverview Input validation, sanitization, clamping, and response shape validation.
 */

/**
 * Valid event types allowed in the system.
 */
const ALLOWED_EVENT_TYPES = [
  'wedding',
  'birthday',
  'anniversary',
  'community',
  'traditional wedding',
  'milestone birthday',
  'anniversary gala',
  'community festival',
  'celebration'
];

/**
 * Clamps a number to a bounded range, safely replacing NaN or non-finite inputs.
 * @param {any} val - Value to parse and clamp.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @param {number} defaultVal - Default fallback if input is NaN or invalid.
 * @returns {number} Clamped numeric value.
 */
function clampNumber(val, min, max, defaultVal) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return defaultVal;
  }
  if (num < min) return min;
  if (num > max) return max;
  return Math.round(num);
}

/**
 * Validates and clamps all fields of an event planning request.
 * @param {object} payload - Incoming request body.
 * @returns {{ valid: boolean, error?: string, data?: object }} Validation result.
 */
function validatePlanInput(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const rawDescription = payload.description || payload.prompt || '';
  if (typeof rawDescription !== 'string' || !rawDescription.trim()) {
    return { valid: false, error: 'Description is required' };
  }

  // Length-capped and trimmed description (1000 characters max)
  const description = rawDescription.trim().slice(0, 1000);

  // Clamped budget (min: 10,000, max: 100,000,000; default: 1,500,000)
  const budget = clampNumber(payload.budget || payload.totalBudget, 10000, 100000000, 1500000);

  // Clamped guests (min: 5, max: 50,000; default: 250)
  const guests = clampNumber(payload.guests || payload.guestCount, 5, 50000, 250);

  // Sanitized event type
  const rawType = typeof payload.eventType === 'string' ? payload.eventType.trim().toLowerCase() : '';
  const isAllowed = ALLOWED_EVENT_TYPES.some((t) => rawType.includes(t));
  const eventType = isAllowed && payload.eventType ? String(payload.eventType).trim().slice(0, 80) : 'Celebration';

  // Sanitized city
  const rawCity = typeof (payload.city || payload.location) === 'string' ? (payload.city || payload.location).trim() : 'Local';
  const city = rawCity.slice(0, 100) || 'Local';

  // Sanitized date
  const rawDate = typeof payload.date === 'string' ? payload.date.trim() : 'Upcoming';
  const date = rawDate.slice(0, 50) || 'Upcoming';

  const currency = typeof payload.currency === 'string' && payload.currency.trim() ? payload.currency.trim().slice(0, 5) : '₹';

  return {
    valid: true,
    data: {
      description,
      eventType,
      budget,
      guests,
      city,
      date,
      currency
    }
  };
}

/**
 * Validates that an AI or fallback response matches the required 4-deliverable schema.
 * @param {any} plan - Object to check.
 * @returns {boolean} True if plan shape is strictly valid.
 */
function isValidPlanShape(plan) {
  if (!plan || typeof plan !== 'object') return false;

  // 1. Budget breakdown check
  if (!plan.budget || typeof plan.budget !== 'object') return false;
  if (typeof plan.budget.total !== 'number' || plan.budget.total <= 0) return false;
  if (!Array.isArray(plan.budget.categories) || plan.budget.categories.length < 3) return false;

  for (const cat of plan.budget.categories) {
    if (!cat || typeof cat !== 'object') return false;
    if (typeof cat.name !== 'string' || !cat.name.trim()) return false;
    if (typeof cat.amount !== 'number' || cat.amount < 0) return false;
  }

  // 2. Timeline check
  if (!Array.isArray(plan.timeline) || plan.timeline.length < 3) return false;
  for (const item of plan.timeline) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.when !== 'string' || typeof item.what !== 'string') return false;
  }

  // 3. Vendors check
  if (!Array.isArray(plan.vendors) || plan.vendors.length < 3) return false;
  for (const item of plan.vendors) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.name !== 'string' || typeof item.note !== 'string') return false;
  }

  // 4. Ideas check
  if (!Array.isArray(plan.ideas) || plan.ideas.length < 2) return false;
  for (const idea of plan.ideas) {
    if (typeof idea !== 'string' || !idea.trim()) return false;
  }

  return true;
}

module.exports = {
  clampNumber,
  validatePlanInput,
  isValidPlanShape
};
