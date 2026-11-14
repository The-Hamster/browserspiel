// Kernwacht – kleiner Ranglisten-Server (ohne Zusatzpakete, Node.js 18+)
//
// Start:   node server/rangliste-server.js
// Optional: PORT=8080  DATEN=./server/daten/rangliste.json  STATISCH=1 (liefert auch das Spiel aus)
//
// Schnittstelle:
//   GET  /api/rangliste/scores?board=gesamt|daily-JJJJ-MM-TT|karte-<id>&limit=50
//   POST /api/rangliste/scores   { name, score, wave, won, mode, difficulty, map, mapName, daily, mission, version }
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = +(process.env.PORT || 8080);
const ROOT = path.resolve(__dirname, '..');
const FILE = path.resolve(process.env.DATEN || path.join(__dirname, 'daten', 'rangliste.json'));
const STATIC = process.env.STATISCH !== '0';
const MAX_ENTRIES = 20000;

fs.mkdirSync(path.dirname(FILE), { recursive: true });
let scores = [];
try { scores = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { scores = []; }
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(scores));
    fs.renameSync(tmp, FILE);
  }, 500);
}

const MODES = new Set(['standard', 'expert', 'daily', 'kampagne']);
const DIFFS = new Set(['leicht', 'mittel', 'schwer', 'experte']);
const clean = (s, n) => String(s || '').replace(/[<>"'`\\\u0000-\u001f]/g, '').trim().slice(0, n);

function validate(b) {
  const name = clean(b.name, 16);
  const score = Math.floor(Number(b.score));
  const wave = Math.floor(Number(b.wave));
  if (!name) return 'Name fehlt';
  if (!Number.isFinite(score) || score < 0 || score > 50_000_000) return 'Punkte ungültig';
  if (!Number.isFinite(wave) || wave < 0 || wave > 999) return 'Welle ungültig';
  if (!MODES.has(b.mode)) return 'Modus ungültig';
  if (b.difficulty && !DIFFS.has(b.difficulty)) return 'Schwierigkeit ungültig';
  return {
    name, score, wave, won: !!b.won, mode: b.mode, difficulty: b.difficulty || 'mittel',
    map: clean(b.map, 40), mapName: clean(b.mapName, 40), daily: b.daily ? clean(b.daily, 10) : null,
    mission: b.mission ? clean(b.mission, 10) : null, endless: !!b.endless, version: clean(b.version, 12), ts: Date.now(),
  };
}

function board(name, limit) {
  let list = scores;
  if (name.startsWith('daily-')) list = list.filter(e => e.daily === name.slice(6));
  else if (name.startsWith('karte-')) list = list.filter(e => e.map === name.slice(6) && !e.daily && !e.mission);
  // pro Name nur das beste Ergebnis
  const best = new Map();
  for (const e of list) { const k = e.name.toLowerCase(); if (!best.has(k) || best.get(k).score < e.score) best.set(k, e); }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// einfache Drosselung: höchstens 12 Einträge pro Minute und Adresse
const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); hits.set(ip, list);
  return list.length > 12;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };

function send(res, code, obj, extra = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '');
  if (p.endsWith('/api/rangliste/scores')) {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method === 'GET') {
      const limit = Math.min(200, Math.max(1, +(url.searchParams.get('limit') || 50)));
      return send(res, 200, { scores: board(url.searchParams.get('board') || 'gesamt', limit) });
    }
    if (req.method === 'POST') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (limited(ip)) return send(res, 429, { error: 'Zu viele Einträge – bitte kurz warten' });
      let body = '';
      req.on('data', c => { body += c; if (body.length > 4000) req.destroy(); });
      req.on('end', () => {
        let data; try { data = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'Ungültige Daten' }); }
        const e = validate(data);
        if (typeof e === 'string') return send(res, 400, { error: e });
        scores.push(e);
        if (scores.length > MAX_ENTRIES) scores = scores.sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
        persist();
        const list = board(e.daily ? 'daily-' + e.daily : 'gesamt', 100000);
        const rank = list.findIndex(x => x.name.toLowerCase() === e.name.toLowerCase()) + 1;
        send(res, 200, { ok: true, rank });
      });
      return;
    }
    return send(res, 405, { error: 'Methode nicht erlaubt' });
  }
  if (!STATIC) return send(res, 404, { error: 'Nicht gefunden' });
  // Spiel-Dateien ausliefern
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT) || file.includes(path.sep + 'server' + path.sep)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`Kernwacht-Rangliste läuft auf http://localhost:${PORT}  (Daten: ${FILE})`));
