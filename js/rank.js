// Rangliste: spricht mit dem eigenen Server (server/rangliste-server.js), sonst lokale Ergebnisse
import { store } from './storage.js';
import { VERSION } from './data.js';

// Adresse der Ranglisten-Schnittstelle. Kann vor dem Laden gesetzt werden: window.KERNWACHT_API = 'https://…/api/rangliste'
const API = () => String(window.KERNWACHT_API || 'api/rangliste').replace(/\/$/, '');

async function req(path, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(API() + path, { ...opts, signal: ctl.signal, headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) throw new Error('keine Rangliste');
    return await r.json();
  } finally { clearTimeout(t); }
}

// Ergebnis lokal merken und – falls ein Name gesetzt ist – an den Server senden
export async function submitScore(entry) {
  const d = store.data;
  const e = { ...entry, name: d.settings.playerName || '', version: VERSION, ts: Date.now() };
  d.history = (d.history || []).concat([e]).sort((a, b) => b.score - a.score).slice(0, 100);
  store.save();
  if (!e.name || location.protocol === 'file:') return { sent: false };
  try { const r = await req('/scores', { method: 'POST', body: JSON.stringify(e) }); return { sent: true, rank: r.rank }; }
  catch (err) { return { sent: false }; }
}

// Liste holen: board = 'gesamt' | 'daily-JJJJ-MM-TT' | 'kdaily-JJJJ-MM-TT' | 'modus-<modus>' | 'karte-<id>'
export async function fetchScores(board) {
  if (location.protocol === 'file:') throw new Error('offline');
  const r = await req('/scores?board=' + encodeURIComponent(board) + '&limit=50');
  return r.scores || [];
}

export function localScores(board) {
  const h = store.data.history || [];
  if (board.startsWith('daily-')) return h.filter(e => e.daily === board.slice(6));
  if (board.startsWith('kdaily-')) return h.filter(e => e.kdaily === board.slice(7));
  if (board.startsWith('modus-')) return h.filter(e => e.mode === board.slice(6));
  if (board.startsWith('karte-')) return h.filter(e => e.map === board.slice(6));
  return h;
}
