// Vorgerenderte Grafiken: Glow-Punkte, Gegner, Türme, Icons
import { ENEMIES, TOWERS, TOWER_LOOK, TILT } from './data.js';
import { rgba, mix } from './util.js';

export const PAL = ['#ffffff', '#36f1ff', '#ff6b3d', '#ffcf3a', '#c9a7ff', '#5dffb0', '#4f9dff', '#ff3d5a',
  '#ff4fa0', '#8dff5a', '#55606e', '#7d7bff', '#66ffcc', '#ff9a3c', '#d9a066', '#dfe8ff', '#ffe14d', '#4fc3ff', '#c58bff', '#ff8cc6', '#ff3d6e'];
const palIndex = new Map(PAL.map((c, i) => [c, i]));
export function ci(hex) {
  let i = palIndex.get(hex);
  if (i === undefined) { i = PAL.length; PAL.push(hex); palIndex.set(hex, i); glowCache.length = 0; }
  return i;
}

export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ---- Glow-Punkt (radialer Verlauf)
const glowCache = [];
export function glow(idx) {
  let c = glowCache[idx];
  if (c) return c;
  const col = PAL[idx] || '#ffffff';
  c = mk(64, 64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(mix(col, '#ffffff', 0.7), 1));
  gr.addColorStop(0.18, rgba(mix(col, '#ffffff', 0.3), 0.9));
  gr.addColorStop(0.45, rgba(col, 0.35));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowCache[idx] = c;
  return c;
}
let smokeSprite = null;
export function smoke() {
  if (smokeSprite) return smokeSprite;
  const c = mk(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(70,75,90,0.55)'); gr.addColorStop(0.6, 'rgba(40,44,55,0.25)'); gr.addColorStop(1, 'rgba(20,22,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (smokeSprite = c);
}

// ---- Gegner-Formen (Mittelpunkt 0,0, Blick nach +x)
function neon(g, col, blur) { g.shadowColor = col; g.shadowBlur = blur; }
function poly(g, n, r, rot) { g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
// Schattierte Füllung (Licht von oben links)
function shade(g, x0, y0, x1, y1, base, k = 0.45) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, mix(base, '#ffffff', k * 0.7)); gr.addColorStop(0.45, base); gr.addColorStop(1, mix(base, '#000000', k));
  return gr;
}
function rshade(g, x, y, r, base) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, mix(base, '#ffffff', 0.45)); gr.addColorStop(0.5, base); gr.addColorStop(1, mix(base, '#000000', 0.6));
  return gr;
}

