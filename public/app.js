/**
 * Celebration AI — Main Client Application
 * Includes 4 Pillars, Algorithmic Budget Rebalancer with Category Locks,
 * Google Calendar (.ics) export, WhatsApp Family Dispatch, and Vendor Negotiation Shield.
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

  // State
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

  // Pillar 2, 3, 4 Containers
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

  // Check Backend Health & Gemini Key
  async function checkServerHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.hasGeminiKey) {
          apiStatusBadge.textContent = '✨ Gemini Live Active';
          apiStatusBadge.title = 'Server connected to live Google Gemini API';
        } else {
          apiStatusBadge.textContent = '⚡ Demo & Fallback Ready';
          apiStatusBadge.title = 'Running on high-fidelity offline celebration engine (zero API key required)';
        }
      }
    } catch (e) {
      console.warn('Health check unreachable, running in resilient client mode');
      apiStatusBadge.textContent = '⚡ Offline Mode';
    }
  }

  // Setup Presets
  function setupPresets() {
    const chips = document.querySelectorAll('.preset-btn');
    chips.forEach(btn => {
      btn.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
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

  // Setup Rebalance Strategy Chips
  function setupStrategies() {
    const chips = document.querySelectorAll('.strategy-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentStrategy = chip.dataset.strategy;
        if (currentPlan) {
          renderBudget(currentPlan);
        }
      });
    });
  }

  // Setup Pillar Tab Switching
  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  // Fetch or Load Plan
  async function loadPlan(payload) {
    showLoading(true);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Server returned ' + res.status);
      }

      const plan = await res.json();
      currentPlan = plan;
      originalBudgetCopy = JSON.parse(JSON.stringify(plan.budgetBreakdown));
      renderCompletePlan(plan);
    } catch (err) {
      console.error('Plan generation failed, loading local demo blueprint:', err);
      // Hard fallback ensuring zero blank screen failure
      const fallbackRes = await fetch('/api/sample');
      const fallbackPlan = await fallbackRes.json();
      currentPlan = fallbackPlan;
      originalBudgetCopy = JSON.parse(JSON.stringify(fallbackPlan.budgetBreakdown));
      renderCompletePlan(fallbackPlan);
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
    document.getElementById('resLocation').textContent = '📍 ' + (meta.location || 'Local Venue');
    document.getElementById('resGuests').textContent = '👥 ' + (meta.guestCount || 100) + ' Guests';
    document.getElementById('resBudgetTag').textContent = '💰 Total: ' + formatINR(meta.totalBudget);

    const perGuest = Math.round(meta.totalBudget / (meta.guestCount || 1));
    document.getElementById('resPerGuestTag').textContent = '🎯 ' + formatINR(perGuest) + ' / guest';
  }

  // Render Pillar 1: Budget & Rebalancer
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
      rebalanceStatusBadge.style.background = '#dc2626';

      // Trigger Algorithmic Rebalancer
      computeAndShowRebalance(plan, deficit);
    } else {
      const surplus = Math.abs(deficit);
      budgetDiffDisplay.textContent = `✨ Under by ${formatINR(surplus)} (Buffer)`;
      budgetDiffDisplay.className = 'meter-diff savings';
      rebalanceStatusBadge.textContent = `+${formatINR(surplus)} Buffer`;
      rebalanceAlert.classList.add('hidden');
    }

    // Render Progress Track
    budgetProgressTrack.innerHTML = '';
    budgetLegend.innerHTML = '';

    categories.forEach((cat, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      const pct = Math.max(1, (cat.amount / totalBudget) * 100);

      // Track Segment
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

    // Render Category Cards
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
              <button type="button" class="lock-toggle-btn ${cat.locked ? 'is-locked' : ''}" title="${cat.locked ? 'Category locked (shielded from automated cuts)' : 'Click to lock category'}">
                ${cat.locked ? '🔒 Locked' : '🔓 Elastic'}
              </button>
            </div>
          </div>
          <p class="category-note">${cat.note || ''}</p>
        </div>
        <div class="category-input-row">
          <span class="currency-label">₹</span>
          <input 
            type="number" 
            class="category-amount-input" 
            step="5000"
            min="${cat.minAllowed || 5000}"
            value="${cat.amount}"
            data-index="${idx}"
            title="Edit amount to test the Budget Rebalancer"
          >
          <span class="category-pct-badge">${pct}%</span>
        </div>
      `;

      // Live edit listener
      const input = card.querySelector('.category-amount-input');
      input.addEventListener('change', (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val) && val >= 0) {
          categories[idx].amount = val;
          renderBudget(currentPlan);
        }
      });

      // Lock toggle listener
      const lockBtn = card.querySelector('.lock-toggle-btn');
      lockBtn.addEventListener('click', () => {
        cat.locked = !cat.locked;
        renderBudget(currentPlan);
      });

      budgetGrid.appendChild(card);
    });
  }

  // Algorithmic Budget Rebalancer with Lock Respect and Strategy Weighting
  function computeAndShowRebalance(plan, deficit) {
    const categories = plan.budgetBreakdown;
    
    // Identify flexible categories that have room to be reduced
    // Rule: Locked categories are strictly protected!
    const eligible = [];
    let totalWeight = 0;

    categories.forEach((cat, idx) => {
      // If manually locked, skip entirely!
      if (cat.locked) return;

      let flexibility = cat.flexibility !== undefined ? cat.flexibility : 0.5;

      // Apply Strategy Multipliers
      if (currentStrategy === 'guest_first') {
        if (cat.id && (cat.id.includes('catering') || cat.id.includes('music') || cat.id.includes('dj'))) {
          flexibility = 0.05; // Shield food & music
        }
        if (cat.id && (cat.id.includes('decor') || cat.id.includes('invites') || cat.id.includes('clothing'))) {
          flexibility = 1.0; // Heavily absorb cuts in decor & clothing
        }
      } else if (currentStrategy === 'aggressive') {
        if (cat.id && (cat.id.includes('decor') || cat.id.includes('invites'))) {
          flexibility = 1.5;
        }
      }

      const minAllowed = cat.minAllowed || Math.round(cat.amount * 0.4);
      const capacity = cat.amount - minAllowed;

      if (flexibility > 0.1 && capacity > 5000 && cat.priority !== 'critical') {
        const weight = capacity * flexibility;
        eligible.push({ idx, cat, capacity, flexibility, weight });
        totalWeight += weight;
      }
    });

    if (eligible.length === 0 || totalWeight === 0) {
      alertTitle.textContent = `Budget Exceeded by ${formatINR(deficit)}`;
      alertDesc.innerHTML = `
        All other categories are either <strong>🔒 Locked</strong> or already at their minimum allowed floors. 
        Unlock one or more categories (e.g. Stage Decor or Favors) so the algorithm can balance the excess.
      `;
      applyRebalanceBtn.style.display = 'none';
      rebalanceAlert.classList.remove('hidden');
      return;
    }

    // Distribute deficit across eligible categories proportionally
    let remainingDeficit = deficit;
    const cuts = [];

    eligible.forEach((item, eIdx) => {
      let cutAmount = 0;
      if (eIdx === eligible.length - 1) {
        cutAmount = Math.min(item.capacity, remainingDeficit);
      } else {
        const share = item.weight / totalWeight;
        cutAmount = Math.min(item.capacity, Math.round((deficit * share) / 1000) * 1000);
      }
      cutAmount = Math.max(0, cutAmount);
      cuts.push({
        idx: item.idx,
        name: item.cat.name,
        cut: cutAmount,
        oldAmount: item.cat.amount,
        newAmount: item.cat.amount - cutAmount
      });
      remainingDeficit -= cutAmount;
    });

    // Generate clear, explainable suggestion text
    const activeCuts = cuts.filter(c => c.cut > 0);
    const cutDescriptions = activeCuts.map(c => `<strong>${c.name}</strong> by ${formatINR(c.cut)}`).join(' and ');

    alertTitle.textContent = `Budget Exceeded by ${formatINR(deficit)}`;
    alertDesc.innerHTML = `
      <strong>Smart Algorithmic Recommendation (${currentStrategy === 'guest_first' ? 'Guest Experience Strategy' : currentStrategy === 'aggressive' ? 'Aggressive Trimming Strategy' : 'Balanced Strategy'}):</strong> Trim ${cutDescriptions}.
      This preserves your <strong>🔒 Locked Categories</strong>, essential Catering baselines, and Emergency Logistics Buffer while returning your total to <strong>${formatINR(plan.meta.totalBudget)}</strong>.
    `;

    lastRebalanceSuggestion = cuts;
    applyRebalanceBtn.style.display = 'inline-flex';
    rebalanceAlert.classList.remove('hidden');
  }

  // Apply Rebalance Solution
  function applyRebalance() {
    if (!lastRebalanceSuggestion || !currentPlan) return;

    lastRebalanceSuggestion.forEach(item => {
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
      (dayItem.schedule || []).forEach(evt => {
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
              📲 WhatsApp Schedule
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

    (dayItem.schedule || []).forEach(evt => {
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

    // Base mock date for demonstration (e.g. next month weekend)
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 30);

    currentPlan.timeline.forEach((dayItem, dIdx) => {
      const eventDate = new Date(baseDate);
      eventDate.setDate(eventDate.getDate() + dIdx);

      (dayItem.schedule || []).forEach((evt, eIdx) => {
        const uid = `celebration-${Date.now()}-${dIdx}-${eIdx}@celebrationai.app`;
        const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        // Parse time like "11:00 AM"
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
        end.setHours(start.getHours() + 2); // 2 hour block

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
      const completed = vendors.filter(v => v.done).length;
      const pct = Math.round((completed / total) * 100);
      checklistProgressText.textContent = `${completed} of ${total} tasks confirmed`;
      checklistProgressFill.style.width = pct + '%';
    }

    vendors.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `vendor-item-card ${item.done ? 'completed' : ''}`;

      const redFlagsHtml = (item.redFlags || []).map(rf => `<span class="red-flag-tag">⚠️ ${rf}</span>`).join(' ');

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

    ideas.forEach(idea => {
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

  // Render Entire Plan
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
      prompt: eventPromptInput.value.trim(),
      totalBudget: Number(totalBudgetInput.value) || 1500000,
      guestCount: Number(guestCountInput.value) || 250,
      eventType: eventTypeInput.value,
      location: eventLocationInput.value.trim()
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
      prompt: preset.prompt,
      totalBudget: preset.budget,
      guestCount: preset.guests,
      eventType: preset.type,
      location: preset.location,
      isDemo: true
    });
  });

  // Budget Rebalancer Buttons
  applyRebalanceBtn.addEventListener('click', applyRebalance);
  resetBudgetBtn.addEventListener('click', resetBudget);

  // Calendar Sync Buttons
  downloadCalendarBtn.addEventListener('click', exportGoogleCalendarICS);
  syncCalendarTabBtn.addEventListener('click', exportGoogleCalendarICS);

  // Print Plan Button
  printPlanBtn.addEventListener('click', () => {
    window.print();
  });

  // Copy Plan Summary
  copyPlanSummaryBtn.addEventListener('click', () => {
    if (!currentPlan) return;
    const m = currentPlan.meta;
    const budgetLines = currentPlan.budgetBreakdown.map(b => `- ${b.name}: ${formatINR(b.amount)} (${b.percentage}%) ${b.locked ? '[LOCKED]' : ''}`).join('\n');
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
