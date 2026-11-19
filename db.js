/**
 * Tappy — Daily Expense Tracker (Exact 1:1 iOS App Store UI & On-Device Storage)
 * Dual-persisted in IndexedDB + LocalStorage Mirror
 */

const DB_NAME = 'TappyExactIOSDB_v4';
const DB_VERSION = 4;
const LS_KEY = 'tappy_exact_ios_state_v4';

const IOS_COLORS = [
  { name: 'Food Coral', hex: '#E06C65' },
  { name: 'Transport Teal', hex: '#3EC1B2' },
  { name: 'Shopping Pink', hex: '#E8649A' },
  { name: 'Entertainment Purple', hex: '#A472E8' },
  { name: 'Health Green', hex: '#48C774' },
  { name: 'Personal Blue', hex: '#5A9EE8' },
  { name: 'Other Slate', hex: '#8FA3BF' },
  { name: 'EMI Amber', hex: '#E8A84E' },
  { name: 'Sunset Orange', hex: '#FF9F0A' },
  { name: 'Coral Red', hex: '#FF453A' },
  { name: 'Sky Cyan', hex: '#64D2FF' },
  { name: 'Golden Yellow', hex: '#FFD60A' }
];

const CURATED_EMOJIS = [
  '🍔', '🚕', '🛍️', '🎬', '💊', '👤', '✨', '🧾',
  '☕', '🛒', '📱', '✈️', '🏠', '⚡', '🎁', '🏋️',
  '📚', '🍕', '🍜', '⛽', '🚇', '🎮', '💇', '🐾',
  '🍷', '🍰', '💻', '🎵', '🏥', '👟'
];

// Exact 8 categories from the Tappy screenshots
const DEFAULT_CATEGORIES = [
  { id: 'cat_food', name: 'Food', emoji: '🍔', color: '#E06C65', order: 0 },
  { id: 'cat_transport', name: 'Transport', emoji: '🚕', color: '#3EC1B2', order: 1 },
  { id: 'cat_shopping', name: 'Shopping', emoji: '🛍️', color: '#E8649A', order: 2 },
  { id: 'cat_entertainment', name: 'Entertainment', emoji: '🎬', color: '#A472E8', order: 3 },
  { id: 'cat_health', name: 'Health', emoji: '💊', color: '#48C774', order: 4 },
  { id: 'cat_personal', name: 'Personal', emoji: '👤', color: '#5A9EE8', order: 5 },
  { id: 'cat_other', name: 'Other', emoji: '✨', color: '#8FA3BF', order: 6 },
  { id: 'cat_emi', name: 'EMI', emoji: '🧾', color: '#E8A84E', order: 7 }
];

const DEFAULT_SETTINGS = {
  currency: '₹',
  currencyCode: 'INR',
  currencyName: 'Indian Rupee',
  language: 'Automatic (English)',
  monthlyBudget: 0, // 0 = "Not set"
  cycleStartDay: 1,
  haptics: true
};

