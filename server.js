/**
 * Image Flow - License Management Server
 * Chạy: node server.js
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = 7979;
const SECRET_SALT = 'SEC_2024_@!#$%^';
const EXTENSION_SLUG = 'image-flow';
const ADMIN_TOKEN = 'admin_' + crypto.createHash('md5').update('imageflow_admin_2024').digest('hex');
const DB_FILE = path.join(__dirname, 'licenses.json');

// ── DB helpers ──────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ licenses: [] }, null, 2));
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ── Token (giống hệt popup.js) ───────────────────────────────
function generateToken(licenseKey, deviceId, slug) {
  const raw = licenseKey + deviceId + slug + SECRET_SALT;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── Gen key ngẫu nhiên ───────────────────────────────────────
function genKey(prefix = 'PRO') {
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${part()}-${part()}-${part()}`;
}

// ── Parse body ───────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

// ── CORS ─────────────────────────────────────────────────────
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Server ───────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = req.url.split('?')[0];
  const log = `[${new Date().toLocaleTimeString()}] ${req.method} ${url}`;

  // ── EXTENSION ENDPOINTS ──────────────────────────────────

  // POST /api/v1/image-flow/verify  (extension gọi khi nhập key)
  if (req.method === 'POST' && url.endsWith('/verify')) {
    const body = await parseBody(req);
    const { license_key, device_id, force_kick } = body;
    console.log(log, '| key:', license_key, '| device:', device_id);

    const db = loadDB();
    const lic = db.licenses.find(l => l.key === license_key);

    if (!lic) {
      return json(res, 200, { status: 'invalid', message: 'Key không tồn tại.' });
    }
    if (lic.status === 'disabled') {
      return json(res, 200, { status: 'locked', message: 'Key đã bị khóa.' });
    }
    if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
      return json(res, 200, { status: 'expired', message: 'Key đã hết hạn.' });
    }

    // Kiểm tra device
    if (!force_kick && lic.device_id && lic.device_id !== device_id) {
      return json(res, 200, { status: 'limit_reached', message: 'Key đang dùng trên thiết bị khác.' });
    }

    // Gắn device nếu chưa có
    if (!lic.device_id || force_kick) {
      lic.device_id = device_id;
      lic.activated_at = new Date().toISOString();
      saveDB(db);
    }

    const token = generateToken(license_key, device_id, EXTENSION_SLUG);
    console.log('  ✅ OK - tier:', lic.tier);

    return json(res, 200, {
      status: 'success',
      token: token,
      tier: lic.tier || 'pro',
      expires_at: lic.expires_at || null,
      verify_token: token,
      message: 'Kích hoạt thành công!'
    });
  }

  // GET /api/v1/image-flow/version
  if (req.method === 'GET' && url.endsWith('/version')) {
    return json(res, 200, { latest_version: '1.0.42' });
  }

  // ── ADMIN ENDPOINTS ──────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const isAdmin = authHeader === `Bearer ${ADMIN_TOKEN}`;

  // GET /admin/keys  - danh sách key
  if (req.method === 'GET' && url === '/admin/keys') {
    if (!isAdmin) return json(res, 401, { error: 'Unauthorized' });
    const db = loadDB();
    console.log(log, '| total:', db.licenses.length);
    return json(res, 200, db.licenses);
  }

  // POST /admin/keys  - tạo key mới
  if (req.method === 'POST' && url === '/admin/keys') {
    if (!isAdmin) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    const db = loadDB();

    const newKey = {
      id: crypto.randomUUID(),
      key: body.key || genKey(body.prefix || 'PRO'),
      tier: body.tier || 'pro',
      note: body.note || '',
      status: 'active',
      device_id: null,
      activated_at: null,
      created_at: new Date().toISOString(),
      expires_at: body.expires_at || null  // null = vĩnh viễn
    };

    db.licenses.push(newKey);
    saveDB(db);
    console.log(log, '| created:', newKey.key);
    return json(res, 200, newKey);
  }

  // DELETE /admin/keys/:key  - xóa key
  if (req.method === 'DELETE' && url.startsWith('/admin/keys/')) {
    if (!isAdmin) return json(res, 401, { error: 'Unauthorized' });
    const keyVal = decodeURIComponent(url.replace('/admin/keys/', ''));
    const db = loadDB();
    const before = db.licenses.length;
    db.licenses = db.licenses.filter(l => l.key !== keyVal);
    saveDB(db);
    console.log(log, '| deleted:', keyVal);
    return json(res, 200, { deleted: before - db.licenses.length });
  }

  // POST /admin/keys/:key/toggle  - bật/tắt key
  if (req.method === 'POST' && url.includes('/toggle')) {
    if (!isAdmin) return json(res, 401, { error: 'Unauthorized' });
    const keyVal = decodeURIComponent(url.replace('/admin/keys/', '').replace('/toggle', ''));
    const db = loadDB();
    const lic = db.licenses.find(l => l.key === keyVal);
    if (!lic) return json(res, 404, { error: 'Not found' });
    lic.status = lic.status === 'active' ? 'disabled' : 'active';
    saveDB(db);
    console.log(log, '| toggled:', keyVal, '->', lic.status);
    return json(res, 200, lic);
  }

  // POST /admin/keys/:key/reset  - reset device
  if (req.method === 'POST' && url.includes('/reset')) {
    if (!isAdmin) return json(res, 401, { error: 'Unauthorized' });
    const keyVal = decodeURIComponent(url.replace('/admin/keys/', '').replace('/reset', ''));
    const db = loadDB();
    const lic = db.licenses.find(l => l.key === keyVal);
    if (!lic) return json(res, 404, { error: 'Not found' });
    lic.device_id = null;
    lic.activated_at = null;
    saveDB(db);
    console.log(log, '| reset device:', keyVal);
    return json(res, 200, lic);
  }

  // GET /admin/token  - lấy admin token (chỉ dùng lần đầu)
  if (req.method === 'GET' && url === '/admin/token') {
    return json(res, 200, { token: ADMIN_TOKEN });
  }

  // Serve admin UI
  if (req.method === 'GET' && (url === '/' || url === '/admin')) {
    const htmlPath = path.join(__dirname, 'admin.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Admin UI not found. Run: node server.js');
    }
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Image Flow - License Server v2.0           ║');
  console.log(`║   http://localhost:${PORT}                      ║`);
  console.log(`║   Admin UI: http://localhost:${PORT}/admin       ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('Admin Token:', ADMIN_TOKEN);
  console.log('');
});
