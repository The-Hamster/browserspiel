// Gelände zeichnen: Boden, Straße, Flüsse, Pflanzen, Felsen, Kristalle, Station
import { TILE, WORLD_W, WORLD_H, TILT } from './data.js';
import { LANE } from './game.js';
import { mk, roundRect } from './sprites.js';
import { rgba, mix, mulberry32, hashString, clamp } from './util.js';

let noiseTile = null;
// Weiche Struktur-Textur (Wertrauschen, mehrere Ebenen), kachelbar
export function noise() {
  if (noiseTile) return noiseTile;
  const N = 256, c = mk(N, N), g = c.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  const rng = mulberry32(99);
  const grids = [8, 16, 32, 64, 128].map(n => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng(); return { n, a }; });
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = 0.5, tot = 0;
    for (const { n, a } of grids) {
      const fx = x / N * n, fy = y / N * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
      const i = (xx, yy) => a[((yy % n + n) % n) * n + ((xx % n + n) % n)];
      const top = i(x0, y0) + (i(x0 + 1, y0) - i(x0, y0)) * tx;
      const bot = i(x0, y0 + 1) + (i(x0 + 1, y0 + 1) - i(x0, y0 + 1)) * tx;
      v += (top + (bot - top) * ty) * amp; tot += amp; amp *= 0.62;
    }
    v = v / tot;
    const k = (y * N + x) * 4, c8 = Math.round(v * 255);
    d[k] = d[k + 1] = d[k + 2] = c8; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (noiseTile = c);
}

function strokePts(g, pts) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); }
function offsetPts(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    out.push({ x: pts[i].x - dy / l * d, y: pts[i].y + dx / l * d });
  }
  return out;
}

// ---------------------------------------------------------------- Einzelteile
export function drawRock(g, o, B) {
  const rng = mulberry32(hashString('r' + Math.round(o.x) + ',' + Math.round(o.y)));
  const n = 7 + Math.floor(rng() * 3), pts = [];
  for (let i = 0; i < n; i++) { const a = o.rot + i / n * Math.PI * 2, r = o.r * (0.72 + rng() * 0.32); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.85]); }
  g.save(); g.translate(o.x, o.y);
  g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x + o.r * 0.25, y + o.r * 0.3) : g.moveTo(x + o.r * 0.25, y + o.r * 0.3)); g.closePath(); g.fill();
  const gr = g.createLinearGradient(-o.r, -o.r, o.r, o.r);
  gr.addColorStop(0, mix(B.rock, '#ffffff', 0.35)); gr.addColorStop(0.5, B.rock); gr.addColorStop(1, mix(B.rock, '#000000', 0.55));
  g.fillStyle = gr; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2; g.stroke();
  // Facetten
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath();
  for (let i = 0; i < n; i += 2) { g.moveTo(pts[i][0] * 0.9, pts[i][1] * 0.9); g.lineTo(pts[i][0] * 0.2 - o.r * 0.1, pts[i][1] * 0.2 - o.r * 0.1); }
  g.stroke();
  g.restore();
}

export function drawCrystal(g, o, B) {
  const rng = mulberry32(hashString('c' + Math.round(o.x) + ',' + Math.round(o.y)));
  g.save(); g.translate(o.x, o.y);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(o.r * 0.25, o.r * 0.35, o.r * 0.9, o.r * 0.55, 0, 0, 7); g.fill();
  const glowG = g.createRadialGradient(0, 0, 0, 0, 0, o.r * 1.8);
  glowG.addColorStop(0, rgba(B.crystal, 0.35)); glowG.addColorStop(1, rgba(B.crystal, 0));
  g.fillStyle = glowG; g.beginPath(); g.arc(0, 0, o.r * 1.8, 0, 7); g.fill();
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 1.6, len = o.r * (0.8 + rng() * 0.9), w = o.r * (0.22 + rng() * 0.15);
    const bx = (rng() - 0.5) * o.r * 0.8, by = (rng() - 0.3) * o.r * 0.5;
    g.save(); g.translate(bx, by); g.rotate(a + Math.PI / 2);
    const gr = g.createLinearGradient(-w, 0, w, 0);
    gr.addColorStop(0, mix(B.crystal, '#ffffff', 0.55)); gr.addColorStop(0.5, B.crystal); gr.addColorStop(1, mix(B.crystal, '#000000', 0.5));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.8, -len * 0.75); g.lineTo(0, -len); g.lineTo(w * 0.8, -len * 0.75); g.lineTo(w, 0); g.closePath(); g.fill();
    g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -len); g.lineTo(0, 0); g.stroke();
    g.restore();
  }
  g.restore();
}

