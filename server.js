require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Google Gemini AI client if API key is present
const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
let aiClient = null;

if (geminiApiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey: geminiApiKey });
    console.log('[Celebration AI] Google Gemini client initialized successfully with API key.');
  } catch (err) {
    console.error('[Celebration AI] Failed to initialize GoogleGenAI client:', err.message);
  }
} else {
  console.log('[Celebration AI] Running in offline demo mode. GEMINI_API_KEY not configured.');
}

// Load baseline demo plan
let samplePlan = null;
try {
  const data = fs.readFileSync(path.join(__dirname, 'sample-data.json'), 'utf8');
  samplePlan = JSON.parse(data);
} catch (err) {
  console.error('[Celebration AI] Error loading sample-data.json:', err.message);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Celebration AI',
    hasGeminiKey: Boolean(geminiApiKey),
    timestamp: new Date().toISOString()
  });
});

// Sample baseline data endpoint
app.get('/api/sample', (req, res) => {
  if (samplePlan) {
    res.json(samplePlan);
  } else {
    res.status(500).json({ error: 'Sample plan not found' });
  }
});

// Helper function to build adapted plan from sample
function getAdaptedSamplePlan(body) {
  const { prompt, totalBudget, guestCount, eventType, location } = body || {};
  const plan = JSON.parse(JSON.stringify(samplePlan));

  if (totalBudget && Number(totalBudget) > 0) {
    const budgetNum = Number(totalBudget);
    const oldTotal = plan.meta.totalBudget || 1500000;
    const ratio = budgetNum / oldTotal;
    plan.meta.totalBudget = budgetNum;

    let sum = 0;
    plan.budgetBreakdown = plan.budgetBreakdown.map((item, idx) => {
      if (idx === plan.budgetBreakdown.length - 1) {
        item.amount = Math.max(10000, budgetNum - sum);
      } else {
        item.amount = Math.round((item.amount * ratio) / 1000) * 1000;
        sum += item.amount;
      }
      item.percentage = Math.round((item.amount / budgetNum) * 100);
      return item;
    });
  }

  if (guestCount && Number(guestCount) > 0) {
    plan.meta.guestCount = Number(guestCount);
  }
  if (eventType && eventType.trim()) {
    plan.meta.eventType = eventType.trim();
  }
  if (location && location.trim()) {
    plan.meta.location = location.trim();
  }
  if (prompt && prompt.trim()) {
    plan.meta.eventName = prompt.length > 55 ? prompt.substring(0, 55) + '...' : prompt;
  }

  plan._source = 'offline-demo-engine';
  return plan;
}

// Core plan generator endpoint
app.post('/api/plan', async (req, res) => {
  const { prompt, totalBudget, guestCount, eventType, location, isDemo } = req.body || {};

  // If explicit demo requested or no Gemini client configured, return adapted sample immediately
  if (isDemo || !aiClient) {
    return res.json(getAdaptedSamplePlan(req.body));
  }

  // Live Gemini API call
  try {
    const budgetVal = Number(totalBudget) || 1500000;
    const guestsVal = Number(guestCount) || 250;
    const cityVal = location || 'India';
    const typeVal = eventType || 'Celebration';

    const systemPrompt = `You are Celebration AI, an expert event & wedding planning assistant built for middle-class Indian families.
Target User: An Indian family organizing an event without a costly wedding planner, navigating budget constraints, vendor coordination, and timing.
Your goal is to generate a realistic, disciplined plan with 4 pillars:
1. Budget Breakdown (categories, ₹ INR amounts summing EXACTLY to ${budgetVal}, percentage, priority: "critical"|"high"|"medium"|"low", flexibility: 0.0 to 1.0, minAllowed, practical note).
2. Day-by-Day Timeline (clear phases/days, time slots, cultural activity names, and details).
3. Vendor Checklist (actionable tasks, categories, deadlines, and insider due diligence tips to prevent overcharging).
4. Personalized Ideas (actionable money-saving hacks and cultural touches).

Return ONLY valid JSON matching this schema:
{
  "meta": {
    "eventName": "...",
    "eventType": "${typeVal}",
    "location": "${cityVal}",
    "guestCount": ${guestsVal},
    "totalBudget": ${budgetVal},
    "currency": "₹",
    "summary": "..."
  },
  "budgetBreakdown": [
    {
      "id": "venue_catering",
      "name": "Catering & Venue",
      "amount": ${Math.round(budgetVal * 0.4)},
      "percentage": 40,
      "priority": "critical",
      "flexibility": 0.1,
      "minAllowed": ${Math.round(budgetVal * 0.3)},
      "note": "..."
    }
  ],
  "timeline": [
    {
      "day": "Day 1",
      "title": "...",
      "date": "...",
      "schedule": [
        { "time": "10:00 AM", "activity": "...", "details": "..." }
      ]
    }
  ],
  "vendorChecklist": [
    { "category": "Catering", "task": "...", "deadline": "45 days before", "tip": "...", "done": false }
  ],
  "personalizedIdeas": [
    { "title": "...", "tag": "Budget Hack", "description": "..." }
  ]
}`;

    const userPrompt = `Event Request: "${prompt || '3-day traditional family wedding'}"
Total Budget: ₹${budgetVal.toLocaleString('en-IN')}
Guest Count: ${guestsVal}
Location: ${cityVal}
Celebration Type: ${typeVal}`;

    const geminiResponse = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const textOutput = geminiResponse.text;
    if (!textOutput) {
      throw new Error('Empty response from Gemini API');
    }

    const parsedPlan = JSON.parse(textOutput);

    // Validate essential keys
    if (!parsedPlan.budgetBreakdown || !parsedPlan.timeline || !parsedPlan.vendorChecklist) {
      throw new Error('Gemini response missing essential pillars');
    }

    parsedPlan._source = 'gemini-live-ai';
    res.json(parsedPlan);

  } catch (apiError) {
    console.warn('[Celebration AI] Gemini API call failed or timed out. Falling back to offline engine:', apiError.message);
    // Never show blank screen or raw error: fallback smoothly to sample output
    const fallbackPlan = getAdaptedSamplePlan(req.body);
    fallbackPlan._source = 'offline-demo-fallback';
    res.json(fallbackPlan);
  }
});

app.listen(PORT, () => {
  console.log(`Celebration AI server running on http://localhost:${PORT}`);
});
