// Zeichnen: Sternenhimmel, Karte, Einheiten, Effekte
import { TILE, COLS, ROWS, WORLD_W, WORLD_H, TOWERS, ENEMIES, BASE, TILT, TOWER_LOOK, SCENERY, VIEW_COLS, VIEW_ROWS } from './data.js';
import { glow, smoke, enemySprite, towerHeadSprite, towerBodySprite, towerDims, headScale, obstacleSprite, mk, clearSpriteCache, PAL, ci, roundRect, tierColor } from './sprites.js';
import { P_GLOW, P_SPARK, P_SMOKE, P_DEBRIS, P_HEAT } from './particles.js';
import { drawTerrain, drawScenery } from './terrain.js';
import { rgba, mix, mulberry32, hashString, clamp } from './util.js';

const ROTATING = { laser: 1, plasma: 1, rail: 1, rocket: 1 };
// Stimmung je Landschaft: Dunkelheit, Umgebungsfarbe, Farbschleier, Nebel
const MOOD = {
  wueste:    { dark: 0.3,  ambient: '#2a0c04', tint: '#ff8a40', tintA: 0.05, fog: 0.07 },
  eis:       { dark: 0.0,  ambient: '#000000', tint: '#bfe6ff', tintA: 0.05, fog: 0.12 },
  kristall:  { dark: 0.55, ambient: '#0c0626', tint: '#6a4aff', tintA: 0.05, fog: 0.08 },
  dschungel: { dark: 0.42, ambient: '#03140a', tint: '#4aff7a', tintA: 0.04, fog: 0.12 },
  asche:     { dark: 0.45, ambient: '#1c0704', tint: '#ff6a3a', tintA: 0.04, fog: 0.08 },
  sumpf:     { dark: 0.35, ambient: '#021412', tint: '#3affd0', tintA: 0.04, fog: 0.22 },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.time = 0;
    this.dpr = 1; this.scale = 1; this.ox = 0; this.oy = 0; this.res = 1;
    this.mapLayer = null; this.mapKey = null; this.mapRef = null;
    this.flash = 0; this.flashColor = 'rgba(255,40,60,0.4)';
    this.parX = 0; this.parY = 0;
    this.quality = 'hoch';
    this.sandLines = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), l: 20 + Math.random() * 60, s: 0.4 + Math.random() * 0.8 }));
    this.storm = [];
    this.zoom = 1; this.cx = WORLD_W / 2; this.cy = WORLD_H / 2;
    this.weather = [];
  }

  resize(rect) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.vw = w; this.vh = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.playRect = rect || { x: 0, y: 0, w, h };
    const r = this.playRect;
    // Spiel: Karte füllt den ganzen Bildschirm (Rest per Ziehen erreichbar); Editor: ganze Karte sichtbar
    this.HEAD = this.fit === 'contain' ? 30 : 0;
    // Spiel: Standard-Ansicht zeigt etwa 20 × 14 Felder und füllt den Bildschirm; weiter herauszoomen bis zur ganzen Karte samt Kulisse
    const VW = VIEW_COLS * TILE, VH = VIEW_ROWS * TILE;
    this.scale0 = this.fit === 'contain'
      ? Math.min(r.w / WORLD_W, r.h / (WORLD_H * TILT + this.HEAD))
      : Math.max(r.w / VW, r.h / (VH * TILT));
    this.zoomMin = this.fit === 'contain' ? 1 : Math.max(r.w / (WORLD_W + 2 * SCENERY), r.h / ((WORLD_H + 2 * SCENERY) * TILT)) / this.scale0;
    this.applyView();
    const cap = this.quality === 'niedrig' ? 1.5 : this.quality === 'mittel' ? 2 : 3;
    const res = Math.min(cap, Math.max(1, Math.ceil(this.scale0 * dpr * 2) / 2));
    this.sceneryLayer = null;
    if (res !== this.res) { this.res = res; clearSpriteCache(); }
    this.buildStars();
    this.mapKey = null;
    this.prewarmed = false;
  }

  // Alle Sprites einmal vorab erzeugen, damit es im Spiel nicht ruckelt
  prewarm() {
    this.prewarmed = true;
    for (const type of Object.keys(ENEMIES)) for (const f of [0, 1]) { enemySprite(type, false, this.res, f); if (!ENEMIES[type].boss) enemySprite(type, true, this.res, f); }
    for (const type of Object.keys(TOWERS)) for (const tier of Object.keys(TOWERS[type].tiers)) { towerBodySprite(type, tier, this.res); towerHeadSprite(type, tier, this.res); }
    for (let i = 0; i < PAL.length; i++) glow(i);
    smoke();
  }

  // Ansicht: Zoom und Mittelpunkt (Welt) -> Maßstab und Versatz (CSS-Pixel)
  applyView() {
    const r = this.playRect; if (!r || !this.scale0) return;
    this.zoom = clamp(this.zoom, this.zoomMin || 1, 2.6);
    this.scale = this.scale0 * this.zoom;
    const vw = r.w / this.scale, vh = (r.h - this.HEAD * this.scale0) / (this.scale * TILT);
    if (this.fit === 'contain') { this.cx = WORLD_W / 2; this.cy = WORLD_H / 2; }
    else {
      // Bildmitte darf bis an die Baukante, der Bildschirm bleibt dabei mit Kulisse gefüllt
      const M = SCENERY;
      const lx = Math.max(0, vw / 2 - M), hx = Math.min(WORLD_W, WORLD_W + M - vw / 2);
      const ly = Math.max(0, vh / 2 - M), hy = Math.min(WORLD_H, WORLD_H + M - vh / 2);
      this.cx = lx > hx ? WORLD_W / 2 : clamp(this.cx, lx, hx);
      this.cy = ly > hy ? WORLD_H / 2 : clamp(this.cy, ly, hy);
    }
    this.ox = r.x + r.w / 2 - this.cx * this.scale;
    this.oy = r.y + this.HEAD * this.scale0 + (r.h - this.HEAD * this.scale0) / 2 - this.cy * TILT * this.scale;
  }
  zoomAt(sx, sy, factor) {
    const w = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.zoomMin || 1, 2.6);
    this.scale = this.scale0 * this.zoom;
    // Punkt unter dem Zeiger festhalten
    const r = this.playRect;
    this.cx = w.x - (sx - (r.x + r.w / 2)) / this.scale;
    this.cy = w.y - (sy - (r.y + this.HEAD * this.scale0 + (r.h - this.HEAD * this.scale0) / 2)) / (this.scale * TILT);
    this.applyView();
  }
  canPan() { return this.fit !== 'contain'; }
  panBy(dx, dy) { this.cx -= dx / this.scale; this.cy -= dy / (this.scale * TILT); this.applyView(); }
  resetView(cx = WORLD_W / 2, cy = WORLD_H / 2) { this.zoom = 1; this.cx = cx; this.cy = cy; this.applyView(); }
  screenToWorld(x, y) { return { x: (x - this.ox) / this.scale, y: (y - this.oy) / (this.scale * TILT) }; }
  worldToScreen(x, y, z = 0) { return { x: this.ox + x * this.scale, y: this.oy + y * TILT * this.scale - z * this.scale }; }

  // ---------------------------------------------------------------- Hintergrund
  buildStars() {
    const W = this.canvas.width, H = this.canvas.height, d = this.dpr;
    const rng = mulberry32(1234);
    // bewegte Sterne (Ebene 1 und 2) als Liste, Ebene 0 wird fest in den Nebel gebacken
    this.starList = [];
    const area = (W * H) / (1600 * 900 * d * d);
    for (let layer = 1; layer <= 2; layer++) {
      const n = Math.round([0, 120, 45][layer] * area);
      for (let i = 0; i < n; i++) {
        const hue = rng();
        this.starList.push({
          x: rng(), y: rng(), layer, a: [0, 0.6, 0.9][layer] * (0.5 + rng() * 0.5),
          s: ([0, 0.9, 1.5][layer] + rng() * [0, 0.8, 1.2][layer]) * d, tw: rng() * 6.28,
          c: ci(hue < 0.15 ? '#ffd6a0' : hue < 0.3 ? '#a0c8ff' : '#ffffff'),
        });
      }
    }
    // Nebel + Gasriese
    const nb = mk(W + 40 * d, H + 40 * d), g = nb.getContext('2d');
    g.translate(20 * d, 20 * d);
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#05060d'); bg.addColorStop(0.5, '#070a16'); bg.addColorStop(1, '#0b0614');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const blobs = [['#3a1d6e', 0.15, 0.2, 0.5], ['#0f4a5e', 0.85, 0.75, 0.55], ['#5e1d3a', 0.7, 0.15, 0.35], ['#1d3a6e', 0.25, 0.85, 0.4]];
    for (const [col, bx, by, br] of blobs) {
      const R = Math.max(W, H) * br;
      const gr = g.createRadialGradient(bx * W, by * H, 0, bx * W, by * H, R);
      gr.addColorStop(0, rgba(col, 0.45)); gr.addColorStop(0.5, rgba(col, 0.15)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    // Planet
    const pr = Math.min(W, H) * 0.42, px = W * 0.93, py = H * 0.1;
    const pg = g.createRadialGradient(px - pr * 0.4, py + pr * 0.35, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#6a4a8c'); pg.addColorStop(0.6, '#2c1c48'); pg.addColorStop(1, '#0c0818');
    g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(px, py, pr, 0, 7); g.clip();
    for (let i = 0; i < 9; i++) { g.fillStyle = rgba(i % 2 ? '#8a6ab0' : '#3a2a60', 0.18); g.fillRect(px - pr, py - pr + i * pr * 0.24 + pr * 0.1, pr * 2, pr * 0.1); }
    g.restore();
    g.strokeStyle = 'rgba(180,150,255,0.25)'; g.lineWidth = pr * 0.05;
    g.beginPath(); g.ellipse(px, py, pr * 1.6, pr * 0.28, -0.35, 0, 7); g.stroke();
    const atm = g.createRadialGradient(px, py, pr * 0.95, px, py, pr * 1.15);
    atm.addColorStop(0, 'rgba(160,120,255,0.35)'); atm.addColorStop(1, 'rgba(160,120,255,0)');
    g.fillStyle = atm; g.beginPath(); g.arc(px, py, pr * 1.15, 0, 7); g.fill();
    for (let i = 0; i < 300 * area; i++) {
      const x = rng() * W, y = rng() * H, r = (0.4 + rng() * 0.6) * d;
      g.globalAlpha = 0.25 + rng() * 0.45; g.fillStyle = rng() < 0.2 ? '#cfe0ff' : '#ffffff';
      g.fillRect(x, y, r * 1.4, r * 1.4);
    }
    g.globalAlpha = 1;
    this.nebula = nb;
    // Vignette
    const vg = mk(W, H), v = vg.getContext('2d');
    const vgr = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vgr.addColorStop(0, 'rgba(0,0,0,0)'); vgr.addColorStop(1, 'rgba(0,0,0,0.65)');
    v.fillStyle = vgr; v.fillRect(0, 0, W, H);
    this.vignette = vg;
    const rv = mk(W, H), rvg = rv.getContext('2d');
    const rgr = rvg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    rgr.addColorStop(0, 'rgba(255,0,30,0)'); rgr.addColorStop(1, 'rgba(255,20,50,0.55)');
    rvg.fillStyle = rgr; rvg.fillRect(0, 0, W, H);
    this.redVig = rv;
  }

  drawBackground(dt, mx = 0, my = 0) {
    const g = this.ctx, W = this.canvas.width, H = this.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    this.parX += (mx - this.parX) * Math.min(1, dt * 3);
    this.parY += (my - this.parY) * Math.min(1, dt * 3);
    const px = this.parX * 30 * this.dpr, py = this.parY * 20 * this.dpr;
    g.drawImage(this.nebula, Math.round(-px * 0.3 - 20 * this.dpr), Math.round(-py * 0.3 - 20 * this.dpr));
    const speeds = [0, 8, 20];
    const t = this.time;
    g.globalCompositeOperation = 'lighter';
    for (const st of this.starList) {
      const k = st.layer;
      let x = st.x * W - t * speeds[k] * this.dpr - px * k * 0.6;
      let y = st.y * H - py * k * 0.5;
      x = ((x % W) + W) % W; y = ((y % H) + H) % H;
      const a = st.a * (k === 2 ? 0.75 + Math.sin(t * 2 + st.tw) * 0.25 : 1);
      g.globalAlpha = a;
      if (k === 2) { const sz = st.s * 6; g.drawImage(glow(st.c), x - sz / 2, y - sz / 2, sz, sz); }
      else { g.fillStyle = PAL[st.c]; g.fillRect(x, y, st.s, st.s); }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  renderMenu(dt, mx, my) {
    this.time += dt;
    this.drawBackground(dt, mx, my);
    const g = this.ctx;
    g.drawImage(this.vignette, 0, 0);
  }

  // ---------------------------------------------------------------- Karten-Ebene
  buildMapLayer(map, exact = false, upright = true) {
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const res = exact ? Math.min(coarse ? 1.6 : 2.4, this.scale * this.dpr) : Math.min(this.res, 1.5);
    const c = mk(WORLD_W * res, WORLD_H * TILT * res), g = c.getContext('2d');
    g.scale(res, res * TILT);
    drawTerrain(g, map, { upright, feather: exact });
    c.res = res;
    return c;
  }
  buildScenery(map) {
    const M = SCENERY, res = Math.min(1, this.scale0 * this.dpr * 0.7);
    const c = mk((WORLD_W + 2 * M) * res, (WORLD_H + 2 * M) * TILT * res), g = c.getContext('2d');
    g.setTransform(res, 0, 0, res * TILT, M * res, M * TILT * res);
    drawScenery(g, map, M, res, (o) => obstacleSprite(o, map.biome, res));
    c.res = res;
    return c;
  }
  ensureMap(map) {
    const sk = map.def && map.def.kachel ? 'kachel|' + map.def.biome : map;
    if (!this.sceneryLayer || this.sceneryRef !== sk) { this.sceneryLayer = this.buildScenery(map); this.sceneryRef = sk; }
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const want = Math.min(coarse ? 1.6 : 2.4, this.scale * this.dpr);
    const key = map.id + '|' + want.toFixed(3);
    if (this.mapKey === key && this.mapRef === map) return;
    // beim Zoomen erst nach kurzer Ruhe neu zeichnen
    if (this.mapRef === map && this.mapLayer && performance.now() - (this.lastZoomAt || 0) < 250) return;
    this.mapLayer = this.buildMapLayer(map, true);
    this.mapKey = key; this.mapRef = map;
  }

  // Bodenebene: x normal, y gestaucht
  worldTransform(shx = 0, shy = 0) {
    const s = this.scale * this.dpr;
    this.wt = { s, sy: s * TILT, tx: (this.ox + shx) * this.dpr, ty: (this.oy + shy) * this.dpr };
    this.ctx.setTransform(s, 0, 0, s * TILT, this.wt.tx, this.wt.ty);
  }
  resetWT() { const w = this.wt; this.ctx.setTransform(w.s, 0, 0, w.sy, w.tx, w.ty); }
  // aufrechte Ebene: Koordinaten (x, y*TILT - z) in Weltpixeln, nicht gestaucht
  uprightT() { const w = this.wt; this.ctx.setTransform(w.s, 0, 0, w.s, w.tx, w.ty); }
  // flaches Sprite in der Bodenebene drehen (z = Höhe über Boden)
  sprR(sp, x, y, ang, scale = 1, z = 0) {
    const w = this.wt, c = Math.cos(ang) * scale, sn = Math.sin(ang) * scale;
    this.ctx.setTransform(c * w.s, sn * w.sy, -sn * w.s, c * w.sy, w.tx + x * w.s, w.ty + y * w.sy - z * w.s);
    this.ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  }
  // aufrechtes Sprite mit Fußpunkt
  sprUp(sp, x, y, z = 0, alpha = 1) {
    const w = this.wt;
    this.ctx.globalAlpha = alpha;
    this.ctx.setTransform(w.s, 0, 0, w.s, w.tx + x * w.s, w.ty + y * w.sy - z * w.s);
    this.ctx.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h);
  }

  spr(sp, x, y, ang = 0, scale = 1, alpha = 1) {
    const g = this.ctx;
    g.globalAlpha = alpha;
    if (ang) {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.drawImage(sp.c, -sp.w / 2 * scale, -sp.h / 2 * scale, sp.w * scale, sp.h * scale);
      g.restore();
    } else g.drawImage(sp.c, x - sp.w / 2 * scale, y - sp.h / 2 * scale, sp.w * scale, sp.h * scale);
  }
  glowAt(idx, x, y, size, alpha = 1) {
    const g = this.ctx;
    g.globalAlpha = alpha;
    g.drawImage(glow(idx), x - size / 2, y - size / 2, size, size);
  }

  // ---------------------------------------------------------------- Spielszene
  render(dt, game, ui) {
    this.time += dt;
    const g = this.ctx;
    const shakeOn = ui.settings.shake;
    game.shake *= Math.exp(-dt * 7);
    const sh = shakeOn ? game.shake : 0;
    const shx = (Math.random() - 0.5) * sh, shy = (Math.random() - 0.5) * sh;
    this.drawBackground(dt, shx * 0.05 + ui.mouseNX * 0.3, shy * 0.05 + ui.mouseNY * 0.3);
    if (!this.prewarmed) this.prewarm();
    this.ensureMap(game.map);
    this.worldTransform(shx, shy);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (game.decals.length) this.bakeDecals(game);
    const want = this.scale * this.dpr, S = this.sceneryLayer;
    g.drawImage(S, this.wt.tx - SCENERY * want, this.wt.ty - SCENERY * TILT * want, (WORLD_W + 2 * SCENERY) * want, (WORLD_H + 2 * SCENERY) * TILT * want);
    const L = this.mapLayer;
    if (Math.abs(L.res - want) < 0.01) g.drawImage(L, Math.round(this.wt.tx), Math.round(this.wt.ty));
    else g.drawImage(L, this.wt.tx, this.wt.ty, WORLD_W * want, WORLD_H * TILT * want);
    this.resetWT();
    const low = ui.settings.quality === 'niedrig';
    if (ui.buildType || ui.pendingPos) this.drawBuildGrid(game);
    const t = this.time;
    const th = game.map.theme;

    // Leitlinie auf der Straße + Schimmern der Flüsse
    g.globalCompositeOperation = 'lighter';
    g.setLineDash([6, 30]); g.lineDashOffset = -t * 45;
    g.strokeStyle = rgba(th.lane, 0.16); g.lineWidth = 2.5; g.lineCap = 'round';
    for (const p of game.map.smooth) { g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke(); }
    const B = game.map.biome;
    g.setLineDash([18, 40]); g.lineDashOffset = -t * 22;
    for (const w of game.map.water) {
      g.strokeStyle = rgba(B.water2, B.waterGlow ? 0.22 + Math.sin(t * 2) * 0.06 : 0.18); g.lineWidth = w.w * 0.25;
      g.beginPath(); w.pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke();
    }
    g.setLineDash([]);
    this.drawWavePreview(game);
    if (ui.kPreview && game.kachel) this.drawKachelPreview(game, ui.kPreview);
    // Portale
    const seen = new Set();
    for (const p of game.map.paths) {
      const a = p.pts[0], b = p.pts[1];
      const px = clamp(a.x, 14, WORLD_W - 14), py = clamp(a.y, 14, WORLD_H - 14);
      const key = (px | 0) + ',' + (py | 0);
      if (seen.has(key)) continue; seen.add(key);
      this.glowAt(ci('#ff3d6e'), px, py, 90 + Math.sin(t * 3) * 10, 0.5);
      g.strokeStyle = 'rgba(255,61,110,0.7)'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(px, py, 14 + i * 7, t * (2 + i) + i, t * (2 + i) + i + 3.5); g.stroke(); }
    }
    g.globalCompositeOperation = 'source-over';

    // Auswahl / Vorschau
    this.drawSelection(game, ui);

    if (ui.showRanges) this.drawAllRanges(game);
    // Schatten der Flieger + Drohnen auf dem Boden
    g.globalAlpha = 0.3; g.fillStyle = '#000';
    for (const e of game.enemies) if (e.air && e.active) { g.beginPath(); g.ellipse(e.x + 6, e.y + 4, e.r * 0.9, e.r * 0.6, 0, 0, 7); g.fill(); }
    for (const tw of game.towers) for (const d of tw.drones) { g.beginPath(); g.ellipse(d.x + 4, d.y + 3, 6, 4, 0, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    this.drawEnemies(game, false);
    if (game.hero) this.drawHero(game, ui);
    // Rauch (normale Mischung)
    this.drawParticles(game.particles, true, low);
    // aufrechte Objekte von hinten nach vorn
    this.drawUprights(game, ui);
    this.drawEnemies(game, true);

    // Additive Effekte
    g.globalCompositeOperation = 'lighter';
    this.drawBeams(game);
    this.drawProjectiles(game);
    this.drawFx(game);
    this.drawParticles(game.particles, false, low);
    g.globalCompositeOperation = 'source-over';
    this.drawShells(game);
    this.drawStrikes(game);
    this.drawLighting(game, dt);
    this.drawTexts(game);
    this.drawHealthBars(game);
    this.drawEventOverlay(game, dt);
    this.drawCursor(game, ui);
    if (this.quality !== 'niedrig') this.drawWeather(game, dt);

    // Bildschirm-Ebene
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(this.vignette, 0, 0);
    if (game.warpT > 0) { g.globalAlpha = Math.min(1, game.warpT) * 0.55; g.fillStyle = 'rgba(80,60,200,0.25)'; g.fillRect(0, 0, this.canvas.width, this.canvas.height); g.globalAlpha = 1; }
    const b = game.base;
    if (b.hp < b.maxHp * 0.3 && game.state === 'playing') { g.globalAlpha = 0.35 + Math.sin(t * 6) * 0.25; g.drawImage(this.redVig, 0, 0); g.globalAlpha = 1; }
    if (this.flash > 0) {
      g.globalAlpha = Math.min(1, this.flash * 2.5);
      if (this.flashColor === 'red') g.drawImage(this.redVig, 0, 0);
      else { g.fillStyle = this.flashColor; g.fillRect(0, 0, this.canvas.width, this.canvas.height); }
      g.globalAlpha = 1;
      this.flash -= dt;
    }
  }

  // Weg-Vorschau: Pfeile auf den Wegen der nächsten Welle
  drawWavePreview(game) {
    const wd = game.nextWaveDef;
    if (!wd || game.state !== 'playing') return;
    const waiting = game.wave === 0 || game.countdownPaused || game.countdown !== null;
    if (!waiting) return;
    if (!wd._used) {
      const ground = new Set(), air = new Set();
      for (const sp of wd.spawns) (ENEMIES[sp.type].air ? air : ground).add(sp.path % game.map.paths.length);
      wd._used = { ground: [...ground], air: [...air] };
    }
    const g = this.ctx, t = this.time;
    const pulse = 0.55 + 0.45 * Math.sin(t * 4);
    const along = (path, d, out) => {
      const cum = path.cum; let lo = 0, hi = path.segs.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= d) lo = m; else hi = m - 1; }
      const sg = path.segs[lo], k = Math.min(d - cum[lo], sg.len);
      out.x = path.pts[lo].x + sg.dx * k; out.y = path.pts[lo].y + sg.dy * k; out.a = sg.ang; return out;
    };
    const q = { x: 0, y: 0, a: 0 };
    const draw = (path, col, z) => {
      g.strokeStyle = rgba(col, 0.75 * pulse); g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
      const off = (t * 70) % 90;
      for (let d = off; d < path.total - 60; d += 90) {
        along(path, d, q);
        const c = Math.cos(q.a), s2 = Math.sin(q.a), y = q.y - z / TILT;
        g.beginPath(); g.moveTo(q.x - c * 8 - s2 * 9, y - s2 * 8 + c * 9); g.lineTo(q.x + c * 6, y + s2 * 6); g.lineTo(q.x - c * 8 + s2 * 9, y - s2 * 8 - c * 9); g.stroke();
      }
    };
    g.globalCompositeOperation = 'lighter';
    for (const i of wd._used.ground) draw(game.map.paths[i], wd.isBoss ? '#ff3d6e' : '#ffd23e', 0);
    for (const i of wd._used.air) draw(game.map.flyPaths[i % game.map.flyPaths.length], '#7cc8ff', 20);
    g.globalCompositeOperation = 'source-over';
  }

  // Frontbau: Vorschau des neuen Wegstücks
  drawKachelPreview(game, pv) {
    const g = this.ctx, t = this.time;
    const cen = ([cx, cy]) => ({ x: (cx * 2 + 1) * TILE, y: (cy * 2 + 1) * TILE });
    const cells = game.kstate.cells;
    const pts = [cen(cells[cells.length - 1]), ...pv.cells.map(cen)];
    const D = [[1, 0], [0, 1], [-1, 0], [0, -1]][pv.dir];
    const last = pv.cells[pv.cells.length - 1];
    pts.push(cen([last[0] + D[0], last[1] + D[1]]));
    this.resetWT();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,210,62,0.18)'; g.lineWidth = 58;
    g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke();
    g.setLineDash([14, 12]); g.lineDashOffset = -t * 40;
    g.strokeStyle = 'rgba(255,210,62,0.85)'; g.lineWidth = 3;
    g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke();
    g.setLineDash([]);
    const e = pts[pts.length - 1];
    g.fillStyle = 'rgba(255,61,110,0.8)'; g.beginPath(); g.arc(e.x, e.y, 12 + Math.sin(t * 5) * 2, 0, 7); g.fill();
    this.resetWT();
  }

  setQuality(q) { this.quality = q; this.mapKey = null; this.light = null; this.res = 0; clearSpriteCache(); this.prewarmed = false; if (this.playRect) this.resize(this.playRect); }

  // Brandflecken direkt in die Bodenebene einbrennen
  bakeDecals(game) {
    const c = this.mapLayer, g = c.getContext('2d'), res = c.res;
    g.save(); g.setTransform(res, 0, 0, res * TILT, 0, 0);
    for (const d of game.decals) {
      const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
      gr.addColorStop(0, 'rgba(8,6,6,0.42)'); gr.addColorStop(0.6, 'rgba(12,10,10,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill();
    }
    g.restore();
    game.decals.length = 0;
  }

  // Beim Bauen: freie Flächen dezent markieren
  drawBuildGrid(game) {
    const map = game.map;
    if (!this.gridLayer || this.gridRef !== map) {
      const c = mk(WORLD_W, WORLD_H), g = c.getContext('2d');
      const grid = map.grid, CW = WORLD_W / Math.ceil(WORLD_W / 8);
      g.fillStyle = 'rgba(93,255,176,0.07)';
      const GWc = Math.ceil(WORLD_W / 8);
      for (let i = 0; i < grid.length; i++) if (!grid[i]) g.fillRect((i % GWc) * 8, Math.floor(i / GWc) * 8, 8, 8);
      g.fillStyle = 'rgba(93,255,176,0.35)';
      for (let y = 16; y < WORLD_H; y += 32) for (let x = 16; x < WORLD_W; x += 32) {
        const i = Math.floor(y / 8) * GWc + Math.floor(x / 8);
        if (!grid[i]) g.fillRect(x - 1, y - 1, 2, 2);
      }
      this.gridLayer = c; this.gridRef = map;
    }
    const g = this.ctx;
    g.globalAlpha = 0.75 + Math.sin(this.time * 3) * 0.2;
    g.drawImage(this.gridLayer, 0, 0, WORLD_W, WORLD_H);
    g.globalAlpha = 1;
  }

  // Licht und Atmosphäre: Tag/Dämmerung/Nacht, Lichtquellen, Bodennebel
  drawLighting(game, dt) {
    const q = this.quality || 'hoch';
    const B = game.map.biome, mood = MOOD[game.map.def.biome] || MOOD.kristall;
    const g = this.ctx, t = this.time;
    // Nebel
    if (q === 'hoch') {
      if (!this.fogSprite) {
        const c = mk(256, 128), fg = c.getContext('2d');
        for (let i = 0; i < 9; i++) {
          const x = 40 + Math.random() * 176, y = 30 + Math.random() * 68, r = 30 + Math.random() * 40;
          const gr = fg.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          fg.fillStyle = gr; fg.fillRect(0, 0, 256, 128);
        }
        this.fogSprite = c;
      }
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 4; i++) {
        const w = 460 + i * 40, x = ((t * (6 + i * 2) + i * 260) % (WORLD_W + w)) - w, y = (i * 113) % WORLD_H - 40;
        g.globalAlpha = mood.fog * (0.6 + 0.4 * Math.sin(t * 0.3 + i));
        g.drawImage(this.fogSprite, x, y, w, w * 0.5);
      }
      g.globalAlpha = 1;
    }
    if (q === 'niedrig') return;
    // Dunkelheit mit ausgeschnittenen Lichtern
    const LS = q === 'hoch' ? 0.25 : 0.15;
    if (!this.light || this.light.width !== Math.round(WORLD_W * LS)) {
      this.light = mk(WORLD_W * LS, WORLD_H * LS);
    }
    const L = this.light.getContext('2d');
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over'; L.globalAlpha = 1;
    L.clearRect(0, 0, this.light.width, this.light.height);
    if (mood.dark > 0) {
      L.fillStyle = mood.ambient; L.globalAlpha = mood.dark; L.fillRect(0, 0, this.light.width, this.light.height);
      L.globalCompositeOperation = 'destination-out';
      L.setTransform(LS, 0, 0, LS, 0, 0);
      const white = glow(0);
      const cut = (x, y, r, a) => { L.globalAlpha = Math.min(1, a); L.drawImage(white, x - r, y - r, r * 2, r * 2); };
      const b = game.base;
      cut(b.x, b.y, 230 + Math.sin(t * 2.5) * 15, 1);
      for (const tw of game.towers) cut(tw.x, tw.y, 70, 0.55);
      for (const w of game.map.water) if (B.waterGlow) for (let i = 0; i < w.pts.length; i += 6) cut(w.pts[i].x, w.pts[i].y, w.w * 1.6 + 40, 0.5);
      for (const l of game.lights) cut(l.x, l.y, l.r * 1.4, (l.life / l.max) * 1.2);
      for (const e of game.enemies) if (e.active && (e.boss || e.type === 'flyer')) cut(e.x, e.y, e.boss ? 150 : 50, 0.5);
      if (game.hero && game.hero.dead <= 0) cut(game.hero.x, game.hero.y, 90, 0.7);
      for (const p of game.projectiles) if (p.kind === 'missile' || p.kind === 'shell') cut(p.x, p.y, 40, 0.6);
      for (const tw of game.towers) for (const bm of tw.beams) cut(bm.e.x, bm.e.y, 50, 0.7);
      g.drawImage(this.light, 0, 0, WORLD_W, WORLD_H);
      // Dunkelheit reicht über den Kartenrand hinaus (keine Kante)
      const M = SCENERY;
      g.globalAlpha = mood.dark; g.fillStyle = mood.ambient;
      g.fillRect(-M, -M, WORLD_W + 2 * M, M); g.fillRect(-M, WORLD_H, WORLD_W + 2 * M, M);
      g.fillRect(-M, 0, M, WORLD_H); g.fillRect(WORLD_W, 0, M, WORLD_H);
      g.globalAlpha = 1;
    }
    // farbige Lichtblitze (auch am Tag)
    g.globalCompositeOperation = 'lighter';
    for (const l of game.lights) {
      if (l.r < 60) continue;
      const f = l.life / l.max;
      this.glowAt(l.color, l.x, l.y, l.r * 2, f * (mood.dark > 0 ? 0.35 : 0.22));
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    // Farbstimmung
    if (mood.tintA > 0 && mood.dark === 0 && q === 'hoch') { g.globalAlpha = mood.tintA; g.fillStyle = mood.tint; g.fillRect(-SCENERY, -SCENERY, WORLD_W + 2 * SCENERY, WORLD_H + 2 * SCENERY); g.globalAlpha = 1; }
  }

  drawSelection(game, ui) {
    const g = this.ctx;
    const sel = ui.selected;
    if (sel && sel.kind === 'tower') {
      const tw = sel.tower;
      const r = game.towerRange(tw);
      const col = TOWERS[tw.type].color;
      g.fillStyle = rgba(col, 0.07); g.strokeStyle = rgba(col, 0.55); g.lineWidth = 2;
      g.setLineDash([10, 8]); g.lineDashOffset = -this.time * 20;
      g.beginPath(); g.arc(tw.x, tw.y, r, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
      if (tw.spec.auraRange && (tw.spec.rangeBuff || tw.spec.dmgBuff)) { g.strokeStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(tw.x, tw.y, tw.spec.auraRange * TILE, 0, 7); g.stroke(); }
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(tw.x, tw.y, 30, 0, 7); g.stroke();
    }
    if (sel && sel.kind === 'base') {
      const b = game.base, r = game.baseCannon().range * TILE;
      g.fillStyle = 'rgba(54,241,255,0.06)'; g.strokeStyle = 'rgba(54,241,255,0.5)'; g.lineWidth = 2;
      g.setLineDash([10, 8]); g.beginPath(); g.arc(b.x, b.y, r, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
    }
    // Bauvorschau (frei platzierbar)
    const h = ui.ghost;
    if (h && game.state === 'playing' && (ui.buildType || ui.pendingPos)) {
      const ok = game.canBuild(h.x, h.y);
      const col = ok ? '#5dffb0' : '#ff3d5a';
      g.fillStyle = rgba(col, 0.14); g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.arc(h.x, h.y, 26, 0, 7); g.fill(); g.stroke();
      const buildType = ui.buildType;
      if (buildType && ok) {
        const spec = TOWERS[buildType].tiers[1];
        const rr = (spec.range || 1.5) * TILE;
        g.fillStyle = rgba(TOWERS[buildType].color, 0.06); g.strokeStyle = rgba(TOWERS[buildType].color, 0.5);
        g.setLineDash([8, 8]); g.beginPath(); g.arc(h.x, h.y, rr, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
        const body = towerBodySprite(buildType, '1', this.res);
        this.sprUp(body, h.x, h.y, 0, 0.65);
        g.globalAlpha = 0.65;
        this.sprR(towerHeadSprite(buildType, '1', this.res), h.x, h.y, -Math.PI / 2, 1, body.top);
        this.resetWT();
        g.globalAlpha = 1;
        if (ui.coverage !== undefined) {
          this.uprightT();
          g.font = '600 12px system-ui, sans-serif'; g.textAlign = 'center';
          const txt = ui.coverage > 0 ? `deckt ${ui.coverage.toFixed(1)} Felder Weg ab` : 'erreicht keinen Weg';
          g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(txt, h.x, h.y * TILT + 34);
          g.fillStyle = ui.coverage > 0 ? '#a7f3d0' : '#fca5a5'; g.fillText(txt, h.x, h.y * TILT + 34);
          this.resetWT();
        }
      } else if (!ok) {
        g.beginPath(); g.moveTo(h.x - 8, h.y - 8); g.lineTo(h.x + 8, h.y + 8); g.moveTo(h.x + 8, h.y - 8); g.lineTo(h.x - 8, h.y + 8); g.stroke();
      }
    }
  }

  // Reaktorkomplex (aufrecht, animiert)
  drawReactor(game) {
    const g = this.ctx, b = game.base, t = this.time;
    const hpF = b.hp / b.maxHp;
    const col = hpF > 0.5 ? '#36f1ff' : hpF > 0.25 ? '#ffcf3a' : '#ff3d5a';
    this.uprightT();
    g.save(); g.translate(b.x, b.y * TILT);
    const R = 19, H = 50, ry = R * TILT;
    // Schatten
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(14, -2, R + 14, ry + 6, 0, 0, 7); g.fill();
    // Sockelring
    const sg = g.createLinearGradient(-R - 10, 0, R + 10, 0); sg.addColorStop(0, '#5a6476'); sg.addColorStop(1, '#1c2129');
    g.fillStyle = sg; g.beginPath(); g.moveTo(-R - 10, -8); g.lineTo(-R - 10, 0); g.ellipse(0, 0, R + 10, (R + 10) * TILT, 0, Math.PI, 0, true); g.lineTo(R + 10, -8); g.closePath(); g.fill();
    g.fillStyle = '#3a4352'; g.beginPath(); g.ellipse(0, -8, R + 10, (R + 10) * TILT, 0, 0, 7); g.fill();
    // Kernzylinder
    const cg = g.createLinearGradient(-R, 0, R, 0); cg.addColorStop(0, '#7d889c'); cg.addColorStop(0.45, '#3a4250'); cg.addColorStop(1, '#151920');
    g.fillStyle = cg; g.beginPath(); g.moveTo(-R, -H); g.lineTo(-R, -8); g.ellipse(0, -8, R, ry, 0, Math.PI, 0, true); g.lineTo(R, -H); g.closePath(); g.fill();
    // Leuchtbänder (wandern nach oben)
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.6 + i / 3) % 1), y = -10 - k * (H - 14);
      g.strokeStyle = rgba(col, 0.25 + 0.6 * Math.sin(k * Math.PI)); g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, y, R, ry, 0, 0, Math.PI); g.stroke();
    }
    // Sichtfenster
    g.fillStyle = rgba(col, 0.9); for (let i = -1; i <= 1; i++) g.fillRect(i * 9 - 2, -H * 0.55 + ry * 0.6, 4, 8);
    // Deckel mit pulsierendem Kern
    g.fillStyle = '#4b5566'; g.beginPath(); g.ellipse(0, -H, R, ry, 0, 0, 7); g.fill();
    g.globalCompositeOperation = 'lighter';
    const pulse = 0.85 + Math.sin(t * 4) * 0.15;
    g.drawImage(glow(ci(col)), -30 * pulse, -H - 30 * pulse, 60 * pulse, 60 * pulse);
    g.drawImage(glow(0), -9, -H - 9, 18, 18);
    // rotierende Ringe
    g.strokeStyle = rgba(col, 0.8); g.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { const a = t * 0.9 + i * 2.094; g.beginPath(); g.ellipse(0, -H * 0.5, R + 9, (R + 9) * TILT, 0, a, a + 1.1); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    g.restore();
    // Kanone obenauf (dreht in der Bodenebene)
    const w = this.wt, c = Math.cos(b.angle), sn = Math.sin(b.angle);
    g.setTransform(c * w.s, sn * w.sy, -sn * w.s, c * w.sy, w.tx + b.x * w.s, w.ty + b.y * w.sy - (H + 6) * w.s);
    const rc = b.recoil * 4, twin = game.baseCannon().twin;
    g.fillStyle = '#2c3442'; g.strokeStyle = col; g.lineWidth = 1.2;
    for (const off of twin ? [-5, 5] : [0]) { g.fillRect(6 - rc, off - 3, 24, 6); g.strokeRect(6 - rc, off - 3, 24, 6); }
    g.fillStyle = '#5a6476'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill();
    this.uprightT();
    // Schildkuppel
    if (b.shieldMax > 0 && b.shield > 0) {
      const f = b.shield / b.shieldMax;
      g.save(); g.translate(b.x, b.y * TILT);
      const dg = g.createRadialGradient(-18, -50, 5, 0, -20, 80);
      dg.addColorStop(0, rgba('#a8d0ff', 0.18 * f + 0.05)); dg.addColorStop(1, rgba('#4f9dff', 0.04));
      g.fillStyle = dg; g.beginPath(); g.ellipse(0, -10, 62, 70, 0, Math.PI, 0); g.ellipse(0, -10, 62, 62 * TILT, 0, 0, Math.PI); g.fill();
      g.strokeStyle = rgba('#7cc0ff', 0.25 + 0.45 * f); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, -10, 62, 70, 0, Math.PI, 0); g.stroke();
      g.beginPath(); g.ellipse(0, -10, 62, 62 * TILT, 0, 0, 7); g.stroke();
      g.restore();
    }
    if (b.heal > 0) { g.globalCompositeOperation = 'lighter'; this.glowAt(ci('#5dffb0'), b.x, b.y * TILT - 25, 130, 0.4); g.globalCompositeOperation = 'source-over'; }
    this.resetWT();
    g.globalAlpha = 1;
  }

  // Alle aufrechten Objekte (Türme, Hindernisse, Reaktor) nach Tiefe sortiert
  drawUprights(game, ui) {
    const g = this.ctx, res = this.res, t = this.time;
    const list = this._up || (this._up = []);
    list.length = 0;
    for (const tw of game.towers) list.push(tw);
    const map = game.map;
    if (!map._big) map._big = [...map.obstacles, ...map.deco.filter(d => d.block), ...(map.mountains || [])];
    // nur sichtbare Felsen und Berge
    const v0 = this.screenToWorld(0, 0), v1 = this.screenToWorld(this.vw, this.vh);
    for (const o of map._big) if (o.x > v0.x - 160 && o.x < v1.x + 160 && o.y > v0.y - 80 && o.y < v1.y + 260) list.push(o);
    list.push(game.base);
    list.sort((a, b) => a.y - b.y);
    const B = map.biome;
    for (const o of list) {
      if (o === game.base) { this.drawReactor(game); continue; }
      if (o.kind) { this.sprUp(obstacleSprite(o, B, res), o.x, o.y); continue; }
      const tw = o, off = tw.offline > 0 || tw.jammed > 0;
      const body = towerBodySprite(tw.type, tw.tier, res);
      this.sprUp(body, tw.x, tw.y, 0, off ? 0.6 : 1);
      g.globalAlpha = off ? 0.6 : 1;
      let ang = 0;
      const rot = ROTATING[tw.type];
      if (rot) ang = tw.angle;
      else if (tw.type === 'radar') ang = tw.spin;
      else if (tw.type === 'tesla' || tw.type === 'emp') ang = t * 0.4;
      const rx = rot ? -Math.cos(tw.angle) * tw.recoil * 3 : 0, ry = rot ? -Math.sin(tw.angle) * tw.recoil * 3 : 0;
      const hs = headScale(tw.type);
      this.sprR(towerHeadSprite(tw.type, tw.tier, res), tw.x + rx, tw.y + ry, ang, hs, body.top);
      g.globalAlpha = 1;
    }
    this.resetWT();
    // Leuchten, Schilde, Drohnen
    g.globalCompositeOperation = 'lighter';
    for (const tw of game.towers) {
      const top = towerDims(tw.type, tw.tier).H, ty = tw.y - top / TILT;
      if (tw.jammed > 0) { this.glowAt(ci('#ff9a3c'), tw.x, ty, 40, 0.5 + Math.sin(t * 20) * 0.3); continue; }
      if (tw.offline > 0) continue;
      const sp = tw.spec;
      if (tw.type === 'tesla') this.glowAt(ci('#c9a7ff'), tw.x, ty - 4, 44 + Math.sin(t * 9 + tw.id) * 8, 0.65);
      else if (tw.type === 'emp') { const k = clamp(1 - Math.max(0, tw.cd) * sp.rate, 0, 1); this.glowAt(ci('#7d7bff'), tw.x, ty, 20 + k * 30, 0.5 * k); }
      else if (tw.type === 'shield') {
        g.strokeStyle = rgba('#4f9dff', 0.16 + Math.sin(t * 2 + tw.id) * 0.06); g.lineWidth = 2;
        g.beginPath(); g.arc(tw.x, tw.y, sp.range * TILE, 0, 7); g.stroke();
        this.glowAt(ci('#4f9dff'), tw.x, ty - 6, 30, 0.6);
      } else if (tw.type === 'radar') {
        const R = game.towerRange(tw);
        g.fillStyle = rgba('#66ffcc', 0.05);
        g.beginPath(); g.moveTo(tw.x, tw.y); g.arc(tw.x, tw.y, R, tw.spin - 0.5, tw.spin); g.closePath(); g.fill();
      }
      if (tw.shield > 1) {
        const f = tw.shield / Math.max(1, tw.buffs.shieldCap);
        g.strokeStyle = rgba('#4f9dff', 0.2 + 0.4 * f); g.lineWidth = 2;
        g.beginPath(); g.ellipse(tw.x, tw.y - top / TILT * 0.5, 26, 26 + top * 0.6, 0, 0, 7); g.stroke();
      }
      // Positionslichter
      const blink = Math.sin(t * 3 + tw.id * 1.7) > 0.2;
      const lx = TOWER_LOOK[tw.type].R * 0.7;
      this.glowAt(ci('#ff3d5a'), tw.x - lx, ty, blink ? 8 : 4, blink ? 0.9 : 0.35);
      this.glowAt(ci('#5dffb0'), tw.x + lx, ty, !blink ? 8 : 4, !blink ? 0.9 : 0.35);
      for (const d of tw.drones) this.glowAt(ci('#5dffb0'), d.x, d.y - 22 / TILT, 18, 0.7);
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#d8fff0';
    for (const tw of game.towers) for (const d of tw.drones) {
      const c = Math.cos(d.ang), s2 = Math.sin(d.ang), y = d.y - 22 / TILT;
      g.beginPath(); g.moveTo(d.x + c * 7, y + s2 * 7); g.lineTo(d.x - c * 5 + s2 * 5, y - s2 * 5 - c * 5); g.lineTo(d.x - c * 2, y - s2 * 2); g.lineTo(d.x - c * 5 - s2 * 5, y - s2 * 5 + c * 5); g.closePath(); g.fill();
    }
    // Stufen, Erfahrung, Ausfall (aufrecht)
    this.uprightT();
    for (const tw of game.towers) {
      const { H } = towerDims(tw.type, tw.tier), sy = tw.y * TILT;
      const lvl = tw.tier === '1' ? 1 : tw.tier === '2' ? 2 : 3;
      g.fillStyle = tierColor(tw.type, tw.tier);
      for (let i = 0; i < lvl; i++) { g.beginPath(); g.arc(tw.x - (lvl - 1) * 4 + i * 8, sy + 22, 2.2, 0, 7); g.fill(); }
      if (tw.vet) { g.fillStyle = '#ffd23e'; g.font = '700 10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('★'.repeat(tw.vet), tw.x, sy - H - 16); }
      if (tw.offline > 0) {
        g.globalAlpha = 0.5 + Math.sin(t * 10) * 0.3;
        g.strokeStyle = '#ff3d5a'; g.lineWidth = 3; const cy = sy - H * 0.6;
        g.beginPath(); g.moveTo(tw.x - 8, cy - 8); g.lineTo(tw.x + 8, cy + 8); g.moveTo(tw.x + 8, cy - 8); g.lineTo(tw.x - 8, cy + 8); g.stroke();
        g.globalAlpha = 1;
      }
    }
    // Kombi-Verbindungen des gewählten Turms
    const sel = ui.selected?.tower;
    if (sel && sel.combos && sel.combos.length) {
      g.strokeStyle = 'rgba(255,210,62,0.8)'; g.lineWidth = 2; g.setLineDash([5, 5]); g.lineDashOffset = -t * 30;
      for (const c of sel.combos) { g.beginPath(); g.moveTo(sel.x, sel.y * TILT - 10); g.lineTo(c.partner.x, c.partner.y * TILT - 10); g.stroke(); }
      g.setLineDash([]);
    }
    this.resetWT();
  }

  drawAllRanges(game) {
    const g = this.ctx;
    for (const tw of game.towers) {
      if (tw.spec.kind === 'shieldgen') continue;
      const col = TOWERS[tw.type].color;
      g.fillStyle = rgba(col, 0.035); g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1.5;
      g.beginPath(); g.arc(tw.x, tw.y, game.towerRange(tw), 0, 7); g.fill(); g.stroke();
    }
  }

  // Gegner: Bodengegner flach in der Bodenebene, Flieger schweben darüber
  enemyZ(e) { return e.air ? 20 : e.type === 'boss' ? 12 : 0; }
  drawEnemies(game, air) {
    const g = this.ctx, t = this.time, E = game.enemies;
    const vis = (e) => e.active && e.air === air && !(e.cloaked && !e.revealed);
    g.globalCompositeOperation = 'lighter';
    for (const e of E) {
      if (!vis(e) || !(e.boss || e.elite || e.type === 'flyer')) continue;
      this.glowAt(ci(e.def.color), e.x, e.y - this.enemyZ(e) / TILT, e.r * (e.boss ? 3.5 : 3), e.boss ? 0.35 : 0.22);
    }
    g.globalCompositeOperation = 'source-over';
    for (const e of E) {
      if (!e.active || e.air !== air) continue;
      const hidden = e.cloaked && !e.revealed;
      let sc = 1 + (e.hit > 0 ? e.hit * 1.8 : 0);
      if (e.type === 'splitter') sc *= 1 + Math.sin(e.anim * 5) * 0.06;
      const rate = e.type === 'swarm' || e.type === 'mite' ? 14 : e.type === 'tank' || e.def.boss ? 6 : 4;
      const frame = e.stunT <= 0 ? Math.floor(e.anim * rate) & 1 : 0;
      g.globalAlpha = hidden ? 0.1 + Math.sin(t * 7 + e.wob) * 0.05 : e.cloaked ? 0.85 : 1;
      const z = this.enemyZ(e) + (e.air || e.type === 'boss' ? Math.sin(e.anim * 3 + e.wob) * 2 : 0);
      if (z > 0 && !e.air) { g.globalAlpha *= 0.3; this.resetWT(); g.fillStyle = '#000'; g.beginPath(); g.ellipse(e.x + 6, e.y + 4, e.r, e.r * 0.7, 0, 0, 7); g.fill(); g.globalAlpha = hidden ? 0.1 : 1; }
      this.sprR(enemySprite(e.type, e.elite, this.res, frame), e.x, e.y, e.angle, sc, z);
    }
    this.resetWT();
    g.globalAlpha = 1;
    for (const e of E) {
      if (!e.def.boss || !e.active || e.air !== air) continue;
      const ey = e.y - this.enemyZ(e) / TILT;
      if (e.charge > 0 && e.chargeTower) {
        const tw = e.chargeTower, k = 1 - e.charge / (e.def.shoot.charge || 1), top = towerDims(tw.type, tw.tier).H;
        g.strokeStyle = rgba('#ff3d5a', 0.3 + k * 0.6); g.lineWidth = 1 + k * 3;
        g.setLineDash([8, 6]); g.lineDashOffset = -t * 60;
        g.beginPath(); g.moveTo(e.x, ey); g.lineTo(tw.x, tw.y - top / TILT); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.arc(tw.x, tw.y, 30 - k * 8, 0, 7); g.stroke();
        g.globalCompositeOperation = 'lighter';
        this.glowAt(ci('#ff3d5a'), e.x, ey, 40 + k * 60, 0.5 + k * 0.5);
        g.globalCompositeOperation = 'source-over';
      }
      if (e.def.jam && e.jamCd < 1.2) {
        const k = 1 - e.jamCd / 1.2;
        g.strokeStyle = rgba('#ffb02e', 0.2 + k * 0.7); g.lineWidth = 2 + k * 2;
        g.beginPath(); g.arc(e.x, e.y, e.def.jam.range * TILE * k, 0, 7); g.stroke();
      }
      g.strokeStyle = rgba(e.def.color, 0.8); g.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.094; g.beginPath(); g.arc(e.x, ey, e.r * 0.78, a, a + 1.2); g.stroke(); }
    }
    g.globalCompositeOperation = 'lighter';
    for (const e of E) {
      if (!vis(e)) continue;
      const ey = e.y - this.enemyZ(e) / TILT;
      if (e.hit > 0) this.glowAt(0, e.x, ey, e.r * 2.6, Math.min(1, e.hit * 6));
      if (e.shield > 0) {
        const f = e.shield / Math.max(1, e.maxShield);
        g.globalAlpha = Math.min(1, 0.35 + f * 0.35 + (e.shieldHit > 0 ? 0.3 : 0));
        g.strokeStyle = '#4fc3ff'; g.lineWidth = 2;
        g.beginPath(); g.arc(e.x, ey, e.r * 1.45, 0, 7); g.stroke();
        g.globalAlpha = 0.08 + f * 0.08; g.fillStyle = '#4fc3ff'; g.fill();
      }
      if (e.slowT > 0 && e.slowAmt > 0) this.glowAt(ci('#7d7bff'), e.x, e.y, e.r * 1.8, 0.45);
      if (e.stunT > 0) { for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; this.glowAt(0, e.x + Math.cos(a) * e.r, ey - e.r - 4 + Math.sin(a) * 3, 8, 0.9); } }
      if (e.cloaked) { g.globalAlpha = 0.6; g.strokeStyle = '#c58bff'; g.lineWidth = 1.5; g.beginPath(); g.arc(e.x, ey, e.r * 1.5, t, t + 4.5); g.stroke(); }
      if (e.markT > 0) { g.globalAlpha = 0.6; g.strokeStyle = '#66ffcc'; g.lineWidth = 1; g.beginPath(); g.moveTo(e.x - e.r - 4, ey); g.lineTo(e.x + e.r + 4, ey); g.moveTo(e.x, ey - e.r - 4); g.lineTo(e.x, ey + e.r + 4); g.stroke(); }
      g.globalAlpha = 1;
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  drawHealthBars(game) {
    const g = this.ctx;
    this.uprightT();
    for (const e of game.enemies) {
      if (!e.active || (e.cloaked && !e.revealed)) continue;
      const big = e.def.boss;
      const w = big ? 84 : Math.max(16, e.r * 2), h = big ? 5 : 3;
      const x = e.x - w / 2, y = e.y * TILT - this.enemyZ(e) - e.r * TILT - (big ? 16 : 10);
      g.fillStyle = e.elite ? '#ffd23e' : 'rgba(0,0,0,0.75)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = 'rgba(10,12,18,0.95)'; g.fillRect(x, y, w, h);
      const f = Math.max(0, e.hp / e.maxHp);
      g.fillStyle = f > 0.5 ? '#5dff8a' : f > 0.25 ? '#ffcf3a' : '#ff3d5a';
      g.fillRect(x, y, w * f, h);
      if (e.maxShield > 0 && e.shield > 0) { g.fillStyle = '#4fc3ff'; g.fillRect(x, y - 3, w * (e.shield / e.maxShield), 2); }
    }
    for (const tw of game.towers) {
      if (tw.hp >= tw.maxHp && tw.offline <= 0) continue;
      const H = towerDims(tw.type, tw.tier).H;
      const x = tw.x - 18, y = tw.y * TILT - H - 24;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, y - 1, 38, 5);
      g.fillStyle = tw.offline > 0 ? '#ff3d5a' : '#ffcf3a';
      g.fillRect(x, y, 36 * (tw.offline > 0 ? 1 - tw.offline / 9 : tw.hp / tw.maxHp), 3);
    }
    this.resetWT();
  }

  drawHero(game, ui) {
    const g = this.ctx, h = game.hero, t = this.time;
    if (h.dead > 0) return;
    if (ui.heroSelected) {
      g.strokeStyle = 'rgba(93,255,176,0.9)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.lineDashOffset = -t * 20;
      g.beginPath(); g.arc(h.x, h.y, 22, 0, 7); g.stroke(); g.setLineDash([]);
      g.strokeStyle = 'rgba(93,255,176,0.18)'; g.beginPath(); g.arc(h.x, h.y, h.range, 0, 7); g.stroke();
      if (h.moving) { g.strokeStyle = 'rgba(93,255,176,0.4)'; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(h.tx, h.ty); g.stroke(); g.setLineDash([]); }
    }
    g.globalCompositeOperation = 'lighter';
    this.glowAt(ci('#5dffb0'), h.x, h.y, 80, 0.5);
    if (h.od > 0) {
      g.strokeStyle = rgba('#ffcf3a', 0.4 + Math.sin(t * 8) * 0.2); g.lineWidth = 2;
      g.beginPath(); g.arc(h.x, h.y, 2.5 * TILE, 0, 7); g.stroke();
      this.glowAt(ci('#ffcf3a'), h.x, h.y, 70, 0.4);
    }
    g.globalCompositeOperation = 'source-over';
    g.save(); g.translate(h.x, h.y); g.rotate(h.angle);
    const step = h.moving ? Math.sin(h.walk) * 5 : 0;
    g.fillStyle = '#16302a'; g.strokeStyle = '#5dffb0'; g.lineWidth = 1.5;
    g.fillRect(-8 + step, -12, 12, 6); g.strokeRect(-8 + step, -12, 12, 6);
    g.fillRect(-8 - step, 6, 12, 6); g.strokeRect(-8 - step, 6, 12, 6);
    g.shadowColor = '#5dffb0'; g.shadowBlur = 12;
    g.fillStyle = '#2f6a58'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(15, 0); g.lineTo(4, -13); g.lineTo(-11, -10); g.lineTo(-11, 10); g.lineTo(4, 13); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#0d1512'; g.fillRect(8, 5, 18, 5); g.strokeRect(8, 5, 18, 5);
    g.fillStyle = '#e8fff6'; g.beginPath(); g.arc(1, 0, 5.5, 0, 7); g.fill();
    g.fillStyle = '#5dffb0'; g.fillRect(3, -2, 4, 4);
    g.shadowBlur = 0;
    g.restore();
    // Balken + Stufe
    const f = h.hp / h.maxHp, hy = h.y * TILT;
    this.uprightT();
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(h.x - 18, hy - 26, 36, 5);
    g.fillStyle = '#5dffb0'; g.fillRect(h.x - 17, hy - 25, 34 * f, 3);
    g.fillStyle = '#ffd23e'; g.beginPath(); g.arc(h.x + 25, hy - 23, 7, 0, 7); g.fill();
    g.fillStyle = '#000'; g.font = 'bold 10px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(h.level, h.x + 25, hy - 22.5); g.textBaseline = 'alphabetic';
    this.resetWT();
  }

  drawBeams(game) {
    const g = this.ctx, t = this.time;
    for (const tw of game.towers) {
      if (!tw.beams.length || tw.offline > 0) continue;
      const col = tierColor(tw.type, tw.tier);
      for (const b of tw.beams) {
        const e = b.e;
        const top = towerDims(tw.type, tw.tier).H + 4;
        const sx = tw.x + Math.cos(tw.angle) * 18, sy = tw.y + Math.sin(tw.angle) * 18 - top / TILT;
        const r = b.ramp || 1;
        const flick = 0.85 + Math.sin(t * 40 + tw.id) * 0.15;
        g.strokeStyle = rgba(col, 0.25 * flick); g.lineWidth = 6 + r * 3; g.lineCap = 'round';
        const ey = e.y - this.enemyZ(e) / TILT;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(e.x, ey); g.stroke();
        g.strokeStyle = rgba(mix(col, '#ffffff', 0.6), 0.9); g.lineWidth = 1.5 + r * 0.8;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(e.x, ey); g.stroke();
        this.glowAt(ci(col), e.x, ey, 22 + r * 8, 0.8);
        this.glowAt(ci(col), sx, sy, 18, 0.8);
      }
    }
  }

  drawProjectiles(game) {
    const g = this.ctx;
    for (const p of game.projectiles) {
      // Höhe: vom Turmkopf bis zum Ziel absinken
      const tx = p.target && p.target.active ? p.target.x : p.tx, ty = p.target && p.target.active ? p.target.y : p.ty;
      const z = (p.z0 || 0) * clamp(Math.hypot(tx - p.x, ty - p.y) / (p.d0 || 1), 0, 1);
      const py = p.y - z / TILT;
      switch (p.kind) {
        case 'bolt': case 'drone': case 'hero': case 'cannon': {
          const len = p.kind === 'cannon' ? 16 : 11;
          g.strokeStyle = PAL[p.color]; g.lineWidth = p.kind === 'cannon' ? 3.5 : 2.5; g.lineCap = 'round'; g.globalAlpha = 0.9;
          g.beginPath(); g.moveTo(p.x - Math.cos(p.ang) * len, py - Math.sin(p.ang) * len); g.lineTo(p.x, py); g.stroke();
          this.glowAt(p.color, p.x, py, 16 * p.size, 0.9);
          break;
        }
        case 'missile': {
          this.glowAt(p.color, p.x, py, 20, 0.9);
          g.globalAlpha = 1; g.strokeStyle = '#fff2c0'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(p.x - Math.cos(p.ang) * 6, py - Math.sin(p.ang) * 6); g.lineTo(p.x + Math.cos(p.ang) * 3, py + Math.sin(p.ang) * 3); g.stroke();
          break;
        }
        case 'ebolt': this.glowAt(p.color, p.x, py, 18 * p.size, 0.95); this.glowAt(0, p.x, py, 6 * p.size, 0.9); break;
      }
    }
    for (const f of game.fireworks) {
      if (!f.live) continue;
      this.glowAt(f.color, f.x, f.y - f.z / TILT, 22, 1); this.glowAt(0, f.x, f.y - f.z / TILT, 7, 1);
    }
    g.globalAlpha = 1;
  }

  drawShells(game) {
    const g = this.ctx;
    for (const p of game.projectiles) {
      if (p.kind !== 'shell' && p.kind !== 'bomb' && p.kind !== 'grenade' && p.kind !== 'ebomb') continue;
      g.globalAlpha = 0.3; g.fillStyle = '#000';
      g.beginPath(); g.ellipse(p.x, p.y, 5, 3, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      const s = p.kind === 'shell' ? 26 : 16;
      const z = (p.z0 || 0) * (1 - Math.min(1, p.t || 0)) + p.h;
      this.glowAt(p.color, p.x, p.y - z / TILT, s + p.h * 0.2, 1);
      this.glowAt(0, p.x, p.y - z / TILT, s * 0.35, 1);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }

  drawFx(game) {
    const g = this.ctx;
    for (const r of game.rails) {
      const f = r.life / r.max;
      g.strokeStyle = rgba(r.color, 0.35 * f); g.lineWidth = r.w * 3 * f + 1; g.lineCap = 'round';
      const y1 = r.y1 - (r.z1 || 0) / TILT;
      g.beginPath(); g.moveTo(r.x1, y1); g.lineTo(r.x2, r.y2); g.stroke();
      g.strokeStyle = rgba('#ffffff', f); g.lineWidth = r.w * 0.6 * f + 0.5;
      g.beginPath(); g.moveTo(r.x1, y1); g.lineTo(r.x2, r.y2); g.stroke();
    }
    for (const b of game.bolts) {
      const f = b.life / b.max, p = b.pts;
      for (const [w, a, c] of [[7, 0.3, b.color], [2, 1, '#ffffff']]) {
        g.strokeStyle = rgba(c, a * f); g.lineWidth = w; g.lineJoin = 'round';
        const z0 = (b.z0 || 0) / TILT, n = p.length / 2;
        g.beginPath(); g.moveTo(p[0], p[1] - z0);
        for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] + (Math.random() - 0.5) * 3, p[i + 1] - z0 * Math.max(0, 1 - i / 2 / 4) + (Math.random() - 0.5) * 3);
        g.stroke();
      }
    }
    for (const r of game.rings) {
      const f = r.life / r.max, rad = r.r1 + (r.r0 - r.r1) * f;
      g.strokeStyle = rgba(r.color, f * 0.8); g.lineWidth = r.w * (0.4 + f);
      g.beginPath(); g.arc(r.x, r.y, Math.max(0.1, rad), 0, 7); g.stroke();
    }
    for (const fl of game.flashes) {
      const f = fl.life / fl.max;
      const fy = fl.y - (fl.z || 0) / TILT;
      this.glowAt(fl.color, fl.x, fy, 30 * fl.size * (0.6 + f), f);
      g.globalAlpha = f * 0.8; g.fillStyle = PAL[fl.color];
      g.save(); g.translate(fl.x, fy); g.rotate(fl.ang);
      g.beginPath(); g.moveTo(0, -3 * fl.size); g.lineTo(16 * fl.size, 0); g.lineTo(0, 3 * fl.size); g.closePath(); g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  drawParticles(P, smokePass, low) {
    const g = this.ctx;
    const n = P.n;
    if (smokePass) {
      const s = smoke();
      for (let i = 0; i < n; i++) {
        const k = P.kind[i];
        const f = P.life[i] / P.maxLife[i];
        if (k === P_SMOKE) {
          const sz = P.size[i] * (2 - f);
          g.globalAlpha = f * 0.8;
          g.drawImage(s, P.x[i] - sz, P.y[i] - sz, sz * 2, sz * 2);
        } else if (k === P_DEBRIS) {
          const sz = P.size[i];
          g.globalAlpha = Math.min(1, f * 2);
          g.fillStyle = '#1b1d22'; g.fillRect(P.x[i] - sz / 2, P.y[i] - sz / 2, sz, sz * 0.7);
          g.fillStyle = PAL[P.color[i]]; g.fillRect(P.x[i] - sz / 2, P.y[i] - sz / 2, sz, 1);
        } else if (k === P_HEAT && !low) {
          // Hitzeflimmern: helle, wabernde Schlieren
          const sz = P.size[i] * (1.6 - f * 0.6), wob = Math.sin(this.time * 18 + i) * 3;
          g.globalAlpha = f * 0.1;
          g.drawImage(s, P.x[i] - sz + wob, P.y[i] - sz, sz * 2, sz * 1.4);
          g.globalAlpha = f * 0.06; g.drawImage(glow(0), P.x[i] - sz * 0.6 - wob, P.y[i] - sz * 0.6, sz * 1.2, sz * 1.2);
        }
      }
      g.globalAlpha = 1;
      return;
    }
    const s = this.scale * this.dpr, ox = this.ctx.getTransform();
    let st = false;
    for (let i = 0; i < n; i++) {
      const k = P.kind[i];
      if (k === P_SMOKE || k === P_DEBRIS || k === P_HEAT) continue;
      const f = P.life[i] / P.maxLife[i];
      const sz = P.size[i] * (k === P_GLOW ? (0.4 + f) : 1);
      const spr = glow(P.color[i]);
      g.globalAlpha = k === P_DEBRIS ? Math.min(1, f * 2) : f;
      if (k === P_SPARK && !low) {
        const vx = P.vx[i], vy = P.vy[i], v = Math.hypot(vx, vy);
        if (v > 20) {
          const len = Math.min(26, v * 0.05 + 4);
          const cx = vx / v, cy = vy / v;
          g.setTransform(cx * len * s, cy * len * s, -cy * sz * s, cx * sz * s, ox.e + P.x[i] * s, ox.f + P.y[i] * s);
          g.drawImage(spr, -0.5, -0.5, 1, 1);
          st = true;
          continue;
        }
      }
      if (st) { g.setTransform(ox); st = false; }
      g.drawImage(spr, P.x[i] - sz, P.y[i] - sz, sz * 2, sz * 2);
    }
    g.setTransform(ox);
    g.globalAlpha = 1;
  }

  drawStrikes(game) {
    const g = this.ctx, t = this.time;
    for (const s of game.strikes) {
      const f = 1 - s.t / s.max;
      g.strokeStyle = rgba('#ff5a3a', 0.4 + f * 0.6); g.lineWidth = 2;
      g.setLineDash([8, 6]); g.lineDashOffset = t * 30;
      g.beginPath(); g.arc(s.x, s.y, s.r * (1.4 - f * 0.4), 0, 7); g.stroke(); g.setLineDash([]);
      g.globalCompositeOperation = 'lighter';
      const w = 6 + f * 30;
      const gr = g.createLinearGradient(s.x, s.y - 800, s.x, s.y);
      gr.addColorStop(0, 'rgba(255,120,80,0)'); gr.addColorStop(1, rgba('#ffb08a', 0.25 + f * 0.6));
      g.fillStyle = gr; g.fillRect(s.x - w / 2, s.y - 800, w, 800);
      this.glowAt(ci('#ff6b3d'), s.x, s.y, 40 + f * 90, 0.5 + f * 0.5);
      g.globalCompositeOperation = 'source-over';
    }
    for (const m of game.meteors) {
      const f = 1 - m.t / m.max;
      g.strokeStyle = rgba('#ff3d5a', 0.3 + f * 0.6); g.lineWidth = 2;
      g.beginPath(); g.arc(m.x, m.y, m.r * (1.2 - f * 0.2), 0, 7); g.stroke();
      g.fillStyle = rgba('#ff3d5a', 0.08 + f * 0.1); g.fill();
      const d = (1 - f) * 520;
      const mx = m.x + d * 0.6, my = m.y - d;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,170,90,0.5)'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 40, my - 66); g.stroke();
      this.glowAt(ci('#ff9a3c'), mx, my, 34, 1);
      this.glowAt(0, mx, my, 10, 1);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }

  drawTexts(game) {
    const g = this.ctx;
    this.uprightT();
    g.textAlign = 'center';
    for (const tx of game.texts) {
      g.font = tx.big ? '700 15px system-ui, sans-serif' : '600 12px system-ui, sans-serif';
      const y = tx.y * TILT - (tx.z || 0);
      g.globalAlpha = Math.min(1, tx.life / tx.max * 2);
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(tx.text, tx.x, y);
      g.fillStyle = tx.color; g.fillText(tx.text, tx.x, y);
    }
    g.globalAlpha = 1;
    this.resetWT();
  }

  drawEventOverlay(game, dt) {
    const g = this.ctx, ev = game.activeEvent, t = this.time;
    if (!ev && !game.pendingEvent) return;
    if (ev && ev.type === 'sand') {
      const left = ev.end - game.time, a = Math.min(1, left / 2, (ev.dur - left) / 2);
      g.globalAlpha = 0.18 * a; g.fillStyle = '#c88a4a'; g.fillRect(-50, -50, WORLD_W + 100, WORLD_H + 100);
      g.globalAlpha = 0.35 * a; g.strokeStyle = '#e8b980'; g.lineWidth = 1.5;
      g.beginPath();
      for (const l of this.sandLines) {
        const x = ((l.x * WORLD_W * 1.3 + t * 600 * l.s) % (WORLD_W * 1.3)) - 100, y = l.y * WORLD_H + Math.sin(t + l.x * 10) * 10;
        g.moveTo(x, y); g.lineTo(x + l.l, y + l.l * 0.08);
      }
      g.stroke();
      g.globalAlpha = 1;
    }
    if (ev && ev.type === 'storm') {
      if (Math.random() < dt * 1.5) {
        const pts = []; let x = Math.random() * WORLD_W, y = -20;
        while (y < WORLD_H * 0.7) { pts.push(x, y); x += (Math.random() - 0.5) * 80; y += 30 + Math.random() * 40; }
        this.storm.push({ pts, life: 0.25 });
        this.flash = 0.12; this.flashColor = 'rgba(160,120,255,0.18)';
      }
      g.globalAlpha = 0.1 + Math.sin(t * 3) * 0.04; g.fillStyle = '#5a3aff'; g.fillRect(-50, -50, WORLD_W + 100, WORLD_H + 100);
      g.globalAlpha = 1;
    }
    if (this.storm.length) {
      g.globalCompositeOperation = 'lighter';
      for (const s of this.storm) {
        s.life -= dt;
        g.strokeStyle = rgba('#c9a7ff', Math.max(0, s.life * 4)); g.lineWidth = 3;
        g.beginPath(); g.moveTo(s.pts[0], s.pts[1]); for (let i = 2; i < s.pts.length; i += 2) g.lineTo(s.pts[i], s.pts[i + 1]); g.stroke();
      }
      this.storm = this.storm.filter(s => s.life > 0);
      g.globalCompositeOperation = 'source-over';
    }
  }

  // Wetter je Landschaft: Glut, Schnee, Kristallstaub, Sporen (reine Stimmung)
  drawWeather(game, dt) {
    const kind = game.map.def.biome || 'kristall';
    const n = this.quality === 'hoch' ? 90 : 45;
    const W = this.weather;
    if (W.kind !== kind) { W.length = 0; W.kind = kind; }
    while (W.length < n) W.push({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, z: Math.random() * 90, p: Math.random() * 6.28, s: 0.6 + Math.random() * 0.8 });
    const g = this.ctx, t = this.time;
    const cfg = {
      wueste: { col: ci('#ff9a3c'), vx: 8, vz: 22, size: 5, add: true },
      eis: { col: ci('#ffffff'), vx: -14, vz: -26, size: 4, add: false },
      kristall: { col: ci('#d18cff'), vx: 4, vz: 6, size: 5, add: true },
      dschungel: { col: ci('#c4ff8a'), vx: 6, vz: 4, size: 5, add: true },
      asche: { col: ci('#ff7a3a'), vx: 12, vz: 30, size: 4, add: true },
      sumpf: { col: ci('#7affd0'), vx: 3, vz: 3, size: 5, add: true },
    }[kind] || { col: 0, vx: 0, vz: 0, size: 3, add: true };
    g.globalCompositeOperation = cfg.add ? 'lighter' : 'source-over';
    const spr = glow(cfg.col);
    for (const w of W) {
      w.x += (cfg.vx + Math.sin(t + w.p) * 6) * dt * w.s; w.z += cfg.vz * dt * w.s;
      if (w.z > 110) w.z = 0; if (w.z < 0) w.z = 110;
      if (w.x < 0) w.x += WORLD_W; if (w.x > WORLD_W) w.x -= WORLD_W;
      const a = kind === 'kristall' ? 0.4 + 0.4 * Math.sin(t * 4 + w.p) : 0.55;
      g.globalAlpha = a * Math.min(1, w.z / 20, (110 - w.z) / 20);
      const sz = cfg.size * w.s;
      g.drawImage(spr, w.x - sz, w.y - w.z / TILT - sz, sz * 2, sz * 2);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  drawCursor(game, ui) {
    const g = this.ctx;
    if (ui.targeting && ui.mouseWorld) {
      const { x, y } = ui.mouseWorld, t = this.time;
      const r = 1.5 * TILE;
      g.strokeStyle = 'rgba(255,90,58,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,90,58,0.1)'; g.fill();
      g.beginPath();
      for (let i = 0; i < 4; i++) { const a = t + i * Math.PI / 2; g.moveTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10)); g.lineTo(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10)); }
      g.stroke();
    }
  }
}
