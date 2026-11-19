/**
 * Tappy — Daily Expense Tracker (Exact 1:1 Minimal Clean Dark UI & Logic)
 */

(function () {
  'use strict';

  const storage = new window.TappyStorage();

  const ui = {
    activeTab: 'tap', // 'history' | 'tap' | 'analytics'
    selectedCategoryId: null,
    keypadInput: '0',
    dateMode: 'today', // 'today' | 'yesterday' | 'custom'
    customDateStr: '',
    isCredit: false,

    // History filter ('today' | 'week' | 'month' | 'all')
    historyRange: 'today',

    // Spending period ('week' | 'month' | 'year')
    spendingPeriod: 'month',

    // Modals
    editingCategoryId: null,
    editingCatColor: '#E06C65',
    editingCatEmoji: '🍔',
    editingExpenseId: null,
    editingExpenseCatId: null,

    // Back-Tap 3-Step Shortcut Flow state
    backtapAmount: 0,
    backtapCategoryId: null,

    // Toast Undo
    lastUndoFn: null,
    toastTimer: null,
    audioCtx: null
  };

  // --- Formatting Helpers ---
  function hexToRgba(hex, alpha) {
    const clean = (hex || '#E06C65').replace('#', '');
    const num = parseInt(
      clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean,
      16
    );
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function formatCurrency(amount, decimals = 'auto') {
    const cur = storage.state.settings.currency || '₹';
    const val = Number(amount) || 0;
    const locale = storage.state.settings.currencyCode === 'INR' ? 'en-IN' : 'en-US';

    let minDec = 0;
    let maxDec = 2;
    if (decimals === 2) {
      minDec = 2;
      maxDec = 2;
    } else if (decimals === 0) {
      minDec = 0;
      maxDec = 0;
    } else {
      const isWhole = Math.abs(val - Math.round(val)) < 0.005;
      minDec = isWhole ? 0 : 2;
      maxDec = 2;
    }

    const str = val.toLocaleString(locale, {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec
    });
    return `${cur}${str}`;
  }

  function isSameDay(ts1, ts2) {
    const a = new Date(ts1);
    const b = new Date(ts2);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function formatDayGroupLabel(ts) {
    const now = new Date();
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (isSameDay(ts, now)) return 'TODAY';
    if (isSameDay(ts, yest)) return 'YESTERDAY';
    const d = new Date(ts);
    return d
      .toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      })
      .toUpperCase();
  }

  function formatTime12h(ts) {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function toDatetimeLocal(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function getCategoryById(id) {
    return (
      storage.state.categories.find((c) => c.id === id) ||
      storage.state.categories[0] || {
        id: 'cat_other',
        name: 'Other',
        emoji: '✨',
        color: '#8FA3BF'
      }
    );
  }

  // --- Subtle iOS Haptic & Tactile Click ---
  function triggerClick(type = 'tap') {
    if (!storage.state.settings.haptics) return;
    if (navigator.vibrate) {
      try {
        navigator.vibrate(type === 'save' ? [8, 24, 12] : 5);
      } catch (_) {}
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ui.audioCtx) ui.audioCtx = new AC();
      if (ui.audioCtx.state === 'suspended') ui.audioCtx.resume();

      const now = ui.audioCtx.currentTime;
      const osc = ui.audioCtx.createOscillator();
      const gain = ui.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(ui.audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'save' ? 540 : 150, now);
      osc.frequency.exponentialRampToValueAtTime(type === 'save' ? 820 : 60, now + (type === 'save' ? 0.08 : 0.016));
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (type === 'save' ? 0.09 : 0.016));
      osc.start(now);
      osc.stop(now + (type === 'save' ? 0.095 : 0.02));
    } catch (_) {}
  }

  function showToast(message, undoCallback = null) {
    const toast = document.getElementById('tappy-toast');
    const textEl = document.getElementById('tappy-toast-text');
    const undoBtn = document.getElementById('tappy-toast-undo');

    textEl.textContent = message;
    ui.lastUndoFn = undoCallback;

    if (undoCallback) {
      undoBtn.classList.remove('hidden');
    } else {
      undoBtn.classList.add('hidden');
    }

    toast.classList.add('visible');
    if (ui.toastTimer) clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      ui.lastUndoFn = null;
    }, undoCallback ? 4000 : 2200);
  }

  // --- Navigation (3 Bottom Tabs + Settings Overlay) ---
  function switchTab(tabName) {
    ui.activeTab = tabName;
    triggerClick('tap');

    document.querySelectorAll('.tab-view').forEach((v) => {
      v.classList.toggle('active', v.id === `view-${tabName}`);
    });

    document.querySelectorAll('.tappy-tab-bar .tappy-tab-item').forEach((btn) => {
      const active = btn.dataset.target === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (tabName === 'tap') renderTapView();
    if (tabName === 'history') renderHistoryView();
    if (tabName === 'analytics') renderSpendingView();
  }

  function openSettingsOverlay() {
    triggerClick('tap');
    renderSettingsView();
    document.getElementById('view-settings').classList.remove('hidden');
  }

  function closeSettingsOverlay() {
    triggerClick('tap');
    document.getElementById('view-settings').classList.add('hidden');
    renderTapView();
    renderHistoryView();
    renderSpendingView();
  }

  // ==========================================================================
  // SCREEN 1: "TAP" TAB (How much? + Categories + Date + Keypad + Save)
  // ==========================================================================
  function renderTapAmount() {
    const curEl = document.getElementById('tap-currency');
    const digitsEl = document.getElementById('tap-digits');
    const saveBtn = document.getElementById('tap-save-btn');

    curEl.textContent = storage.state.settings.currency || '₹';

    const parts = ui.keypadInput.split('.');
    const intNum = parseInt(parts[0] || '0', 10);
    const locale = storage.state.settings.currencyCode === 'INR' ? 'en-IN' : 'en-US';
    const formattedInt = isNaN(intNum) ? '0' : intNum.toLocaleString(locale);
    const displayStr = parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;

    digitsEl.textContent = displayStr;
    digitsEl.classList.toggle('long', displayStr.length > 8);

    const numVal = parseFloat(ui.keypadInput) || 0;
    saveBtn.classList.toggle('ready', numVal > 0);
  }

  function renderTapCategories() {
    const strip = document.getElementById('tap-category-strip');
    const cats = storage.state.categories;
    if (!ui.selectedCategoryId || !cats.some((c) => c.id === ui.selectedCategoryId)) {
      ui.selectedCategoryId = cats[0] ? cats[0].id : null;
    }

    strip.innerHTML = '';
    cats.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = cat.id === ui.selectedCategoryId;
      btn.className = `tap-cat-pill${isSelected ? ' selected' : ''}`;
      btn.style.setProperty('--pill-color', cat.color);
      btn.style.setProperty('--pill-bg', hexToRgba(cat.color, 0.14));

      btn.innerHTML = `
        <span class="cat-emoji">${cat.emoji}</span>
        <span>${cat.name}</span>
      `;

      btn.addEventListener('click', () => {
        triggerClick('tap');
        ui.selectedCategoryId = cat.id;
        renderTapCategories();
      });

      strip.appendChild(btn);
    });
  }

  function renderTapDateRow() {
    const todayBtn = document.getElementById('date-btn-today');
    const yestBtn = document.getElementById('date-btn-yesterday');
    const pickBtn = document.getElementById('date-btn-pick');
    const pickLabel = document.getElementById('pick-date-label');

    todayBtn.classList.toggle('active', ui.dateMode === 'today');
    yestBtn.classList.toggle('active', ui.dateMode === 'yesterday');
    pickBtn.classList.toggle('active', ui.dateMode === 'custom');

    if (ui.dateMode === 'custom' && ui.customDateStr) {
      const [y, m, d] = ui.customDateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      pickLabel.textContent = dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } else {
      pickLabel.textContent = 'Pick date';
    }
  }

  function renderTapView() {
    renderTapAmount();
    renderTapCategories();
    renderTapDateRow();
    document.getElementById('tap-credit-btn').classList.toggle('active', ui.isCredit);
  }

  function handleKeypadInput(key) {
    triggerClick('tap');

    if (key === 'backspace') {
      if (ui.keypadInput.length > 1) {
        ui.keypadInput = ui.keypadInput.slice(0, -1);
      } else {
        ui.keypadInput = '0';
      }
      renderTapAmount();
      return;
    }

    if (key === '.') {
      if (!ui.keypadInput.includes('.')) {
        ui.keypadInput += '.';
      }
      renderTapAmount();
      return;
    }

    if (/^\d$/.test(key)) {
      if (ui.keypadInput.includes('.')) {
        const dec = ui.keypadInput.split('.')[1] || '';
        if (dec.length >= 2) return;
      }
      if (ui.keypadInput.replace('.', '').length >= 8) return;

      if (ui.keypadInput === '0') {
        ui.keypadInput = key;
      } else {
        ui.keypadInput += key;
      }
      renderTapAmount();
    }
  }

  async function saveTapExpense() {
    const amount = parseFloat(ui.keypadInput) || 0;
    const row = document.getElementById('tap-amount-row');

    if (amount <= 0) {
      row.classList.remove('shake');
      void row.offsetWidth;
      row.classList.add('shake');
      triggerClick('tap');
      return;
    }

    const now = new Date();
    let timestamp = now.getTime();

    if (ui.dateMode === 'yesterday') {
      const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), now.getMinutes());
      timestamp = yest.getTime();
    } else if (ui.dateMode === 'custom' && ui.customDateStr) {
      const [y, m, d] = ui.customDateStr.split('-').map(Number);
      timestamp = new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime();
    }

    const noteInput = document.getElementById('tap-note-input');
    const note = noteInput.value.trim();
    const cat = getCategoryById(ui.selectedCategoryId);

    const saved = await storage.addExpense({
      amount,
      categoryId: cat.id,
      note,
      isCredit: ui.isCredit,
      timestamp
    });

    triggerClick('save');

    // Reset entry state
    ui.keypadInput = '0';
    ui.dateMode = 'today';
    ui.customDateStr = '';
    ui.isCredit = false;
    noteInput.value = '';
    renderTapView();

    showToast(`${cat.emoji} ${formatCurrency(saved.amount)} saved in ${cat.name}`, async () => {
      await storage.deleteExpense(saved.id);
      renderHistoryView();
      renderSpendingView();
    });
  }

  // ==========================================================================
  // SCREEN 2: "HISTORY" -> "Expenses" Screen
  // ==========================================================================
  function getHistoryFilteredExpenses() {
    const now = new Date();
    const range = ui.historyRange;
    let startTs = 0;

    if (range === 'today') {
      startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    } else if (range === 'week') {
      startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0).getTime();
    } else if (range === 'month') {
      const startDay = Math.min(28, Math.max(1, Number(storage.state.settings.cycleStartDay) || 1));
      const d = now.getDate();
      startTs = d >= startDay
        ? new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0).getTime()
        : new Date(now.getFullYear(), now.getMonth() - 1, startDay, 0, 0, 0).getTime();
    }

    return storage.state.expenses.filter((e) => e.timestamp >= startTs);
  }

  function attachSwipeDelete(wrapEl, rowEl, expense) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let dragging = false;
    let isOpen = false;

    rowEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = isOpen ? -84 : 0;
      dragging = true;
      rowEl.style.transition = 'none';
    }, { passive: true });

    rowEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 12) {
        dragging = false;
        rowEl.style.transition = '';
        rowEl.style.transform = isOpen ? 'translateX(-84px)' : 'translateX(0)';
        return;
      }

      const nextX = Math.min(0, Math.max(-150, (isOpen ? -84 : 0) + dx));
      currentX = nextX;
      rowEl.style.transform = `translateX(${nextX}px)`;
    }, { passive: true });

    rowEl.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      rowEl.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';

      if (currentX < -125) {
        rowEl.style.transform = 'translateX(-100%)';
        deleteExpenseWithUndo(expense);
      } else if (currentX < -38) {
        isOpen = true;
        rowEl.style.transform = 'translateX(-84px)';
      } else {
        isOpen = false;
        rowEl.style.transform = 'translateX(0)';
      }
    });
  }

  async function deleteExpenseWithUndo(expense) {
    const removed = await storage.deleteExpense(expense.id);
    if (!removed) return;
    triggerClick('tap');
    renderHistoryView();
    renderSpendingView();

    showToast(`Deleted ${formatCurrency(removed.amount)}`, async () => {
      await storage.addExpense(removed);
      renderHistoryView();
      renderSpendingView();
    });
  }

  function renderHistoryView() {
    document.querySelectorAll('#history-filter-pills .tappy-filter-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.range === ui.historyRange);
    });

    const filtered = getHistoryFilteredExpenses();
    const grandTotal = filtered.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('history-total-amount').textContent = formatCurrency(grandTotal);

    const container = document.getElementById('history-groups-container');
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-placeholder">No expenses logged for this period.</div>`;
      return;
    }

    // Group by calendar day
    const groups = [];
    const map = new Map();

    filtered.forEach((exp) => {
      const d = new Date(exp.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) {
        const g = {
          key,
          label: formatDayGroupLabel(exp.timestamp),
          subtotal: 0,
          items: []
        };
        map.set(key, g);
        groups.push(g);
      }
      const g = map.get(key);
      g.items.push(exp);
      g.subtotal += exp.amount;
    });

    groups.forEach((g) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'expense-day-group';

      const headerEl = document.createElement('div');
      headerEl.className = 'expense-day-header';
      headerEl.innerHTML = `
        <span class="day-header-title">${g.label}</span>
        <span class="day-header-total">${formatCurrency(g.subtotal)}</span>
      `;
      groupEl.appendChild(headerEl);

      g.items.forEach((exp) => {
        const cat = getCategoryById(exp.categoryId);
        const wrap = document.createElement('div');
        wrap.className = 'expense-swipe-wrap';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'expense-delete-action';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteExpenseWithUndo(exp);
        });

        const row = document.createElement('div');
        row.className = 'expense-item-row';
        const noteDisplay = exp.note
          ? `${exp.note}${exp.isCredit ? ' • Credit' : ''}`
          : (exp.isCredit ? 'Credit' : '');

        row.innerHTML = `
          <div class="expense-item-left">
            <div class="expense-avatar-circle" style="background: ${hexToRgba(cat.color, 0.16)}">
              ${cat.emoji}
            </div>
            <div class="expense-text-col">
              <div class="expense-cat-title">${cat.name}</div>
              ${noteDisplay ? `<div class="expense-note-sub">${noteDisplay}</div>` : ''}
            </div>
          </div>
          <div class="expense-item-right">
            <div class="expense-amount-val">${formatCurrency(exp.amount)}</div>
            <div class="expense-time-sub">${formatTime12h(exp.timestamp)}</div>
          </div>
        `;

        row.addEventListener('click', () => openEditExpenseModal(exp.id));
        attachSwipeDelete(wrap, row, exp);

        wrap.appendChild(delBtn);
        wrap.appendChild(row);
        groupEl.appendChild(wrap);
      });

      container.appendChild(groupEl);
    });
  }

  // ==========================================================================
  // SCREEN 3: "ANALYTICS" -> "Spending" Screen (Exact Match with Screenshot)
  // ==========================================================================
  function renderSpendingView() {
    const period = ui.spendingPeriod;
    document.querySelectorAll('#spending-period-pills .spending-period-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    let startTs = 0;
    let totalDaysInPeriod = 30;
    let elapsedDays = 1;
    let labelText = 'Spent this month';

    if (period === 'week') {
      labelText = 'Spent this week';
      startTs = new Date(y, m, d - 6, 0, 0, 0).getTime();
      totalDaysInPeriod = 7;
      elapsedDays = 7;
    } else if (period === 'month') {
      labelText = 'Spent this month';
      const startDay = Math.min(28, Math.max(1, Number(storage.state.settings.cycleStartDay) || 1));
      const cycleStart = d >= startDay
        ? new Date(y, m, startDay, 0, 0, 0)
        : new Date(y, m - 1, startDay, 0, 0, 0);
      const cycleEnd = d >= startDay
        ? new Date(y, m + 1, startDay, 0, 0, 0)
        : new Date(y, m, startDay, 0, 0, 0);

      startTs = cycleStart.getTime();
      totalDaysInPeriod = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86400000));
      elapsedDays = Math.max(1, Math.ceil((now.getTime() - cycleStart.getTime()) / 86400000));
    } else {
      labelText = 'Spent this year';
      const yearStart = new Date(y, 0, 1, 0, 0, 0);
      startTs = yearStart.getTime();
      totalDaysInPeriod = 365;
      elapsedDays = Math.max(1, Math.ceil((now.getTime() - yearStart.getTime()) / 86400000));
    }

    const periodExpenses = storage.state.expenses.filter((e) => e.timestamp >= startTs);
    const totalSpent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

    document.getElementById('spending-kpi-label').textContent = labelText;
    document.getElementById('spending-kpi-total').textContent = formatCurrency(totalSpent);

    // Budget left KPI Card
    const budgetLimit = Number(storage.state.settings.monthlyBudget) || 0;
    const budgetLeftEl = document.getElementById('spending-budget-left');
    if (budgetLimit <= 0) {
      budgetLeftEl.textContent = '—';
    } else {
      const scaledLimit = period === 'week'
        ? Math.round(budgetLimit / 4.3)
        : period === 'year'
        ? budgetLimit * 12
        : budgetLimit;
      const left = scaledLimit - totalSpent;
      budgetLeftEl.textContent = left >= 0 ? formatCurrency(left) : `-${formatCurrency(Math.abs(left))}`;
    }

    // Pace & Daily Average Calculation
    const dailyAvg = Math.round(totalSpent / elapsedDays);
    const onPaceFor = Math.round((totalSpent / elapsedDays) * totalDaysInPeriod);

    document.getElementById('spending-pace-amount').textContent = formatCurrency(onPaceFor);
    document.getElementById('spending-daily-avg').textContent = `${formatCurrency(dailyAvg)}/day average`;

    // By Category Breakdown Card
    const catListEl = document.getElementById('spending-category-list');
    catListEl.innerHTML = '';

    if (periodExpenses.length === 0 || totalSpent <= 0) {
      catListEl.innerHTML = `<div class="empty-placeholder" style="padding: 24px 0;">No expenses in this period yet.</div>`;
      return;
    }

    const catMap = new Map();
    periodExpenses.forEach((e) => {
      const prev = catMap.get(e.categoryId) || { amount: 0, items: [] };
      prev.amount += e.amount;
      prev.items.push(e);
      catMap.set(e.categoryId, prev);
    });

    const ranked = Array.from(catMap.entries())
      .map(([catId, data]) => ({
        category: getCategoryById(catId),
        amount: data.amount,
        items: data.items,
        pct: Math.round((data.amount / totalSpent) * 100)
      }))
      .sort((a, b) => b.amount - a.amount);

    ranked.forEach((row) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'by-cat-item';
      itemEl.innerHTML = `
        <div class="by-cat-accent-bar" style="background: ${row.category.color}"></div>
        <div class="by-cat-main">
          <div class="by-cat-top-line">
            <div class="by-cat-name-wrap">
              <span>${row.category.emoji}</span>
              <span>${row.category.name}</span>
            </div>
            <div class="by-cat-amount-wrap">
              <span>${formatCurrency(row.amount, 2)}</span>
              <span class="by-cat-chevron">›</span>
            </div>
          </div>
          <div class="by-cat-bottom-line">
            <div class="by-cat-progress-track">
              <div class="by-cat-progress-fill" style="width: ${Math.max(4, row.pct)}%; background: ${row.category.color}"></div>
            </div>
            <span class="by-cat-pct">${row.pct}%</span>
          </div>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        openCategoryDrilldownModal(row.category, row.items, row.amount);
      });

      catListEl.appendChild(itemEl);
    });
  }

  // ==========================================================================
  // SCREEN 4: FULL-SCREEN SETTINGS & DRAG-TO-REORDER CATEGORIES
  // ==========================================================================
  function renderSettingsCategories() {
    const container = document.getElementById('settings-categories-list');
    container.innerHTML = '';
    const cats = storage.state.categories;

    cats.forEach((cat) => {
      const row = document.createElement('div');
      row.className = 'settings-cat-item';
      row.dataset.id = cat.id;

      row.innerHTML = `
        <div class="settings-cat-left">
          <span class="settings-cat-emoji">${cat.emoji}</span>
          <span class="settings-cat-name">${cat.name}</span>
        </div>
        <div class="settings-cat-right">
          <button type="button" class="settings-cat-delete" aria-label="Delete ${cat.name}">✕</button>
          <span class="settings-cat-drag" title="Drag to reorder">≡</span>
        </div>
      `;

      // Tap category name/emoji to edit
      row.querySelector('.settings-cat-left').addEventListener('click', () => {
        openCategoryModal(cat);
      });

      // Tap red '✕' to delete category
      row.querySelector('.settings-cat-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (storage.state.categories.length <= 1) {
          showToast('At least 1 category is required');
          return;
        }
        await storage.deleteCategory(cat.id);
        triggerClick('tap');
        renderSettingsCategories();
        renderTapCategories();
        showToast(`Removed ${cat.emoji} ${cat.name}`);
      });

      // Drag handle '≡' pointer drag-and-drop
      const dragHandle = row.querySelector('.settings-cat-drag');
      dragHandle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        row.classList.add('dragging');
        dragHandle.setPointerCapture(e.pointerId);

        const onPointerMove = (moveEv) => {
          const y = moveEv.clientY;
          const siblings = [...container.querySelectorAll('.settings-cat-item:not(.dragging)')];
          const nextSibling = siblings.find((sib) => {
            const rect = sib.getBoundingClientRect();
            return y < rect.top + rect.height / 2;
          });
          if (nextSibling) {
            container.insertBefore(row, nextSibling);
          } else {
            container.appendChild(row);
          }
        };

        const onPointerUp = async () => {
          row.classList.remove('dragging');
          dragHandle.removeEventListener('pointermove', onPointerMove);
          dragHandle.removeEventListener('pointerup', onPointerUp);
          dragHandle.removeEventListener('pointercancel', onPointerUp);

          const orderedIds = [...container.querySelectorAll('.settings-cat-item')].map(
            (el) => el.dataset.id
          );
          triggerClick('tap');
          await storage.reorderCategories(orderedIds);
          renderSettingsCategories();
          renderTapCategories();
        };

        dragHandle.addEventListener('pointermove', onPointerMove);
        dragHandle.addEventListener('pointerup', onPointerUp);
        dragHandle.addEventListener('pointercancel', onPointerUp);
      });

      container.appendChild(row);
    });
  }

  function renderSettingsView() {
    const s = storage.state.settings;
    document.getElementById('setting-currency-label').textContent =
      `${s.currency} ${s.currencyName || 'Indian Rupee'}`;

    const budgetVal = Number(s.monthlyBudget) || 0;
    document.getElementById('setting-budget-label').textContent =
      budgetVal > 0 ? formatCurrency(budgetVal) : 'Not set';

    document.getElementById('setting-cycle-label').textContent =
      getOrdinal(Number(s.cycleStartDay) || 1);

    renderSettingsCategories();
  }

  // ==========================================================================
  // MODAL SHEETS (CATEGORY EDIT, EXPENSE EDIT, BUDGET, CURRENCY, GUIDES)
  // ==========================================================================
  function updateCategoryPreview() {
    const name = document.getElementById('cat-name-input').value.trim() || 'Category';
    const emoji = document.getElementById('cat-emoji-input').value.trim() || ui.editingCatEmoji || '🍔';
    const color = ui.editingCatColor || '#E06C65';

    const pill = document.getElementById('cat-live-preview');
    document.getElementById('cat-preview-emoji').textContent = emoji;
    document.getElementById('cat-preview-name').textContent = name;
    pill.style.setProperty('--pill-color', color);
    pill.style.setProperty('--pill-bg', hexToRgba(color, 0.16));
  }

  function openCategoryModal(category = null) {
    triggerClick('tap');
    ui.editingCategoryId = category ? category.id : null;
    ui.editingCatColor = category
      ? category.color
      : window.IOS_COLORS[storage.state.categories.length % window.IOS_COLORS.length].hex;
    ui.editingCatEmoji = category ? category.emoji : '☕';

    document.getElementById('cat-sheet-title').textContent = category ? 'Edit Category' : 'Add Category';
    document.getElementById('cat-name-input').value = category ? category.name : '';
    document.getElementById('cat-emoji-input').value = ui.editingCatEmoji;

    const emojiGrid = document.getElementById('emoji-grid-picker');
    emojiGrid.innerHTML = '';
    window.CURATED_EMOJIS.forEach((em) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `emoji-choice${em === ui.editingCatEmoji ? ' active' : ''}`;
      btn.textContent = em;
      btn.addEventListener('click', () => {
        ui.editingCatEmoji = em;
        document.getElementById('cat-emoji-input').value = em;
        emojiGrid.querySelectorAll('.emoji-choice').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        updateCategoryPreview();
      });
      emojiGrid.appendChild(btn);
    });

    const colorGrid = document.getElementById('color-swatch-grid');
    colorGrid.innerHTML = '';
    window.IOS_COLORS.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-choice${c.hex.toLowerCase() === ui.editingCatColor.toLowerCase() ? ' active' : ''}`;
      btn.style.background = c.hex;
      btn.addEventListener('click', () => {
        ui.editingCatColor = c.hex;
        colorGrid.querySelectorAll('.color-choice').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        updateCategoryPreview();
      });
      colorGrid.appendChild(btn);
    });

    updateCategoryPreview();
    document.getElementById('category-sheet-backdrop').classList.remove('hidden');
  }

  function openEditExpenseModal(expenseId) {
    const exp = storage.state.expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    triggerClick('tap');

    ui.editingExpenseId = exp.id;
    ui.editingExpenseCatId = exp.categoryId;

    document.getElementById('edit-exp-amount').value = exp.amount;
    document.getElementById('edit-exp-note').value = exp.note || '';
    document.getElementById('edit-exp-datetime').value = toDatetimeLocal(exp.timestamp);

    const grid = document.getElementById('edit-exp-cat-grid');
    const renderPills = () => {
      grid.innerHTML = '';
      storage.state.categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSel = cat.id === ui.editingExpenseCatId;
        btn.className = `tap-cat-pill${isSel ? ' selected' : ''}`;
        btn.style.setProperty('--pill-color', cat.color);
        btn.style.setProperty('--pill-bg', hexToRgba(cat.color, 0.16));
        btn.innerHTML = `<span>${cat.emoji}</span><span>${cat.name}</span>`;
        btn.addEventListener('click', () => {
          ui.editingExpenseCatId = cat.id;
          renderPills();
        });
        grid.appendChild(btn);
      });
    };
    renderPills();

    document.getElementById('expense-sheet-backdrop').classList.remove('hidden');
  }

  function openGenericSheet({ title, bodyHTML, actionText = null, onAction = null }) {
    triggerClick('tap');
    document.getElementById('generic-sheet-title').textContent = title;
    const bodyEl = document.getElementById('generic-sheet-body');
    bodyEl.innerHTML = bodyHTML;

    const actionBtn = document.getElementById('generic-sheet-action');
    const newActionBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

    if (actionText && onAction) {
      newActionBtn.textContent = actionText;
      newActionBtn.classList.remove('hidden');
      newActionBtn.style.visibility = 'visible';
      newActionBtn.addEventListener('click', () => {
        onAction();
      });
    } else {
      newActionBtn.classList.remove('hidden');
      newActionBtn.style.visibility = 'hidden';
    }

    document.getElementById('generic-sheet-backdrop').classList.remove('hidden');
  }

  function closeGenericSheet() {
    document.getElementById('generic-sheet-backdrop').classList.add('hidden');
  }

  function openMonthlyBudgetSheet() {
    const current = Number(storage.state.settings.monthlyBudget) || '';
    openGenericSheet({
      title: 'Monthly Budget',
      bodyHTML: `
        <div class="sheet-field">
          <label class="sheet-label" for="modal-budget-input">MONTHLY BUDGET AMOUNT (LEAVE 0 FOR "NOT SET")</label>
          <input type="number" id="modal-budget-input" class="sheet-text-input large-num" placeholder="Not set" value="${current}" min="0" step="500" />
        </div>
        <button type="button" class="sheet-danger-btn" id="clear-budget-btn">Clear Budget (Not set)</button>
      `,
      actionText: 'Save',
      onAction: async () => {
        const val = Math.max(0, Number(document.getElementById('modal-budget-input').value) || 0);
        await storage.updateSettings({ monthlyBudget: val });
        closeGenericSheet();
        renderSettingsView();
        renderSpendingView();
        showToast(val > 0 ? `Budget set to ${formatCurrency(val)}` : 'Monthly budget cleared');
      }
    });

    const clearBtn = document.getElementById('clear-budget-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        await storage.updateSettings({ monthlyBudget: 0 });
        closeGenericSheet();
        renderSettingsView();
        renderSpendingView();
        showToast('Monthly budget set to Not set');
      });
    }
  }

  function openCycleStartSheet() {
    const current = Number(storage.state.settings.cycleStartDay) || 1;
    let optionsHTML = '<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">';
    for (let d = 1; d <= 28; d++) {
      const active = d === current;
      optionsHTML += `
        <button type="button" class="cycle-day-option" data-day="${d}" style="
          height:42px; border-radius:12px; font-weight:600; cursor:pointer;
          background:${active ? '#FFFFFF' : '#222226'};
          color:${active ? '#000000' : '#FFFFFF'};
        ">${getOrdinal(d)}</button>
      `;
    }
    optionsHTML += '</div>';

    openGenericSheet({
      title: 'Cycle starts on',
      bodyHTML: optionsHTML
    });

    document.querySelectorAll('.cycle-day-option').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const day = Number(btn.dataset.day) || 1;
        await storage.updateSettings({ cycleStartDay: day });
        closeGenericSheet();
        renderSettingsView();
        renderSpendingView();
        showToast(`Cycle resets on the ${getOrdinal(day)}`);
      });
    });
  }

  function openCurrencySheet() {
    const currencies = [
      { symbol: '₹', code: 'INR', name: 'Indian Rupee' },
      { symbol: '$', code: 'USD', name: 'US Dollar' },
      { symbol: '€', code: 'EUR', name: 'Euro' },
      { symbol: '£', code: 'GBP', name: 'British Pound' },
      { symbol: 'AED ', code: 'AED', name: 'UAE Dirham' },
      { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
      { symbol: 'A$', code: 'AUD', name: 'Australian Dollar' },
      { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar' },
      { symbol: 'S$', code: 'SGD', name: 'Singapore Dollar' }
    ];

    const listHTML = currencies
      .map((c) => {
        const isCurrent = c.code === storage.state.settings.currencyCode;
        return `
          <button type="button" class="tappy-card-row currency-pick-row" data-symbol="${c.symbol}" data-code="${c.code}" data-name="${c.name}" style="background:#222226; border-radius:12px; margin-bottom:6px;">
            <span class="card-row-title">${c.symbol.trim()} — ${c.name} (${c.code})</span>
            <span style="color:var(--tappy-teal); font-weight:700;">${isCurrent ? '✓' : ''}</span>
          </button>
        `;
      })
      .join('');

    openGenericSheet({
      title: 'Select Currency',
      bodyHTML: `<div>${listHTML}</div>`
    });

    document.querySelectorAll('.currency-pick-row').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await storage.updateSettings({
          currency: btn.dataset.symbol,
          currencyCode: btn.dataset.code,
          currencyName: btn.dataset.name
        });
        closeGenericSheet();
        renderSettingsView();
        renderTapView();
        renderHistoryView();
        renderSpendingView();
        showToast(`Currency updated to ${btn.dataset.name}`);
      });
    });
  }

  function openCategoryDrilldownModal(category, items, totalAmount) {
    const rowsHTML = items
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(
        (exp) => `
        <div class="expense-item-row drilldown-exp-row" data-id="${exp.id}">
          <div class="expense-item-left">
            <div class="expense-avatar-circle" style="background: ${hexToRgba(category.color, 0.2)}">
              ${category.emoji}
            </div>
            <div class="expense-text-col">
              <div class="expense-cat-title">${exp.note || category.name}</div>
              <div class="expense-note-sub">${formatDayGroupLabel(exp.timestamp)} • ${formatTime12h(exp.timestamp)}</div>
            </div>
          </div>
          <div class="expense-item-right">
            <div class="expense-amount-val">${formatCurrency(exp.amount)}</div>
          </div>
        </div>
      `
      )
      .join('');

    openGenericSheet({
      title: `${category.emoji} ${category.name} (${formatCurrency(totalAmount)})`,
      bodyHTML: `<div class="drilldown-list-card">${rowsHTML}</div>`
    });

    document.querySelectorAll('.drilldown-exp-row').forEach((row) => {
      row.addEventListener('click', () => {
        closeGenericSheet();
        openEditExpenseModal(row.dataset.id);
      });
    });
  }

  // ==========================================================================
  // iOS BACK TAP 3-STEP SHORTCUT FLOW
  // Step 1: "How much did you spend?" -> Step 2: "Choose a category" -> Step 3: "Add a note (optional)"
  // ==========================================================================
  function launchBackTapFlow() {
    triggerClick('tap');
    ui.backtapAmount = 0;
    ui.backtapCategoryId = null;

    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.add('hidden');

    const overlay = document.getElementById('ios-backtap-overlay');
    const stepAmount = document.getElementById('backtap-step-amount');
    const stepCat = document.getElementById('backtap-step-category');
    const stepNote = document.getElementById('backtap-step-note');
    const amountInput = document.getElementById('backtap-amount-input');
    const noteInput = document.getElementById('backtap-note-input');

    amountInput.value = '';
    noteInput.value = '';

    stepAmount.classList.remove('hidden');
    stepCat.classList.add('hidden');
    stepNote.classList.add('hidden');
    overlay.classList.remove('hidden');

    setTimeout(() => {
      amountInput.focus();
    }, 60);
  }

  function closeBackTapFlow() {
    triggerClick('tap');
    document.getElementById('ios-backtap-overlay').classList.add('hidden');
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('hidden');
    document.getElementById('backtap-amount-input').blur();
    document.getElementById('backtap-note-input').blur();
  }

  function advanceBackTapToCategory() {
    const rawVal = document.getElementById('backtap-amount-input').value.replace(/,/g, '').trim();
    const amount = parseFloat(rawVal);

    if (!amount || amount <= 0) {
      const box = document.querySelector('.shortcut-amount-box');
      box.style.outline = '1.5px solid #E05246';
      setTimeout(() => {
        box.style.outline = 'none';
      }, 450);
      document.getElementById('backtap-amount-input').focus();
      return;
    }

    triggerClick('tap');
    ui.backtapAmount = Math.round(amount * 100) / 100;
    document.getElementById('backtap-amount-input').blur();

    // Populate "Choose a category" list in exact user category order
    const listEl = document.getElementById('backtap-category-list');
    listEl.innerHTML = '';

    storage.state.categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shortcut-cat-row';
      btn.innerHTML = `
        <span class="shortcut-cat-emoji">${cat.emoji}</span>
        <span>${cat.name}</span>
      `;
      btn.addEventListener('click', () => {
        advanceBackTapToNote(cat.id);
      });
      listEl.appendChild(btn);
    });

    document.getElementById('backtap-step-amount').classList.add('hidden');
    document.getElementById('backtap-step-category').classList.remove('hidden');
  }

  function advanceBackTapToNote(categoryId) {
    triggerClick('tap');
    ui.backtapCategoryId = categoryId;

    document.getElementById('backtap-step-category').classList.add('hidden');
    document.getElementById('backtap-step-note').classList.remove('hidden');

    const noteInput = document.getElementById('backtap-note-input');
    noteInput.value = '';
    setTimeout(() => {
      noteInput.focus();
    }, 60);
  }

  async function completeBackTapFlow() {
    if (!ui.backtapAmount || ui.backtapAmount <= 0) {
      closeBackTapFlow();
      return;
    }

    const note = document.getElementById('backtap-note-input').value.trim();
    const cat = getCategoryById(ui.backtapCategoryId);

    const saved = await storage.addExpense({
      amount: ui.backtapAmount,
      categoryId: cat.id,
      note,
      timestamp: Date.now()
    });

    triggerClick('save');
    closeBackTapFlow();
    renderTapView();
    renderHistoryView();
    renderSpendingView();

    showToast(`${cat.emoji} ${formatCurrency(saved.amount)} saved in ${cat.name}`, async () => {
      await storage.deleteExpense(saved.id);
      renderHistoryView();
      renderSpendingView();
    });
  }

  function openQuickLaunchGuide(type) {
    const baseUrl = window.location.origin;
    const categoriesApiUrl = `${baseUrl}/api/categories-text`;
    const silentLogApiUrl = `${baseUrl}/api/log`;

    openGenericSheet({
      title: 'Popup-Only Back Tap Script Setup',
      bodyHTML: `
        <div style="display:flex; flex-direction:column; gap:12px; font-size:13.5px; color:#C8C8CE; line-height:1.45;">
          <div style="background:rgba(78, 205, 196, 0.12); border:1px solid rgba(78, 205, 196, 0.35); padding:12px; border-radius:14px; color:#E8FDFB; font-size:13px;">
            💡 <strong>Why did the full app open before?</strong><br/>
            In iOS Shortcuts, the <em>"Open URLs"</em> action launches the app window. To show <strong>ONLY the native popup over any app/Home Screen</strong> without opening the app, use <strong>"Get Contents of URL"</strong> at the end — it runs our connected background script silently!
          </div>

          <div style="background:#202024; padding:14px; border-radius:14px; display:flex; flex-direction:column; gap:8px;">
            <div style="font-weight:700; color:#FFF; font-size:14.5px;">iOS Shortcut Actions (Popup-Only Over Any App)</div>

            <p style="font-size:12.5px; color:#D8D8DF;">
              <strong>1. Ask for Input</strong> → Type: <code>Number</code>, Prompt: <code>How much did you spend?</code>
            </p>

            <p style="font-size:12.5px; color:#D8D8DF;">
              <strong>2. Get Contents of URL</strong> <em>(fetches your live reordered categories)</em> →<br/>
              <span style="font-family:monospace; font-size:11.5px; color:var(--tappy-teal); user-select:all; -webkit-user-select:all;">${categoriesApiUrl}</span><br/>
              Then add <strong>Split Text</strong> (by <code>New Lines</code>) → <strong>Choose from List</strong> (Prompt: <code>Choose a category</code>)
            </p>

            <p style="font-size:12.5px; color:#D8D8DF;">
              <strong>3. Ask for Input</strong> → Type: <code>Text</code>, Prompt: <code>Add a note (optional)</code> <em>(expand arrow → uncheck "Require Answer" if optional)</em>
            </p>

            <p style="font-size:12.5px; color:#D8D8DF;">
              <strong>4. Get Contents of URL</strong> <em>(saves silently to the app without opening it!)</em> →<br/>
              Tap <strong>Show More</strong> → Method: <strong>POST</strong> → Request Body: <strong>JSON</strong>:<br/>
              • <code>amount</code> = <em>Provided Input (from Step 1)</em><br/>
              • <code>cat</code> = <em>Chosen Item (from Step 2)</em><br/>
              • <code>note</code> = <em>Provided Input (from Step 3)</em>
            </p>

            <div style="background:#141416; padding:9px 11px; border-radius:10px; font-family:monospace; font-size:11.5px; color:var(--tappy-teal); word-break:break-all; user-select:all; -webkit-user-select:all;">
              ${silentLogApiUrl}
            </div>

            <div style="display:flex; gap:8px; margin-top:4px;">
              <button type="button" id="copy-silent-api-btn" style="flex:1; height:40px; border-radius:10px; background:var(--tappy-teal); color:#000; font-weight:700; font-size:13px; cursor:pointer;">
                Copy Script URL (/api/log)
              </button>
              <button type="button" id="copy-cat-api-btn" style="flex:1; height:40px; border-radius:10px; background:#2C2C32; color:#FFF; font-weight:600; font-size:12.5px; cursor:pointer;">
                Copy Categories URL
              </button>
            </div>
          </div>

          <button type="button" id="run-backtap-flow-now" style="height:44px; border-radius:12px; background:#222226; color:#FFF; font-weight:600; font-size:14px; cursor:pointer;">
            ⚡ Test Popup Flow Inside App
          </button>
        </div>
      `
    });

    const runBtn = document.getElementById('run-backtap-flow-now');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        closeGenericSheet();
        document.getElementById('view-settings').classList.add('hidden');
        launchBackTapFlow();
      });
    }

    const copyLogBtn = document.getElementById('copy-silent-api-btn');
    if (copyLogBtn) {
      copyLogBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(silentLogApiUrl);
          showToast('Copied /api/log script URL!');
        } catch (_) {
          showToast('Tap and hold the URL box to copy');
        }
      });
    }

    const copyCatBtn = document.getElementById('copy-cat-api-btn');
    if (copyCatBtn) {
      copyCatBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(categoriesApiUrl);
          showToast('Copied /api/categories-text URL!');
        } catch (_) {
          showToast('Tap and hold the URL box to copy');
        }
      });
    }
  }

  function openICloudBackupSheet() {
    openGenericSheet({
      title: 'iCloud & On-Device Backup',
      bodyHTML: `
        <p style="font-size:14px; color:#A0A0A8; line-height:1.45;">
          Your expenses are automatically saved on your iPhone (IndexedDB + LocalStorage). You can also save a backup file to <strong>iCloud Drive</strong> or restore from a backup file:
        </p>
        <button type="button" id="sheet-export-json" style="height:46px; border-radius:13px; background:var(--tappy-teal); color:#000; font-weight:700; font-size:15px; cursor:pointer;">
          Save Backup to iCloud Drive (.JSON)
        </button>
        <label for="sheet-import-json" style="height:46px; border-radius:13px; background:#222226; color:#FFF; font-weight:600; font-size:15px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          Restore from iCloud Backup File
          <input type="file" id="sheet-import-json" accept=".json,application/json" class="hidden" />
        </label>
      `
    });

    document.getElementById('sheet-export-json').addEventListener('click', () => {
      const payload = {
        app: 'Tappy iOS Expense Tracker',
        exportedAt: new Date().toISOString(),
        ...storage.state
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tappy-icloud-backup.json`;
      a.click();
      URL.revokeObjectURL(url);
      closeGenericSheet();
      showToast('Backup file downloaded');
    });

    document.getElementById('sheet-import-json').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (Array.isArray(parsed.categories) && Array.isArray(parsed.expenses)) {
            storage.state.categories = parsed.categories;
            storage.state.expenses = parsed.expenses;
            if (parsed.settings) {
              storage.state.settings = { ...storage.state.settings, ...parsed.settings };
            }
            await storage.saveState();
            closeGenericSheet();
            renderSettingsView();
            renderTapView();
            renderHistoryView();
            renderSpendingView();
            showToast(`Restored ${parsed.expenses.length} expenses`);
          }
        } catch (_) {
          showToast('Invalid backup file');
        }
      };
      reader.readAsText(file);
    });
  }

  function exportToCSV() {
    const rows = [['Date', 'Time', 'Category', 'Amount', 'Currency', 'Note']];
    const pad = (n) => String(n).padStart(2, '0');

    storage.state.expenses.forEach((e) => {
      const cat = getCategoryById(e.categoryId);
      const d = new Date(e.timestamp);
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const safeCat = `"${cat.name.replace(/"/g, '""')}"`;
      const safeNote = `"${(e.note || '').replace(/"/g, '""')}"`;
      rows.push([
        dateStr,
        timeStr,
        safeCat,
        Number(e.amount).toFixed(2),
        storage.state.settings.currencyCode || 'INR',
        safeNote
      ]);
    });

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tappy-expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported expenses to CSV');
  }

  async function checkUrlShortcutParams() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('shortcut') || params.has('backtap') || window.location.hash === '#shortcut') {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      launchBackTapFlow();
      return;
    }

    if (params.has('tab')) {
      const t = params.get('tab');
      if (['history', 'tap', 'analytics'].includes(t)) switchTab(t);
    }

    if (params.has('add')) {
      const amt = parseFloat(params.get('add'));
      const catQuery = (params.get('cat') || '').toLowerCase();
      const note = params.get('note') || '';

      if (amt > 0) {
        const matched =
          storage.state.categories.find(
            (c) =>
              c.name.toLowerCase().includes(catQuery) ||
              catQuery.includes(c.name.toLowerCase())
          ) || storage.state.categories[0];

        const saved = await storage.addExpense({
          amount: amt,
          categoryId: matched.id,
          note,
          timestamp: Date.now()
        });

        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
        renderTapView();
        renderHistoryView();
        renderSpendingView();
        showToast(`${matched.emoji} ${formatCurrency(saved.amount)} saved in ${matched.name}`, async () => {
          await storage.deleteExpense(saved.id);
          renderHistoryView();
          renderSpendingView();
        });
      }
    }
  }

  // ==========================================================================
  // EVENT LISTENERS & INITIALIZATION
  // ==========================================================================
  function bindEvents() {
    // Bottom 3 Tabs
    document.querySelectorAll('.tappy-tab-bar .tappy-tab-item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.target));
    });

    // Toast Undo
    document.getElementById('tappy-toast-undo').addEventListener('click', async () => {
      if (ui.lastUndoFn) {
        const fn = ui.lastUndoFn;
        ui.lastUndoFn = null;
        await fn();
        document.getElementById('tappy-toast').classList.remove('visible');
      }
    });

    // Top-Right Sliders Icon -> Open Settings Overlay
    document.querySelectorAll('.open-settings-btn').forEach((btn) => {
      btn.addEventListener('click', openSettingsOverlay);
    });

    // Settings Back Button
    document.getElementById('close-settings-btn').addEventListener('click', closeSettingsOverlay);

    // TAP SCREEN: Date Row
    document.getElementById('date-btn-today').addEventListener('click', () => {
      triggerClick('tap');
      ui.dateMode = 'today';
      renderTapDateRow();
    });

    document.getElementById('date-btn-yesterday').addEventListener('click', () => {
      triggerClick('tap');
      ui.dateMode = 'yesterday';
      renderTapDateRow();
    });

    document.getElementById('native-date-picker').addEventListener('change', (e) => {
      if (e.target.value) {
        ui.dateMode = 'custom';
        ui.customDateStr = e.target.value;
        renderTapDateRow();
      }
    });

    // TAP SCREEN: Credit Toggle Pill
    document.getElementById('tap-credit-btn').addEventListener('click', () => {
      triggerClick('tap');
      ui.isCredit = !ui.isCredit;
      document.getElementById('tap-credit-btn').classList.toggle('active', ui.isCredit);
    });

    // TAP SCREEN: Keypad Keys & Save
    document.querySelectorAll('#tap-keypad .tap-key').forEach((btn) => {
      btn.addEventListener('click', () => handleKeypadInput(btn.dataset.key));
    });

    document.getElementById('tap-save-btn').addEventListener('click', saveTapExpense);

    // Hardware Keyboard Support on Tap Screen
    window.addEventListener('keydown', (e) => {
      if (ui.activeTab !== 'tap') return;
      if (!document.getElementById('view-settings').classList.contains('hidden')) return;
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter' && document.activeElement.id === 'tap-note-input') {
          document.activeElement.blur();
          saveTapExpense();
        }
        return;
      }

      if (/^\d$/.test(e.key) || e.key === '.') {
        e.preventDefault();
        handleKeypadInput(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadInput('backspace');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        saveTapExpense();
      }
    });

    // HISTORY SCREEN: Filter Pills (Today | This Week | This Month | All)
    document.querySelectorAll('#history-filter-pills .tappy-filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        triggerClick('tap');
        ui.historyRange = btn.dataset.range;
        renderHistoryView();
      });
    });

    // SPENDING SCREEN: Period Pills (Week | Month | Year)
    document.querySelectorAll('#spending-period-pills .spending-period-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        triggerClick('tap');
        ui.spendingPeriod = btn.dataset.period;
        renderSpendingView();
      });
    });

    document.getElementById('budget-left-card').addEventListener('click', openMonthlyBudgetSheet);

    // SETTINGS SCREEN: Row Actions
    document.getElementById('setting-currency-btn').addEventListener('click', openCurrencySheet);
    document.getElementById('setting-language-btn').addEventListener('click', () => {
      showToast('Language: Automatic (English)');
    });
    document.getElementById('setting-pro-btn').addEventListener('click', () => {
      showToast('✨ All Tappy Pro features are unlocked & free!');
    });
    document.getElementById('setting-restore-btn').addEventListener('click', () => {
      showToast('✓ Tappy Pro active');
    });
    document.getElementById('setting-budget-btn').addEventListener('click', openMonthlyBudgetSheet);
    document.getElementById('setting-cycle-btn').addEventListener('click', openCycleStartSheet);
    document.getElementById('settings-add-category-btn').addEventListener('click', () => openCategoryModal(null));

    document.querySelectorAll('.ql-teal-pill').forEach((btn) => {
      btn.addEventListener('click', () => openQuickLaunchGuide(btn.dataset.guide));
    });

    document.getElementById('setting-icloud-btn').addEventListener('click', openICloudBackupSheet);
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

    document.getElementById('import-csv-input').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const count = await storage.importTappyCSV(ev.target.result);
        renderHistoryView();
        renderSpendingView();
        showToast(count > 0 ? `Imported ${count} expenses from CSV` : 'No valid rows found in CSV');
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('clear-all-data-btn').addEventListener('click', async () => {
      const backup = [...storage.state.expenses];
      storage.state.expenses = [];
      await storage.saveState();
      renderHistoryView();
      renderSpendingView();
      showToast('All expenses cleared', async () => {
        storage.state.expenses = backup;
        await storage.saveState();
        renderHistoryView();
        renderSpendingView();
      });
    });

    document.getElementById('rate-app-btn').addEventListener('click', () => {
      showToast('❤️ Thank you for loving Tappy!');
    });
    document.getElementById('share-feedback-btn').addEventListener('click', () => {
      showToast('Feedback saved — thank you!');
    });

    document.getElementById('reset-demo-btn').addEventListener('click', async () => {
      storage.state.categories = [...window.DEFAULT_CATEGORIES];
      storage.seedExactScreenshotExpenses();
      await storage.saveState();
      renderSettingsView();
      renderTapView();
      renderHistoryView();
      renderSpendingView();
      showToast('Restored Tappy screenshot sample data');
    });

    // CATEGORY MODAL SHEET
    document.getElementById('cat-sheet-cancel').addEventListener('click', () => {
      document.getElementById('category-sheet-backdrop').classList.add('hidden');
    });
    document.getElementById('cat-name-input').addEventListener('input', updateCategoryPreview);
    document.getElementById('cat-emoji-input').addEventListener('input', (e) => {
      if (e.target.value.trim()) ui.editingCatEmoji = e.target.value.trim();
      updateCategoryPreview();
    });
    document.getElementById('cat-sheet-save').addEventListener('click', async () => {
      const name = document.getElementById('cat-name-input').value.trim() || 'Category';
      const emoji = document.getElementById('cat-emoji-input').value.trim() || ui.editingCatEmoji || '🍔';
      const saved = await storage.saveCategory({
        id: ui.editingCategoryId,
        name,
        emoji,
        color: ui.editingCatColor
      });
      triggerClick('save');
      document.getElementById('category-sheet-backdrop').classList.add('hidden');
      renderSettingsCategories();
      renderTapCategories();
      renderHistoryView();
      renderSpendingView();
      showToast(`Saved ${saved.emoji} ${saved.name}`);
    });

    // EDIT EXPENSE MODAL SHEET
    document.getElementById('exp-sheet-cancel').addEventListener('click', () => {
      document.getElementById('expense-sheet-backdrop').classList.add('hidden');
    });
    document.getElementById('exp-sheet-save').addEventListener('click', async () => {
      if (!ui.editingExpenseId) return;
      const amount = parseFloat(document.getElementById('edit-exp-amount').value);
      const note = document.getElementById('edit-exp-note').value.trim();
      const dtVal = document.getElementById('edit-exp-datetime').value;
      const timestamp = dtVal ? new Date(dtVal).getTime() : Date.now();
      if (!amount || amount <= 0) return;

      await storage.updateExpense(ui.editingExpenseId, {
        amount,
        categoryId: ui.editingExpenseCatId,
        note,
        timestamp
      });
      triggerClick('save');
      document.getElementById('expense-sheet-backdrop').classList.add('hidden');
      renderHistoryView();
      renderSpendingView();
      showToast('Expense updated');
    });

    document.getElementById('exp-sheet-delete').addEventListener('click', () => {
      const exp = storage.state.expenses.find((e) => e.id === ui.editingExpenseId);
      document.getElementById('expense-sheet-backdrop').classList.add('hidden');
      if (exp) deleteExpenseWithUndo(exp);
    });

    // GENERIC SHEET CLOSE
    document.getElementById('generic-sheet-close').addEventListener('click', closeGenericSheet);

    // BACK-TAP 3-STEP SHORTCUT OVERLAY EVENTS
    document.getElementById('backtap-amount-cancel').addEventListener('click', closeBackTapFlow);
    document.getElementById('backtap-amount-done').addEventListener('click', advanceBackTapToCategory);
    document.getElementById('backtap-note-cancel').addEventListener('click', closeBackTapFlow);
    document.getElementById('backtap-note-done').addEventListener('click', completeBackTapFlow);

    document.getElementById('backtap-amount-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        advanceBackTapToCategory();
      } else if (e.key === 'Escape') {
        closeBackTapFlow();
      }
    });

    document.getElementById('backtap-note-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        completeBackTapFlow();
      } else if (e.key === 'Escape') {
        closeBackTapFlow();
      }
    });

    // Backdrop tap closes modals
    ['category-sheet-backdrop', 'expense-sheet-backdrop', 'generic-sheet-backdrop'].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener('click', (e) => {
        if (e.target === el) el.classList.add('hidden');
      });
    });
  }

  async function init() {
    await storage.init();
    ui.selectedCategoryId = storage.state.categories[0] ? storage.state.categories[0].id : null;
    bindEvents();
    renderTapView();
    renderHistoryView();
    renderSpendingView();
    await checkUrlShortcutParams();

    // Auto-sync silent Back-Tap logs from /api/state whenever app focuses or polls
    const syncSilentLogs = async () => {
      const updated = await storage.syncFromServer();
      if (updated) {
        renderHistoryView();
        renderSpendingView();
      }
    };

    window.addEventListener('focus', syncSilentLogs);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncSilentLogs();
    });
    setInterval(syncSilentLogs, 3000);

    // Enforce Portrait Mode Lock on iOS / Mobile Landscape Rotation
    const enforcePortraitLock = () => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait-primary').catch(() => {});
      }
      const angle =
        (screen.orientation && typeof screen.orientation.angle === 'number')
          ? screen.orientation.angle
          : (typeof window.orientation === 'number' ? window.orientation : 0);

      if (angle === 90) {
        document.documentElement.style.setProperty('--portrait-lock-angle', '-90deg');
      } else if (angle === -90 || angle === 270) {
        document.documentElement.style.setProperty('--portrait-lock-angle', '90deg');
      } else {
        document.documentElement.style.setProperty('--portrait-lock-angle', '0deg');
      }
    };

    enforcePortraitLock();
    window.addEventListener('orientationchange', enforcePortraitLock);
    window.addEventListener('resize', enforcePortraitLock);
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', enforcePortraitLock);
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  init();
})();
