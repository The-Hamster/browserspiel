// Vorgerenderte Grafiken: Glow-Punkte, Gegner, Türme, Icons
import { ENEMIES, TOWERS } from './data.js';
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
      roundRect(g, -r * 0.92, -r * 0.6, r * 1.84, r * 1.2, r * 0.22); g.fill();
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
      g.beginPath();
      g.moveTo(r * 1.15, 0); g.lineTo(r * 0.55, -r * 0.45); g.lineTo(r * 0.1, -r * 1.05); g.lineTo(-r * 0.55, -r * 0.95); g.lineTo(-r * 0.95, -r * 0.5);
      g.lineTo(-r * 0.8, 0); g.lineTo(-r * 0.95, r * 0.5); g.lineTo(-r * 0.55, r * 0.95); g.lineTo(r * 0.1, r * 1.05); g.lineTo(r * 0.55, r * 0.45); g.closePath(); g.fill();
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
function metalBox(g, x, y, w, h, r, base = '#3a4250') {
  g.fillStyle = shade(g, x, y, x + w, y + h, base, 0.55); roundRect(g, x, y, w, h, r); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + r, y + 0.8); g.lineTo(x + w - r, y + 0.8); g.stroke();
}
function barrel(g, x, y, len, w, col, base = '#2c323c') {
  const gr = g.createLinearGradient(0, y - w / 2, 0, y + w / 2);
  gr.addColorStop(0, mix(base, '#000000', 0.3)); gr.addColorStop(0.35, mix(base, '#ffffff', 0.35)); gr.addColorStop(1, mix(base, '#000000', 0.5));
  g.fillStyle = gr; g.fillRect(x, y - w / 2, len, w);
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.8; g.strokeRect(x, y - w / 2, len, w);
  g.fillStyle = mix(base, '#000000', 0.5); g.fillRect(x + len - 2.5, y - w / 2 - 0.6, 2.5, w + 1.2);
  if (col) { g.fillStyle = rgba(col, 0.9); g.fillRect(x + len * 0.35, y - w / 2, 1.6, w); }
}
function core(g, x, y, r, col, res) {
  neon(g, col, 10 * res);
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, mix(col, '#ffffff', 0.4)); gr.addColorStop(1, col);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.shadowBlur = 0;
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
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2 + Math.PI / 4); metalBox(g, 6, -2.5, 13, 5, 2, '#3a4250'); g.fillStyle = col; g.fillRect(16, -1.5, 2.5, 3); g.restore(); }
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
      g.fillStyle = shade(g, -16, -16, 16, 16, '#3d4656'); poly(g, 6, 17, 0); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#14171c'; poly(g, 6, 11, 0); g.fill();
      g.fillStyle = shade(g, -10, -9, 0, 9, '#4a5466'); g.fillRect(-9.5, -8, 9, 16); g.fillStyle = shade(g, 0, -9, 10, 9, '#4a5466'); g.fillRect(0.5, -8, 9, 16);
      g.fillStyle = '#c9a227'; g.fillRect(-0.5, -8, 1, 16);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; core(g, Math.cos(a) * 14, Math.sin(a) * 14, 1.3, col, res); }
      break;
    }
    case 'shield': {
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.fillStyle = shade(g, 6, -4, 16, 4, '#465062'); g.beginPath(); g.moveTo(6, -5); g.lineTo(16, -2); g.lineTo(16, 2); g.lineTo(6, 5); g.closePath(); g.fill(); g.restore(); }
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
  g.scale(96 / 74, 96 / 74); g.translate(37, 35);
  drawTowerBase(g, type, tier, 1.5);
  g.rotate(-0.6);
  drawTowerHead(g, type, tier, 1.5);
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