export function drawTree(g, o, B) {
  const rng = mulberry32(hashString('t' + Math.round(o.x) + ',' + Math.round(o.y)));
  const blobs = [];
  const n = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) { const a = rng() * 6.28, d = rng() * o.r * 0.55; blobs.push([Math.cos(a) * d, Math.sin(a) * d, o.r * (0.42 + rng() * 0.3)]); }
  g.save(); g.translate(o.x, o.y);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x + o.r * 0.3, y + o.r * 0.38, r, 0, 7); g.fill(); }
  for (const [x, y, r] of blobs) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, mix(B.plant2, '#ffffff', 0.15)); gr.addColorStop(0.55, B.plant); gr.addColorStop(1, mix(B.plant, '#000000', 0.55));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // leuchtende Sporen
  for (let i = 0; i < 6; i++) {
    const a = rng() * 6.28, d = rng() * o.r * 0.7;
    g.fillStyle = rgba(B.plant2, 0.8); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 1.2 + rng() * 1.3, 0, 7); g.fill();
  }
  g.restore();
}

function drawObstacle(g, o, B) {
  if (o.kind === 'crystal') drawCrystal(g, o, B);
  else if (o.kind === 'tree') drawTree(g, o, B);
  else drawRock(g, o, B);
}

// ---------------------------------------------------------------- Ganze Karte (in Weltkoordinaten)
// Randzone, Schluchten und Felskante entlang der Grenzlinie
function loopPath(g, P, off = 0) {
  g.moveTo(P[0].x + P[0].ox * off, P[0].y + P[0].oy * off);
  for (let i = 1; i < P.length; i++) g.lineTo(P[i].x + P[i].ox * off, P[i].y + P[i].oy * off);
  g.closePath();
}
function drawBorder(g, map, pat) {
  const B = map.biome, P = map.border.pts, n = P.length;
  // Randzone: dunkler, felsiger Boden
  g.save();
  g.beginPath(); g.rect(-80, -80, WORLD_W + 160, WORLD_H + 160); loopPath(g, P, 0);
  g.clip('evenodd');
  g.fillStyle = rgba(B.dark, 0.38); g.fillRect(-80, -80, WORLD_W + 160, WORLD_H + 160);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.7; g.fillStyle = pat;
  g.save(); g.scale(0.5, 0.5); g.fillRect(-160, -160, WORLD_W * 2 + 320, WORLD_H * 2 + 320); g.restore();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // Geröll am Rand
  const rng = mulberry32(hashString('rim-' + (map.seedId || map.id)));
  for (let i = 0; i < n; i++) {
    const p = P[i];
    for (let k = 0; k < 3; k++) {
      const d = 6 + rng() * 120, x = p.x + p.ox * d + (rng() - 0.5) * 30, y = p.y + p.oy * d + (rng() - 0.5) * 30, r = 2 + rng() * 6;
      g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(x + 1.5, y + 1.5, r, r * 0.75, 0, 0, 7); g.fill();
      g.fillStyle = mix(B.rock, '#ffffff', 0.08 + rng() * 0.12); g.beginPath(); g.ellipse(x, y, r, r * 0.75, rng() * 3, 0, 7); g.fill();
    }
  }
  g.restore();
  // Schluchten: zusammenhängende Abschnitte mit v < 0
  const depth = (p) => { const d = clamp(-p.v * 3, 0, 1) * (1 - p.pass); return d * d * (3 - 2 * d); };
  let s0 = 0;
  while (s0 < n && depth(P[s0]) > 0.06) s0++;
  if (s0 >= n) s0 = 0;
  const runs = [];
  let cur = null;
  for (let k = 1; k <= n; k++) {
    const p = P[(s0 + k) % n], d = depth(p);
    if (d > 0.06) { if (!cur) { cur = []; runs.push(cur); } cur.push(p); } else cur = null;
  }
  const deep = mix(B.dark, '#000000', 0.6), wall = mix(B.rock, '#000000', 0.38), lip = mix(B.ground2 || B.ground, '#ffffff', 0.22);
  for (const run of runs) {
    if (run.length < 3) continue;
    const inner = run.map(p => ({ x: p.x + p.ox * 10, y: p.y + p.oy * 10 }));
    // runde Enden statt Spitzen
    run[0] = { ...run[0], cw: 0 }; run[run.length - 1] = { ...run[run.length - 1], cw: 0 };
    const outer = run.map(p => { const w = 10 + p.cw * depth(p); return { x: p.x + p.ox * w, y: p.y + p.oy * w }; });
    const mid = run.map(p => { const w = 10 + p.cw * depth(p) * 0.5; return { x: p.x + p.ox * w, y: p.y + p.oy * w }; });
    const poly = () => { g.beginPath(); inner.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); for (let i = outer.length - 1; i >= 0; i--) g.lineTo(outer[i].x, outer[i].y); g.closePath(); };
    const line = (pts, dy = 0) => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.x, q.y + dy) : g.moveTo(q.x, q.y + dy)); };
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 10;
    poly(); g.fillStyle = deep; g.fill();
    g.shadowBlur = 0;
    poly(); g.clip();
    // sichtbare Felswand unter der oberen Kante + Gesteinsschichten
    g.strokeStyle = wall; g.lineWidth = 26;
    line(inner, 13); g.stroke(); line(outer, 13); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1.5;
    for (const dy of [6, 13, 20]) { line(inner, dy); g.stroke(); line(outer, dy); g.stroke(); }
    // Tiefe: Lava, Eisnebel, Kristall- oder Giftschein
    g.lineWidth = 1;
    const glowCol = B.waterGlow ? B.water : (B.crystal || B.accent);
    g.globalCompositeOperation = 'lighter';
    g.shadowColor = glowCol; g.shadowBlur = 18;
    g.strokeStyle = rgba(glowCol, B.waterGlow ? 0.55 : 0.18);
    let avg = 0; for (const p of run) avg += p.cw * depth(p); avg /= run.length;
    g.lineWidth = Math.max(2, avg * (B.waterGlow ? 0.2 : 0.26));
    line(mid, 8); g.stroke();
    g.shadowBlur = 0; g.globalCompositeOperation = 'source-over';
    g.restore();
    // helle Abbruchkanten
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 5; line(inner, 2); g.stroke(); line(outer, 2); g.stroke();
    g.strokeStyle = rgba(lip, 0.55); g.lineWidth = 2.2; line(inner); g.stroke(); line(outer); g.stroke();
    g.restore();
  }
  // weiche Kante zwischen Baufläche und Randzone
  g.save();
  g.lineJoin = 'round';
  g.beginPath(); loopPath(g, P, 2); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 8; g.stroke();
  g.beginPath(); loopPath(g, P, -1); g.strokeStyle = rgba(lip, 0.18); g.lineWidth = 2; g.stroke();
  g.restore();
}

