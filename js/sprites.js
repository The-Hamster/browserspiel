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

export function drawEnemyShape(g, type, r, col, elite, res = 1) {
  const dark = mix(col, '#05070c', 0.72);
  const mid = mix(col, '#05070c', 0.35);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const lw = Math.max(1.2, r * 0.13);
  g.lineWidth = lw;
  neon(g, col, 10 * res);
  g.strokeStyle = col;
  switch (type) {
    case 'swarm': case 'mite': {
      g.fillStyle = rgba(col, 0.35);
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(-r * 0.25, s * r * 0.72, r * 0.75, r * 0.32, s * 0.5, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = mid; g.beginPath(); g.ellipse(-r * 0.35, 0, r * 0.45, r * 0.32, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 6 * res; g.fillStyle = '#fff';
      g.beginPath(); g.arc(r * 0.62, -r * 0.2, r * 0.13, 0, 7); g.arc(r * 0.62, r * 0.2, r * 0.13, 0, 7); g.fill();
      if (type === 'mite') { g.strokeStyle = col; for (let i = 0; i < 5; i++) { const a = i * 1.26; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); g.stroke(); } }
      break;
    }
    case 'tank': {
      g.fillStyle = '#1a1d24';
      g.fillRect(-r * 1.05, -r * 0.95, r * 2.1, r * 0.42); g.fillRect(-r * 1.05, r * 0.53, r * 2.1, r * 0.42);
      g.strokeStyle = rgba(col, 0.6); g.lineWidth = lw * 0.6;
      for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * r * 0.24, -r * 0.95); g.lineTo(i * r * 0.24, -r * 0.55); g.moveTo(i * r * 0.24, r * 0.55); g.lineTo(i * r * 0.24, r * 0.95); g.stroke(); }
      g.lineWidth = lw; g.strokeStyle = col;
      g.fillStyle = dark; roundRect(g, -r * 0.9, -r * 0.62, r * 1.8, r * 1.24, r * 0.25); g.fill(); g.stroke();
      g.fillStyle = mid; g.beginPath(); g.arc(-r * 0.05, 0, r * 0.45, 0, 7); g.fill(); g.stroke();
      g.fillStyle = col; g.fillRect(r * 0.2, -r * 0.1, r * 0.95, r * 0.2);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.05, 0, r * 0.14, 0, 7); g.fill();
      break;
    }
    case 'shield': {
      g.fillStyle = dark; poly(g, 6, r, 0); g.fill(); g.stroke();
      g.fillStyle = mid; poly(g, 6, r * 0.6, Math.PI / 6); g.fill();
      g.fillStyle = '#e8fbff'; g.shadowBlur = 14 * res; g.beginPath(); g.arc(0, 0, r * 0.26, 0, 7); g.fill();
      break;
    }
    case 'phantom': {
      g.fillStyle = rgba(col, 0.25);
      g.beginPath(); g.moveTo(-r * 1.5, 0); g.quadraticCurveTo(-r * 0.6, -r * 0.9, 0, -r * 0.3); g.quadraticCurveTo(-r * 0.6, r * 0.9, -r * 1.5, 0); g.fill();
      g.fillStyle = dark; g.beginPath(); g.moveTo(r * 1.1, 0); g.lineTo(0, -r * 0.75); g.lineTo(-r * 0.8, 0); g.lineTo(0, r * 0.75); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(r * 0.35, 0, r * 0.3, r * 0.12, 0, 0, 7); g.fill();
      break;
    }
    case 'flyer': {
      g.fillStyle = dark; g.beginPath(); g.moveTo(r * 1.2, 0); g.lineTo(-r * 0.9, -r * 1.05); g.lineTo(-r * 0.45, 0); g.lineTo(-r * 0.9, r * 1.05); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = mid; g.beginPath(); g.moveTo(r * 0.8, 0); g.lineTo(-r * 0.3, -r * 0.3); g.lineTo(-r * 0.3, r * 0.3); g.closePath(); g.fill();
      g.fillStyle = '#fff6c0'; g.shadowBlur = 12 * res; g.beginPath(); g.arc(-r * 0.55, 0, r * 0.18, 0, 7); g.fill();
      break;
    }
    case 'splitter': {
      g.fillStyle = dark;
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; g.beginPath(); g.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.62, 0, 7); g.fill(); g.stroke(); }
      g.fillStyle = mid; g.beginPath(); g.arc(0, 0, r * 0.45, 0, 7); g.fill();
      g.fillStyle = '#ffe0f0'; g.beginPath(); g.arc(0, 0, r * 0.2, 0, 7); g.fill();
      break;
    }
    case 'boss': {
      g.fillStyle = dark;
      g.beginPath();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = i % 2 ? r * 0.82 : r * 1.05; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = mid; g.beginPath(); g.arc(0, 0, r * 0.62, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#1a0b12'; g.beginPath(); g.arc(0, 0, r * 0.4, 0, 7); g.fill();
      g.fillStyle = col; g.fillRect(r * 0.55, -r * 0.08, r * 0.6, r * 0.16);
      g.fillStyle = '#fff'; g.shadowBlur = 20 * res; g.beginPath(); g.arc(0, 0, r * 0.16, 0, 7); g.fill();
      break;
    }
  }
  if (elite) {
    g.shadowColor = '#ffd23e'; g.shadowBlur = 10 * res; g.strokeStyle = '#ffd23e'; g.lineWidth = Math.max(1.2, r * 0.1);
    g.setLineDash([r * 0.35, r * 0.25]); g.beginPath(); g.arc(0, 0, r * 1.28, 0, 7); g.stroke(); g.setLineDash([]);
  }
  g.shadowBlur = 0;
}

