# 🎉 Celebration AI — GenAI Event & Celebration Planner

> **PromptWars x HackArena** ([Hack2Skill](https://hack2skill.com) x **Google Developer Community**)  
> **Challenge Track**: `[Challenge 5] Celebration & Event Planner`

Celebration AI is an intelligent, accessible planning assistant designed specifically for middle-class families organizing milestone celebrations (weddings, milestone birthdays, anniversaries, and community festivals) without hiring expensive professional event planners. It produces a comprehensive 4-pillar blueprint—**itemized budgets**, **day-by-day timelines**, **vendor negotiation shields**, and **personalized cultural ideas**—paired with an instant, explainable **Budget Rebalancer**, **Google Calendar Sync**, and **WhatsApp Family Dispatch**.

---

## 🎯 1. Problem Statement & Target User

### Target User
A middle-class Indian family planning a high-stakes life event (such as a 3-day wedding, a 50th golden jubilee birthday, a silver anniversary, or a residential society Diwali utsav) without hiring an expensive event agency.

### Core Pain Points
1. **Budget Anxiety & Opaque Allocation**: Families struggle to allocate a fixed budget across competing vendors and worry about accidental cost blowouts.
2. **Hidden Vendor Fees & Contract Traps**: Lack of professional contracts leaves families vulnerable to hidden vendor costs (e.g. diesel generator billing, corkage markups, music curfew penalties, delayed deliverables).
3. **Timeline & Ritual Friction**: Managing multi-generational rituals across multiple days often leads to schedule slippage, guest fatigue, and confusion over who in the family is responsible for which ceremony.
4. **No Rebalancing Mechanism**: When one vendor inevitably demands more money, traditional planners or static templates offer no instant way to adjust other categories without breaking the total budget.

---

## 💡 2. Solution Overview & Key Innovations

Celebration AI bridges the gap between expensive wedding agencies and disorganized spreadsheets:
- **Plain Language Input**: Users simply describe their vision, location, guest count, and budget.
- **4-Pillar Blueprint**: The system generates a complete, culturally grounded plan.
- **Zero-Login & Instant Offline Demo**: Evaluators and users can experience full functionality with one click, requiring zero logins or API keys.
- **Deterministic Twist (The Budget Rebalancer)**: An algorithmic solver that prevents overspending in real time with **Category Lock Shielding** and **Multi-Strategy Optimization**.
- **Google Calendar Integration**: 1-click `.ics` standard export that syncs auspicious muhurats and ceremony windows directly to Google Calendar.
- **WhatsApp Family Dispatch**: 1-click formatted schedule generation tailored for Indian family WhatsApp groups with designated family member leads.
- **Vendor Negotiation Shield**: Screens vendor contracts for hidden red flags and generates ready-to-send WhatsApp bargaining scripts.

---

## 🗺️ 3. Features Mapped 1:1 to Problem Statement

| Problem Statement Requirement | Feature in Celebration AI | Innovation & Implementation Detail |
| :--- | :--- | :--- |
| **Budgets** | **Smart INR Budget Breakdown** | Itemized category allocations (Catering, Stage Decor, Photography, Styling, DJ, Favors, Logistics) with percentage visualizer, priority badges, and editable inline amounts. |
| **Timelines** | **Day-by-Day Chronological Schedule** | Multi-day phase breakdown with exact time slots, ceremony descriptions, and family coordination notes + **Google Calendar Sync (.ics)** + **WhatsApp Family Dispatch**. |
| **Vendor Checklists** | **Vendor Negotiation Shield** | Actionable task checklist + **Contract Red Flag Detector** (guards against hidden diesel, curfew, or royalty fees) + **1-Click WhatsApp Bargaining Scripts**. |
| **Personalized Ideas** | **Cultural Hacks & Savings** | High-impact ideas tailored to Indian families (mandi flower sourcing, tabletop QR photo clouds, Kulhad Chai welcome counters, animated WhatsApp invites) with **₹ savings pills** and **family lead assignments**. |
| **The Original Twist** | **Algorithmic Budget Rebalancer** | Instant mathematical solver with **🔒 Category Locks** (protect favorite line items) and **Strategy Selectors** (`Balanced`, `Guest Experience First`, `Aggressive Trimming`). |

---

## ⚡ 4. The Original Twist: Algorithmic Budget Rebalancer

In middle-class celebrations, budgets are fixed ceilings. If Catering or Outfits cost ₹50,000 more, you cannot expand the budget—you must trim elsewhere.

### How it Works:
1. **Category Weighting & Lock Shielding**: Each budget category features an interactive **🔒 Lock** toggle. When locked by the user, the category is strictly protected from automated reductions.
2. **Strategy Optimization Modes**:
   - ⚖️ **Balanced Proportional**: Distributes reductions evenly across all unlocked elastic categories.
   - 🍽️ **Guest Experience First**: Shields Food, Catering, and DJ/Music; absorbs cuts exclusively in Stage Decor, Invitations, and Clothing.
   - ✂️ **Aggressive Trimming**: Deeply scales back aesthetic markups while protecting logistics.
3. **Explainability**: Rather than making a mysterious black-box change, Celebration AI explains its logic clearly:
   > *"Smart Algorithmic Recommendation (Guest Experience Strategy): Trim Stage Decor by ₹30,000 and Invitations/Favors by ₹20,000. Preserves your 🔒 Locked Categories, Catering baselines, and Emergency Logistics Buffer while restoring your exact ₹15,00,000 ceiling."*
4. **One-Click Application**: Users can apply the recommendation with one click or reset to the original plan.

---

## 🛠️ 5. Tech Stack

- **Frontend**: Semantic HTML5, Vanilla CSS3 (custom festive design system, responsive CSS Grid/Flexbox, Outfit & Plus Jakarta Sans typography), Vanilla JavaScript (zero framework bloat, instant load times, 0 console errors).
- **Backend**: Node.js, Express.js.
- **Generative AI**: Google Gemini API via official `@google/genai` SDK (`gemini-2.5-flash`).
- **Google Integrations**: Google Calendar `.ics` engine, Google Fonts, and Google AI Studio prototyping.
- **Containerization**: Single-container Dockerfile optimized for **Google Cloud Run**.

---

## 🌐 6. Google Products Used

1. **Google Gemini API (`@google/genai` SDK)**: Used server-side to analyze unstructured celebration requests and produce structured multi-pillar plans adhering to a strict JSON schema.
2. **Google AI Studio**: Prompt engineering, system instruction tuning, and response schema prototyping.
3. **Google Calendar (.ics Sync)**: Standard calendar export syncing all ritual milestones directly into Google Calendar.
4. **Google Cloud Run**: Target serverless container platform for deployment (`Dockerfile` included).
5. **Google Fonts**: `Outfit` and `Plus Jakarta Sans` for clean, accessible typography.

---

## 🧠 7. Prompt Engineering Workflow

Celebration AI was built using a structured prompt engineering methodology:
- **Role Assignment**: Hackathon pair-programmer persona with urgency, scope discipline, and compliance mindset.
- **Hard Constraints First**: Server-only API calls, zero hardcoded secrets, `.gitignore` discipline, and repository size capped at <10 MB.
- **Scope Discipline**: Restricted strictly to core features directly mapped to the challenge words with high-impact innovations.
- **Fallback-First Reliability**: The application provides a complete, high-fidelity offline celebration engine. If the Gemini API key is missing, network is down, or quota is exhausted, it gracefully serves the tailored sample blueprint—**never displaying a raw error or blank screen**.
- **Self-Verification**: Verification in headless and local environments before submission.

*(See [PROMPTS.md](PROMPTS.md) for the exact step-by-step prompts used during development).*

---

## 📁 8. Project Structure

```text
Celebration_AI/
├── .dockerignore              # Clean container build ignore
├── .env.example               # Safe environment variable template
├── .gitignore                 # Prevents committing node_modules & .env
├── Dockerfile                 # Cloud Run single-container definition
├── package.json               # Express, dotenv, @google/genai dependencies
├── sample-data.json           # High-fidelity benchmark Indian celebration dataset
├── server.js                  # Express server with Gemini API & offline fallback
├── public/
│   ├── index.html             # Semantic responsive UI with 4 pillars & innovations
│   ├── style.css              # Warm festive aesthetic, responsive grids & print styles
│   └── app.js                 # Rebalancer, Calendar sync, WhatsApp dispatch & Shield
├── README.md                  # Comprehensive documentation for evaluators
└── PROMPTS.md                 # Log of development prompts and iterations
```

---

## 🚀 9. Quickstart & Local Setup

### Prerequisites
- Node.js (v18 or higher; v20+ recommended)
- npm

### 1. Clone & Install
```bash
git clone https://github.com/rahulganesh-tech/Celebration_AI.git
cd Celebration_AI
npm install
```

### 2. Configure Environment (Optional for Live Gemini AI)
```bash
cp .env.example .env
```
Open `.env` and set your key from [Google AI Studio](https://aistudio.google.com/):
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```
*(Note: If no key is set, Celebration AI runs in offline demo mode with zero errors).*

### 3. Run Locally
```bash
npm start
```
Open your browser to: [http://localhost:3000](http://localhost:3000)

---

## 🐳 10. Container Deployment (Google Cloud Run)

Build and run with Docker locally:
```bash
docker build -t celebration-ai .
docker run -p 8080:8080 -e PORT=8080 celebration-ai
```

Deploy directly to Google Cloud Run:
```bash
gcloud run deploy celebration-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 📋 11. HackArena Submission Checklist

- [x] **Public GitHub Repository**: [https://github.com/rahulganesh-tech/Celebration_AI](https://github.com/rahulganesh-tech/Celebration_AI.git)
- [ ] **Live Deployed App**: *(Deploy to Google Cloud Run or Render/Vercel and paste URL here)*
- [ ] **LinkedIn Post**: *(Publish post describing the solution and paste full `https://www.linkedin.com/posts/...` URL here)*
