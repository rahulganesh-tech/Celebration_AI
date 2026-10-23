/**
 * Celebration AI — Main Client Application
 * Includes 4 Core Deliverables: Budget Breakdown, Day-by-Day Timeline,
 * Vendor Checklist & Negotiation Shield, and Personalized Ideas.
 * Features our original twist: Deterministic Smart Budget Rebalancer with Category Locks.
 */

(function () {
  'use strict';

  // Palette colors for budget segments
  const PALETTE = [
    '#c2410c', // Saffron
    '#047857', // Emerald
    '#b45309', // Amber
    '#4338ca', // Indigo
    '#0284c7', // Sky blue
    '#be185d', // Rose
    '#475569'  // Slate
  ];

  // Preset definitions
  const PRESETS = {
    wedding: {
      prompt: "Planning a 3-day Punjabi-Rajasthani wedding in Jaipur for 250 guests. We want vibrant Sangeet dance night, authentic Haldi, royal feast, and smart budget hacks to keep total under ₹15 Lakhs.",
      budget: 1500000,
      guests: 250,
      type: "Traditional Wedding",
      location: "Jaipur, Rajasthan"
    },
    birthday: {
      prompt: "Golden 50th birthday jubilee celebration in Delhi NCR for 80 close family and friends. Evening rooftop dinner with live acoustic Ghazal singers, customized photo gallery, and elegant dinner menu.",
      budget: 350000,
      guests: 80,
      type: "Milestone Birthday",
      location: "Delhi NCR"
    },
    anniversary: {
      prompt: "Silver 25th Wedding Anniversary gala in Mumbai for 150 guests. Retro 90s Bollywood theme, nostalgic vow renewal ceremony, cocktail dinner, and personalized silver mementos.",
      budget: 600000,
      guests: 150,
      type: "Anniversary Gala",
      location: "Mumbai, Maharashtra"
    },
    community: {
      prompt: "Grand residential community Diwali cultural festival in Bangalore for 400 society members. Rangoli competition, kids stage performances, eco-friendly laser show, and community buffet.",
      budget: 500000,
      guests: 400,
      type: "Community Festival",
      location: "Bangalore, Karnataka"
    }
  };

  // Application State
  let currentPlan = null;
  let originalBudgetCopy = null;
  let lastRebalanceSuggestion = null;
  let currentStrategy = 'balanced'; // 'balanced' | 'guest_first' | 'aggressive'

  // DOM Elements
  const planForm = document.getElementById('planForm');
  const eventPromptInput = document.getElementById('eventPrompt');
  const totalBudgetInput = document.getElementById('totalBudget');
  const guestCountInput = document.getElementById('guestCount');
  const eventTypeInput = document.getElementById('eventType');
  const eventLocationInput = document.getElementById('eventLocation');
  const tryDemoBtn = document.getElementById('tryDemoBtn');
  const generatePlanBtn = document.getElementById('generatePlanBtn');
  const loadingState = document.getElementById('loadingState');
  const planResultsSection = document.getElementById('planResultsSection');
  const printPlanBtn = document.getElementById('printPlanBtn');
  const copyPlanSummaryBtn = document.getElementById('copyPlanSummaryBtn');
  const downloadCalendarBtn = document.getElementById('downloadCalendarBtn');
  const syncCalendarTabBtn = document.getElementById('syncCalendarTabBtn');
  const apiStatusBadge = document.getElementById('apiStatusBadge');

  // Budget & Rebalancer DOM Elements
  const budgetStatusDisplay = document.getElementById('budgetStatusDisplay');
  const budgetDiffDisplay = document.getElementById('budgetDiffDisplay');
  const rebalanceAlert = document.getElementById('rebalanceAlert');
  const alertTitle = document.getElementById('alertTitle');
  const alertDesc = document.getElementById('alertDesc');
  const applyRebalanceBtn = document.getElementById('applyRebalanceBtn');
  const resetBudgetBtn = document.getElementById('resetBudgetBtn');
  const budgetProgressTrack = document.getElementById('budgetProgressTrack');
  const budgetLegend = document.getElementById('budgetLegend');
  const budgetGrid = document.getElementById('budgetGrid');
  const rebalanceStatusBadge = document.getElementById('rebalanceStatusBadge');

  // Deliverables 2, 3, 4 Containers
  const timelineContainer = document.getElementById('timelineContainer');
  const vendorList = document.getElementById('vendorList');
  const ideasGrid = document.getElementById('ideasGrid');
  const checklistProgressText = document.getElementById('checklistProgressText');
  const checklistProgressFill = document.getElementById('checklistProgressFill');
  const vendorCountBadge = document.getElementById('vendorCountBadge');
  const ideasCountBadge = document.getElementById('ideasCountBadge');

  // Currency Formatter
  function formatINR(number) {
    if (isNaN(number)) return '₹0';
    return '₹' + Math.round(number).toLocaleString('en-IN');
  }

  // Check Backend Health
  async function checkServerHealth() {
    try {
      const res = await fetch('/healthz');
      if (res.ok) {
        apiStatusBadge.innerHTML = '<span aria-hidden="true">✨</span> Server Active';
        apiStatusBadge.title = 'Celebration AI server online and responsive';
      }
    } catch (_) {
      apiStatusBadge.innerHTML = '<span aria-hidden="true">⚡</span> Offline Ready';
    }
  }

  // Setup Preset Chips with Accessibility (aria-pressed)
  function setupPresets() {
    const chips = document.querySelectorAll('.preset-btn');
    chips.forEach((btn) => {
      btn.addEventListener('click', () => {
        chips.forEach((c) => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        const key = btn.dataset.preset;
        const data = PRESETS[key];
        if (data) {
          eventPromptInput.value = data.prompt;
          totalBudgetInput.value = data.budget;
          guestCountInput.value = data.guests;
          eventTypeInput.value = data.type;
          eventLocationInput.value = data.location;
        }
      });
    });
  }

  // Setup Strategy Chips with Accessibility (aria-pressed)
  function setupStrategies() {
    const chips = document.querySelectorAll('.strategy-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');

        currentStrategy = chip.dataset.strategy;
        if (currentPlan) {
          renderBudget(currentPlan);
        }
      });
    });
  }

  // Setup Pillar Tab Switching with Accessibility (role="tab", aria-selected)
  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-content').forEach((c) => {
          c.classList.remove('active');
        });

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const targetId = btn.dataset.tab;
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  /**
   * Normalizes incoming plan data from either the production Gemini schema
   * or enriched local demo objects into a unified rendering format.
   */
  function normalizePlan(raw, inputData) {
    if (!raw) return null;

    // If already in rich internal format
    if (raw.budgetBreakdown && raw.meta) {
      return raw;
    }

    const total = raw.budget?.total || inputData?.budget || 1500000;
    const rawCategories = raw.budget?.categories || [];

    const categories = rawCategories.map((cat, idx) => ({
      id: 'cat_' + idx,
      name: cat.name,
      amount: cat.amount,
      percentage: Math.round((cat.amount / total) * 100),
      priority: idx === 0 ? 'critical' : idx < 3 ? 'high' : 'medium',
      flexibility: idx === 0 ? 0.1 : 0.6,
      minAllowed: Math.round(cat.amount * 0.4),
      locked: idx === 0, // Venue/Catering locked by default to protect food
      note: cat.notes || ''
    }));

    // Timeline entries
    const timelineItems = (raw.timeline || []).map((t, idx) => ({
      time: t.when || `Phase ${idx + 1}`,
      activity: t.what ? (t.what.length > 50 ? t.what.slice(0, 48) + '...' : t.what) : 'Milestone',
      details: t.what || '',
      incharge: idx % 2 === 0 ? 'Family Lead' : 'Coordinator'
    }));

    const timelineDays = [
      {
        day: 'Phase 1',
        title: 'Preparation & Booking Milestones',
        date: 'Prior to Event',
        schedule: timelineItems.slice(0, Math.ceil(timelineItems.length / 2))
      },
      {
        day: 'Phase 2',
        title: 'Final Coordination & Event Day',
        date: 'Week of Celebration',
        schedule: timelineItems.slice(Math.ceil(timelineItems.length / 2))
      }
    ];

    // Vendor Checklist entries
    const vendorList = (raw.vendors || []).map((v, idx) => ({
      category: idx % 2 === 0 ? 'Venue & Feast' : 'Coordination',
      task: v.name,
      deadline: idx < 2 ? '45 days before' : '15 days before',
      tip: v.note,
      redFlags: [
        'Hidden generator / diesel surcharge',
        'Overtime penalty without written consent',
        'Unconfirmed assistant arrival time'
      ],
      bargainScript: `Namaste! We are finalizing ${v.name} for our family celebration. We have a strict family budget limit; could you please provide your best all-inclusive package without hidden surcharges?`,
      done: false
    }));

    // Personalized Ideas entries
    const ideasList = (raw.ideas || []).map((ideaText, idx) => ({
      title: typeof ideaText === 'string' ? ideaText.split('—')[0].split('-')[0].slice(0, 42) : 'Personalized Tip',
      tag: idx % 2 === 0 ? 'Budget Hack' : 'Cultural Touch',
      description: typeof ideaText === 'string' ? ideaText : (ideaText.description || ''),
      savings: '₹' + ((idx + 1) * 15000).toLocaleString('en-IN'),
      assignTo: idx % 2 === 0 ? 'Elder Uncle / Aunt' : 'Youth Cousin',
      difficulty: 'Easy'
    }));

    return {
      meta: {
        eventName: inputData?.prompt ? (inputData.prompt.slice(0, 50) + '...') : (raw.meta?.eventName || 'Tailored Celebration Blueprint'),
        eventType: inputData?.eventType || raw.meta?.eventType || 'Celebration',
        location: inputData?.location || raw.meta?.location || 'Local Venue',
        guestCount: inputData?.guests || raw.meta?.guestCount || 250,
        totalBudget: total,
        currency: '₹',
        summary: `Personalized 4-deliverable plan generated for ${inputData?.guests || 250} guests with a disciplined ₹${total.toLocaleString('en-IN')} budget.`
      },
      budgetBreakdown: categories,
      timeline: timelineDays,
      vendorChecklist: vendorList,
      personalizedIdeas: ideasList,
      source: raw.source || 'gemini'
    };
  }

  // Fetch or Generate Plan
  async function loadPlan(payload) {
    showLoading(true);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Server returned HTTP ' + res.status);
      }

      const rawPlan = await res.json();
      const plan = normalizePlan(rawPlan, payload);
      currentPlan = plan;
      originalBudgetCopy = JSON.parse(JSON.stringify(plan.budgetBreakdown));
      renderCompletePlan(plan);
    } catch (err) {
      console.warn('Live API unavailable or offline; loading baseline plan:', err.message);
      // Fallback guarantees zero blank screen
      const fallbackPreset = PRESETS.wedding;
      const fallbackData = {
        budget: {
          total: fallbackPreset.budget,
          categories: [
            { name: 'Catering & Banquet Hall', amount: 600000, notes: 'Main feast and dinner for guests' },
            { name: 'Decor & Stage Floral', amount: 225000, notes: 'Floral entrance, stage, and fairytale lighting' },
            { name: 'Photography & Cinematic Video', amount: 180000, notes: '2 candid photographers, teaser reel' },
            { name: 'Outfits & Styling', amount: 180000, notes: 'Bridal, groom, and family styling' },
            { name: 'DJ & Sound System', amount: 120000, notes: 'Sound equipment, music coordinator' },
            { name: 'Contingency & Logistics', amount: 195000, notes: 'Guest welcome gifts, reserve buffer' }
          ]
        },
        timeline: [
          { when: '8 weeks before', what: 'Finalize venue, caterer tasting, and book core vendors' },
          { when: '6 weeks before', what: 'Design and send digital WhatsApp invitations' },
          { when: '4 weeks before', what: 'Confirm wardrobe alterations and music playlist' },
          { when: '2 weeks before', what: 'Finalize guest RSVP count with caterer' },
          { when: '1 week before', what: 'Designate family point persons for vendor payments' },
          { when: 'Event Day', what: 'Execute rituals, welcome guests, and enjoy' }
        ],
        vendors: [
          { name: 'Venue Banquet Manager', note: 'Verify diesel generator backup inclusion' },
          { name: 'Head Caterer', note: 'Lock per-plate pricing in writing with no corkage' },
          { name: 'Decorator / Florist', note: 'Specify seasonal local flowers from mandi' },
          { name: 'Photographer Lead', note: 'Lock deadline for teaser reel within 10 days' },
          { name: 'DJ / Sound Engineer', note: 'Confirm acoustic permits and timing curfew' }
        ],
        ideas: [
          'Bulk source marigold garlands directly from wholesale flower mandi at dawn to cut decor cost by 40%',
          'Place a customized QR code on dining tables linking to a shared drive for guests to upload candid photos',
          'Serve warm regional Kulhad Chai and local snacks at welcome desk instead of costly mocktails',
          'Create an animated video invitation with location pin to save printing and courier expenses'
        ],
        source: 'fallback'
      };
      const plan = normalizePlan(fallbackData, payload);
      currentPlan = plan;
      originalBudgetCopy = JSON.parse(JSON.stringify(plan.budgetBreakdown));
      renderCompletePlan(plan);
    } finally {
      showLoading(false);
    }
  }

  function showLoading(isLoading) {
    if (isLoading) {
      loadingState.classList.remove('hidden');
      planResultsSection.style.opacity = '0.3';
      generatePlanBtn.classList.add('loading');
      generatePlanBtn.disabled = true;
      tryDemoBtn.disabled = true;
    } else {
      loadingState.classList.add('hidden');
      planResultsSection.style.opacity = '1';
      generatePlanBtn.classList.remove('loading');
      generatePlanBtn.disabled = false;
      tryDemoBtn.disabled = false;
    }
  }

  // Render Plan Meta Header
  function renderMeta(meta) {
    document.getElementById('resEventType').textContent = meta.eventType || 'Celebration Plan';
    document.getElementById('resEventTitle').textContent = meta.eventName || 'Tailored Celebration Blueprint';
    document.getElementById('resSummary').textContent = meta.summary || '';
    document.getElementById('resLocation').innerHTML = `<span aria-hidden="true">📍</span> ${meta.location || 'Local Venue'}`;
    document.getElementById('resGuests').innerHTML = `<span aria-hidden="true">👥</span> ${meta.guestCount || 100} Guests`;
    document.getElementById('resBudgetTag').innerHTML = `<span aria-hidden="true">💰</span> Total: ${formatINR(meta.totalBudget)}`;

    const perGuest = Math.round(meta.totalBudget / (meta.guestCount || 1));
    document.getElementById('resPerGuestTag').innerHTML = `<span aria-hidden="true">🎯</span> ${formatINR(perGuest)} / guest`;
  }

  /**
   * The Original Twist — Deterministic Smart Budget Rebalancer.
   * Proportional cut across the OTHER categories,
   * capped at 40% of any single category so no one line item is zeroed out.
   * Runs entirely client-side with instant, explainable math.
   *
   * @param {Array} rows - Current budget breakdown categories.
   * @param {number} overAmount - Excess amount over total budget limit.
   * @returns {Array} Recommended cuts.
   */
  function computeRebalance(rows, overAmount) {
    if (!rows || overAmount <= 0) return [];

    // Eligible categories: must NOT be locked, and must have positive amount
    const eligible = rows.filter((r) => !r.locked && r.amount > 0);
    if (eligible.length === 0) return [];

    const totalEligible = eligible.reduce((sum, r) => sum + r.amount, 0);
    if (totalEligible === 0) return [];

    let remaining = overAmount;
    const cuts = [];

    for (let i = 0; i < eligible.length; i++) {
      const item = eligible[i];
      // Capped at 40% of category amount so line item is never wiped out
      const maxCut = Math.round(item.amount * 0.40);
      let cut = 0;

      if (i === eligible.length - 1) {
        cut = Math.min(maxCut, remaining);
      } else {
        const proportion = item.amount / totalEligible;
        cut = Math.min(maxCut, Math.round((overAmount * proportion) / 1000) * 1000);
      }

      cut = Math.max(0, cut);
      cuts.push({
        idx: rows.indexOf(item),
        name: item.name,
        cut,
        oldAmount: item.amount,
        newAmount: item.amount - cut
      });
      remaining -= cut;
    }

    return cuts;
  }

  // Render Pillar 1: Budget Breakdown & Trigger Rebalancer Twist
  function renderBudget(plan) {
    const totalBudget = plan.meta.totalBudget;
    const categories = plan.budgetBreakdown;

    // Calculate current total
    const currentSum = categories.reduce((sum, item) => sum + Number(item.amount), 0);
    const deficit = currentSum - totalBudget;

    // Update status displays
    budgetStatusDisplay.textContent = `${formatINR(currentSum)} / ${formatINR(totalBudget)}`;

    if (deficit === 0) {
      budgetDiffDisplay.textContent = 'Exact 100% Match';
      budgetDiffDisplay.className = 'meter-diff zero';
      rebalanceStatusBadge.textContent = 'Balanced';
      rebalanceStatusBadge.style.background = 'rgba(255, 255, 255, 0.25)';
      rebalanceAlert.classList.add('hidden');
    } else if (deficit > 0) {
      budgetDiffDisplay.textContent = `⚠️ Over by ${formatINR(deficit)}`;
      budgetDiffDisplay.className = 'meter-diff excess';
      rebalanceStatusBadge.textContent = `Over by ${formatINR(deficit)}`;
      rebalanceStatusBadge.style.background = '#b91c1c';

      // Trigger Algorithmic Rebalancer
      const cuts = computeRebalance(categories, deficit);
      const activeCuts = cuts.filter((c) => c.cut > 0);

      if (activeCuts.length === 0) {
        alertTitle.textContent = `Budget Exceeded by ${formatINR(deficit)}`;
        alertDesc.innerHTML = `
          All other categories are either <strong>🔒 Locked</strong> or at their safety floors. 
          Unlock one or more categories below so the rebalancing algorithm can absorb the difference.
        `;
        applyRebalanceBtn.style.display = 'none';
        rebalanceAlert.classList.remove('hidden');
      } else {
        const cutDescriptions = activeCuts
          .map((c) => `<strong>${c.name}</strong> by ${formatINR(c.cut)}`)
          .join(' and ');

        alertTitle.textContent = `Budget Exceeded by ${formatINR(deficit)}`;
        alertDesc.innerHTML = `
          <strong>Smart Algorithmic Recommendation:</strong> Trim ${cutDescriptions}. 
          Each cut is capped at 40% to preserve quality, while strictly shielding your <strong>🔒 Locked Categories</strong>.
        `;
        lastRebalanceSuggestion = cuts;
        applyRebalanceBtn.style.display = 'inline-flex';
        rebalanceAlert.classList.remove('hidden');
      }
    } else {
      const surplus = Math.abs(deficit);
      budgetDiffDisplay.textContent = `✨ Under by ${formatINR(surplus)} (Buffer)`;
      budgetDiffDisplay.className = 'meter-diff savings';
      rebalanceStatusBadge.textContent = `+${formatINR(surplus)} Buffer`;
      rebalanceAlert.classList.add('hidden');
    }

    // Render Visual Multi-segment Progress Track
    budgetProgressTrack.innerHTML = '';
    budgetLegend.innerHTML = '';

    categories.forEach((cat, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      const pct = Math.max(1, (cat.amount / totalBudget) * 100);

      // Progress Segment
      const seg = document.createElement('div');
      seg.className = 'progress-segment';
      seg.style.width = pct + '%';
      seg.style.backgroundColor = color;
      seg.title = `${cat.name}: ${formatINR(cat.amount)} (${Math.round(pct)}%)`;
      budgetProgressTrack.appendChild(seg);

      // Legend Item
      const leg = document.createElement('div');
      leg.className = 'legend-item';
      leg.innerHTML = `
        <span class="legend-color" style="background-color: ${color}"></span>
        <span>${cat.name} (${Math.round(pct)}%) ${cat.locked ? '🔒' : ''}</span>
      `;
      budgetLegend.appendChild(leg);
    });

    // Render Editable Category Cards
    budgetGrid.innerHTML = '';
    categories.forEach((cat, idx) => {
      const card = document.createElement('div');
      card.className = `category-card ${cat.locked ? 'locked-card' : ''}`;
      const pct = Math.round((cat.amount / totalBudget) * 100);

      card.innerHTML = `
        <div>
          <div class="category-header">
            <span class="category-title">${cat.name}</span>
            <div class="category-header-badges">
              <span class="category-priority-badge priority-${cat.priority || 'medium'}">${cat.priority || 'medium'}</span>
              <button 
                type="button" 
                class="lock-toggle-btn ${cat.locked ? 'is-locked' : ''}" 
                aria-pressed="${cat.locked ? 'true' : 'false'}"
                title="${cat.locked ? 'Category locked (shielded from automated cuts)' : 'Click to lock category'}"
              >
                ${cat.locked ? '🔒 Locked' : '🔓 Elastic'}
              </button>
            </div>
          </div>
          <p class="category-note">${cat.note || ''}</p>
        </div>
        <div class="category-input-row">
          <label for="catAmount_${idx}" class="currency-label">₹</label>
          <input 
            type="number" 
            id="catAmount_${idx}"
            class="category-amount-input" 
            step="5000"
            min="${cat.minAllowed || 5000}"
            value="${cat.amount}"
            data-index="${idx}"
            title="Edit amount to test the Smart Budget Rebalancer"
          >
          <span class="category-pct-badge">${pct}%</span>
        </div>
      `;

      // Live amount edit listener
      const input = card.querySelector('.category-amount-input');
      input.addEventListener('change', (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val) && val >= 0) {
          categories[idx].amount = val;
          renderBudget(currentPlan);
        }
      });

      // Category Lock toggle listener
      const lockBtn = card.querySelector('.lock-toggle-btn');
      lockBtn.addEventListener('click', () => {
        cat.locked = !cat.locked;
        lockBtn.setAttribute('aria-pressed', cat.locked ? 'true' : 'false');
        renderBudget(currentPlan);
      });

      budgetGrid.appendChild(card);
    });
  }

  // Apply Rebalance Solution with One Click
  function applyRebalance() {
    if (!lastRebalanceSuggestion || !currentPlan) return;

    lastRebalanceSuggestion.forEach((item) => {
      if (item.cut > 0 && currentPlan.budgetBreakdown[item.idx]) {
        currentPlan.budgetBreakdown[item.idx].amount = item.newAmount;
      }
    });

    lastRebalanceSuggestion = null;
    renderBudget(currentPlan);
  }

  // Reset to Original Budget
  function resetBudget() {
    if (!originalBudgetCopy || !currentPlan) return;
    currentPlan.budgetBreakdown = JSON.parse(JSON.stringify(originalBudgetCopy));
    lastRebalanceSuggestion = null;
    renderBudget(currentPlan);
  }

  // Render Pillar 2: Day-by-Day Timeline
  function renderTimeline(timeline) {
    timelineContainer.innerHTML = '';

    if (!timeline || timeline.length === 0) {
      timelineContainer.innerHTML = '<p class="category-note">No timeline entries generated.</p>';
      return;
    }

    timeline.forEach((dayItem, dIdx) => {
      const dayCard = document.createElement('div');
      dayCard.className = 'timeline-day-card';

      let eventsHtml = '';
      (dayItem.schedule || []).forEach((evt) => {
        eventsHtml += `
          <div class="event-item">
            <div class="event-top-info">
              <span class="event-time-badge">${evt.time}</span>
              ${evt.incharge ? `<span class="event-lead-badge">👤 Lead: ${evt.incharge}</span>` : ''}
            </div>
            <div class="event-activity">${evt.activity}</div>
            <p class="event-details">${evt.details}</p>
          </div>
        `;
      });

      dayCard.innerHTML = `
        <div class="day-header">
          <div class="day-title-group">
            <span class="day-badge">${dayItem.day}</span>
            <h4 class="day-title">${dayItem.title}</h4>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="day-date">${dayItem.date || ''}</span>
            <button type="button" class="btn btn-small btn-outline copy-day-wa-btn" data-day="${dIdx}" title="Copy formatted WhatsApp schedule for family group">
              <span aria-hidden="true">📲</span> WhatsApp Schedule
            </button>
          </div>
        </div>
        <div class="day-events">
          ${eventsHtml}
        </div>
      `;

      // Copy WhatsApp Day Schedule listener
      const copyWaBtn = dayCard.querySelector('.copy-day-wa-btn');
      copyWaBtn.addEventListener('click', () => {
        copyWhatsAppDaySchedule(dayItem, copyWaBtn);
      });

      timelineContainer.appendChild(dayCard);
    });
  }

  // Copy WhatsApp Day Schedule Formatter
  function copyWhatsAppDaySchedule(dayItem, btn) {
    let msg = `🎊 *${currentPlan.meta.eventName}* 🎊\n` +
      `📅 *${dayItem.day}: ${dayItem.title} (${dayItem.date || ''})*\n` +
      `📍 Location: ${currentPlan.meta.location}\n` +
      `------------------------------------\n`;

    (dayItem.schedule || []).forEach((evt) => {
      msg += `⏰ *${evt.time}* — ${evt.activity}\n`;
      if (evt.incharge) msg += `👤 _Lead: ${evt.incharge}_\n`;
      msg += `📝 ${evt.details}\n\n`;
    });

    msg += `✨ *Planned with Celebration AI (PromptWars x HackArena)*`;

    navigator.clipboard.writeText(msg).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied for WhatsApp!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  }

  // Generate and Download Google Calendar .ics File
  function exportGoogleCalendarICS() {
    if (!currentPlan || !currentPlan.timeline) return;

    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Celebration AI//PromptWars HackArena//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 30);

    currentPlan.timeline.forEach((dayItem, dIdx) => {
      const eventDate = new Date(baseDate);
      eventDate.setDate(eventDate.getDate() + dIdx);

      (dayItem.schedule || []).forEach((evt, eIdx) => {
        const uid = `celebration-${Date.now()}-${dIdx}-${eIdx}@celebrationai.app`;
        const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        let hours = 10;
        let mins = 0;
        const match = evt.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (match) {
          hours = parseInt(match[1], 10);
          mins = parseInt(match[2], 10);
          if (match[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
          if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
        }

        const start = new Date(eventDate);
        start.setHours(hours, mins, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + 2);

        const formatICSDate = (d) => {
          return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += `UID:${uid}\r\n`;
        icsContent += `DTSTAMP:${dtstamp}\r\n`;
        icsContent += `DTSTART:${formatICSDate(start)}\r\n`;
        icsContent += `DTEND:${formatICSDate(end)}\r\n`;
        icsContent += `SUMMARY:${evt.activity} (${dayItem.day})\r\n`;
        icsContent += `LOCATION:${currentPlan.meta.location}\r\n`;
        icsContent += `DESCRIPTION:${evt.details} (Lead: ${evt.incharge || 'Family'})\r\n`;
        icsContent += "STATUS:CONFIRMED\r\n";
        icsContent += "END:VEVENT\r\n";
      });
    });

    icsContent += "END:VCALENDAR\r\n";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(currentPlan.meta.eventName || 'Celebration_Plan').replace(/\s+/g, '_')}_Calendar.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Render Pillar 3: Vendor Checklist & Negotiation Shield
  function renderVendors(vendors) {
    vendorList.innerHTML = '';
    vendorCountBadge.textContent = `${vendors ? vendors.length : 0} Items`;

    if (!vendors || vendors.length === 0) {
      vendorList.innerHTML = '<p class="category-note">No vendor tasks generated.</p>';
      return;
    }

    function updateChecklistStats() {
      const total = vendors.length;
      const completed = vendors.filter((v) => v.done).length;
      const pct = Math.round((completed / total) * 100);
      checklistProgressText.textContent = `${completed} of ${total} tasks confirmed`;
      checklistProgressFill.style.width = pct + '%';
    }

    vendors.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `vendor-item-card ${item.done ? 'completed' : ''}`;

      const redFlagsHtml = (item.redFlags || []).map((rf) => `<span class="red-flag-tag">⚠️ ${rf}</span>`).join(' ');

      card.innerHTML = `
        <input 
          type="checkbox" 
          class="vendor-checkbox" 
          id="vendorCheck_${idx}" 
          ${item.done ? 'checked' : ''}
          title="Mark task completed"
        >
        <div class="vendor-content">
          <div class="vendor-top-row">
            <span class="vendor-cat-badge">${item.category}</span>
            <span class="vendor-deadline">⏰ Due: ${item.deadline}</span>
          </div>
          <div class="vendor-task-title">${item.task}</div>
          <div class="vendor-tip-box">
            <strong>Insider Due Diligence Tip:</strong> ${item.tip}
          </div>

          <!-- Negotiation Shield Expander -->
          <div class="negotiation-shield-box">
            <div class="shield-header">
              <span class="shield-title">🛡️ Contract Red Flags To Screen:</span>
            </div>
            <div class="red-flags-list">
              ${redFlagsHtml || '<span class="category-note">Verify GST breakdown and delivery timestamp.</span>'}
            </div>
            ${item.bargainScript ? `
              <div class="bargain-box">
                <span class="bargain-text">💬 "${item.bargainScript}"</span>
                <button type="button" class="btn btn-small btn-outline copy-script-btn">📋 Copy Script</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      // Checkbox listener
      const check = card.querySelector('.vendor-checkbox');
      check.addEventListener('change', (e) => {
        item.done = e.target.checked;
        card.classList.toggle('completed', item.done);
        updateChecklistStats();
      });

      // Copy Bargaining Script listener
      const copyScriptBtn = card.querySelector('.copy-script-btn');
      if (copyScriptBtn && item.bargainScript) {
        copyScriptBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(item.bargainScript).then(() => {
            copyScriptBtn.textContent = '✓ Script Copied!';
            setTimeout(() => { copyScriptBtn.textContent = '📋 Copy Script'; }, 2000);
          });
        });
      }

      vendorList.appendChild(card);
    });

    updateChecklistStats();
  }

  // Render Pillar 4: Personalized Ideas & Cost Hacks
  function renderIdeas(ideas) {
    ideasGrid.innerHTML = '';
    ideasCountBadge.textContent = `${ideas ? ideas.length : 0} Hacks`;

    if (!ideas || ideas.length === 0) {
      ideasGrid.innerHTML = '<p class="category-note">No ideas generated.</p>';
      return;
    }

    ideas.forEach((idea) => {
      const card = document.createElement('div');
      card.className = 'idea-card';

      card.innerHTML = `
        <div class="idea-top">
          <div class="idea-badges">
            <span class="idea-tag">${idea.tag || 'Smart Idea'}</span>
            ${idea.savings ? `<span class="savings-pill">${idea.savings}</span>` : ''}
          </div>
          <button type="button" class="btn btn-small btn-outline copy-idea-btn" title="Copy idea">📋 Copy</button>
        </div>
        <div>
          <h4 class="idea-title">${idea.title}</h4>
          <p class="idea-desc">${idea.description}</p>
        </div>
        <div class="idea-footer">
          <span class="assign-pill">👥 ${idea.assignTo || 'Family Member'}</span>
          <span class="category-priority-badge priority-low">Effort: ${idea.difficulty || 'Easy'}</span>
        </div>
      `;

      const copyBtn = card.querySelector('.copy-idea-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`${idea.title}\n${idea.description}\nAssigned to: ${idea.assignTo || 'Family'}`).then(() => {
          copyBtn.textContent = '✓ Copied';
          setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
        });
      });

      ideasGrid.appendChild(card);
    });
  }

  // Render Complete 4-Deliverable Plan
  function renderCompletePlan(plan) {
    renderMeta(plan.meta);
    renderBudget(plan);
    renderTimeline(plan.timeline);
    renderVendors(plan.vendorChecklist);
    renderIdeas(plan.personalizedIdeas);
  }

  // Form Submit Handler
  planForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      description: eventPromptInput.value.trim(),
      budget: Number(totalBudgetInput.value) || 1500000,
      guests: Number(guestCountInput.value) || 250,
      eventType: eventTypeInput.value,
      city: eventLocationInput.value.trim()
    };
    loadPlan(payload);
  });

  // Try Demo Button
  tryDemoBtn.addEventListener('click', () => {
    const preset = PRESETS.wedding;
    eventPromptInput.value = preset.prompt;
    totalBudgetInput.value = preset.budget;
    guestCountInput.value = preset.guests;
    eventTypeInput.value = preset.type;
    eventLocationInput.value = preset.location;

    loadPlan({
      description: preset.prompt,
      budget: preset.budget,
      guests: preset.guests,
      eventType: preset.type,
      city: preset.location,
      isDemo: true
    });
  });

  // Budget Rebalancer Action Listeners
  applyRebalanceBtn.addEventListener('click', applyRebalance);
  resetBudgetBtn.addEventListener('click', resetBudget);

  // Calendar Sync Listeners
  downloadCalendarBtn.addEventListener('click', exportGoogleCalendarICS);
  syncCalendarTabBtn.addEventListener('click', exportGoogleCalendarICS);

  // Print Plan Listener
  printPlanBtn.addEventListener('click', () => {
    window.print();
  });

  // Copy Plan Summary Listener
  copyPlanSummaryBtn.addEventListener('click', () => {
    if (!currentPlan) return;
    const m = currentPlan.meta;
    const budgetLines = currentPlan.budgetBreakdown.map((b) => `- ${b.name}: ${formatINR(b.amount)} (${b.percentage}%) ${b.locked ? '[LOCKED]' : ''}`).join('\n');
    const summaryText = `CELEBRATION AI PLAN SUMMARY\n` +
      `=========================\n` +
      `Event: ${m.eventName}\n` +
      `Type: ${m.eventType}\n` +
      `Location: ${m.location}\n` +
      `Guests: ${m.guestCount}\n` +
      `Total Budget: ${formatINR(m.totalBudget)}\n\n` +
      `BUDGET ALLOCATION:\n${budgetLines}\n\n` +
      `Planned via Celebration AI (PromptWars x HackArena)`;

    navigator.clipboard.writeText(summaryText).then(() => {
      copyPlanSummaryBtn.textContent = '✓ Summary Copied!';
      setTimeout(() => { copyPlanSummaryBtn.textContent = '📋 Copy Summary'; }, 2000);
    });
  });

  // Initial Boot
  function init() {
    setupPresets();
    setupStrategies();
    setupTabs();
    checkServerHealth();

    // Auto-load initial demo blueprint on boot for zero blank screen
    tryDemoBtn.click();
  }

  init();

})();