export function drawTerrain(g, map, opts = {}) {
  const B = map.biome;
  const rng = mulberry32(hashString('terrain-' + (map.seedId || map.id)));
  g.save();
  g.beginPath(); g.rect(0, 0, WORLD_W, WORLD_H); g.clip();
  // Boden
  g.fillStyle = B.ground; g.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 46; i++) {
    const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 60 + rng() * 180;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = rng() < 0.55 ? B.ground2 : B.dark;
    gr.addColorStop(0, rgba(c, 0.55)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const pat = g.createPattern(noise(), 'repeat');
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55;
  g.fillStyle = pat; g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.save(); g.scale(0.35, 0.35); g.globalAlpha = 0.35; g.fillRect(0, 0, WORLD_W / 0.35, WORLD_H / 0.35); g.restore();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // Krater
  for (let i = 0; i < 9; i++) {
    const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 14 + rng() * 34;
    const gr = g.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.2, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(0.85, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r * 0.95, Math.PI * 0.15, Math.PI * 1.1); g.stroke();
  }
  // Kleinteile
  for (const d of map.deco) {
    if (d.block) continue;
    if (d.kind === 'pebble') {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(d.x + 1.5, d.y + 1.5, d.r, d.r * 0.7, d.rot, 0, 7); g.fill();
      g.fillStyle = mix(B.rock, '#ffffff', 0.15); g.beginPath(); g.ellipse(d.x, d.y, d.r, d.r * 0.7, d.rot, 0, 7); g.fill();
    } else if (d.kind === 'grass') {
      g.strokeStyle = rgba(B.plant2, 0.55); g.lineWidth = 1.2; g.beginPath();
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.35; g.moveTo(d.x, d.y); g.lineTo(d.x + Math.cos(a) * d.r * 1.6, d.y + Math.sin(a) * d.r * 1.6); }
      g.stroke();
    } else {
      g.fillStyle = rgba(B.crystal, 0.75); g.beginPath(); g.moveTo(d.x, d.y - d.r * 1.4); g.lineTo(d.x + d.r * 0.5, d.y); g.lineTo(d.x - d.r * 0.5, d.y); g.closePath(); g.fill();
    }
  }
  // Wasser / Lava / Gift
  for (const w of map.water) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = rgba(B.dark, 0.85); g.lineWidth = w.w + 16; strokePts(g, w.pts);
    g.strokeStyle = mix(B.water, '#000000', 0.45); g.lineWidth = w.w + 4; strokePts(g, w.pts);
    if (B.waterGlow) { g.shadowColor = B.water; g.shadowBlur = 22; }
    g.strokeStyle = B.water; g.lineWidth = w.w - 2; strokePts(g, w.pts);
    g.shadowBlur = 0;
    g.strokeStyle = rgba(B.water2, 0.45); g.lineWidth = w.w * 0.45; strokePts(g, w.pts);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.strokeStyle = pat; g.lineWidth = w.w; strokePts(g, w.pts);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  // Straße
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 14;
  g.strokeStyle = rgba(B.dark, 0.6); g.lineWidth = LANE * 2 + 14;
  for (const p of map.smooth) strokePts(g, p);
  g.shadowBlur = 0;
  g.strokeStyle = B.roadEdge; g.lineWidth = LANE * 2 + 2;
  for (const p of map.smooth) strokePts(g, p);
  g.strokeStyle = B.road; g.lineWidth = LANE * 2 - 6;
  for (const p of map.smooth) strokePts(g, p);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.7;
  g.strokeStyle = pat; g.lineWidth = LANE * 2 - 4;
  for (const p of map.smooth) strokePts(g, p);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // Reifen- und Kettenspuren
  g.setLineDash([16, 7]); g.lineWidth = 3.2; g.strokeStyle = 'rgba(0,0,0,0.2)';
  for (const p of map.smooth) for (const off of [-11, -6, 6, 11]) strokePts(g, offsetPts(p, off));
  g.setLineDash([]);
  // Randsteine
  for (const p of map.smooth) {
    for (let i = 0; i < p.length; i += 3) {
      const side = (i / 3) % 2 ? 1 : -1;
      const q = offsetPts([p[Math.max(0, i - 1)], p[i], p[Math.min(p.length - 1, i + 1)]], side * (LANE - 1 + rng() * 3))[1];
      const r = 1.5 + rng() * 2.5;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(q.x + 1, q.y + 1, r, 0, 7); g.fill();
      g.fillStyle = mix(B.roadEdge, '#ffffff', 0.25); g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill();
    }
  }
  // Hindernisse + große Pflanzen (von oben nach unten für korrekte Überdeckung)
  if (!opts.upright) {
    const big = [...map.obstacles, ...map.deco.filter(d => d.block)].sort((a, b) => a.y - b.y);
    for (const o of big) drawObstacle(g, o, B);
  }
  // Station um den Kern
  if (map.smooth.length) drawStation(g, map.basePos.x, map.basePos.y, B);
  // natürliche Grenze (Berge stehen aufrecht und werden extra gezeichnet)
  if (map.border) drawBorder(g, map, pat);
  // zum Rand hin weich ausblenden, damit die Umgebung ohne Kante anschließt
  if (opts.feather) {
    g.globalCompositeOperation = 'destination-out';
    const F = 130;
    const fe = (x0, y0, x1, y1, w, h) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h); };
    fe(0, 0, F, 0, F, WORLD_H); fe(WORLD_W, 0, WORLD_W - F, 0, F, WORLD_H);
    fe(0, 0, 0, F, WORLD_W, F); fe(0, WORLD_H, 0, WORLD_H - F, WORLD_W, F);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();

}