// ---- Gegner (Mittelpunkt 0,0, Blick nach +x). frame 0/1 = Laufbild
export function drawEnemyShape(g, type, r, col, elite, res = 1, frame = 0) {
  const dark = mix(col, '#06080d', 0.7);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const lw = Math.max(1, r * 0.1);
  g.lineWidth = lw;
  const f = frame ? 1 : -1;
  switch (type) {
    case 'swarm': case 'mite': {
      // Beine
      g.strokeStyle = mix(col, '#000000', 0.45); g.lineWidth = Math.max(1, r * 0.12);
      for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) {
        const sw = (i % 2 === 0 ? f : -f) * 0.35 * s;
        g.beginPath(); g.moveTo(i * r * 0.35, s * r * 0.3);
        g.lineTo(i * r * 0.35 + r * 0.25 + sw * r, s * r * 0.95); g.lineTo(i * r * 0.35 + r * 0.05 + sw * r * 1.2, s * r * 1.25); g.stroke();
      }
      // Flügel
      g.fillStyle = rgba(mix(col, '#ffffff', 0.4), 0.28);
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(-r * 0.3, s * r * (0.55 + frame * 0.12), r * 0.8, r * 0.3, s * (0.45 - frame * 0.15), 0, 7); g.fill(); }
      // Hinterleib + Kopf
      g.fillStyle = rshade(g, -r * 0.35, 0, r * 0.6, mix(col, '#000000', 0.25));
      g.beginPath(); g.ellipse(-r * 0.4, 0, r * 0.62, r * 0.45, 0, 0, 7); g.fill();
      g.fillStyle = rshade(g, r * 0.3, 0, r * 0.5, col);
      g.beginPath(); g.ellipse(r * 0.28, 0, r * 0.5, r * 0.4, 0, 0, 7); g.fill();
      g.strokeStyle = rgba('#000000', 0.4); g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(-r * 0.6, -r * 0.2); g.lineTo(-r * 0.6, r * 0.2); g.moveTo(-r * 0.3, -r * 0.3); g.lineTo(-r * 0.3, r * 0.3); g.stroke();
      neon(g, col, 6 * res); g.fillStyle = '#fff';
      g.beginPath(); g.arc(r * 0.62, -r * 0.18, r * 0.11, 0, 7); g.arc(r * 0.62, r * 0.18, r * 0.11, 0, 7); g.fill();
      g.shadowBlur = 0;
      if (type === 'mite') { g.strokeStyle = col; g.lineWidth = lw; for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.78; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); g.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); g.stroke(); } }
      break;
    }
    case 'tank': {
      // Ketten mit laufenden Gliedern
      for (const s of [-1, 1]) {
        const y0 = s > 0 ? r * 0.5 : -r * 0.95;
        g.fillStyle = '#15181e'; roundRect(g, -r * 1.05, y0, r * 2.1, r * 0.45, r * 0.15); g.fill();
        g.fillStyle = '#2b3038';
        for (let i = 0; i < 9; i++) { const x = -r * 1.0 + ((i * r * 0.25 + frame * r * 0.125) % (r * 2.05)); g.fillRect(x, y0 + 1, r * 0.1, r * 0.43); }
      }
      g.fillStyle = shade(g, -r, -r * 0.6, r, r * 0.6, mix(col, '#2a2f38', 0.55));
      roundRect(g, -r * 0.92, -r * 0.6, r * 1.84, r * 1.2, r * 0.45); g.fill();
      g.strokeStyle = rgba('#000000', 0.5); g.stroke();
      g.strokeStyle = rgba(col, 0.8); g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(-r * 0.8, -r * 0.45); g.lineTo(r * 0.6, -r * 0.45); g.moveTo(-r * 0.8, r * 0.45); g.lineTo(r * 0.6, r * 0.45); g.stroke();
      g.fillStyle = rshade(g, -r * 0.05, 0, r * 0.48, mix(col, '#333a44', 0.4)); g.beginPath(); g.arc(-r * 0.05, 0, r * 0.46, 0, 7); g.fill();
      g.strokeStyle = rgba('#000000', 0.5); g.lineWidth = lw; g.stroke();
      g.fillStyle = shade(g, 0, -r * 0.1, 0, r * 0.1, '#3a414c'); g.fillRect(r * 0.25, -r * 0.11, r * 0.95, r * 0.22);
      neon(g, col, 8 * res); g.fillStyle = col; g.beginPath(); g.arc(-r * 0.05, 0, r * 0.14, 0, 7); g.fill(); g.shadowBlur = 0;
      break;
    }
    case 'shield': {
      g.fillStyle = shade(g, -r, -r, r, r, mix(col, '#20252e', 0.6)); poly(g, 6, r, 0); g.fill();
      g.strokeStyle = rgba(col, 0.9); g.lineWidth = lw; g.stroke();
      g.fillStyle = shade(g, -r, -r, r, r, mix(col, '#2a3340', 0.35)); poly(g, 6, r * 0.62, Math.PI / 6); g.fill();
      for (const s of [-1, 1]) { g.fillStyle = '#20252e'; g.fillRect(-r * 0.9, s * r * (0.65 + frame * 0.05) - r * 0.12, r * 0.5, r * 0.24); }
      neon(g, col, 14 * res); g.fillStyle = '#eafcff'; g.beginPath(); g.arc(0, 0, r * 0.25, 0, 7); g.fill(); g.shadowBlur = 0;
      break;
    }
    case 'phantom': {
      g.fillStyle = rgba(col, 0.22);
      g.beginPath(); g.moveTo(-r * (1.5 + frame * 0.2), 0); g.quadraticCurveTo(-r * 0.6, -r * 0.95, 0, -r * 0.3); g.quadraticCurveTo(-r * 0.6, r * 0.95, -r * (1.5 + frame * 0.2), 0); g.fill();
      g.fillStyle = shade(g, -r, -r, r, r, mix(col, '#140c22', 0.5));
      g.beginPath(); g.moveTo(r * 1.1, 0); g.lineTo(0, -r * 0.75); g.lineTo(-r * 0.8, 0); g.lineTo(0, r * 0.75); g.closePath(); g.fill();
      g.strokeStyle = rgba(col, 0.9); g.lineWidth = lw; g.stroke();
      neon(g, col, 8 * res); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(r * 0.38, 0, r * 0.28, r * 0.1, 0, 0, 7); g.fill(); g.shadowBlur = 0;
      break;
    }
    case 'flyer': {
      g.fillStyle = shade(g, -r, -r, r, r, mix(col, '#2a2f38', 0.6));
      g.beginPath(); g.moveTo(r * 1.2, 0); g.lineTo(-r * 0.6, -r * 1.1); g.lineTo(-r * 0.9, -r * 1.0); g.lineTo(-r * 0.45, 0); g.lineTo(-r * 0.9, r * 1.0); g.lineTo(-r * 0.6, r * 1.1); g.closePath(); g.fill();
      g.strokeStyle = rgba('#000000', 0.5); g.lineWidth = lw; g.stroke();
      g.strokeStyle = rgba(col, 0.9); g.lineWidth = lw * 0.9; g.beginPath(); g.moveTo(r * 0.6, 0); g.lineTo(-r * 0.55, -r * 0.95); g.moveTo(r * 0.6, 0); g.lineTo(-r * 0.55, r * 0.95); g.stroke();
      g.fillStyle = rshade(g, r * 0.2, 0, r * 0.45, '#9fb4c8'); g.beginPath(); g.ellipse(r * 0.25, 0, r * 0.45, r * 0.2, 0, 0, 7); g.fill();
      neon(g, col, 14 * res); g.fillStyle = '#fff6c0';
      for (const s of [-1, 1]) { g.beginPath(); g.arc(-r * 0.62, s * r * 0.35, r * (0.13 + frame * 0.04), 0, 7); g.fill(); }
      g.shadowBlur = 0;
      break;
    }
    case 'splitter': {
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094 + 0.5, x = Math.cos(a) * r * 0.42, y = Math.sin(a) * r * 0.42, rr = r * (0.6 + (i === frame ? 0.05 : 0));
        g.fillStyle = rshade(g, x, y, rr, mix(col, '#1a0812', 0.35)); g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
        g.strokeStyle = rgba(col, 0.7); g.lineWidth = lw * 0.8; g.stroke();
      }
      g.fillStyle = rshade(g, 0, 0, r * 0.45, col); g.beginPath(); g.arc(0, 0, r * 0.42, 0, 7); g.fill();
      neon(g, col, 10 * res); g.fillStyle = '#ffe0f0'; g.beginPath(); g.arc(0, 0, r * 0.17, 0, 7); g.fill(); g.shadowBlur = 0;
      break;
    }
    case 'boss': {
      // großes Schiff
      g.fillStyle = shade(g, -r, -r, r, r, '#3a2430', 0.5);
      const hull = [[1.15, 0], [0.55, -0.45], [0.1, -1.05], [-0.55, -0.95], [-0.95, -0.5], [-0.8, 0], [-0.95, 0.5], [-0.55, 0.95], [0.1, 1.05], [0.55, 0.45]].map(([x, y]) => [x * r, y * r]);
      g.beginPath();
      for (let i = 0; i <= hull.length; i++) { const p = hull[i % hull.length], q = hull[(i + 1) % hull.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my); }
      g.closePath(); g.fill();
      g.strokeStyle = rgba(col, 0.9); g.lineWidth = lw * 0.8; g.stroke();
      g.strokeStyle = rgba('#000000', 0.45); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-r * 0.6, -r * 0.6); g.lineTo(r * 0.4, -r * 0.3); g.moveTo(-r * 0.6, r * 0.6); g.lineTo(r * 0.4, r * 0.3); g.moveTo(-r * 0.7, 0); g.lineTo(r * 0.9, 0); g.stroke();
      g.fillStyle = rshade(g, 0, 0, r * 0.55, '#5a2a3a'); g.beginPath(); g.arc(-r * 0.05, 0, r * 0.5, 0, 7); g.fill();
      g.fillStyle = shade(g, 0, -r * 0.1, 0, r * 0.1, '#4a4f5a'); g.fillRect(r * 0.5, -r * 0.09, r * 0.65, r * 0.18);
      neon(g, col, 20 * res);
      g.fillStyle = '#ffd0dc'; g.beginPath(); g.arc(-r * 0.05, 0, r * 0.18, 0, 7); g.fill();
      g.fillStyle = col; for (const s of [-1, 1]) { g.beginPath(); g.arc(-r * 0.85, s * r * 0.5, r * (0.1 + frame * 0.03), 0, 7); g.fill(); }
      g.shadowBlur = 0;
      break;
    }
  }
  if (type === 'healer') {
    // Sanitätsdrohne: runder Körper, vier Stelzen, grünes Kreuz
    g.strokeStyle = '#1b2a22'; g.lineWidth = r * 0.14;
    for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.785 + f * 0.12; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); g.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); g.stroke(); }
    g.fillStyle = rshade(g, 0, 0, r * 0.85, mix(col, '#1a2a24', 0.55)); g.beginPath(); g.arc(0, 0, r * 0.82, 0, 7); g.fill();
    g.strokeStyle = rgba(col, 0.9); g.lineWidth = lw; g.stroke();
    g.fillStyle = rgba(col, 0.25); g.beginPath(); g.arc(0, 0, r * (1.05 + frame * 0.08), 0, 7); g.fill();
    neon(g, col, 12 * res); g.fillStyle = '#eafff4';
    g.fillRect(-r * 0.12, -r * 0.42, r * 0.24, r * 0.84); g.fillRect(-r * 0.42, -r * 0.12, r * 0.84, r * 0.24);
    g.shadowBlur = 0;
  }
  if (type === 'graeber') {
    // Gräber: gepanzerter Wurm mit Bohrkopf
    for (let i = 3; i >= 1; i--) {
      const x = -i * r * 0.42, y = Math.sin(i * 1.3 + frame * 1.5) * r * 0.12, rr = r * (0.62 - i * 0.06);
      g.fillStyle = rshade(g, x, y, rr, mix(col, '#2a1f14', 0.4)); g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
      g.strokeStyle = rgba('#000000', 0.45); g.lineWidth = lw * 0.8; g.stroke();
    }
    g.fillStyle = rshade(g, r * 0.1, 0, r * 0.66, col); g.beginPath(); g.arc(r * 0.1, 0, r * 0.64, 0, 7); g.fill();
    g.strokeStyle = rgba('#000000', 0.5); g.lineWidth = lw; g.stroke();
    // Bohrkopf
    g.fillStyle = shade(g, r * 0.5, -r * 0.4, r * 1.2, r * 0.4, '#8a8f99');
    g.beginPath(); g.moveTo(r * 0.55, -r * 0.42); g.lineTo(r * 1.3, 0); g.lineTo(r * 0.55, r * 0.42); g.closePath(); g.fill();
    g.strokeStyle = rgba('#000000', 0.45); g.lineWidth = 1; for (let i = 1; i < 4; i++) { const x = r * (0.55 + i * 0.18); g.beginPath(); g.moveTo(x, -r * 0.42 * (1 - i * 0.25)); g.lineTo(x + r * 0.1 * f, r * 0.42 * (1 - i * 0.25)); g.stroke(); }
    neon(g, '#ffcf3a', 6 * res); g.fillStyle = '#ffe9a8'; for (const sy of [-1, 1]) { g.beginPath(); g.arc(r * 0.3, sy * r * 0.26, r * 0.09, 0, 7); g.fill(); }
    g.shadowBlur = 0;
  }
  if (type === 'boss2') {
    // schwerer Kampfläufer mit vier Beinen
    g.strokeStyle = '#1c1f25'; g.lineWidth = r * 0.16; g.lineCap = 'round';
    for (const [lx, ly] of [[0.55, -0.85], [-0.55, -0.85], [0.55, 0.85], [-0.55, 0.85]]) {
      const sw = (lx > 0 ? f : -f) * (ly > 0 ? 1 : -1) * 0.18;
      g.beginPath(); g.moveTo(lx * r * 0.6, ly * r * 0.5); g.lineTo((lx + sw) * r * 1.05, ly * r * 1.05); g.lineTo((lx + sw) * r * 1.2, ly * r * 1.25); g.stroke();
    }
    g.fillStyle = shade(g, -r, -r, r, r, '#4a3f2a', 0.55);
    roundRect(g, -r * 0.85, -r * 0.62, r * 1.7, r * 1.24, r * 0.5); g.fill();
    g.strokeStyle = rgba(col, 0.9); g.lineWidth = lw * 0.8; g.stroke();
    g.fillStyle = shade(g, -r * 0.5, -r * 0.4, r * 0.5, r * 0.4, '#6a5a3a', 0.5);
    g.beginPath(); g.ellipse(0, 0, r * 0.5, r * 0.42, 0, 0, 7); g.fill();
    g.fillStyle = shade(g, 0, -r * 0.1, 0, r * 0.1, '#3a3f48'); for (const sy of [-0.25, 0.25]) g.fillRect(r * 0.4, sy * r - r * 0.07, r * 0.75, r * 0.14);
    neon(g, col, 18 * res); g.fillStyle = '#fff0c8'; g.beginPath(); g.arc(-r * 0.05, 0, r * 0.18, 0, 7); g.fill();
    g.fillStyle = col; for (const sx of [-0.6, 0.6]) { g.beginPath(); g.arc(sx * r, 0, r * 0.07, 0, 7); g.fill(); }
    g.shadowBlur = 0;
  }
  if (elite) {
    neon(g, '#ffd23e', 8 * res); g.strokeStyle = '#ffd23e'; g.lineWidth = Math.max(1.2, r * 0.09);
    g.setLineDash([r * 0.35, r * 0.25]); g.beginPath(); g.arc(0, 0, r * 1.3, 0, 7); g.stroke(); g.setLineDash([]);
    g.shadowBlur = 0;
  }
}