// Exact 24 records from tappy-expenses-2026-11-01-to-2026-11-20.csv
const INITIAL_CSV_EXPENSES = [
  { date: '2026-11-19', time: '22:24', category: 'Other', amount: 250.00, currency: 'INR', note: 'Babu' },
  { date: '2026-11-19', time: '19:41', category: 'Transport', amount: 200.00, currency: 'INR', note: 'Petrol' },
  { date: '2026-11-19', time: '10:57', category: 'Food', amount: 100.00, currency: 'INR', note: 'Kele pyaaz' },
  { date: '2026-11-19', time: '10:51', category: 'Food', amount: 160.00, currency: 'INR', note: 'Pohe' },
  { date: '2026-11-19', time: '00:18', category: 'Shopping', amount: 2500.00, currency: 'INR', note: 'Blazer' },
  { date: '2026-11-17', time: '21:22', category: 'Food', amount: 20.00, currency: 'INR', note: 'Bread' },
  { date: '2026-11-17', time: '21:21', category: 'Food', amount: 20.00, currency: 'INR', note: 'Mufali' },
  { date: '2026-11-17', time: '21:21', category: 'Food', amount: 155.00, currency: 'INR', note: 'Eggs' },
  { date: '2026-11-16', time: '19:26', category: 'Food', amount: 50.00, currency: 'INR', note: 'Monish ko kele ke' },
  { date: '2026-11-16', time: '13:32', category: 'Transport', amount: 20.00, currency: 'INR', note: 'parking' },
  { date: '2026-11-15', time: '19:46', category: 'Health', amount: 600.00, currency: 'INR', note: 'Loki ear medicine' },
  { date: '2026-11-13', time: '22:44', category: 'Other', amount: 50.00, currency: 'INR', note: 'Monish govind dev ji ' },
  { date: '2026-11-13', time: '19:27', category: 'Food', amount: 60.00, currency: 'INR', note: 'Kele' },
  { date: '2026-11-12', time: '17:05', category: 'Transport', amount: 200.00, currency: 'INR', note: 'Petrol' },
  { date: '2026-11-08', time: '17:05', category: 'Other', amount: 100.00, currency: 'INR', note: 'Monish - krish 100 rupee' },
  { date: '2026-11-08', time: '17:04', category: 'Food', amount: 150.00, currency: 'INR', note: 'Geeta kirana pooja saman' },
  { date: '2026-11-08', time: '17:03', category: 'Food', amount: 500.00, currency: 'INR', note: 'Shiv shakti mithai' },
  { date: '2026-11-08', time: '17:03', category: 'Food', amount: 200.00, currency: 'INR', note: 'Cold coffee late night' },
  { date: '2026-11-07', time: '17:03', category: 'Food', amount: 47.00, currency: 'INR', note: 'Nitya bhaiya' },
  { date: '2026-11-04', time: '17:02', category: 'Food', amount: 380.00, currency: 'INR', note: 'Cake anniversary' },
  { date: '2026-11-04', time: '17:01', category: 'Other', amount: 395.00, currency: 'INR', note: 'Unknown cash' },
  { date: '2026-11-03', time: '17:00', category: 'Food', amount: 30.00, currency: 'INR', note: 'Kele' },
  { date: '2026-11-02', time: '16:56', category: 'Transport', amount: 200.00, currency: 'INR', note: 'Petrol' },
  { date: '2026-11-01', time: '17:00', category: 'Other', amount: 340.00, currency: 'INR', note: 'Press ke kapde' }
];

class TappyStorage {
  constructor() {
    this.db = null;
    this.state = {
      categories: [...DEFAULT_CATEGORIES],
      expenses: [],
      settings: { ...DEFAULT_SETTINGS }
    };
  }