function drawStation(g, x, y, B) {
  g.save(); g.translate(x, y);
  // Schatten + Plattform
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(6, 8, 74, 0, 7); g.fill();
  const pg = g.createRadialGradient(-20, -24, 10, 0, 0, 74);
  pg.addColorStop(0, '#4a5466'); pg.addColorStop(0.6, '#262d39'); pg.addColorStop(1, '#141820');
  g.fillStyle = pg; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; g.lineTo(Math.cos(a) * 72, Math.sin(a) * 72); }
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.stroke();
  // Plattenfugen
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; g.beginPath(); g.moveTo(Math.cos(a) * 46, Math.sin(a) * 46); g.lineTo(Math.cos(a) * 72, Math.sin(a) * 72); g.stroke(); }
  g.beginPath(); g.arc(0, 0, 46, 0, 7); g.stroke();
  // Warnstreifen
  g.save(); g.beginPath(); g.arc(0, 0, 44, 0, 7); g.arc(0, 0, 38, 0, 7, true); g.clip();
  for (let i = 0; i < 36; i++) { g.fillStyle = i % 2 ? '#1a1d22' : '#c9a227'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 46, i / 36 * 6.283, (i + 1) / 36 * 6.283); g.closePath(); g.fill(); }
  g.restore();
  // kleine Gebäude
  const mods = [[-0.6, '#3b4658'], [0.9, '#334050'], [2.4, '#3b4658'], [3.9, '#2f3a4a']];
  for (const [a, col] of mods) {
    g.save(); g.rotate(a); g.translate(58, 0);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(-7, -9, 18, 22);
    const bg = g.createLinearGradient(-9, -11, 9, 11); bg.addColorStop(0, mix(col, '#ffffff', 0.3)); bg.addColorStop(1, mix(col, '#000000', 0.4));
    g.fillStyle = bg; roundRect(g, -9, -11, 18, 22, 3); g.fill();
    g.fillStyle = rgba(B.accent, 0.8); g.fillRect(-5, -7, 3, 3); g.fillRect(2, -7, 3, 3);
    g.restore();
  }
  g.restore();
}