const spriteCache = new Map();
export function clearSpriteCache() { spriteCache.clear(); }

// Liefert {c, w, h} in Weltkoordinaten-Größe w/h
export function enemySprite(type, elite, res, frame = 0) {
  const key = 'e|' + type + '|' + (elite ? 1 : 0) + '|' + res + '|' + frame;
  let s = spriteCache.get(key);
  if (s) return s;
  const def = ENEMIES[type];
  const r = def.r;
  const size = r * 3.2 + 16;
  const c = mk(size * res, size * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(size / 2, size / 2);
  drawEnemyShape(g, type, r, def.color, elite, res, frame);
  s = { c, w: size, h: size };
  spriteCache.set(key, s);
  return s;
}

export function tierColor(type, tier) {
  const col = TOWERS[type].color;
  if (tier === 'a') return mix(col, '#ffffff', 0.4);
  if (tier === 'b') return mix(col, '#ff4fd8', 0.45);
  if (tier === 'c') return mix(col, '#ffd23e', 0.55);
  return col;
}

const TS = 84; // Sprite-Kantenlänge der Türme (Welt)
function cachedSprite(key, res, draw) {
  let s = spriteCache.get(key);
  if (s) return s;
  const c = mk(TS * res, TS * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(TS / 2, TS / 2);
  draw(g);
  s = { c, w: TS, h: TS };
  spriteCache.set(key, s);
  return s;
}
export function towerBaseSprite(type, tier, res) { return cachedSprite('tb|' + type + '|' + tier + '|' + res, res, g => drawTowerBase(g, type, tier, res)); }
export function towerHeadSprite(type, tier, res) { return cachedSprite('th|' + type + '|' + tier + '|' + res, res, g => drawTowerHead(g, type, tier, res)); }
// dunkle Silhouette des Kopfes als Schatten
export function towerHeadShadow(type, tier, res) {
  return cachedSprite('ts|' + type + '|' + tier + '|' + res, res, g => {
    drawTowerHead(g, type, tier, res);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-TS, -TS, TS * 2, TS * 2);
  });
}

const lvlOf = (tier) => (tier === '1' ? 1 : tier === '2' ? 2 : 3);
export function towerLights(tier) { const R = 18 + lvlOf(tier) * 2.6; return [[-R * 0.62, -R * 0.62], [R * 0.62, R * 0.55]]; }

// Gebäude von schräg oben: Bodenplatte, Seitenwand, Deckfläche, Panzerplatten
export function drawTowerBase(g, type, tier, res = 1) {
  const col = tierColor(type, tier), lvl = lvlOf(tier);
  const R = 18 + lvl * 2.6, H = 5 + lvl * 1.5;
  // Bodenplatte
  g.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(g, -R - 5, -R - 1, 2 * R + 14, 2 * R + 14, 7); g.fill();
  g.fillStyle = shade(g, -R, -R, R, R, '#30363f', 0.5); roundRect(g, -R - 7, -R - 5, 2 * R + 14, 2 * R + 14, 6); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#6b7380';
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.arc(x * (R + 3), y * (R + 3) - 2, 1.4, 0, 7); g.fill(); }
  // Schlagschatten des Gebäudes
  g.fillStyle = 'rgba(0,0,0,0.45)'; poly(g, 8, R, Math.PI / 8); g.save(); g.translate(5, 7 + H); g.fill(); g.restore();
  // Seitenwand (Prisma)
  const side = shade(g, -R, 0, R, 0, '#262b35', 0.35);
  for (let k = H; k > 0; k -= 1) { g.save(); g.translate(0, k); g.fillStyle = side; poly(g, 8, R, Math.PI / 8); g.fill(); g.restore(); }
  g.save(); g.translate(0, H); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; poly(g, 8, R, Math.PI / 8); g.stroke(); g.restore();
  // Deckfläche
  g.save(); g.translate(0, -1);
  g.fillStyle = shade(g, -R, -R, R, R, '#4a5363', 0.55); poly(g, 8, R, Math.PI / 8); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; poly(g, 8, R - 5, Math.PI / 8); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; g.beginPath(); g.moveTo(Math.cos(a) * (R - 5), Math.sin(a) * (R - 5)); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
  // Farbband
  neon(g, col, 6 * res); g.strokeStyle = rgba(col, 0.85); g.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(0, 0, R - 2.5, a - 0.35, a + 0.35); g.stroke(); }
  g.shadowBlur = 0;
  if (lvl >= 2) { // Panzerplatten
    for (let i = 0; i < 4; i++) {
      g.save(); g.rotate(i * Math.PI / 2); g.translate(R - 1, 0);
      g.fillStyle = shade(g, -3, -6, 3, 6, '#58627a', 0.5); roundRect(g, -3, -6, 6, 12, 1.5); g.fill();
      g.restore();
    }
  }
  if (lvl >= 3) { // Streben + zweiter Ring
    g.strokeStyle = rgba(col, 0.55); g.lineWidth = 1; g.beginPath(); g.arc(0, 0, R - 8, 0, 7); g.stroke();
    g.fillStyle = col; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8), 1.6, 0, 7); g.fill(); }
  }
  g.restore();
}

