const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tappy-data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

const INITIAL_CSV_EXPENSES = [
  { date: '2026-11-19', time: '22:24', category: 'Other', amount: 250.00, note: 'Babu' },
  { date: '2026-11-19', time: '19:41', category: 'Transport', amount: 200.00, note: 'Petrol' },
  { date: '2026-11-19', time: '10:57', category: 'Food', amount: 100.00, note: 'Kele pyaaz' },
  { date: '2026-11-19', time: '10:51', category: 'Food', amount: 160.00, note: 'Pohe' },
  { date: '2026-11-17', time: '21:22', category: 'Food', amount: 20.00, note: 'Bread' },
  { date: '2026-11-17', time: '21:21', category: 'Food', amount: 20.00, note: 'Mufali' },
  { date: '2026-11-17', time: '21:21', category: 'Food', amount: 155.00, note: 'Eggs' },
  { date: '2026-11-16', time: '19:26', category: 'Food', amount: 50.00, note: 'Monish ko kele ke' },
  { date: '2026-11-16', time: '13:32', category: 'Transport', amount: 20.00, note: 'parking' },
  { date: '2026-11-15', time: '19:46', category: 'Health', amount: 600.00, note: 'Loki ear medicine' },
  { date: '2026-11-13', time: '22:44', category: 'Other', amount: 50.00, note: 'Monish govind dev ji ' },
  { date: '2026-11-13', time: '19:27', category: 'Food', amount: 60.00, note: 'Kele' },
  { date: '2026-11-12', time: '17:05', category: 'Transport', amount: 200.00, note: 'Petrol' },
  { date: '2026-11-08', time: '17:05', category: 'Other', amount: 100.00, note: 'Monish - krish 100 rupee' },
  { date: '2026-11-08', time: '17:04', category: 'Food', amount: 150.00, note: 'Geeta kirana pooja saman' },
  { date: '2026-11-08', time: '17:03', category: 'Food', amount: 500.00, note: 'Shiv shakti mithai' },
  { date: '2026-11-08', time: '17:03', category: 'Food', amount: 200.00, note: 'Cold coffee late night' },
  { date: '2026-11-07', time: '17:03', category: 'Food', amount: 47.00, note: 'Nitya bhaiya' },
  { date: '2026-11-04', time: '17:02', category: 'Food', amount: 380.00, note: 'Cake anniversary' },
  { date: '2026-11-04', time: '17:01', category: 'Other', amount: 395.00, note: 'Unknown cash' },
  { date: '2026-11-03', time: '17:00', category: 'Food', amount: 30.00, note: 'Kele' },
  { date: '2026-11-02', time: '16:56', category: 'Transport', amount: 200.00, note: 'Petrol' },
  { date: '2026-11-01', time: '17:00', category: 'Other', amount: 340.00, note: 'Press ke kapde' }
];

function buildInitialState() {
  const catMap = {
    food: 'cat_food',
    transport: 'cat_transport',
    shopping: 'cat_shopping',
    entertainment: 'cat_entertainment',
    health: 'cat_health',
    personal: 'cat_personal',
    other: 'cat_other',
    emi: 'cat_emi'
  };

  const expenses = INITIAL_CSV_EXPENSES.map((row, idx) => {
    const [y, m, d] = row.date.split('-').map(Number);
    const [hh, mm] = row.time.split(':').map(Number);
    const ts = new Date(y, m - 1, d, hh, mm, Math.max(0, 59 - idx)).getTime();
    return {
      id: `exp_csv_${idx}_${ts}`,
      amount: Number(row.amount),
      categoryId: catMap[row.category.toLowerCase()] || 'cat_other',
      note: row.note,
      isCredit: false,
      timestamp: ts,
      createdAt: ts
    };
  }).sort((a, b) => b.timestamp - a.timestamp);

  return {
    categories: DEFAULT_CATEGORIES,
    expenses,
    settings: {
      currency: '₹',
      currencyCode: 'INR',
      currencyName: 'Indian Rupee',
      language: 'Automatic (English)',
      monthlyBudget: 0,
      cycleStartDay: 1,
      haptics: true
    },
    updatedAt: Date.now()
  };
}

