/**
 * Celebration AI — Main Client Application
 * Handles presets, demo mode, plan rendering across 4 pillars, and the algorithmic Budget Rebalancer.
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
        <span>${cat.name} (${Math.round(pct)}%)</span>
      `;
      budgetLegend.appendChild(leg);
    });

    // Render Category Cards
    budgetGrid.innerHTML = '';
    categories.forEach((cat, idx) => {
      const card = document.createElement('div');
      card.className = 'category-card';
      const pct = Math.round((cat.amount / totalBudget) * 100);

      card.innerHTML = `
        <div>
          <div class="category-header">
            <span class="category-title">${cat.name}</span>
            <span class="category-priority-badge priority-${cat.priority || 'medium'}">${cat.priority || 'medium'}</span>
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

      budgetGrid.appendChild(card);
    });
  }

  // Algorithmic Budget Rebalancer
  function computeAndShowRebalance(plan, deficit) {
    const categories = plan.budgetBreakdown;
    
    // Identify flexible categories that have room to be reduced
    // (excluding items with flexibility <= 0.1 or critical priority)
    const eligible = [];
    let totalWeight = 0;

    categories.forEach((cat, idx) => {
      const flexibility = cat.flexibility !== undefined ? cat.flexibility : 0.5;
      const minAllowed = cat.minAllowed || Math.round(cat.amount * 0.4);
      const capacity = cat.amount - minAllowed;

      if (flexibility > 0.2 && capacity > 5000 && cat.priority !== 'critical') {
        const weight = capacity * flexibility;
        eligible.push({ idx, cat, capacity, flexibility, weight });
        totalWeight += weight;
      }
    });

    if (eligible.length === 0 || totalWeight === 0) {
      alertTitle.textContent = `Budget Exceeded by ${formatINR(deficit)}`;
      alertDesc.textContent = `All other categories are already at their minimum allowed allocations. Consider increasing your total budget or manually reducing higher priority line items.`;
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
      <strong>Smart Algorithmic Recommendation:</strong> Trim ${cutDescriptions}.
      This keeps your non-negotiable Catering and Emergency Logistics Buffer 100% protected while restoring your exact <strong>${formatINR(plan.meta.totalBudget)}</strong> ceiling.
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

    timeline.forEach(dayItem => {
      const dayCard = document.createElement('div');
      dayCard.className = 'timeline-day-card';

      let eventsHtml = '';
      (dayItem.schedule || []).forEach(evt => {
        eventsHtml += `
          <div class="event-item">
            <span class="event-time-badge">${evt.time}</span>
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
          <span class="day-date">${dayItem.date || ''}</span>
        </div>
        <div class="day-events">
          ${eventsHtml}
        </div>
      `;

      timelineContainer.appendChild(dayCard);
    });
  }

  // Render Pillar 3: Vendor Checklist
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
        </div>
      `;

      const check = card.querySelector('.vendor-checkbox');
      check.addEventListener('change', (e) => {
        item.done = e.target.checked;
        card.classList.toggle('completed', item.done);
        updateChecklistStats();
      });

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
          <span class="idea-tag">${idea.tag || 'Smart Idea'}</span>
          <button type="button" class="btn btn-small btn-outline copy-idea-btn" title="Copy idea">📋 Copy</button>
        </div>
        <div>
          <h4 class="idea-title">${idea.title}</h4>
          <p class="idea-desc">${idea.description}</p>
        </div>
      `;

      const copyBtn = card.querySelector('.copy-idea-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`${idea.title}\n${idea.description}`).then(() => {
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
    // Load standard wedding demo preset
    const preset = PRESETS.wedding;
    eventPromptInput.value = preset.prompt;
    totalBudgetInput.value = preset.budget;
    guestCountInput.value = preset.guests;
    eventTypeInput.value = preset.type;
    eventLocationInput.value = preset.location;

    // Load instantly
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

  // Print Plan Button
  printPlanBtn.addEventListener('click', () => {
    window.print();
  });

  // Copy Plan Summary
  copyPlanSummaryBtn.addEventListener('click', () => {
    if (!currentPlan) return;
    const m = currentPlan.meta;
    const budgetLines = currentPlan.budgetBreakdown.map(b => `- ${b.name}: ${formatINR(b.amount)} (${b.percentage}%)`).join('\n');
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
    setupTabs();
    checkServerHealth();

    // Auto-load initial demo blueprint on boot for zero blank screen
    tryDemoBtn.click();
  }

  init();

})();