// Geschützköpfe (drehen sich, Blick nach +x)
// Kapselförmiges Gehäuse mit weichem Glanz
function metalBox(g, x, y, w, h, r, base = '#3a4250') {
  const rr = Math.min(w, h) * 0.46;
  const gr = g.createRadialGradient(x + w * 0.3, y + h * 0.25, Math.min(w, h) * 0.1, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, mix(base, '#ffffff', 0.4)); gr.addColorStop(0.55, base); gr.addColorStop(1, mix(base, '#000000', 0.5));
  g.fillStyle = gr; roundRect(g, x, y, w, h, rr); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(x + rr, y + 1.2); g.quadraticCurveTo(x + w * 0.5, y + 0.2, x + w - rr, y + 1.2); g.stroke();
}
// Rohr mit runder Mündung
function barrel(g, x, y, len, w, col, base = '#2c323c') {
  const gr = g.createLinearGradient(0, y - w / 2, 0, y + w / 2);
  gr.addColorStop(0, mix(base, '#000000', 0.2)); gr.addColorStop(0.3, mix(base, '#ffffff', 0.4)); gr.addColorStop(1, mix(base, '#000000', 0.5));
  g.fillStyle = gr; roundRect(g, x, y - w / 2, len, w, w * 0.48); g.fill();
  g.fillStyle = mix(base, '#000000', 0.55); g.beginPath(); g.ellipse(x + len - w * 0.3, y, w * 0.32, w * 0.5, 0, 0, 7); g.fill();
  g.fillStyle = mix(base, '#ffffff', 0.25); g.beginPath(); g.ellipse(x + len * 0.5, y, w * 0.18, w * 0.56, 0, 0, 7); g.fill();
  if (col) { g.fillStyle = rgba(col, 0.9); g.beginPath(); g.ellipse(x + len * 0.3, y, 1, w * 0.52, 0, 0, 7); g.fill(); }
}
// Glaslinse mit Spiegelung
function core(g, x, y, r, col, res) {
  neon(g, col, 10 * res);
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, mix(col, '#ffffff', 0.4)); gr.addColorStop(1, col);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.4, r * 0.32, r * 0.18, -0.6, 0, 7); g.fill();
}
// abgerundetes Vieleck
function rpoly(g, n, r, rot, k = 0.3) {
  const V = []; for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; V.push([Math.cos(a) * r, Math.sin(a) * r]); }
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = V[i % n], q = V[(i + 1) % n];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) g.moveTo(m[0], m[1]); else g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
}

export function drawTowerHead(g, type, tier, res = 1) {
  const col = tierColor(type, tier), lvl = lvlOf(tier);
  const sc = 0.9 + lvl * 0.08;
  g.save(); g.scale(sc, sc); g.translate(0, -2);
  g.lineJoin = 'round'; g.lineCap = 'round';
  switch (type) {
    case 'laser': {
      const n = tier === 'b' || tier === 'c' ? 3 : tier === 'a' ? 1 : 2;
      for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * 5.5; barrel(g, 4, y, tier === 'a' ? 24 : 20, tier === 'a' ? 6 : 3.6, col); }
      if (tier === 'a') for (let i = 0; i < 3; i++) { g.fillStyle = rgba(col, 0.9); g.fillRect(10 + i * 4, -4, 1.5, 8); }
      metalBox(g, -11, -9, 19, 18, 5, '#3c4656');
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-9, -3, 12, 1.2); g.fillRect(-9, 2, 12, 1.2);
      core(g, -2, 0, 4.5, col, res);
      break;
    }
    case 'plasma': {
      barrel(g, 3, 0, 16, 11, col, '#353b45');
      g.fillStyle = rgba(col, 0.9); g.fillRect(15, -5.5, 2, 11);
      if (tier === 'b') for (const s of [-1, 1]) { metalBox(g, -6, s * 11 - 3.5, 13, 7, 3, '#4a3a33'); core(g, 0, s * 11, 2.2, col, res); }
      g.fillStyle = rshade(g, -3, 0, 13, '#454d5a'); g.beginPath(); g.arc(-3, 0, tier === 'a' ? 14 : 12.5, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
      if (tier === 'a') { g.fillStyle = '#2b3038'; for (let i = 0; i < 5; i++) { g.save(); g.rotate(Math.PI * 0.6 + i * 0.25); g.fillRect(11, -1.5, 6, 3); g.restore(); } }
      core(g, -3, 0, tier === 'a' ? 6.5 : 5, col, res);
      break;
    }
    case 'rail': {
      const len = tier === 'b' ? 34 : 28;
      for (const s of [-1, 1]) barrel(g, 0, s * 4.2, len, 3.4, null, '#3a404a');
      if (tier === 'c') for (const s of [-1, 1]) barrel(g, 0, s * 9, len - 6, 2.6, null, '#3a404a');
      for (let i = 0; i < 4; i++) { neon(g, col, 5 * res); g.fillStyle = col; g.fillRect(6 + i * 5.5, -6, 1.6, 12); }
      g.shadowBlur = 0;
      metalBox(g, -13, -8, 18, 16, 4, '#465062');
      if (tier === 'b') { metalBox(g, -4, -12, 12, 4, 1.5, '#2a3038'); g.fillStyle = rgba(col, 0.9); g.fillRect(6, -11, 2, 2); }
      core(g, -6, 0, 3.5, col, res);
      break;
    }
    case 'emp': {
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2 + Math.PI / 4); metalBox(g, 6, -2.5, 13, 5, 2, '#3a4250'); g.fillStyle = col; g.beginPath(); g.arc(17, 0, 1.8, 0, 7); g.fill(); g.restore(); }
      for (let i = 3; i >= 1; i--) { g.fillStyle = rshade(g, 0, 0, 4 + i * 4, i % 2 ? '#4a5466' : '#2c323c'); g.beginPath(); g.arc(0, 0, 4 + i * 4, 0, 7); g.fill(); g.strokeStyle = rgba(col, 0.5); g.lineWidth = 0.8; g.stroke(); }
      core(g, 0, 0, 4.5 + lvl * 0.5, col, res);
      break;
    }
    case 'rocket': {
      if (tier === 'b') for (const s of [-1, 1]) barrel(g, 6, s * 5, 18, 4.5, col, '#353b45');
      metalBox(g, -12, -12, 22, 24, 4, '#4a4f3e');
      const rows = tier === 'a' ? 3 : 2;
      for (let i = 0; i < rows; i++) for (let j = 0; j < 2; j++) {
        const y = (i - (rows - 1) / 2) * 7.5, x = j * 8 - 5;
        g.fillStyle = '#16191e'; g.beginPath(); g.arc(x + 4, y, 3, 0, 7); g.fill();
        g.fillStyle = rshade(g, x + 4, y, 2, col); g.beginPath(); g.arc(x + 4, y, 1.8, 0, 7); g.fill();
      }
      g.fillStyle = '#c9a227'; g.fillRect(-12, -12, 3, 24);
      break;
    }
    case 'tesla': {
      g.fillStyle = rshade(g, 0, 0, 15, '#3d4555'); g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill();
      const rings = 2 + lvl;
      for (let i = 0; i < rings; i++) {
        const rr = 13 - i * (9 / rings);
        g.strokeStyle = mix('#b87333', '#ffcc88', i / rings); g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.6; g.beginPath(); g.arc(0, 0, rr - 1.2, 0, 7); g.stroke();
      }
      for (let i = 0; i < 3; i++) { const a = i * 2.094; g.fillStyle = rshade(g, Math.cos(a) * 15, Math.sin(a) * 15, 3.5, '#596274'); g.beginPath(); g.arc(Math.cos(a) * 15, Math.sin(a) * 15, 3.5, 0, 7); g.fill(); }
      core(g, 0, 0, tier === 'c' ? 6 : 4.5, col, res);
      break;
    }
    case 'drone': {
      g.fillStyle = rshade(g, 0, 0, 18, '#3d4656'); rpoly(g, 6, 18, 0); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#14171c'; rpoly(g, 6, 11.5, 0); g.fill();
      g.fillStyle = shade(g, -10, -9, 0, 9, '#4a5466'); roundRect(g, -9.5, -8, 9, 16, 4); g.fill(); g.fillStyle = shade(g, 0, -9, 10, 9, '#4a5466'); roundRect(g, 0.5, -8, 9, 16, 4); g.fill();
      g.fillStyle = '#c9a227'; g.fillRect(-0.5, -8, 1, 16);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; core(g, Math.cos(a) * 14, Math.sin(a) * 14, 1.3, col, res); }
      break;
    }
    case 'shield': {
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.fillStyle = shade(g, 6, -4, 16, 4, '#465062'); g.beginPath(); g.ellipse(11.5, 0, 6, 3.6, 0, 0, 7); g.fill(); g.restore(); }
      g.fillStyle = rshade(g, 0, 0, 10, '#3d4555'); g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill();
      neon(g, col, 12 * res);
      const gr = g.createLinearGradient(-6, -10, 6, 10); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, mix(col, '#000000', 0.4));
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -10 - lvl); g.lineTo(6.5, 0); g.lineTo(0, 10 + lvl); g.lineTo(-6.5, 0); g.closePath(); g.fill();
      g.shadowBlur = 0;
      break;
    }
    case 'radar': {
      metalBox(g, -5, -3, 16, 6, 2, '#3a4250');
      g.fillStyle = rshade(g, 9, 0, 18, '#5c6678'); g.beginPath(); g.ellipse(9, 0, 6 + lvl, 17 + lvl * 1.5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.25); g.beginPath(); g.ellipse(9, 0, 3, 12, 0, 0, 7); g.stroke();
      g.fillStyle = rshade(g, -2, 0, 8, '#454e5e'); g.beginPath(); g.arc(-3, 0, 7.5, 0, 7); g.fill();
      core(g, 16, 0, 2.5, col, res);
      break;
    }
  }
  g.restore();
  g.shadowBlur = 0;
}