function loadServerState() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = buildInitialState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {
    const initial = buildInitialState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function saveServerState(state) {
  state.updatedAt = Date.now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  return state;
}

function matchCategory(categories, rawInput) {
  const query = String(rawInput || '').trim().toLowerCase();
  if (!query) return categories[0];

  return (
    categories.find((c) => c.id.toLowerCase() === query) ||
    categories.find((c) => c.name.toLowerCase() === query) ||
    categories.find((c) => `${c.emoji} ${c.name}`.toLowerCase() === query) ||
    categories.find((c) => query.includes(c.name.toLowerCase())) ||
    categories.find((c) => c.name.toLowerCase().includes(query)) ||
    categories[0]
  );
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. GET /api/state — returns full categories, expenses & settings
  if (pathname === '/api/state' && req.method === 'GET') {
    const state = loadServerState();
    return sendJSON(res, 200, state);
  }

  // 2. POST /api/state — updates server state from PWA
  if (pathname === '/api/state' && req.method === 'POST') {
    const raw = await readRequestBody(req);
    try {
      const incoming = JSON.parse(raw);
      const current = loadServerState();
      if (Array.isArray(incoming.categories)) current.categories = incoming.categories;
      if (Array.isArray(incoming.expenses)) current.expenses = incoming.expenses;
      if (incoming.settings) current.settings = { ...current.settings, ...incoming.settings };
      saveServerState(current);
      return sendJSON(res, 200, { ok: true, state: current });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: 'Invalid JSON' });
    }
  }

  // 3. GET /api/categories-text OR /api/category-text — plain text list of categories (1 per line)
  if ((pathname === '/api/categories-text' || pathname === '/api/category-text') && req.method === 'GET') {
    const state = loadServerState();
    const sorted = [...state.categories].sort((a, b) => a.order - b.order);
    const lines = sorted.map((c) => `${c.emoji} ${c.name}`).join('\n');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    return res.end(lines);
  }

  // 3b. GET /api/script — Prewritten all-in-one iOS Scriptable script
  if (pathname === '/api/script' && req.method === 'GET') {
    const host = req.headers.host || `192.168.1.3:${PORT}`;
    const scriptCode = `// Tappy Prewritten All-in-One iOS Popup Script (for Scriptable + Back Tap)
const SERVER = "http://${host}";

// 1. Ask Amount
const a1 = new Alert();
a1.title = "How much did you spend?";
const tf1 = a1.addTextField("Amount", "");
tf1.setDecimalPadKeyboard();
a1.addCancelAction("Cancel");
a1.addAction("Done");
if (await a1.presentAlert() === -1) return;
const amount = parseFloat(a1.textFieldValue(0));
if (!amount || amount <= 0) return;

// 2. Fetch Live Categories & Ask Category
const catReq = new Request(SERVER + "/api/categories-text");
const catText = await catReq.loadString();
const cats = catText.split("\\n").map(s => s.trim()).filter(Boolean);

const a2 = new Alert();
a2.title = "Choose a category";
cats.forEach(c => a2.addAction(c));
a2.addCancelAction("Cancel");
const catIdx = await a2.presentSheet();
if (catIdx === -1) return;
const chosenCat = cats[catIdx];

// 3. Ask Note (optional)
const a3 = new Alert();
a3.title = "Add a note (optional)";
a3.addTextField("Note", "");
a3.addCancelAction("Cancel");
a3.addAction("Done");
if (await a3.presentAlert() === -1) return;
const note = a3.textFieldValue(0) || "";

// 4. Save silently to Tappy App
const logReq = new Request(SERVER + "/api/log");
logReq.method = "POST";
logReq.headers = { "Content-Type": "application/json" };
logReq.body = JSON.stringify({ amount, cat: chosenCat, note });
await logReq.loadJSON();
Script.complete();`;

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(scriptCode);
  }

  // 4. GET or POST /api/log (also supports /api/log/:amount/:cat/:note)
  if (pathname === '/api/log' || pathname.startsWith('/api/log/')) {
    const state = loadServerState();
    let amountRaw = parsedUrl.searchParams.get('amount') || parsedUrl.searchParams.get('add');
    let catRaw = parsedUrl.searchParams.get('cat') || parsedUrl.searchParams.get('category');
    let noteRaw = parsedUrl.searchParams.get('note') || '';

    // Support path segments: /api/log/250/Food/Coffee
    if (pathname.startsWith('/api/log/')) {
      const parts = pathname.replace('/api/log/', '').split('/');
      if (parts[0]) amountRaw = parts[0];
      if (parts[1]) catRaw = parts[1];
      if (parts.length > 2) noteRaw = parts.slice(2).join('/');
    }

    if (req.method === 'POST') {
      const bodyStr = await readRequestBody(req);
      if (bodyStr) {
        try {
          const json = JSON.parse(bodyStr);
          if (json.amount !== undefined) amountRaw = json.amount;
          if (json.add !== undefined) amountRaw = json.add;
          if (json.cat !== undefined) catRaw = json.cat;
          if (json.category !== undefined) catRaw = json.category;
          if (json.note !== undefined) noteRaw = json.note;
        } catch (_) {
          const formParams = new URLSearchParams(bodyStr);
          if (formParams.has('amount')) amountRaw = formParams.get('amount');
          if (formParams.has('cat')) catRaw = formParams.get('cat');
          if (formParams.has('note')) noteRaw = formParams.get('note');
        }
      }
    }

    const numAmount = parseFloat(String(amountRaw || '').replace(/,/g, '').trim());
    if (!numAmount || numAmount <= 0) {
      return sendJSON(res, 400, { ok: false, error: 'Valid amount is required' });
    }

    const matchedCat = matchCategory(state.categories, catRaw);
    const expense = {
      id: `exp_backtap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount: Math.round(numAmount * 100) / 100,
      categoryId: matchedCat.id,
      note: String(noteRaw || '').trim(),
      isCredit: false,
      timestamp: Date.now(),
      createdAt: Date.now()
    };

    state.expenses.unshift(expense);
    state.expenses.sort((a, b) => b.timestamp - a.timestamp);
    saveServerState(state);

    return sendJSON(res, 200, {
      ok: true,
      message: `Saved ${state.settings.currency}${expense.amount} in ${matchedCat.emoji} ${matchedCat.name}`,
      expense,
      category: matchedCat
    });
  }

  // Static files
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n======================================================');
  console.log(' 🍏 Tappy — iOS Daily Expense Tracker PWA is running!');
  console.log('======================================================');
  console.log(` • Local PC/Mac:          http://localhost:${PORT}`);
  console.log(` • iPhone 14 Pro Max:     http://${ip}:${PORT}`);
  console.log(` • Silent Back-Tap API:   http://${ip}:${PORT}/api/log`);
  console.log('======================================================\n');
});