function poly(g, n, r, rot) { g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

const spriteCache = new Map();
export function clearSpriteCache() { spriteCache.clear(); }

// Liefert {c, w, h} in Weltkoordinaten-Größe w/h
export function enemySprite(type, elite, res) {
  const key = 'e|' + type + '|' + (elite ? 1 : 0) + '|' + res;
  let s = spriteCache.get(key);
  if (s) return s;
  const def = ENEMIES[type];
  const r = def.r;
  const size = r * 3.2 + 16;
  const c = mk(size * res, size * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(size / 2, size / 2);
  drawEnemyShape(g, type, r, def.color, elite, res);
  s = { c, w: size, h: size };
  spriteCache.set(key, s);
  return s;
}

export function tierColor(type, tier) {
  const col = TOWERS[type].color;
  if (tier === 'a') return mix(col, '#ffffff', 0.4);
  if (tier === 'b') return mix(col, '#ff4fd8', 0.4);
  if (tier === 'c') return mix(col, '#ffd23e', 0.5);
  return col;
}

// Turm-Sockel
export function towerBaseSprite(type, tier, res) {
  const key = 'tb|' + type + '|' + tier + '|' + res;
  let s = spriteCache.get(key);
  if (s) return s;
  const size = 72;
  const c = mk(size * res, size * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(size / 2, size / 2);
  drawTowerBase(g, type, tier, res);
  s = { c, w: size, h: size };
  spriteCache.set(key, s);
  return s;
}
export function towerHeadSprite(type, tier, res) {
  const key = 'th|' + type + '|' + tier + '|' + res;
  let s = spriteCache.get(key);
  if (s) return s;
  const size = 72;
  const c = mk(size * res, size * res), g = c.getContext('2d');
  g.scale(res, res); g.translate(size / 2, size / 2);
  drawTowerHead(g, type, tier, res);
  s = { c, w: size, h: size };
  spriteCache.set(key, s);
  return s;
}

export function drawTowerBase(g, type, tier, res = 1) {
  const col = tierColor(type, tier);
  const R = 25;
  const gr = g.createLinearGradient(-R, -R, R, R);
  gr.addColorStop(0, '#3a4252'); gr.addColorStop(0.5, '#1c212b'); gr.addColorStop(1, '#0d1016');
  g.fillStyle = gr;
  g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8 * res; g.shadowOffsetY = 3 * res;
  poly(g, 8, R, Math.PI / 8); g.fill();
  g.shadowOffsetY = 0;
  g.strokeStyle = rgba(col, 0.9); g.lineWidth = 1.6; neon(g, col, 8 * res);
  poly(g, 8, R - 2, Math.PI / 8); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
  poly(g, 8, R - 6, Math.PI / 8); g.stroke();
  g.fillStyle = '#596274';
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * (R - 6), Math.sin(a) * (R - 6), 1.6, 0, 7); g.fill(); }
}

export function drawTowerHead(g, type, tier, res = 1) {
  const col = tierColor(type, tier);
  const lvl = tier === '1' ? 0 : tier === '2' ? 1 : 2;
  const sc = 0.88 + lvl * 0.1;
  g.save(); g.scale(sc, sc);
  const dark = '#141922', metal = '#2c3442';
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = col; g.lineWidth = 1.6; neon(g, col, 9 * res);
  switch (type) {
    case 'laser': {
      g.fillStyle = metal; roundRect(g, -10, -9, 20, 18, 5); g.fill(); g.stroke();
      g.fillStyle = dark;
      const n = tier === 'b' ? 3 : tier === 'c' ? 3 : 2;
      for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * 6; g.fillRect(6, y - 1.8, 16, 3.6); g.strokeRect(6, y - 1.8, 16, 3.6); }
      g.fillStyle = mix(col, '#ffffff', 0.5); g.shadowBlur = 14 * res; g.beginPath(); g.arc(-1, 0, 5, 0, 7); g.fill();
      break;
    }
    case 'plasma': {
      g.fillStyle = metal; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); g.stroke();
      g.fillStyle = dark; roundRect(g, 4, -7, 18, 14, 4); g.fill(); g.stroke();
      if (tier === 'b') { g.fillRect(4, -12, 12, 4); g.fillRect(4, 8, 12, 4); }
      g.fillStyle = mix(col, '#ffe0b0', 0.4); g.shadowBlur = 16 * res; g.beginPath(); g.arc(-3, 0, tier === 'a' ? 8 : 6, 0, 7); g.fill();
      break;
    }
    case 'rail': {
      g.fillStyle = metal; roundRect(g, -12, -8, 18, 16, 4); g.fill(); g.stroke();
      g.fillStyle = dark;
      const len = tier === 'b' ? 30 : 26;
      g.fillRect(2, -6, len, 3.5); g.fillRect(2, 2.5, len, 3.5); g.strokeRect(2, -6, len, 3.5); g.strokeRect(2, 2.5, len, 3.5);
      if (tier === 'c') { g.fillRect(2, -11, 22, 3); g.fillRect(2, 8, 22, 3); }
      g.fillStyle = col; for (let i = 0; i < 3; i++) g.fillRect(8 + i * 6, -2, 2, 4);
      g.fillStyle = mix(col, '#ffffff', 0.6); g.shadowBlur = 12 * res; g.beginPath(); g.arc(-4, 0, 4, 0, 7); g.fill();
      break;
    }
    case 'emp': {
      for (let i = 3; i >= 1; i--) { g.fillStyle = i % 2 ? metal : dark; g.beginPath(); g.arc(0, 0, 5 + i * 4.5, 0, 7); g.fill(); g.stroke(); }
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); g.stroke(); }
      g.fillStyle = mix(col, '#ffffff', 0.5); g.shadowBlur = 16 * res; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
      break;
    }
    case 'rocket': {
      g.fillStyle = metal; roundRect(g, -12, -13, 24, 26, 4); g.fill(); g.stroke();
      const n = tier === 'a' ? 3 : 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
        const y = (i - (n - 1) / 2) * 8, x = j * 9 - 4;
        g.fillStyle = dark; g.beginPath(); g.arc(x + 6, y, 3.2, 0, 7); g.fill(); g.stroke();
        g.fillStyle = col; g.beginPath(); g.arc(x + 6, y, 1.4, 0, 7); g.fill();
      }
      if (tier === 'b') { g.fillStyle = dark; g.fillRect(10, -3, 16, 6); g.strokeRect(10, -3, 16, 6); }
      break;
    }
    case 'tesla': {
      g.fillStyle = metal; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); g.stroke();
      for (let i = 0; i < 3; i++) { g.strokeStyle = rgba(col, 0.9 - i * 0.2); g.beginPath(); g.arc(0, 0, 11 - i * 3, 0, 7); g.stroke(); }
      for (let i = 0; i < 3; i++) { const a = i * 2.094; g.fillStyle = dark; g.beginPath(); g.arc(Math.cos(a) * 14, Math.sin(a) * 14, 3.5, 0, 7); g.fill(); g.strokeStyle = col; g.stroke(); }
      g.fillStyle = '#ffffff'; g.shadowBlur = 18 * res; g.beginPath(); g.arc(0, 0, tier === 'c' ? 6 : 4.5, 0, 7); g.fill();
      break;
    }
    case 'drone': {
      g.fillStyle = metal; poly(g, 6, 16, 0); g.fill(); g.stroke();
      g.fillStyle = dark; poly(g, 6, 10, 0); g.fill();
      g.strokeStyle = rgba(col, 0.8); g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke();
      g.fillStyle = col; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.4, 0, 7); g.fill(); }
      break;
    }
    case 'shield': {
      g.fillStyle = metal; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); g.stroke();
      g.fillStyle = mix(col, '#ffffff', 0.35); g.shadowBlur = 16 * res;
      g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 0); g.lineTo(0, 11); g.lineTo(-7, 0); g.closePath(); g.fill();
      g.strokeStyle = rgba(col, 0.6); g.beginPath(); g.arc(0, 0, 17, 0, 7); g.stroke();
      break;
    }
    case 'radar': {
      g.fillStyle = metal; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.stroke();
      g.fillStyle = dark; g.beginPath(); g.ellipse(6, 0, 6, 17, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = col; g.beginPath(); g.moveTo(0, 0); g.lineTo(16, 0); g.stroke();
      g.fillStyle = '#ffffff'; g.shadowBlur = 12 * res; g.beginPath(); g.arc(16, 0, 2.5, 0, 7); g.fill();
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
  g.scale(96 / 64, 96 / 64); g.translate(32, 32);
  drawTowerBase(g, type, tier, 1.5);
  g.rotate(-0.5);
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