// ---- Icons für die Oberfläche
const iconCache = new Map();
export function towerIcon(type, tier = '1') {
  const key = type + tier;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = mk(96, 96), g = c.getContext('2d');
  const body = towerBodySprite(type, tier, 2);
  const sc = Math.min(100 / body.w, 96 / (body.h - 14));
  g.translate(48, 48 + (body.ay - body.h / 2) * sc + 6);
  g.scale(sc, sc);
  g.drawImage(body.c, -body.ax, -body.ay, body.w, body.h);
  g.save(); g.translate(0, -body.top); g.scale(1, TILT); g.rotate(-0.6);
  const L = TOWER_LOOK[type], hs = headScale(type);
  g.scale(hs, hs);
  drawTowerHead(g, type, tier, 2);
  g.restore();
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
export function enemyIcon(type, elite = false) {
  const key = 'e' + type + elite;
  if (iconCache.has(key)) return iconCache.get(key);
  const def = ENEMIES[type];
  const c = mk(64, 64), g = c.getContext('2d');
  const sc = 22 / (def.r * 1.4);
  g.translate(32, 32); g.scale(sc, sc); g.rotate(-Math.PI / 2);
  drawEnemyShape(g, type, def.r, def.color, elite, 1);
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------- Aufrechte Gebäude (leichte Seitenansicht)

// Abgerundeter Grundriss: Polygon mit weichen Ecken (rc = Eckradius-Anteil)
function roundedFootprint(shape, R) {
  if (shape === 'round' || shape === 'tiers' || shape === 'mast') { const P = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; P.push([Math.cos(a) * R, Math.sin(a) * R]); } return P; }
  let V;
  const ring = (n, rot, rr = R) => { const P = []; for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; P.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return P; };
  if (shape === 'hex') V = ring(6, 0, R * 1.05);
  else if (shape === 'oct') V = ring(8, Math.PI / 8, R * 1.03);
  else if (shape === 'diamond') V = ring(4, 0, R * 1.12);
  else if (shape === 'square') V = ring(4, Math.PI / 4, R * 1.25);
  else V = [[-R * 1.15, -R * 0.62], [R * 1.15, -R * 0.62], [R * 1.15, R * 0.62], [-R * 1.15, R * 0.62]];
  const rc = shape === 'rect' ? R * 0.5 : shape === 'diamond' ? R * 0.45 : R * 0.42;
  const out = [];
  for (let i = 0; i < V.length; i++) {
    const p = V[i], a = V[(i - 1 + V.length) % V.length], b = V[(i + 1) % V.length];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(rc, la * 0.48, lb * 0.48);
    const p1 = [p[0] + (a[0] - p[0]) / la * r, p[1] + (a[1] - p[1]) / la * r], p2 = [p[0] + (b[0] - p[0]) / lb * r, p[1] + (b[1] - p[1]) / lb * r];
    for (let k = 0; k <= 7; k++) { const t = k / 7, u = 1 - t; out.push([u * u * p1[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * p[1] + t * t * p2[1]]); }
  }
  return out;
}
// vordere Kette des Grundrisses (von links nach rechts über die dem Betrachter zugewandte Seite)
function frontChain(pts) {
  let li = 0, ri = 0;
  pts.forEach((p, i) => { if (p[0] < pts[li][0]) li = i; if (p[0] > pts[ri][0]) ri = i; });
  const n = pts.length, a = [], b = [];
  for (let i = li; ; i = (i + 1) % n) { a.push(pts[i]); if (i === ri) break; }
  for (let i = li; ; i = (i - 1 + n) % n) { b.push(pts[i]); if (i === ri) break; }
  const avg = (c) => c.reduce((s, p) => s + p[1], 0) / c.length;
  return avg(a) > avg(b) ? a : b;
}
// Abgerundeter Körper: weiche Wand, Fußwulst, Lichtkante, Deckfläche mit Kuppel
function roundBody(g, pts, H, wall, top, accent, opts = {}) {
  const y0 = opts.y0 || 0, dome = opts.dome ?? 0.35;
  const xs = pts.map(p => p[0]), minX = Math.min(...xs), maxX = Math.max(...xs), W = maxX - minX;
  const chain = frontChain(pts);
  // Fußwulst
  if (!opts.noSkirt) {
    const sk = pts.map(([x, y]) => [x * 1.1, y * 1.1]), sc = frontChain(sk);
    g.fillStyle = mix(wall, '#000000', 0.35);
    g.beginPath(); sc.forEach(([x, y], i) => i ? g.lineTo(x, y * TILT + y0) : g.moveTo(x, y * TILT + y0));
    for (let i = sc.length - 1; i >= 0; i--) g.lineTo(sc[i][0], sc[i][1] * TILT + y0 - 4);
    g.closePath(); g.fill();
    g.beginPath(); sk.forEach(([x, y], i) => i ? g.lineTo(x, y * TILT + y0 - 4) : g.moveTo(x, y * TILT + y0 - 4)); g.closePath();
    g.fillStyle = mix(wall, '#ffffff', 0.08); g.fill();
  }
  // Wand
  const wallPath = () => {
    g.beginPath();
    chain.forEach(([x, y], i) => i ? g.lineTo(x, y * TILT + y0) : g.moveTo(x, y * TILT + y0));
    for (let i = chain.length - 1; i >= 0; i--) g.lineTo(chain[i][0], chain[i][1] * TILT + y0 - H);
    g.closePath();
  };
  const gr = g.createLinearGradient(minX, 0, maxX, 0);
  gr.addColorStop(0, mix(wall, '#ffffff', 0.18)); gr.addColorStop(0.22, mix(wall, '#ffffff', 0.32)); gr.addColorStop(0.5, wall); gr.addColorStop(0.85, mix(wall, '#000000', 0.45)); gr.addColorStop(1, mix(wall, '#000000', 0.3));
  wallPath(); g.fillStyle = gr; g.fill();
  g.save(); wallPath(); g.clip();
  // Bodenschatten (Kontakt) und Glanzstreifen
  const ao = g.createLinearGradient(0, y0 - Math.min(14, H), 0, y0 + 6);
  ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = ao; g.fillRect(minX - 2, y0 - H - 20, W + 4, H + 40);
  const sx = minX + W * 0.24;
  const sp = g.createLinearGradient(sx - W * 0.08, 0, sx + W * 0.08, 0);
  sp.addColorStop(0, 'rgba(255,255,255,0)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.16)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sp; g.fillRect(minX, y0 - H - 20, W, H + 40);
  // Leuchtband entlang der Rundung
  if (accent) {
    for (const hf of opts.bands || [0.62]) {
      g.strokeStyle = rgba(accent, 0.9); g.lineWidth = 1.6; g.shadowColor = accent; g.shadowBlur = 4;
      g.beginPath(); chain.forEach(([x, y], i) => i ? g.lineTo(x, y * TILT + y0 - H * hf) : g.moveTo(x, y * TILT + y0 - H * hf)); g.stroke();
      g.shadowBlur = 0;
    }
  }
  g.restore();
  if (opts.noTop) return;
  // Deckfläche mit hellem Rand (Fase) und gewölbter Mitte
  const topPath = (k, lift = 0) => { g.beginPath(); pts.forEach(([x, y], i) => { const X = x * k, Y = y * k * TILT + y0 - H - lift; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
  topPath(1); g.fillStyle = mix(top, '#ffffff', 0.32); g.fill();
  topPath(0.86, 1.2);
  const cx = (minX + maxX) / 2, tg = g.createRadialGradient(cx - W * 0.18, y0 - H - W * 0.18 * TILT - W * dome * 0.3, W * 0.04, cx, y0 - H, W * 0.6);
  tg.addColorStop(0, mix(top, '#ffffff', 0.45)); tg.addColorStop(0.55, top); tg.addColorStop(1, mix(top, '#000000', 0.35));
  g.fillStyle = tg; g.fill();
  if (dome > 0) {
    const dr = W * 0.32, dh = W * dome * 0.35;
    const dg = g.createRadialGradient(cx - dr * 0.35, y0 - H - dh * 0.9, dr * 0.05, cx, y0 - H - dh * 0.3, dr * 1.1);
    dg.addColorStop(0, mix(top, '#ffffff', 0.55)); dg.addColorStop(0.6, mix(top, '#ffffff', 0.08)); dg.addColorStop(1, mix(top, '#000000', 0.3));
    g.fillStyle = dg; g.beginPath(); g.ellipse(cx, y0 - H - 1, dr, dr * TILT, 0, 0, Math.PI); g.ellipse(cx, y0 - H - 1, dr, dh + dr * TILT * 0.6, 0, 0, Math.PI, true); g.fill();
  }
  // weiche Lichtkante oben links
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1;
  g.beginPath(); pts.forEach(([x, y], i) => { if (x > cx + W * 0.1 || y > 0) return; const X = x, Y = y * TILT + y0 - H; g.lineTo(X, Y); }); g.stroke();
}
function cylinder(g, R, H, wall, top, accent, y0 = 0, opts = {}) { roundBody(g, roundedFootprint('round', R), H, wall, top, accent, { y0, ...opts }); }
export function headScale(type) { const L = TOWER_LOOK[type]; return L.shape === 'mast' ? 0.62 : Math.max(0.56, Math.min(0.85, L.R / 19)); }
export function towerDims(type, tier) {
  const L = TOWER_LOOK[type], lvl = tier === '1' ? 1 : tier === '2' ? 2 : 3;
  return { R: L.R + (lvl - 1) * 1, H: L.H + (lvl - 1) * 6, lvl };
}

// Gebäude-Sprite: Anker (ax, ay) = Fußpunkt
export function towerBodySprite(type, tier, res) {
  const key = 'tbody|' + type + '|' + tier + '|' + res;
  let s = spriteCache.get(key);
  if (s) return s;
  const { R, H, lvl } = towerDims(type, tier);
  const L = TOWER_LOOK[type];
  const col = tierColor(type, tier);
  const w = R * 2.6 + 36, h = R * TILT * 2 + H + 40, ax = w / 2, ay = R * TILT + H + 26;
  const c = mk(w * res, h * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(ax, ay);
  // Schatten nach hinten rechts
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath(); g.ellipse(R * 0.4 + H * 0.28, -R * 0.15 * TILT, R + H * 0.24, R * TILT * 0.75, -0.12, 0, 7); g.fill();
  // runde Bodenplatte mit Fase
  const pr = R + 5;
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(2, 3, pr + 1, (pr + 1) * TILT, 0, 0, 7); g.fill();
  const pg = g.createRadialGradient(-pr * 0.3, -pr * 0.4 * TILT, 2, 0, 0, pr);
  pg.addColorStop(0, '#4a525e'); pg.addColorStop(1, '#262b33');
  g.fillStyle = pg; g.beginPath(); g.ellipse(0, 0, pr, pr * TILT, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -0.5, pr - 1.5, (pr - 1.5) * TILT, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.fillStyle = rgba('#c9a227', 0.8); for (const a of [2.4, 0.74]) { g.beginPath(); g.ellipse(Math.cos(a) * pr * 0.82, Math.sin(a) * pr * 0.82 * TILT, 2.2, 1.4, 0, 0, 7); g.fill(); }
  const wall = L.wall, top = mix(L.wall, '#6a7688', 0.55);
  if (L.shape === 'tiers') {
    const h1 = H * 0.45, h2 = H * 0.32, h3 = H * 0.23;
    cylinder(g, R, h1, wall, top, col, 0, { dome: 0 });
    cylinder(g, R * 0.78, h2, wall, top, null, -h1, { dome: 0, noSkirt: true });
    cylinder(g, R * 0.56, h3, wall, top, col, -h1 - h2, { dome: 0.5, noSkirt: true });
  } else if (L.shape === 'mast') {
    cylinder(g, R, 8, wall, top, col, 0, { dome: 0 });
    // schlanker, sich verjüngender Mast mit runden Ringen
    const pw0 = 3.6 + lvl * 0.6, pw1 = 2.2 + lvl * 0.4;
    const gr = g.createLinearGradient(-pw0, 0, pw0, 0); gr.addColorStop(0, '#8792a4'); gr.addColorStop(0.35, '#a7b1c2'); gr.addColorStop(1, '#2a3038');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-pw0, -8); g.lineTo(-pw1, -H + 4); g.lineTo(pw1, -H + 4); g.lineTo(pw0, -8); g.closePath(); g.fill();
    for (let y = -16; y > -H + 8; y -= 10) {
      const k = (y + 8) / (-H + 12), w2 = pw0 + (pw1 - pw0) * k + 1.4;
      g.fillStyle = '#5b6575'; g.beginPath(); g.ellipse(0, y, w2, w2 * TILT * 0.8, 0, 0, 7); g.fill();
      g.fillStyle = rgba(col, 0.7); g.beginPath(); g.ellipse(0, y - 0.5, w2 * 0.6, w2 * 0.35 * TILT, 0, Math.PI * 0.1, Math.PI * 0.9); g.fill();
    }
    cylinder(g, R * 0.95, 3, wall, top, col, -H + 3, { dome: 0, noSkirt: true });
  } else {
    const pts = roundedFootprint(L.shape, R);
    roundBody(g, pts, H, wall, top, col, { dome: L.shape === 'oct' ? 0.2 : 0.3, bands: lvl >= 3 ? [0.38, 0.7] : [0.62] });
  }
  if (lvl >= 2 && L.shape !== 'mast' && L.shape !== 'tiers') {
    // gewölbte Panzerplatte an der Front
    const pw = R * 0.62, py = R * 0.62 * TILT - H * 0.45;
    const ag = g.createLinearGradient(-pw, 0, pw, 0); ag.addColorStop(0, '#7a8598'); ag.addColorStop(1, '#3a4252');
    g.fillStyle = ag; roundRect(g, -pw / 2, py - H * 0.18, pw, H * 0.3, Math.min(5, H * 0.12)); g.fill();
  }
  // Fenster / Lichtschlitze
  g.fillStyle = rgba(col, 0.85);
  const fy = L.shape === 'mast' ? -4 : -H * 0.3;
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(i * R * 0.36, R * 0.7 * TILT + fy, 1.8, 1.2, 0, 0, 7); g.fill(); }
  // Stufe 3: Antennen
  if (lvl >= 3) {
    g.strokeStyle = '#9aa5b6'; g.lineWidth = 1.2; g.lineCap = 'round';
    for (const sx of [-R * 0.7, R * 0.7]) { g.beginPath(); g.moveTo(sx, -H - R * 0.3 * TILT); g.lineTo(sx, -H - R * 0.3 * TILT - 12); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(sx, -H - R * 0.3 * TILT - 12, 1.6, 0, 7); g.fill(); }
  }
  s = { c, w, h, ax, ay, top: H };
  spriteCache.set(key, s);
  return s;
}
function poly2(g, n, r, rot) { g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * TILT); } g.closePath(); }

// Hindernisse aufrecht: Fels, Kristall, Pflanze
export function obstacleSprite(o, B, res) {
  if (o.kind === 'mountain') return mountainSprite(o, B, res);
  const key = 'ob|' + Math.round(o.x) + '|' + Math.round(o.y) + '|' + o.kind + '|' + B.name + '|' + res;
  let s = spriteCache.get(key);
  if (s) return s;
  const r = o.r, w = r * 3.4 + 20, h = r * 3.6 + 20, ax = w / 2, ay = h - r * TILT - 8;
  const c = mk(w * res, h * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(ax, ay);
  const rng = (() => { let a = Math.round(o.x * 13 + o.y * 7) >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(r * 0.5, -r * 0.1, r * 1.25, r * TILT * 0.9, 0, 0, 7); g.fill();
  if (o.kind === 'rock') {
    // flacher, rundlicher Felsbrocken: niedrige Flanke + gewölbte Kuppe
    const n = 11, pts = [];
    for (let i = 0; i < n; i++) { const a = o.rot + i / n * Math.PI * 2, rr = r * (0.8 + rng() * 0.22); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    roundBody(g, pts, r * 0.22, mix(B.rock, '#000000', 0.15), B.rock, null, { noSkirt: true, dome: 0, noTop: true });
    // Kuppe: hintere Punkte stärker angehoben, Rand weich gerundet
    const cap = pts.map(([x, y]) => [x * 0.94, y * 0.94 * TILT - r * 0.22 - r * 0.32 * (1 - (y / r + 1) / 2) - r * 0.1]);
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = cap[i % n], b2 = cap[(i + 1) % n];
      const mx = (a[0] + b2[0]) / 2, my = (a[1] + b2[1]) / 2;
      if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(a[0], a[1], mx, my);
    }
    g.closePath();
    const cg = g.createRadialGradient(-r * 0.3, -r * 0.55, r * 0.1, 0, -r * 0.2, r * 1.1);
    cg.addColorStop(0, mix(B.rock, '#ffffff', 0.35)); cg.addColorStop(0.55, B.rock); cg.addColorStop(1, mix(B.rock, '#000000', 0.5));
    g.fillStyle = cg; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(-r * 0.5, -r * 0.45); g.quadraticCurveTo(-r * 0.1, -r * 0.75, r * 0.35, -r * 0.5); g.stroke();
  } else if (o.kind === 'crystal') {
    const gl = g.createRadialGradient(0, -r * 0.6, 0, 0, -r * 0.6, r * 1.6);
    gl.addColorStop(0, rgba(B.crystal, 0.35)); gl.addColorStop(1, rgba(B.crystal, 0));
    g.fillStyle = gl; g.beginPath(); g.arc(0, -r * 0.6, r * 1.6, 0, 7); g.fill();
    const n = 4 + Math.floor(rng() * 3);
    const shards = [];
    for (let i = 0; i < n; i++) shards.push({ x: (rng() - 0.5) * r * 1.2, y: (rng() - 0.5) * r * 0.8, len: r * (1 + rng() * 1.3), w: r * (0.2 + rng() * 0.16), lean: (rng() - 0.5) * 0.7 });
    shards.sort((a, b) => a.y - b.y);
    for (const sh of shards) {
      g.save(); g.translate(sh.x, sh.y * TILT); g.rotate(sh.lean);
      const gr = g.createLinearGradient(-sh.w, 0, sh.w, 0);
      gr.addColorStop(0, mix(B.crystal, '#ffffff', 0.55)); gr.addColorStop(0.5, B.crystal); gr.addColorStop(1, mix(B.crystal, '#000000', 0.5));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-sh.w, 0); g.lineTo(-sh.w * 0.8, -sh.len * 0.8); g.lineTo(0, -sh.len); g.lineTo(sh.w * 0.8, -sh.len * 0.8); g.lineTo(sh.w, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -sh.len); g.lineTo(0, 0); g.stroke();
      g.restore();
    }
  } else {
    // fremde Pflanze: Stiel + Kugelkrone
    g.fillStyle = mix(B.plant, '#000000', 0.5); g.fillRect(-r * 0.12, -r * 0.9, r * 0.24, r * 0.9);
    const blobs = [];
    for (let i = 0; i < 6; i++) { const a = rng() * 6.28, d = rng() * r * 0.5; blobs.push([Math.cos(a) * d, -r * 1.05 + Math.sin(a) * d * 0.7, r * (0.42 + rng() * 0.3)]); }
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, rr] of blobs) {
      const gr = g.createRadialGradient(x - rr * 0.35, y - rr * 0.45, rr * 0.1, x, y, rr);
      gr.addColorStop(0, mix(B.plant2, '#ffffff', 0.2)); gr.addColorStop(0.55, B.plant); gr.addColorStop(1, mix(B.plant, '#000000', 0.55));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = rgba(B.plant2, 0.85); g.beginPath(); g.arc((rng() - 0.5) * r * 1.2, -r * 1.05 + (rng() - 0.5) * r * 0.8, 1.2 + rng() * 1.2, 0, 7); g.fill(); }
  }
  s = { c, w, h, ax, ay };
  spriteCache.set(key, s);
  return s;
}

// Berg der Grenze: runde, weiche Silhouette, Licht von links, je Landschaft Schnee, Glut, Kristalladern oder Moos
export function mountainSprite(o, B, res0) {
  const res = Math.min(res0, 1.5);
  const size = o.r < 46 ? 0 : o.r < 62 ? 1 : 2, v = o.variant || 0;
  const key = 'mt|' + v + '|' + size + '|' + B.name + '|' + res;
  let s = spriteCache.get(key);
  if (s) return s;
  const r = [40, 54, 70][size], h = r * (0.78 + (v % 3) * 0.16);
  const w = r * 2.6 + 30, hh = h + r * TILT * 0.7 + 30, ax = w / 2, ay = h + 18;
  const c = mk(w * res, hh * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(ax, ay);
  let seed = (v * 7919 + size * 104729 + 13) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // Schatten am Boden
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(r * 0.25, r * TILT * 0.1, r * 1.25, r * TILT * 0.75, 0, 0, 7); g.fill();
  const px = (rnd() - 0.5) * r * 0.4;
  // gewölbte Flanken; Varianten 3–5 mit zweitem, niedrigerem Gipfel
  const two = v >= 3, j = () => 0.94 + rnd() * 0.1;
  const top = two ? [
    [-r, 0], [-r * 0.95, -h * 0.32 * j()], [-r * 0.72, -h * 0.62 * j()], [-r * 0.4, -h * 0.66 * j()], [-r * 0.18, -h * 0.82], [px + r * 0.1, -h],
    [r * 0.42, -h * 0.86 * j()], [r * 0.78, -h * 0.5 * j()], [r * 0.97, -h * 0.18], [r, 0],
  ] : [
    [-r, 0], [-r * 0.94, -h * 0.34 * j()], [-r * 0.66, -h * 0.74 * j()], [-r * 0.26, -h * 0.97], [px, -h],
    [r * 0.3, -h * 0.94 * j()], [r * 0.68, -h * 0.7 * j()], [r * 0.95, -h * 0.3 * j()], [r, 0],
  ];
  const sil = () => {
    g.beginPath(); g.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < top.length - 1; i++) { const a = top[i], b = top[i + 1]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.lineTo(top[top.length - 1][0], top[top.length - 1][1]);
    g.ellipse(0, 0, r, r * TILT * 0.55, 0, 0, Math.PI);
    g.closePath();
  };
  const gr = g.createLinearGradient(-r, -h, r, 0);
  gr.addColorStop(0, mix(B.rock, '#ffffff', 0.28)); gr.addColorStop(0.45, mix(B.rock, '#000000', 0.05)); gr.addColorStop(1, mix(B.rock, '#000000', 0.55));
  sil(); g.fillStyle = gr; g.fill();
  g.save(); sil(); g.clip();
  // Schattenseite rechts vom Grat
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.moveTo(px, -h); g.quadraticCurveTo(px + r * 0.15, -h * 0.4, r * 0.12, r * TILT * 0.6); g.lineTo(r * 1.2, r); g.lineTo(r * 1.2, -h - 5); g.closePath(); g.fill();
  // Rinnen
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.6; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const sx = px + (rnd() - 0.5) * r * 0.6, sy = -h * (0.55 + rnd() * 0.35), ex = sx + (rnd() - 0.5) * r * 0.7, ey = -h * rnd() * 0.15;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 + (rnd() - 0.5) * 10, (sy + ey) / 2, ex, ey); g.stroke();
  }
  // Landschaftsdetails
  const nm = B.name || '';
  if (nm.includes('Frost')) {
    g.fillStyle = 'rgba(236,248,255,0.9)';
    g.beginPath(); g.moveTo(-r, -h * 0.58);
    for (let i = 0; i <= 8; i++) { const x = -r + i / 8 * 2 * r; g.lineTo(x, -h * (0.58 + (i % 2 ? 0.08 : -0.04) + rnd() * 0.06)); }
    g.lineTo(r, -h - 10); g.lineTo(-r, -h - 10); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,160,200,0.35)'; g.beginPath(); g.moveTo(px, -h); g.quadraticCurveTo(px + r * 0.2, -h * 0.75, r * 0.5, -h * 0.55); g.lineTo(r, -h); g.closePath(); g.fill();
  } else if (B.waterGlow && !nm.includes('Kristall')) {
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(B.water, 0.55); g.lineWidth = 1.4; g.shadowColor = B.water; g.shadowBlur = 6;
    for (let i = 0; i < 2; i++) { const sx = (rnd() - 0.5) * r * 0.9, sy = -h * (0.05 + rnd() * 0.3); g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + (rnd() - 0.5) * 14, sy - 10, sx + (rnd() - 0.5) * 12, sy - 18 - rnd() * 10); g.stroke(); }
    g.shadowBlur = 0; g.globalCompositeOperation = 'source-over';
  } else if (nm.includes('Kristall')) {
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - 0.5) * r * 1.1, y = -h * (0.1 + rnd() * 0.45), l = 10 + rnd() * 14;
      const cg = g.createLinearGradient(x - 4, 0, x + 4, 0); cg.addColorStop(0, mix(B.crystal, '#ffffff', 0.5)); cg.addColorStop(1, mix(B.crystal, '#000000', 0.3));
      g.fillStyle = cg; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y - l); g.lineTo(x + 4, y); g.closePath(); g.fill();
    }
  } else {
    // Moos und Ranken
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * r * 1.6, y = -h * rnd() * 0.45, rr = 4 + rnd() * 9;
      g.fillStyle = rgba(rnd() < 0.5 ? B.plant : B.plant2, 0.45); g.beginPath(); g.ellipse(x, y, rr, rr * 0.6, 0, 0, 7); g.fill();
    }
  }
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; sil(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(top[2][0], top[2][1] + 3); g.quadraticCurveTo((top[2][0] + px) / 2, -h + 2, px, -h + 2); g.stroke();
  s = { c, w, h: hh, ax, ay };
  spriteCache.set(key, s);
  return s;
}
