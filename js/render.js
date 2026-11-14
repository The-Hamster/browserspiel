// Zeichnen: Sternenhimmel, Karte, Einheiten, Effekte
import { TILE, COLS, ROWS, WORLD_W, WORLD_H, TOWERS, ENEMIES, BASE } from './data.js';
import { glow, smoke, enemySprite, towerBaseSprite, towerHeadSprite, mk, clearSpriteCache, PAL, ci, roundRect, tierColor } from './sprites.js';
import { P_GLOW, P_SPARK, P_SMOKE, P_DEBRIS } from './particles.js';
import { rgba, mix, mulberry32, hashString, clamp } from './util.js';

const ROTATING = { laser: 1, plasma: 1, rail: 1, rocket: 1 };

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
  }

  resize(rect) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.vw = w; this.vh = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.playRect = rect || { x: 0, y: 0, w, h };
    const r = this.playRect;
    this.scale = Math.min(r.w / WORLD_W, r.h / WORLD_H);
    this.ox = r.x + (r.w - WORLD_W * this.scale) / 2;
    this.oy = r.y + (r.h - WORLD_H * this.scale) / 2;
    const res = Math.min(3, Math.max(1, Math.ceil(this.scale * dpr * 2) / 2));
    if (res !== this.res) { this.res = res; clearSpriteCache(); }
    this.buildStars();
    this.mapKey = null;
  }

  screenToWorld(x, y) { return { x: (x - this.ox) / this.scale, y: (y - this.oy) / this.scale }; }
  worldToScreen(x, y) { return { x: this.ox + x * this.scale, y: this.oy + y * this.scale }; }

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
  buildMapLayer(map, exact = false) {
    const res = exact ? this.scale * this.dpr : this.res;
    const c = mk(WORLD_W * res, WORLD_H * res), g = c.getContext('2d');
    g.scale(res, res);
    const th = map.theme;
    const rng = mulberry32(hashString(map.id || 'x'));
    // Boden
    g.save();
    roundRect(g, 0, 0, WORLD_W, WORLD_H, 18); g.clip();
    const gr = g.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 50, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.7);
    gr.addColorStop(0, th.ground2); gr.addColorStop(1, th.ground);
    g.fillStyle = gr; g.fillRect(0, 0, WORLD_W, WORLD_H);
    for (let i = 0; i < 220; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 3 + rng() * 26;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = rng() < 0.5;
      rg.addColorStop(0, dark ? 'rgba(0,0,0,0.28)' : rgba(th.ground2, 0.9)); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 14; i++) { // Krater
      const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 12 + rng() * 30;
      g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x, y, r, Math.PI * 1.9, Math.PI * 2.9); g.stroke();
    }
    g.strokeStyle = rgba(th.accent, 0.05); g.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * TILE, 0); g.lineTo(x * TILE, WORLD_H); g.stroke(); }
    for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * TILE); g.lineTo(WORLD_W, y * TILE); g.stroke(); }
    // Weg
    const lines = map.rawPaths.map(p => p.map(([x, y]) => [(x + 0.5) * TILE, (y + 0.5) * TILE]));
    const strokeAll = (w, style, blur = 0, blurCol = null) => {
      g.lineWidth = w; g.strokeStyle = style; g.lineJoin = 'miter'; g.lineCap = 'square';
      g.shadowBlur = blur; g.shadowColor = blurCol || style;
      for (const l of lines) { g.beginPath(); l.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
      g.shadowBlur = 0;
    };
    strokeAll(58, rgba(th.accent, 0.08), 26, rgba(th.accent, 0.5));
    strokeAll(48, rgba(th.accent, 0.55), 10, th.accent);
    strokeAll(44, '#07080c');
    strokeAll(40, mix(th.ground, '#000000', 0.45));
    g.setLineDash([2, 10]); strokeAll(30, 'rgba(255,255,255,0.025)'); g.setLineDash([]);
    strokeAll(2, rgba(th.lane, 0.12));
    // Bauflächen
    for (const idx of map.pads) {
      const x = (idx % COLS) * TILE, y = Math.floor(idx / COLS) * TILE;
      const pg = g.createLinearGradient(x, y, x + TILE, y + TILE);
      pg.addColorStop(0, '#262c38'); pg.addColorStop(1, '#12151c');
      g.fillStyle = pg; roundRect(g, x + 5, y + 5, TILE - 10, TILE - 10, 8); g.fill();
      g.strokeStyle = rgba(th.accent, 0.28); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = rgba(th.accent, 0.6); g.lineWidth = 2;
      const k = 9, a = x + 9, b = y + 9, A = x + TILE - 9, B = y + TILE - 9;
      g.beginPath();
      g.moveTo(a, b + k); g.lineTo(a, b); g.lineTo(a + k, b);
      g.moveTo(A - k, b); g.lineTo(A, b); g.lineTo(A, b + k);
      g.moveTo(A, B - k); g.lineTo(A, B); g.lineTo(A - k, B);
      g.moveTo(a + k, B); g.lineTo(a, B); g.lineTo(a, B - k);
      g.stroke();
    }
    // Basis-Plattform
    const bx = (map.base[0] + 0.5) * TILE, by = (map.base[1] + 0.5) * TILE;
    const bg = g.createRadialGradient(bx, by, 10, bx, by, 90);
    bg.addColorStop(0, '#2a3240'); bg.addColorStop(0.7, '#141920'); bg.addColorStop(1, 'rgba(10,12,16,0)');
    g.fillStyle = bg; g.beginPath(); g.arc(bx, by, 90, 0, 7); g.fill();
    g.strokeStyle = 'rgba(54,241,255,0.25)'; g.lineWidth = 2;
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(bx + Math.cos(a) * 70, by + Math.sin(a) * 70); } g.closePath(); g.stroke();
    g.restore();
    // Rand
    g.strokeStyle = rgba(th.accent, 0.35); g.lineWidth = 2; g.shadowBlur = 16; g.shadowColor = th.accent;
    roundRect(g, 1, 1, WORLD_W - 2, WORLD_H - 2, 18); g.stroke(); g.shadowBlur = 0;
    return c;
  }
  ensureMap(map) {
    const key = map.id + '|' + (this.scale * this.dpr).toFixed(4) + '|' + map.pads.size + '|' + map.rawPaths.length;
    if (this.mapKey === key && this.mapRef === map) return;
    this.mapLayer = this.buildMapLayer(map, true);
    this.mapKey = key; this.mapRef = map;
  }

  worldTransform(shx = 0, shy = 0) {
    const s = this.scale * this.dpr;
    this.wt = { s, tx: (this.ox + shx) * this.dpr, ty: (this.oy + shy) * this.dpr };
    this.ctx.setTransform(s, 0, 0, s, this.wt.tx, this.wt.ty);
  }
  resetWT() { const w = this.wt; this.ctx.setTransform(w.s, 0, 0, w.s, w.tx, w.ty); }
  // Sprite gedreht zeichnen ohne save/restore
  sprR(sp, x, y, ang, scale = 1) {
    const w = this.wt, c = Math.cos(ang) * w.s * scale, sn = Math.sin(ang) * w.s * scale;
    this.ctx.setTransform(c, sn, -sn, c, w.tx + x * w.s, w.ty + y * w.s);
    this.ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
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
    this.ensureMap(game.map);
    this.worldTransform(shx, shy);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.mapLayer, Math.round(this.wt.tx), Math.round(this.wt.ty));
    this.resetWT();
    const low = ui.settings.quality === 'niedrig';
    const t = this.time;
    const th = game.map.theme;

    // Wegfluss
    g.globalCompositeOperation = 'lighter';
    g.setLineDash([8, 26]); g.lineDashOffset = -t * 50;
    g.strokeStyle = rgba(th.lane, 0.28); g.lineWidth = 3; g.lineCap = 'round';
    for (const p of game.map.paths) { g.beginPath(); p.pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke(); }
    g.setLineDash([]);
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

    this.drawBase(game);
    this.drawTowers(game);

    // Schatten der Flieger
    g.globalAlpha = 0.35; g.fillStyle = '#000';
    for (const e of game.enemies) if (e.air && e.active) { g.beginPath(); g.ellipse(e.x + 10, e.y + 18, e.r * 0.9, e.r * 0.5, 0, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    // Rauch (normale Mischung)
    this.drawParticles(game.particles, true, low);
    this.drawEnemies(game);
    if (game.hero) this.drawHero(game, ui);

    // Additive Effekte
    g.globalCompositeOperation = 'lighter';
    this.drawBeams(game);
    this.drawProjectiles(game);
    this.drawFx(game);
    this.drawParticles(game.particles, false, low);
    g.globalCompositeOperation = 'source-over';
    this.drawShells(game);
    this.drawStrikes(game);
    this.drawTexts(game);
    this.drawHealthBars(game);
    this.drawEventOverlay(game, dt);
    this.drawCursor(game, ui);

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
      roundRect(g, tw.tx * TILE + 3, tw.ty * TILE + 3, TILE - 6, TILE - 6, 10); g.stroke();
    }
    if (sel && sel.kind === 'base') {
      const b = game.base, r = game.baseCannon().range * TILE;
      g.fillStyle = 'rgba(54,241,255,0.06)'; g.strokeStyle = 'rgba(54,241,255,0.5)'; g.lineWidth = 2;
      g.setLineDash([10, 8]); g.beginPath(); g.arc(b.x, b.y, r, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
    }
    // Hover / Bauvorschau
    const h = ui.hoverTile;
    if (h && game.state === 'playing') {
      const buildType = ui.buildType;
      const ok = game.canBuild(h.x, h.y);
      if (buildType) {
        const x = (h.x + 0.5) * TILE, y = (h.y + 0.5) * TILE;
        const col = ok ? '#5dffb0' : '#ff3d5a';
        g.fillStyle = rgba(col, 0.15); g.strokeStyle = col; g.lineWidth = 2;
        roundRect(g, h.x * TILE + 4, h.y * TILE + 4, TILE - 8, TILE - 8, 9); g.fill(); g.stroke();
        if (ok) {
          const spec = TOWERS[buildType].tiers[1];
          const rr = spec.range * TILE;
          g.fillStyle = rgba(TOWERS[buildType].color, 0.06); g.strokeStyle = rgba(TOWERS[buildType].color, 0.5);
          g.setLineDash([8, 8]); g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
          this.spr(towerBaseSprite(buildType, '1', this.res), x, y, 0, 1, 0.55);
          this.spr(towerHeadSprite(buildType, '1', this.res), x, y, -Math.PI / 2, 1, 0.55);
          g.globalAlpha = 1;
        }
      } else if (ok && !ui.targeting && !ui.heroSelected) {
        g.strokeStyle = rgba(game.map.theme.accent, 0.8); g.lineWidth = 2;
        roundRect(g, h.x * TILE + 4, h.y * TILE + 4, TILE - 8, TILE - 8, 9); g.stroke();
      }
    }
  }

  drawBase(game) {
    const g = this.ctx, b = game.base, t = this.time;
    const hpF = b.hp / b.maxHp;
    const col = hpF > 0.5 ? '#36f1ff' : hpF > 0.25 ? '#ffcf3a' : '#ff3d5a';
    const cidx = ci(col);
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cidx, b.x, b.y, 150 + Math.sin(t * 2.5) * 12, 0.45);
    g.globalCompositeOperation = 'source-over';
    // Ringe
    g.save(); g.translate(b.x, b.y);
    g.fillStyle = '#10141c'; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill();
    g.strokeStyle = rgba(col, 0.8); g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 12;
    for (let i = 0; i < 4; i++) { const a = t * 0.6 + i * Math.PI / 2; g.beginPath(); g.arc(0, 0, 36, a, a + 1.1); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = rgba(col, 0.5);
    for (let i = 0; i < 6; i++) { const a = -t * 1.1 + i * Math.PI / 3; g.beginPath(); g.arc(0, 0, 27, a, a + 0.6); g.stroke(); }
    g.shadowBlur = 0;
    // Kern
    const pulse = 0.85 + Math.sin(t * 4) * 0.15;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow(cidx), -24 * pulse, -24 * pulse, 48 * pulse, 48 * pulse);
    g.drawImage(glow(0), -10, -10, 20, 20);
    g.globalCompositeOperation = 'source-over';
    // Kanone
    g.rotate(b.angle);
    const rc = b.recoil * 4;
    g.fillStyle = '#2c3442'; g.strokeStyle = col; g.lineWidth = 1.5;
    const twin = game.baseCannon().twin;
    for (const off of twin ? [-6, 6] : [0]) { g.fillRect(14 - rc, off - 3, 22, 6); g.strokeRect(14 - rc, off - 3, 22, 6); }
    g.restore();
    // Schild
    if (b.shieldMax > 0 && b.shield > 0) {
      const f = b.shield / b.shieldMax;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#4f9dff', 0.25 + f * 0.5); g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, 52, 0, 7); g.stroke();
      g.fillStyle = rgba('#4f9dff', 0.05 + f * 0.06); g.fill();
      g.strokeStyle = rgba('#a8d0ff', 0.25 * f); g.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const a = t * 0.5 + i * 1.047; g.beginPath(); g.arc(b.x, b.y, 52, a, a + 0.4); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
    }
    if (b.heal > 0) { g.globalCompositeOperation = 'lighter'; this.glowAt(ci('#5dffb0'), b.x, b.y, 130, 0.4); g.globalCompositeOperation = 'source-over'; }
    g.globalAlpha = 1;
  }

  drawTowers(game) {
    const g = this.ctx, res = this.res, t = this.time, T = game.towers;
    // Sockel + Köpfe
    for (const tw of T) {
      const off = tw.offline > 0;
      g.globalAlpha = off ? 0.5 : 1;
      const bs = towerBaseSprite(tw.type, tw.tier, res);
      g.drawImage(bs.c, tw.x - bs.w / 2, tw.y - bs.h / 2, bs.w, bs.h);
    }
    for (const tw of T) {
      const off = tw.offline > 0;
      g.globalAlpha = off ? 0.5 : 1;
      let ang = 0;
      const rot = ROTATING[tw.type];
      if (rot) ang = tw.angle;
      else if (tw.type === 'radar') ang = tw.spin;
      else if (tw.type === 'tesla' || tw.type === 'emp') ang = t * 0.4;
      const rx = rot ? -Math.cos(tw.angle) * tw.recoil * 3 : 0;
      const ry = rot ? -Math.sin(tw.angle) * tw.recoil * 3 : 0;
      this.sprR(towerHeadSprite(tw.type, tw.tier, res), tw.x + rx, tw.y + ry, ang);
    }
    this.resetWT();
    g.globalAlpha = 1;
    // Additive Effekte
    g.globalCompositeOperation = 'lighter';
    for (const tw of T) {
      if (tw.offline > 0) continue;
      const sp = tw.spec;
      if (tw.type === 'tesla') this.glowAt(ci('#c9a7ff'), tw.x, tw.y, 40 + Math.sin(t * 9 + tw.id) * 8, 0.6);
      else if (tw.type === 'emp') { const k = clamp(1 - Math.max(0, tw.cd) * sp.rate, 0, 1); this.glowAt(ci('#7d7bff'), tw.x, tw.y, 20 + k * 30, 0.5 * k); }
      else if (tw.type === 'shield') {
        g.globalAlpha = 1;
        g.strokeStyle = rgba('#4f9dff', 0.18 + Math.sin(t * 2 + tw.id) * 0.08); g.lineWidth = 2;
        g.beginPath(); g.arc(tw.x, tw.y, sp.range * TILE, 0, 7); g.stroke();
      } else if (tw.type === 'radar') {
        g.globalAlpha = 1;
        const R = game.towerRange(tw);
        g.fillStyle = rgba('#66ffcc', 0.06);
        g.beginPath(); g.moveTo(tw.x, tw.y); g.arc(tw.x, tw.y, R, tw.spin - 0.5, tw.spin); g.closePath(); g.fill();
        g.strokeStyle = rgba('#66ffcc', 0.12); g.lineWidth = 1; g.beginPath(); g.arc(tw.x, tw.y, R, 0, 7); g.stroke();
      }
      if (tw.shield > 1) {
        const f = tw.shield / Math.max(1, tw.buffs.shieldCap);
        g.globalAlpha = 1;
        g.strokeStyle = rgba('#4f9dff', 0.2 + 0.4 * f); g.lineWidth = 2;
        g.beginPath(); g.arc(tw.x, tw.y, 28, 0, 7); g.stroke();
      }
      for (const d of tw.drones) this.glowAt(ci('#5dffb0'), d.x, d.y, 18, 0.7);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // Drohnen, Stufen, Ausfall
    g.fillStyle = '#d8fff0';
    for (const tw of T) {
      if (!tw.drones.length) continue;
      for (const d of tw.drones) {
        const c = Math.cos(d.ang), s = Math.sin(d.ang);
        g.beginPath();
        g.moveTo(d.x + c * 7, d.y + s * 7);
        g.lineTo(d.x - c * 5 + s * 5, d.y - s * 5 - c * 5);
        g.lineTo(d.x - c * 2, d.y - s * 2);
        g.lineTo(d.x - c * 5 - s * 5, d.y - s * 5 + c * 5);
        g.closePath(); g.fill();
      }
    }
    for (const tw of T) {
      const lvl = tw.tier === '1' ? 1 : tw.tier === '2' ? 2 : 3;
      g.fillStyle = tierColor(tw.type, tw.tier);
      for (let i = 0; i < lvl; i++) { g.beginPath(); g.arc(tw.x - (lvl - 1) * 4 + i * 8, tw.y + 24, 2.2, 0, 7); g.fill(); }
      if (tw.offline > 0) {
        g.globalAlpha = 0.5 + Math.sin(t * 10) * 0.3;
        g.strokeStyle = '#ff3d5a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(tw.x - 10, tw.y - 10); g.lineTo(tw.x + 10, tw.y + 10); g.moveTo(tw.x + 10, tw.y - 10); g.lineTo(tw.x - 10, tw.y + 10); g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  drawEnemies(game) {
    const g = this.ctx, t = this.time, E = game.enemies;
    // 1) Leuchten
    g.globalCompositeOperation = 'lighter';
    for (const e of E) {
      if (!e.active || (e.cloaked && !e.revealed) || e.type === 'swarm' || e.type === 'mite') continue;
      this.glowAt(ci(e.def.color), e.x, e.y, e.r * (e.boss ? 3.5 : 3), e.boss ? 0.35 : 0.22);
    }
    g.globalCompositeOperation = 'source-over';
    // 2) Körper (erst Boden, dann Luft)
    for (let pass = 0; pass < 2; pass++) {
      for (const e of E) {
        if (!e.active || (pass === 0) === e.air) continue;
        const hidden = e.cloaked && !e.revealed;
        let sc = 1;
        if (e.type === 'swarm' || e.type === 'mite') sc = 1 + Math.sin(e.anim * 30) * 0.06;
        else if (e.type === 'splitter') sc = 1 + Math.sin(e.anim * 5) * 0.07;
        g.globalAlpha = hidden ? 0.1 + Math.sin(t * 7 + e.wob) * 0.05 : e.cloaked ? 0.85 : 1;
        this.sprR(enemySprite(e.type, e.elite, this.res), e.x, e.y, e.angle, sc);
      }
    }
    this.resetWT();
    g.globalAlpha = 1;
    // Boss-Ringe
    for (const e of E) {
      if (!e.boss || !e.active) continue;
      g.strokeStyle = 'rgba(255,61,110,0.8)'; g.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.094; g.beginPath(); g.arc(e.x, e.y, e.r * 0.78, a, a + 1.2); g.stroke(); }
    }
    // 3) Zustände (additiv)
    g.globalCompositeOperation = 'lighter';
    for (const e of E) {
      if (!e.active || (e.cloaked && !e.revealed)) continue;
      if (e.hit > 0) this.glowAt(0, e.x, e.y, e.r * 2.6, Math.min(1, e.hit * 6));
      if (e.shield > 0) {
        const f = e.shield / Math.max(1, e.maxShield);
        g.globalAlpha = Math.min(1, 0.35 + f * 0.35 + (e.shieldHit > 0 ? 0.3 : 0));
        g.strokeStyle = '#4fc3ff'; g.lineWidth = 2;
        g.beginPath(); g.arc(e.x, e.y, e.r * 1.45, 0, 7); g.stroke();
        g.globalAlpha = 0.08 + f * 0.08; g.fillStyle = '#4fc3ff'; g.fill();
      }
      if (e.slowT > 0 && e.slowAmt > 0) { g.globalAlpha = 0.5; g.strokeStyle = '#7d7bff'; g.lineWidth = 1.5; g.beginPath(); g.arc(e.x, e.y, e.r * 1.15, 0, 7); g.stroke(); }
      if (e.stunT > 0) { for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; this.glowAt(0, e.x + Math.cos(a) * e.r, e.y - e.r - 4 + Math.sin(a) * 3, 8, 0.9); } }
      if (e.cloaked) { g.globalAlpha = 0.6; g.strokeStyle = '#c58bff'; g.lineWidth = 1.5; g.beginPath(); g.arc(e.x, e.y, e.r * 1.5, t, t + 4.5); g.stroke(); }
      if (e.markT > 0) { g.globalAlpha = 0.6; g.strokeStyle = '#66ffcc'; g.lineWidth = 1; g.beginPath(); g.moveTo(e.x - e.r - 4, e.y); g.lineTo(e.x + e.r + 4, e.y); g.moveTo(e.x, e.y - e.r - 4); g.lineTo(e.x, e.y + e.r + 4); g.stroke(); }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  drawHealthBars(game) {
    const g = this.ctx;
    for (const e of game.enemies) {
      if (!e.active || e.boss || (e.cloaked && !e.revealed)) continue;
      if (e.hp >= e.maxHp && e.shield >= e.maxShield) continue;
      const w = Math.max(16, e.r * 2), x = e.x - w / 2, y = e.y - e.r - 9;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, y - 1, w + 2, 5);
      const f = e.hp / e.maxHp;
      g.fillStyle = f > 0.5 ? '#5dff8a' : f > 0.25 ? '#ffcf3a' : '#ff3d5a';
      g.fillRect(x, y, w * f, 3);
      if (e.maxShield > 0 && e.shield > 0) { g.fillStyle = '#4fc3ff'; g.fillRect(x, y - 3, w * (e.shield / e.maxShield), 2); }
    }
    for (const tw of game.towers) {
      if (tw.hp >= tw.maxHp && tw.offline <= 0) continue;
      const x = tw.x - 20, y = tw.y - 30;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, y - 1, 42, 5);
      g.fillStyle = tw.offline > 0 ? '#ff3d5a' : '#ffcf3a';
      g.fillRect(x, y, 40 * (tw.offline > 0 ? 1 - tw.offline / 9 : tw.hp / tw.maxHp), 3);
    }
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
    this.glowAt(ci('#5dffb0'), h.x, h.y, 56, 0.35);
    if (h.od > 0) {
      g.strokeStyle = rgba('#ffcf3a', 0.4 + Math.sin(t * 8) * 0.2); g.lineWidth = 2;
      g.beginPath(); g.arc(h.x, h.y, 2.5 * TILE, 0, 7); g.stroke();
      this.glowAt(ci('#ffcf3a'), h.x, h.y, 70, 0.4);
    }
    g.globalCompositeOperation = 'source-over';
    g.save(); g.translate(h.x, h.y); g.rotate(h.angle);
    const step = h.moving ? Math.sin(h.walk) * 4 : 0;
    g.fillStyle = '#1b2a26';
    g.fillRect(-6 + step, -9, 10, 5); g.fillRect(-6 - step, 4, 10, 5);
    g.fillStyle = '#26413a'; g.strokeStyle = '#5dffb0'; g.lineWidth = 2; g.shadowColor = '#5dffb0'; g.shadowBlur = 8;
    g.beginPath(); g.ellipse(0, 0, 10, 12, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#0d1512'; g.fillRect(6, 3, 14, 4); g.strokeRect(6, 3, 14, 4);
    g.fillStyle = '#c8ffe8'; g.beginPath(); g.arc(3, -2, 4, 0, 7); g.fill();
    g.shadowBlur = 0;
    g.restore();
    // Balken + Stufe
    const f = h.hp / h.maxHp;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(h.x - 16, h.y - 26, 32, 5);
    g.fillStyle = '#5dffb0'; g.fillRect(h.x - 15, h.y - 25, 30 * f, 3);
    g.fillStyle = '#ffd23e'; g.font = 'bold 10px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(h.level, h.x + 22, h.y - 20);
  }

  drawBeams(game) {
    const g = this.ctx, t = this.time;
    for (const tw of game.towers) {
      if (!tw.beams.length || tw.offline > 0) continue;
      const col = tierColor(tw.type, tw.tier);
      for (const b of tw.beams) {
        const e = b.e;
        const sx = tw.x + Math.cos(tw.angle) * 20, sy = tw.y + Math.sin(tw.angle) * 20;
        const r = b.ramp || 1;
        const flick = 0.85 + Math.sin(t * 40 + tw.id) * 0.15;
        g.strokeStyle = rgba(col, 0.25 * flick); g.lineWidth = 6 + r * 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(e.x, e.y); g.stroke();
        g.strokeStyle = rgba(mix(col, '#ffffff', 0.6), 0.9); g.lineWidth = 1.5 + r * 0.8;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(e.x, e.y); g.stroke();
        this.glowAt(ci(col), e.x, e.y, 22 + r * 8, 0.8);
        this.glowAt(ci(col), sx, sy, 18, 0.8);
      }
    }
  }

  drawProjectiles(game) {
    const g = this.ctx;
    for (const p of game.projectiles) {
      switch (p.kind) {
        case 'bolt': case 'drone': case 'hero': case 'cannon': {
          const len = p.kind === 'cannon' ? 16 : 11;
          g.strokeStyle = PAL[p.color]; g.lineWidth = p.kind === 'cannon' ? 3.5 : 2.5; g.lineCap = 'round'; g.globalAlpha = 0.9;
          g.beginPath(); g.moveTo(p.x - Math.cos(p.ang) * len, p.y - Math.sin(p.ang) * len); g.lineTo(p.x, p.y); g.stroke();
          this.glowAt(p.color, p.x, p.y, 16 * p.size, 0.9);
          break;
        }
        case 'missile': {
          this.glowAt(p.color, p.x, p.y, 20, 0.9);
          g.globalAlpha = 1; g.strokeStyle = '#fff2c0'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(p.x - Math.cos(p.ang) * 6, p.y - Math.sin(p.ang) * 6); g.lineTo(p.x + Math.cos(p.ang) * 3, p.y + Math.sin(p.ang) * 3); g.stroke();
          break;
        }
        case 'ebolt': this.glowAt(p.color, p.x, p.y, 18 * p.size, 0.95); this.glowAt(0, p.x, p.y, 6 * p.size, 0.9); break;
      }
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
      this.glowAt(p.color, p.x, p.y - p.h, s + p.h * 0.2, 1);
      this.glowAt(0, p.x, p.y - p.h, s * 0.35, 1);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }

  drawFx(game) {
    const g = this.ctx;
    for (const r of game.rails) {
      const f = r.life / r.max;
      g.strokeStyle = rgba(r.color, 0.35 * f); g.lineWidth = r.w * 3 * f + 1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(r.x1, r.y1); g.lineTo(r.x2, r.y2); g.stroke();
      g.strokeStyle = rgba('#ffffff', f); g.lineWidth = r.w * 0.6 * f + 0.5;
      g.beginPath(); g.moveTo(r.x1, r.y1); g.lineTo(r.x2, r.y2); g.stroke();
    }
    for (const b of game.bolts) {
      const f = b.life / b.max, p = b.pts;
      for (const [w, a, c] of [[7, 0.3, b.color], [2, 1, '#ffffff']]) {
        g.strokeStyle = rgba(c, a * f); g.lineWidth = w; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] + (Math.random() - 0.5) * 3, p[i + 1] + (Math.random() - 0.5) * 3);
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
      this.glowAt(fl.color, fl.x, fl.y, 30 * fl.size * (0.6 + f), f);
      g.globalAlpha = f * 0.8; g.fillStyle = PAL[fl.color];
      g.save(); g.translate(fl.x, fl.y); g.rotate(fl.ang);
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
        if (P.kind[i] !== P_SMOKE) continue;
        const f = P.life[i] / P.maxLife[i];
        const sz = P.size[i] * (2 - f);
        g.globalAlpha = f * 0.8;
        g.drawImage(s, P.x[i] - sz, P.y[i] - sz, sz * 2, sz * 2);
      }
      g.globalAlpha = 1;
      return;
    }
    const s = this.scale * this.dpr, ox = this.ctx.getTransform();
    let st = false;
    for (let i = 0; i < n; i++) {
      const k = P.kind[i];
      if (k === P_SMOKE) continue;
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
    g.font = 'bold 13px system-ui, sans-serif'; g.textAlign = 'center';
    for (const tx of game.texts) {
      g.globalAlpha = Math.min(1, tx.life / tx.max * 2);
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(tx.text, tx.x, tx.y);
      g.fillStyle = tx.color; g.fillText(tx.text, tx.x, tx.y);
    }
    g.globalAlpha = 1;
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