// Kleines Vorschaubild
export function drawThumbTerrain(g, map, W, H) {
  const s = W / WORLD_W, B = map.biome;
  g.save(); g.scale(s, s);
  g.fillStyle = B.ground; g.fillRect(0, 0, WORLD_W, WORLD_H);
  const gr = g.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 50, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.7);
  gr.addColorStop(0, rgba(B.ground2, 0.8)); gr.addColorStop(1, rgba(B.dark, 0.6));
  g.fillStyle = gr; g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const w of map.water) { g.strokeStyle = B.water; g.lineWidth = w.w; strokePts(g, w.pts); }
  g.strokeStyle = B.roadEdge; g.lineWidth = LANE * 2 + 6; for (const p of map.smooth) strokePts(g, p);
  g.strokeStyle = B.road; g.lineWidth = LANE * 2 - 6; for (const p of map.smooth) strokePts(g, p);
  for (const o of [...map.obstacles, ...map.deco.filter(d => d.block)]) {
    g.fillStyle = o.kind === 'tree' ? B.plant : o.kind === 'crystal' ? B.crystal : B.rock;
    g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
  }
  if (map.smooth.length) {
    g.fillStyle = '#36f1ff'; g.shadowColor = '#36f1ff'; g.shadowBlur = 30;
    g.beginPath(); g.arc(map.basePos.x, map.basePos.y, 36, 0, 7); g.fill(); g.shadowBlur = 0;
  }
  g.restore();
}

