const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const apiHandler = require('./api/index.js');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Explicit static file map so Vercel's @vercel/nft bundler traces and includes every static asset
const STATIC_FILES = {
  '/': path.join(__dirname, 'index.html'),
  '/index.html': path.join(__dirname, 'index.html'),
  '/styles.css': path.join(__dirname, 'styles.css'),
  '/app.js': path.join(__dirname, 'app.js'),
  '/db.js': path.join(__dirname, 'db.js'),
  '/sw.js': path.join(__dirname, 'sw.js'),
  '/manifest.json': path.join(__dirname, 'manifest.json'),
  '/icons/icon-180.png': path.join(__dirname, 'icons', 'icon-180.png'),
  '/icons/icon-192.png': path.join(__dirname, 'icons', 'icon-192.png'),
  '/icons/icon-512.png': path.join(__dirname, 'icons', 'icon-512.png'),
  '/icons/icon.svg': path.join(__dirname, 'icons', 'icon.svg')
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function requestHandler(req, res) {
  try {
    const rawUrl = req.url || '/';
    const qIndex = rawUrl.indexOf('?');
    let pathname = decodeURIComponent(qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl);

    if (pathname.startsWith('/api/')) {
      return await apiHandler(req, res);
    }

    if (pathname === '' || pathname === '/') {
      pathname = '/index.html';
    }

    const filePath = STATIC_FILES[pathname] || path.join(ROOT, pathname);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + (err && err.message ? err.message : String(err)));
  }
}

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

const server = http.createServer(requestHandler);

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

module.exports = server;