  async init() {
    // Clean up older cache versions so fresh dataset loads cleanly
    try {
      ['tappy_ios_state_v1', 'tappy_exact_ios_state_v2', 'tappy_exact_ios_state_v3'].forEach((k) => {
        localStorage.removeItem(k);
      });
    } catch (_) {}

    const rawMirror = localStorage.getItem(LS_KEY);
    let mirrorLoaded = false;

    if (rawMirror) {
      try {
        const parsed = JSON.parse(rawMirror);
        if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.expenses)) {
          this.state.categories = parsed.categories.sort((a, b) => a.order - b.order);
          this.state.expenses = parsed.expenses.sort((a, b) => b.timestamp - a.timestamp);
          this.state.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
          mirrorLoaded = true;
        }
      } catch (e) {
        console.warn('LocalStorage mirror parse warning:', e);
      }
    }

    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (_) {}
    }

    try {
      this.db = await this.openIndexedDB();
      const idbData = await this.readAllFromIDB();

      if (idbData.categories.length > 0 || idbData.expenses.length > 0) {
        this.state.categories = idbData.categories.sort((a, b) => a.order - b.order);
        this.state.expenses = idbData.expenses.sort((a, b) => b.timestamp - a.timestamp);
        if (idbData.settings) {
          this.state.settings = { ...DEFAULT_SETTINGS, ...idbData.settings };
        }
        this.syncMirror();
      } else if (mirrorLoaded) {
        await this.writeAllToIDB();
      } else {
        this.seedExactScreenshotExpenses();
        await this.writeAllToIDB();
        this.syncMirror();
      }
    } catch (err) {
      if (!mirrorLoaded) {
        this.seedExactScreenshotExpenses();
        this.syncMirror();
      }
    }

    // 4. Sync any background Back-Tap expenses from /api/state
    await this.syncFromServer();

    return this.state;
  }

  async syncFromServer() {
    try {
      const res = await fetch('./api/state', { cache: 'no-store' });
      if (!res.ok) return false;
      const serverState = await res.json();
      if (!serverState || !Array.isArray(serverState.expenses)) return false;

      // Merge server expenses with local expenses by ID so silent Back-Tap logs appear immediately
      const localMap = new Map(this.state.expenses.map((e) => [e.id, e]));
      let addedNew = false;

      serverState.expenses.forEach((se) => {
        if (!localMap.has(se.id)) {
          localMap.set(se.id, se);
          addedNew = true;
        }
      });

      if (addedNew || this.state.expenses.length === 0) {
        this.state.expenses = Array.from(localMap.values()).sort((a, b) => b.timestamp - a.timestamp);
        this.syncMirror();
        await this.writeAllToIDB();
        return true;
      }
    } catch (_) {
      // Offline mode — continue using IndexedDB + LocalStorage
    }
    return false;
  }

  async pushToServer() {
    try {
      await fetch('./api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state)
      });
    } catch (_) {}
  }

  openIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('timestamp', 'timestamp', { unique: false });
          expStore.createIndex('categoryId', 'categoryId', { unique: false });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  readAllFromIDB() {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve({ categories: [], expenses: [], settings: null });
      const tx = this.db.transaction(['categories', 'expenses', 'meta'], 'readonly');
      const catReq = tx.objectStore('categories').getAll();
      const expReq = tx.objectStore('expenses').getAll();
      const metaReq = tx.objectStore('meta').get('settings');

      tx.oncomplete = () => {
        resolve({
          categories: catReq.result || [],
          expenses: expReq.result || [],
          settings: metaReq.result ? metaReq.result.value : null
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  writeAllToIDB() {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      try {
        const tx = this.db.transaction(['categories', 'expenses', 'meta'], 'readwrite');
        const catStore = tx.objectStore('categories');
        const expStore = tx.objectStore('expenses');
        const metaStore = tx.objectStore('meta');

        catStore.clear();
        expStore.clear();

        this.state.categories.forEach((c) => catStore.put(c));
        this.state.expenses.forEach((e) => expStore.put(e));
        metaStore.put({ key: 'settings', value: this.state.settings });

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  syncMirror() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.state));
    } catch (_) {}
  }

  async saveState() {
    this.syncMirror();
    await this.writeAllToIDB();
    this.pushToServer();
  }

  async addExpense({ amount, categoryId, note = '', isCredit = false, timestamp = Date.now() }) {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return null;

    const expense = {
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      amount: Math.round(numAmount * 100) / 100,
      categoryId: categoryId || (this.state.categories[0] && this.state.categories[0].id) || 'cat_food',
      note: String(note || '').trim(),
      isCredit: Boolean(isCredit),
      timestamp: Number(timestamp) || Date.now(),
      createdAt: Date.now()
    };

    this.state.expenses.unshift(expense);
    this.state.expenses.sort((a, b) => b.timestamp - a.timestamp);
    await this.saveState();
    return expense;
  }

  async updateExpense(id, updates) {
    const idx = this.state.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    this.state.expenses[idx] = {
      ...this.state.expenses[idx],
      ...updates,
      amount: Math.round(Number(updates.amount ?? this.state.expenses[idx].amount) * 100) / 100,
      timestamp: Number(updates.timestamp ?? this.state.expenses[idx].timestamp)
    };
    this.state.expenses.sort((a, b) => b.timestamp - a.timestamp);
    await this.saveState();
    return this.state.expenses.find((e) => e.id === id);
  }

  async deleteExpense(id) {
    const idx = this.state.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const [removed] = this.state.expenses.splice(idx, 1);
    await this.saveState();
    return removed;
  }

  async saveCategory(catData) {
    if (catData.id) {
      const idx = this.state.categories.findIndex((c) => c.id === catData.id);
      if (idx !== -1) {
        this.state.categories[idx] = {
          ...this.state.categories[idx],
          name: String(catData.name || 'Category').trim(),
          emoji: String(catData.emoji || '✨').trim(),
          color: catData.color || '#E06C65'
        };
        await this.saveState();
        return this.state.categories[idx];
      }
    }

    const newCat = {
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: String(catData.name || 'New Category').trim(),
      emoji: String(catData.emoji || '✨').trim(),
      color: catData.color || IOS_COLORS[this.state.categories.length % IOS_COLORS.length].hex,
      order: this.state.categories.length
    };
    this.state.categories.push(newCat);
    await this.saveState();
    return newCat;
  }

  async reorderCategories(orderedIds) {
    const map = new Map(this.state.categories.map((c) => [c.id, c]));
    const next = [];
    orderedIds.forEach((id, index) => {
      const item = map.get(id);
      if (item) {
        item.order = index;
        next.push(item);
        map.delete(id);
      }
    });
    map.forEach((item) => {
      item.order = next.length;
      next.push(item);
    });
    this.state.categories = next;
    await this.saveState();
    return this.state.categories;
  }

  async deleteCategory(id) {
    if (this.state.categories.length <= 1) {
      throw new Error('At least one category is required.');
    }
    const idx = this.state.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.state.categories.splice(idx, 1);
    this.state.categories.forEach((c, i) => {
      c.order = i;
    });
    const fallbackId = this.state.categories[0].id;
    this.state.expenses.forEach((e) => {
      if (e.categoryId === id) e.categoryId = fallbackId;
    });
    await this.saveState();
    return true;
  }

  async updateSettings(partial) {
    this.state.settings = {
      ...this.state.settings,
      ...partial
    };
    await this.saveState();
    return this.state.settings;
  }

  resolveCategoryIdByName(catName) {
    const clean = String(catName || '').trim().toLowerCase();
    const found = this.state.categories.find(
      (c) => c.name.toLowerCase() === clean
    );
    if (found) return found.id;
    const other = this.state.categories.find((c) => c.id === 'cat_other');
    return other ? other.id : this.state.categories[0].id;
  }

  /**
   * Seeds all 23 exact expenses from tappy-expenses-2026-11-01-to-2026-11-19.csv
   */
  seedExactScreenshotExpenses() {
    this.state.expenses = INITIAL_CSV_EXPENSES.map((row, idx) => {
      const [y, m, d] = row.date.split('-').map(Number);
      const [hh, mm] = row.time.split(':').map(Number);
      // Reduce index seconds slightly for identical minute timestamps so CSV order is preserved
      const ts = new Date(y, m - 1, d, hh, mm, Math.max(0, 59 - idx)).getTime();

      return {
        id: `exp_csv_${idx}_${ts}`,
        amount: Number(row.amount),
        categoryId: this.resolveCategoryIdByName(row.category),
        note: row.note,
        isCredit: false,
        timestamp: ts,
        createdAt: ts
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Parses and imports a Tappy CSV file (Date,Time,Category,Amount,Currency,Note)
   */
  async importTappyCSV(csvText) {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return 0;

    // Parse CSV line respecting quoted fields
    const parseCSVLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur);
      return result;
    };

    const imported = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 4) continue;

      const dateStr = cols[0].trim();
      const timeStr = (cols[1] || '12:00').trim();
      const categoryName = (cols[2] || 'Other').trim();
      const amount = parseFloat(cols[3]);
      const note = cols[5] !== undefined ? cols[5] : '';

      if (!amount || isNaN(amount)) continue;

      const [y, m, d] = dateStr.split('-').map(Number);
      const [hh, mm] = timeStr.split(':').map(Number);
      const ts = new Date(
        y || new Date().getFullYear(),
        (m || 1) - 1,
        d || 1,
        hh || 12,
        mm || 0,
        Math.max(0, 59 - (i % 60))
      ).getTime();

      imported.push({
        id: `exp_imp_${Date.now()}_${i}`,
        amount: Math.round(amount * 100) / 100,
        categoryId: this.resolveCategoryIdByName(categoryName),
        note: String(note || ''),
        isCredit: false,
        timestamp: ts,
        createdAt: Date.now()
      });
    }

    if (imported.length > 0) {
      this.state.expenses = [...imported, ...this.state.expenses].sort(
        (a, b) => b.timestamp - a.timestamp
      );
      await this.saveState();
    }
    return imported.length;
  }
}

window.TappyStorage = TappyStorage;
window.IOS_COLORS = IOS_COLORS;
window.CURATED_EMOJIS = CURATED_EMOJIS;
window.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
window.INITIAL_CSV_EXPENSES = INITIAL_CSV_EXPENSES;