// ---------------------------------------------------------------- Kulisse jenseits des Grenzwalls
// Zeichnet die Welt von -M bis W+M (Weltkoordinaten), Ebene ist bereits gestaucht skaliert.
export function drawScenery(g, map, M, res, uprightSprite) {
  const B = map.biome;
  const rng = mulberry32(hashString('scenery-' + (map.def && map.def.kachel ? 'kachel' : map.seedId || map.id)));
  const X0 = -M, Y0 = -M, X1 = WORLD_W + M, Y1 = WORLD_H + M;
  g.fillStyle = B.ground; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  for (let i = 0; i < 90; i++) {
    const x = X0 + rng() * (X1 - X0), y = Y0 + rng() * (Y1 - Y0), r = 80 + rng() * 240;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = rng() < 0.55 ? B.ground2 : B.dark;
    gr.addColorStop(0, rgba(c, 0.55)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const pat = g.createPattern(noise(), 'repeat');
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5; g.fillStyle = pat; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = rgba(B.dark, 0.38); g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  // Krater
  for (let i = 0; i < 30; i++) {
    const x = X0 + rng() * (X1 - X0), y = Y0 + rng() * (Y1 - Y0), r = 18 + rng() * 50;
    const gr = g.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.2, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // Wasser und Straßen laufen nach draußen weiter
  const extend = (pts, len) => {
    const a = pts[0], b = pts[Math.min(3, pts.length - 1)], l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    return [{ x: a.x + (a.x - b.x) / l * len, y: a.y + (a.y - b.y) / l * len }, ...pts];
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  // nur was den Kartenrand wirklich erreicht, läuft draußen weiter
  const atEdge = (p) => p.x < 40 || p.y < 40 || p.x > WORLD_W - 40 || p.y > WORLD_H - 40;
  for (const w of map.water) {
    const a = atEdge(w.pts[0]), b = atEdge(w.pts[w.pts.length - 1]);
    if (!a && !b) continue;
    let pts = a ? extend(w.pts, M * 1.6) : w.pts;
    if (b) pts = extend(pts.slice().reverse(), M * 1.6);
    g.strokeStyle = rgba(B.dark, 0.85); g.lineWidth = w.w + 16; strokePts(g, pts);
    if (B.waterGlow) { g.shadowColor = B.water; g.shadowBlur = 18; }
    g.strokeStyle = B.water; g.lineWidth = w.w - 2; strokePts(g, pts); g.shadowBlur = 0;
    g.strokeStyle = rgba(B.water2, 0.4); g.lineWidth = w.w * 0.45; strokePts(g, pts);
  }
  for (const p of map.smooth) {
    if (!atEdge(p[0])) continue;
    const pts = extend(p, M * 1.6).slice(0, 3);
    g.strokeStyle = rgba(B.dark, 0.6); g.lineWidth = LANE * 2 + 14; strokePts(g, pts);
    g.strokeStyle = B.roadEdge; g.lineWidth = LANE * 2 + 2; strokePts(g, pts);
    g.strokeStyle = B.road; g.lineWidth = LANE * 2 - 6; strokePts(g, pts);
    g.setLineDash([16, 7]); g.lineWidth = 3.2; g.strokeStyle = 'rgba(0,0,0,0.2)';
    for (const off of [-11, 11]) strokePts(g, offsetPts(pts, off));
    g.setLineDash([]);
  }
  // Kleinteile und aufrechte Felsen, Kristalle, Pflanzen
  for (let i = 0; i < 900; i++) {
    const x = X0 + rng() * (X1 - X0), y = Y0 + rng() * (Y1 - Y0);
    if (x > 60 && x < WORLD_W - 60 && y > 60 && y < WORLD_H - 60) continue;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x + 1.5, y + 1.5, 4, 3, 0, 0, 7); g.fill();
    g.fillStyle = mix(B.rock, '#ffffff', 0.12); g.beginPath(); g.ellipse(x, y, 3 + rng() * 3, 2.4, rng() * 3, 0, 7); g.fill();
  }
  const objs = [];
  for (let i = 0; i < 70; i++) {
    const x = X0 + 30 + rng() * (X1 - X0 - 60), y = Y0 + 30 + rng() * (Y1 - Y0 - 60);
    if (x > -60 && x < WORLD_W + 60 && y > -60 && y < WORLD_H + 60) continue;
    const k = rng();
    objs.push({ x, y, r: 16 + rng() * 26, kind: k < 0.45 ? 'tree' : k < 0.75 ? 'rock' : 'crystal', rot: rng() * 6.28 });
  }
  objs.sort((a, b) => a.y - b.y);
  if (uprightSprite) {
    for (const o of objs) {
      const sp = uprightSprite(o);
      g.save(); g.setTransform(res, 0, 0, res, (o.x + M) * res, (o.y + M) * TILT * res);
      g.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h);
      g.restore();
    }
  }
  // nach außen dunkler werden
  const fade = (x0, y0, x1, y1, gx0, gy0, gx1, gy1) => {
    const gr = g.createLinearGradient(gx0, gy0, gx1, gy1);
    gr.addColorStop(0, 'rgba(3,5,10,0)'); gr.addColorStop(0.2, 'rgba(3,5,10,0.08)'); gr.addColorStop(0.6, 'rgba(3,5,10,0.45)'); gr.addColorStop(1, 'rgba(3,5,10,0.92)');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  fade(X0, Y0, 0, Y1, 0, 0, X0, 0);
  fade(WORLD_W, Y0, X1, Y1, WORLD_W, 0, X1, 0);
  fade(X0, Y0, X1, 0, 0, 0, 0, Y0);
  fade(X0, WORLD_H, X1, Y1, 0, WORLD_H, 0, Y1);
}
