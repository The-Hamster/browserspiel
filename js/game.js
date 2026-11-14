// Simulation: Wellen, Gegner, Türme, Basis, Fähigkeiten, Kommandant, Ereignisse
import {
  TILE, COLS, ROWS, WORLD_W, WORLD_H, TOWERS, TOWER_ORDER, TOWER_HP, towerSpec, tierLevel, ENEMIES, ELITE_INFO,
  BASE, BASE_UPGRADES, BASE_UPGRADE_ORDER, ABILITIES, HERO, heroXpNeed, BIOMES,
} from './data.js';
import { makeRules, makeWave, hpScale } from './waves.js';
import { Particles, P_GLOW, P_SPARK, P_SMOKE, P_DEBRIS, P_HEAT } from './particles.js';
import { ci } from './sprites.js';
import { sfx } from './audio.js';
import { dist2, clamp, angleLerp, rand, mulberry32, hashString } from './util.js';

// ------------------------------------------------------------------ Karte aufbereiten
export const CELL = 8;                       // Raster für "frei / belegt" (in Weltpixeln)
export const GW = Math.ceil(WORLD_W / CELL), GH = Math.ceil(WORLD_H / CELL);
export const TOWER_R = 22;                   // Platzbedarf eines Turms
export const LANE = 26;                      // halbe Wegbreite inkl. Rand

function makePath(pts) {
  const cum = [0], segs = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y, len = Math.hypot(dx, dy) || 1;
    segs.push({ dx: dx / len, dy: dy / len, len, ang: Math.atan2(dy, dx) });
    cum.push(cum[i - 1] + len);
  }
  return { pts, cum, segs, total: cum[cum.length - 1] };
}

// Ecken abrunden: Wegpunkte (Feld-Einheiten) -> feine Punktliste (Weltpixel)
export function smoothPoints(wps, radius = 1.35) {
  const P = wps.map(([x, y]) => ({ x: x * TILE, y: y * TILE }));
  if (P.length < 3) return P;
  const out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    if (l1 < 1 || l2 < 1) continue;
    const r = Math.min(radius * TILE, l1 / 2, l2 / 2);
    const p1 = { x: b.x + (a.x - b.x) / l1 * r, y: b.y + (a.y - b.y) / l1 * r };
    const p2 = { x: b.x + (c.x - b.x) / l2 * r, y: b.y + (c.y - b.y) / l2 * r };
    const n = 10;
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      out.push({ x: u * u * p1.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * b.y + t * t * p2.y });
    }
  }
  out.push(P[P.length - 1]);
  // doppelte Punkte entfernen
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y) > 0.5);
}

// alte Karten (Feldmitte = x + 0.5) auf neues Format umrechnen
export function normalizeDef(def) {
  if (def.v === 2 || !def.custom && MAPS_IDS.has(def.id)) return def;
  const sh = (p) => [p[0] + 0.5, p[1] + 0.5];
  return { ...def, v: 2, biome: def.biome || 'kristall', paths: def.paths.map(pp => pp.map(sh)), base: sh(def.base), water: [], obstacles: [] };
}
const MAPS_IDS = new Set(['krater', 'zwilling', 'spirale', 'gabel']);

export function buildMap(rawDef) {
  const def = normalizeDef(rawDef);
  const biome = BIOMES[def.biome] || BIOMES.kristall;
  const grid = new Uint8Array(GW * GH);          // 1 = Weg/Wasser/Kern (nie bebaubar), 2 = Hindernis
  const stamp = (x, y, r, v = 1) => {
    const x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(GW - 1, Math.floor((x + r) / CELL));
    const y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(GH - 1, Math.floor((y + r) / CELL));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const cx = (gx + 0.5) * CELL, cy = (gy + 0.5) * CELL;
      if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) { const i = gy * GW + gx; if (grid[i] === 0 || v === 1) grid[i] = v; }
    }
  };
  const stampLine = (pts, r, v = 1) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5));
      for (let k = 0; k <= n; k++) stamp(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n, r, v);
    }
  };
  const smooth = (def.paths || []).filter(p => p.length >= 2).map(p => smoothPoints(p));
  const paths = smooth.map(makePath);
  for (const p of smooth) stampLine(p, LANE);
  const water = (def.water || []).map(w => ({ pts: smoothPoints(w.pts, 1.6), w: w.w * TILE }));
  for (const w of water) stampLine(w.pts, w.w / 2 + 4);
  const [bx, by] = def.base;
  const basePos = { x: bx * TILE, y: by * TILE };
  if (smooth.length) stamp(basePos.x, basePos.y, 78);
  const obstacles = (def.obstacles || []).map(([x, y, r, kind]) => ({ x: x * TILE, y: y * TILE, r: r * TILE, kind: kind || 'rock', rot: (x * 7 + y * 13) % 6.28 }));
  for (const o of obstacles) stamp(o.x, o.y, o.r, 2);
  // Deko (zufällig, aber fest je Karte)
  const rng = mulberry32(hashString((def.id || 'x') + (def.biome || '')));
  const deco = [];
  const freeAt = (x, y, r) => {
    for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
      const gx = Math.floor((x + dx) / CELL), gy = Math.floor((y + dy) / CELL);
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || grid[gy * GW + gx]) return false;
    }
    return true;
  };
  const nearPath = (x, y, d) => {
    for (const p of smooth) for (let i = 0; i < p.length; i += 2) if ((p[i].x - x) ** 2 + (p[i].y - y) ** 2 < d * d) return true;
    return false;
  };
  if (!def.noDeco) {
    // große Pflanzen/Felsen weit weg vom Weg (blockieren; nicht auf eigenen Karten)
    for (let tries = 0, n = 0; !def.custom && tries < 260 && n < 9; tries++) {
      const x = 30 + rng() * (WORLD_W - 60), y = 30 + rng() * (WORLD_H - 60), r = 18 + rng() * 16;
      if (!freeAt(x, y, r + 6) || nearPath(x, y, 120)) continue;
      const kind = rng() < 0.55 ? 'tree' : rng() < 0.5 ? 'rock' : 'crystal';
      deco.push({ x, y, r, kind, rot: rng() * 6.28, block: true });
      stamp(x, y, r, 2); n++;
    }
    // kleine Steine, Gras, Splitter (blockieren nicht)
    for (let tries = 0, n = 0; tries < 900 && n < 140; tries++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 2 + rng() * 6;
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      if (grid[gy * GW + gx]) continue;
      const k = rng();
      deco.push({ x, y, r, kind: k < 0.45 ? 'pebble' : k < 0.8 ? 'grass' : 'shard', rot: rng() * 6.28, block: false });
      n++;
    }
  }
  const fly = smooth.map(p => {
    const s0 = p[0];
    return makePath([{ x: clamp(s0.x, -30, WORLD_W + 30), y: clamp(s0.y, -30, WORLD_H + 30) }, basePos]);
  });
  const theme = { ground: biome.ground, ground2: biome.ground2, accent: biome.accent, lane: biome.lane };
  return { id: def.id, name: def.name, def, biome, theme, paths, flyPaths: fly, smooth, water, obstacles, deco, base: def.base, basePos, grid };
}

// Darf an dieser Stelle (Weltpixel) gebaut werden? (ohne andere Türme)
export function mapFree(map, x, y, r = TOWER_R) {
  if (x < r + 2 || y < r + 2 || x > WORLD_W - r - 2 || y > WORLD_H - r - 2) return false;
  const g = map.grid;
  for (let k = 0; k < 13; k++) {
    let dx = 0, dy = 0;
    if (k > 0 && k <= 8) { const a = k / 8 * Math.PI * 2; dx = Math.cos(a) * r; dy = Math.sin(a) * r; }
    else if (k > 8) { const a = k / 4 * Math.PI * 2 + 0.4; dx = Math.cos(a) * r * 0.5; dy = Math.sin(a) * r * 0.5; }
    const gx = Math.floor((x + dx) / CELL), gy = Math.floor((y + dy) / CELL);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || g[gy * GW + gx]) return false;
  }
  return true;
}

export function posAt(path, d, out) {
  if (d <= 0) { out.x = path.pts[0].x; out.y = path.pts[0].y; return out; }
  const cum = path.cum;
  let lo = 0, hi = path.segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= d) lo = m; else hi = m - 1; }
  const s = lo;
  const seg = path.segs[s], t = Math.min(d - cum[s], seg.len);
  out.x = path.pts[s].x + seg.dx * t; out.y = path.pts[s].y + seg.dy * t;
  return out;
}

const tmp = { x: 0, y: 0 };
const C = {
  white: ci('#ffffff'), orange: ci('#ff6b3d'), yellow: ci('#ffcf3a'), red: ci('#ff3d5a'), smoke: ci('#55606e'),
  green: ci('#5dffb0'), blue: ci('#4f9dff'), cyan: ci('#36f1ff'), violet: ci('#c9a7ff'), sand: ci('#d9a066'), amber: ci('#ff9a3c'),
};

// ------------------------------------------------------------------ Spiel
export class Game {
  constructor(opts) {
    this.opts = opts;
    this.mode = opts.mode;
    this.endless = !!opts.endless;
    this.daily = opts.daily || null;
    this.progress = opts.progress;
    this.rules = makeRules(this.mode, { endless: this.endless, mods: this.daily?.mods, banned: this.daily?.banned, difficulty: opts.difficulty });
    this.difficulty = this.rules.difficulty;
    this.res = new Set(this.rules.research ? (opts.research || []) : []);
    this.mapDef = opts.mapDef;
    this.map = buildMap(opts.mapDef);
    this.seed = this.daily ? 'daily-' + this.daily.key : this.mapDef.id + '-' + this.mode;
    this.time = 0;
    this.state = 'playing';
    this.particles = new Particles(3500);
    this.events = [];
    this.shake = 0;

    const r = this.rules;
    this.credits = r.startCredits + (this.res.has('b1') ? 60 : 0);
    this.energy = 30;
    const bp = this.map.basePos;
    this.base = {
      x: bp.x, y: bp.y, maxHp: r.baseHp + (this.res.has('b2') ? 30 : 0), hp: 0, shield: 0, shieldMax: 0, shieldRegen: 0,
      lastHit: -99, cd: 0, angle: -Math.PI / 2, reduce: 0, up: { armor: 0, shield: 0, cannon: 0, energy: 0, pulse: 0 }, recoil: 0, alarmed: false, heal: 0,
    };
    this.base.hp = this.base.maxHp;
    if (this.res.has('b4')) this.applyBaseUpgrade('shield');

    this.towers = []; this.towerId = 1;
    this.enemies = []; this.enemyPool = []; this.uid = 1;
    this.projectiles = []; this.projPool = [];
    this.rails = []; this.bolts = []; this.rings = []; this.texts = []; this.flashes = []; this.strikes = []; this.meteors = []; this.beams = [];
    this.radars = [];
    this.lights = []; this.decals = [];

    this.wave = 0;
    this.totalWaves = r.totalWaves;
    this.nextWaveDef = makeWave(1, this.seed, r, this.map.paths.length);
    this.spawnQueue = [];
    this.spawnEnd = 0;
    this.countdown = null;
    this.clearedUpTo = 0;
    this.pendingEvent = null; this.activeEvent = null; this.eventTimer = 0;
    this.warpT = 0;
    this.cooldowns = { orbital: 0, warp: 0, repair: 0, pulse: 0 };
    this.stats = { kills: 0, creditsEarned: 0, towersBuilt: 0, earlyCalls: 0, baseDamage: 0, bossKills: 0, leaks: 0, dmgByType: {}, built: new Set(), maxChain: 0, elitesKilled: 0 };
    this.orbitalCount = -1;
    this.hero = null;
    if (r.hero) this.spawnHero(this.res.has('c1') ? 3 : 1);
    this.tip('build');
  }

  // ---------------------------------------------------------------- Ereignisse an die Oberfläche
  emit(ev) { this.events.push(ev); }
  toast(text, kind = '') { this.emit({ t: 'toast', text, kind }); }
  announce(title, sub = '', kind = '') { this.emit({ t: 'announce', title, sub, kind }); }
  tip(id) {
    const p = this.progress;
    if (!p || !p.settings.tips || p.tips[id]) return;
    p.tips[id] = 1;
    this.emit({ t: 'tip', id });
  }
  ach(id) {
    const p = this.progress;
    if (!p || p.achievements[id]) return;
    p.achievements[id] = Date.now();
    this.emit({ t: 'ach', id });
    sfx.play('achieve');
  }
  pan(x) { return (x / WORLD_W) * 1.4 - 0.7; }
  addShake(a) { this.shake = Math.min(18, this.shake + a); }

  // ---------------------------------------------------------------- Kommandant
  spawnHero(level = 1) {
    const b = this.base;
    this.hero = { x: b.x - 70, y: b.y, tx: b.x - 70, ty: b.y, level, xp: 0, hp: 0, maxHp: 0, cd: 0, dead: 0, angle: 0, abil: [0, 0], od: 0, lastHit: -9, moving: false, walk: 0 };
    this.heroStats();
    this.hero.hp = this.hero.maxHp;
  }
  heroStats() {
    const h = this.hero;
    h.maxHp = HERO.hp + HERO.hpLvl * (h.level - 1);
    h.dmg = HERO.dmg + HERO.dmgLvl * (h.level - 1);
    h.range = (HERO.range + 0.05 * (h.level - 1)) * TILE;
  }
  heroMoveTo(x, y) {
    const h = this.hero;
    if (!h || h.dead > 0) return;
    h.tx = clamp(x, 16, WORLD_W - 16); h.ty = clamp(y, 16, WORLD_H - 16);
    this.rings.push({ x: h.tx, y: h.ty, r0: 18, r1: 4, life: 0.4, max: 0.4, color: '#5dffb0', w: 2 });
  }
  heroAbility(i) {
    const h = this.hero;
    if (!h || h.dead > 0 || h.abil[i] > 0) { sfx.play('error'); return false; }
    const cdMul = this.res.has('c5') ? 0.7 : 1;
    if (i === 0) {
      // Schockgranate: dichteste Gegnergruppe in Reichweite
      let best = null, bestN = 0;
      const R2 = (3.6 * TILE) ** 2;
      for (const e of this.enemies) {
        if (!e.active || dist2(e.x, e.y, h.x, h.y) > R2) continue;
        let n = 0;
        for (const o of this.enemies) if (o.active && dist2(o.x, o.y, e.x, e.y) < 6400) n++;
        if (n > bestN) { bestN = n; best = e; }
      }
      if (!best) { this.toast('Keine Gegner in Wurfweite'); sfx.play('error'); return false; }
      const p = this.newProj('grenade', h.x, h.y, null);
      p.sx = h.x; p.sy = h.y; p.tx = best.x; p.ty = best.y; p.t = 0; p.dur = 0.55; p.arc = 50;
      p.dmg = (80 + 25 * h.level) * this.rules.towerDmgMul; p.splash = 1.3 * TILE; p.stun = 1.2; p.color = C.green; p.hitAir = true;
      h.abil[0] = HERO.abilities[0].cd * cdMul;
    } else {
      h.od = HERO.abilities[1].dur;
      h.abil[1] = HERO.abilities[1].cd * cdMul;
      this.rings.push({ x: h.x, y: h.y, r0: 10, r1: 2.5 * TILE, life: 0.6, max: 0.6, color: '#ffcf3a', w: 4 });
      sfx.play('upgrade');
    }
    return true;
  }
  heroGainXp(v) {
    const h = this.hero;
    if (!h || h.level >= HERO.maxLevel) return;
    h.xp += v;
    while (h.level < HERO.maxLevel && h.xp >= heroXpNeed(h.level)) {
      h.xp -= heroXpNeed(h.level);
      h.level++;
      this.heroStats();
      h.hp = h.maxHp;
      this.toast(`Kommandant erreicht Stufe ${h.level}`, 'good');
      sfx.play('levelup');
      this.rings.push({ x: h.x, y: h.y, r0: 8, r1: 60, life: 0.7, max: 0.7, color: '#ffd23e', w: 3 });
      if (h.level >= 10) this.ach('hero10');
    }
  }

  // ---------------------------------------------------------------- Wellen
  canCallWave() { return this.state === 'playing' && this.wave < this.totalWaves && (this.wave === 0 || this.countdown !== null); }
  earlyBonus() {
    if (this.wave === 0 || this.countdown === null) return 0;
    return Math.ceil(this.countdown * (1.5 + this.wave * 0.2));
  }
  callNextWave() {
    if (!this.canCallWave()) return false;
    const bonus = this.countdownPaused ? 0 : this.earlyBonus();
    if (bonus > 0) {
      this.addCredits(bonus);
      this.energy = Math.min(this.energyMax(), this.energy + Math.ceil(this.countdown * 0.4));
      this.stats.earlyCalls++;
      this.toast(`Frühstart-Bonus +${bonus} Credits`, 'gold');
      if (this.stats.earlyCalls >= 10) this.ach('hasty');
    }
    this.countdownPaused = false;
    this.startWave();
    return true;
  }
  startWave() {
    if (this.wave >= this.totalWaves) return;
    this.wave++;
    const wd = this.nextWaveDef;
    for (const s of wd.spawns) this.spawnQueue.push({ at: this.time + s.t, type: s.type, elite: s.elite, path: s.path, w: wd.w });
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.spawnEnd = Math.max(this.spawnEnd, this.time + wd.duration);
    this.countdown = null;
    this.nextWaveDef = this.wave < this.totalWaves ? makeWave(this.wave + 1, this.seed, this.rules, this.map.paths.length) : null;
    if (wd.isBoss) {
      this.announce('WARNUNG: SCHWARMTRÄGER', `Welle ${this.wave} – ein Mutterschiff nähert sich`, 'boss');
      sfx.play('boss'); this.tip('boss');
    } else {
      this.announce(`WELLE ${this.wave}`, this.totalWaves === Infinity ? 'Endlos-Modus' : `von ${this.totalWaves}`);
      sfx.play('wave');
    }
    if (wd.event) {
      const names = { meteor: 'Meteoritenschauer', sand: 'Sandsturm', storm: 'Energiesturm' };
      this.pendingEvent = { type: wd.event, at: this.time + 6 };
      this.toast(`Warnung: ${names[wd.event]} in 6 Sekunden`, 'warn');
      sfx.play('alarm');
    }
    for (const t of Object.keys(wd.summary)) {
      if (t === 'flyer') this.tip('flyer');
      if (t === 'phantom') this.tip('phantom');
      if (t === 'shield') this.tip('shield');
      if (t === 'tank') this.tip('tank');
      if (wd.summary[t].elite) this.tip('elite');
    }
    if (this.wave === 1) this.tip('speed');
    if (this.wave === 3) this.tip('base');
  }

  energyMax() { return BASE.energyMax; }
  energyIncome() {
    let inc = BASE.energyIncome;
    const lv = this.base.up.energy;
    for (let i = 0; i < lv; i++) inc += BASE_UPGRADES.energy.levels[i].income;
    if (this.res.has('b3')) inc *= 1.25;
    if (this.activeEvent?.type === 'storm') inc *= 2;
    return inc;
  }
  addCredits(n) { n = Math.round(n); this.credits += n; this.stats.creditsEarned += n; if (this.stats.creditsEarned >= 5000) this.ach('rich'); }

  // ---------------------------------------------------------------- Gegner
  spawnEnemy(type, elite, pathIdx, dist = 0, w = this.wave) {
    const def = ENEMIES[type];
    const e = this.enemyPool.pop() || {};
    const r = this.rules;
    const hs = type === 'boss' ? Math.pow(hpScale(Math.max(1, w)), 0.8) * r.hpMul * r.bossMul : hpScale(Math.max(1, w)) * r.hpMul;
    e.active = true; e.uid = this.uid++; e.type = type; e.def = def; e.elite = elite;
    e.maxHp = def.hp * hs * (elite ? 1.8 : 1); e.hp = e.maxHp;
    e.maxShield = (def.shield || 0) * hs * (elite && type === 'shield' ? 1.8 : 1); e.shield = e.maxShield;
    e.armor = (def.armor || 0) + r.armorAdd + (elite && type === 'tank' ? 3 : 0) + Math.floor(w / 12);
    e.speed = def.speed * r.speedMul * (elite && type === 'swarm' ? 1.3 : 1) * (1 + Math.min(w, 40) * 0.004);
    e.air = !!def.air; e.r = def.r; e.boss = !!def.boss;
    e.pathIdx = pathIdx % (e.air ? this.map.flyPaths.length : this.map.paths.length);
    e.path = e.air ? this.map.flyPaths[e.pathIdx] : this.map.paths[e.pathIdx];
    e.dist = dist; e.seg = 0; e.x = e.path.pts[0].x; e.y = e.path.pts[0].y; e.vx = 0; e.vy = 0;
    e.angle = e.path.segs[0].ang;
    e.reward = Math.round(def.reward * r.rewardMul * (elite ? 1.6 * r.eliteRewardMul : 1) * (1 + w * 0.005));
    e.dmg = def.dmg; e.cloaked = !!def.cloak; e.revealed = false; e.wasRevealed = false;
    e.slowT = 0; e.slowAmt = 0; e.stunT = 0; e.burnT = 0; e.burnDps = 0; e.burnSrc = null; e.shredT = 0; e.shredAmt = 0; e.markT = 0;
    e.hit = 0; e.shieldHit = 0; e.shootCd = def.shoot ? def.shoot.cd * (0.5 + Math.random()) : 0; e.spawnCd = def.spawn ? def.spawn.cd : 0;
    e.charge = 0; e.chargeTower = null; e.abilCd = 2 + Math.random() * 2; e.wob = Math.random() * 6.28; e.anim = Math.random() * 6.28; e.age = 0; e.freezeCount = 0;
    if (dist > 0) this.updatePos(e, 0);
    this.enemies.push(e);
    return e;
  }

  updatePos(e, dt) {
    const p = e.path, cum = p.cum;
    while (e.seg < p.segs.length - 1 && cum[e.seg + 1] <= e.dist) e.seg++;
    const s = p.segs[e.seg], t = Math.min(e.dist - cum[e.seg], s.len);
    let nx = p.pts[e.seg].x + s.dx * t, ny = p.pts[e.seg].y + s.dy * t;
    if (e.air) { const w = Math.sin(this.time * 1.7 + e.wob) * 10; nx += -s.dy * w; ny += s.dx * w; }
    if (dt > 0) { e.vx = (nx - e.x) / dt; e.vy = (ny - e.y) / dt; }
    e.x = nx; e.y = ny;
    e.angle = angleLerp(e.angle, s.ang, 0.15);
  }

  damageEnemy(e, amt, src, o) {
    if (!e.active) return 0;
    if (e.markT > 0) amt *= 1.15;
    if (src && src.buffs) amt *= src.buffs.dmgMul;
    let dealt = 0;
    if (e.shield > 0 && !(o && o.ignoreShield)) {
      const a = Math.min(e.shield, amt);
      e.shield -= a; amt -= a; dealt += a; e.shieldHit = 0.15;
    }
    if (amt > 0) {
      const armor = Math.max(0, e.armor - (e.shredT > 0 ? e.shredAmt : 0));
      const d = (o && o.pierceArmor) ? amt : Math.max(amt * 0.25, amt - armor);
      e.hp -= d; dealt += d;
    }
    e.hit = 0.08;
    if (src && src.type) { src.dmg += dealt; this.stats.dmgByType[src.type] = (this.stats.dmgByType[src.type] || 0) + dealt; }
    if (e.hp <= 0) this.killEnemy(e, src);
    return dealt;
  }

  killEnemy(e, src) {
    if (!e.active) return;
    e.active = false; e.hp = 0;
    this.addCredits(e.reward);
    this.stats.kills++;
    if (e.elite) this.stats.elitesKilled++;
    if (this.progress) { this.progress.stats.kills++; if (this.progress.stats.kills >= 1000) this.ach('kills1000'); }
    if (src && src.kills !== undefined) src.kills++;
    if (this.orbitalCount >= 0) this.orbitalCount++;
    const col = ci(e.def.color);
    const P = this.particles;
    const big = e.r >= 16;
    P.burst(e.x, e.y, 6 + e.r * 0.8, col, 60 + e.r * 7, 0.45, 5 + e.r * 0.4, P_GLOW, 3);
    P.burst(e.x, e.y, 4 + e.r * 0.4, C.white, 120 + e.r * 8, 0.3, 3, P_SPARK, 2);
    this.lights.push({ x: e.x, y: e.y, r: e.r * 4 + 30, color: col, life: 0.3, max: 0.3 });
    if (big) {
      P.burst(e.x, e.y, 6, C.smoke, 40, 1.1, 18, P_SMOKE, 1.5); P.burst(e.x, e.y, 8, col, 170, 0.9, 4, P_DEBRIS, 1.8);
      P.spawn(e.x, e.y, 0, -18, 1.2, e.r * 2, C.white, P_HEAT, 0.5);
      if (this.decals.length < 40) this.decals.push({ x: e.x, y: e.y, r: e.r * 1.3 });
    }
    this.rings.push({ x: e.x, y: e.y, r0: e.r * 0.5, r1: e.r * 2.6, life: 0.35, max: 0.35, color: e.def.color, w: big ? 3 : 2 });
    sfx.play('explode', this.pan(e.x), big ? 1 : 0.5);
    if (big) this.addShake(e.boss ? 16 : 2.5);
    if (e.reward >= 12) this.texts.push({ x: e.x, y: e.y - 10, text: '+' + e.reward, life: 0.9, max: 0.9, color: '#ffd23e' });
    if (e.boss) {
      this.stats.bossKills++; this.ach('boss1');
      sfx.play('bigboom');
      for (let i = 0; i < 8; i++) P.burst(e.x + rand(-40, 40), e.y + rand(-40, 40), 20, i % 2 ? C.red : C.yellow, 240, 1, 10);
      this.rings.push({ x: e.x, y: e.y, r0: 20, r1: 220, life: 0.9, max: 0.9, color: '#ff3d6e', w: 6 });
      this.toast(`Schwarmträger vernichtet! +${e.reward}`, 'gold');
    }
    if (e.def.split) {
      const n = e.elite ? 5 : e.def.split.n;
      for (let i = 0; i < n; i++) {
        const c = this.spawnEnemy(e.def.split.type, false, e.pathIdx, Math.max(0, e.dist + (i - (n - 1) / 2) * 12), this.wave);
        c.x = e.x; c.y = e.y;
        c.reward = Math.max(1, Math.round(c.reward * 0.8));
      }
    }
    const h = this.hero;
    if (h && h.dead <= 0 && (src === h || dist2(h.x, h.y, e.x, e.y) < (4 * TILE) ** 2)) this.heroGainXp(e.reward * (src === h ? 1.5 : 1));
  }

  damageBase(amt) {
    const b = this.base;
    if (this.state !== 'playing') return;
    amt *= (1 - b.reduce);
    b.lastHit = this.time;
    if (b.shield > 0) {
      const a = Math.min(b.shield, amt); b.shield -= a; amt -= a;
      this.rings.push({ x: b.x, y: b.y, r0: 46, r1: 56, life: 0.3, max: 0.3, color: '#4f9dff', w: 4 });
      sfx.play('shieldhit');
    }
    if (amt <= 0) return;
    b.hp -= amt; this.stats.baseDamage += amt;
    this.addShake(4 + amt * 0.5);
    this.emit({ t: 'basehit' });
    sfx.play('basehit');
    this.particles.burst(b.x, b.y, 20, C.red, 200, 0.5, 6);
    if (!b.alarmed && b.hp < b.maxHp * 0.3) { b.alarmed = true; sfx.play('alarm'); this.announce('KERN KRITISCH', 'Reparaturdrohnen einsetzen!', 'warn'); }
    if (b.hp > b.maxHp * 0.5) b.alarmed = false;
    this.tip('basehit');
    if (b.hp <= 0) { b.hp = 0; this.endGame(false); }
  }

  // ---------------------------------------------------------------- Türme
  towerNear(x, y, r = 28) {
    let best = null, bd = r * r;
    for (const t of this.towers) { const d = dist2(t.x, t.y, x, y); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  canBuild(x, y) {
    if (!mapFree(this.map, x, y)) return false;
    for (const t of this.towers) if (dist2(t.x, t.y, x, y) < (TOWER_R * 2 + 4) ** 2) return false;
    return true;
  }
  towerHp() { return TOWER_HP * (this.res.has('a1') ? 1.25 : 1); }
  build(type, x, y) {
    if (this.state !== 'playing') return null;
    if (this.rules.banned.includes(type)) { this.toast('Diese Turmart ist heute gesperrt'); sfx.play('error'); return null; }
    if (!this.canBuild(x, y)) { sfx.play('error'); return null; }
    const cost = TOWERS[type].tiers[1].cost;
    if (this.credits < cost) { this.toast('Nicht genug Credits'); sfx.play('error'); return null; }
    this.credits -= cost;
    const t = {
      id: this.towerId++, type, tier: '1', x, y, angle: -Math.PI / 2,
      cd: 0.2, target: null, tuid: 0, mode: 'first', spent: cost, kills: 0, dmg: 0, hp: this.towerHp(), maxHp: this.towerHp(),
      shield: 0, offline: 0, lastHit: -9, hasFired: false, recoil: 0, beams: [], drones: [], pulses: 0, spin: Math.random() * 6, extraShot: 0,
      buffs: { rangeMul: 1, dmgMul: 1, rateMul: 1, shieldCap: 0, shieldRegen: 0 }, built: this.time,
    };
    t.spec = towerSpec(type, '1');
    this.towers.push(t);
    this.stats.towersBuilt++; this.stats.built.add(type);
    if (this.stats.towersBuilt >= 20) this.ach('builder');
    if (this.stats.built.size >= TOWER_ORDER.length) this.ach('all_towers');
    this.recomputeAuras();
    sfx.play('build', this.pan(t.x));
    this.particles.burst(t.x, t.y, 18, ci(TOWERS[type].color), 120, 0.5, 5);
    this.rings.push({ x: t.x, y: t.y, r0: 6, r1: 40, life: 0.4, max: 0.4, color: TOWERS[type].color, w: 3 });
    if (this.stats.towersBuilt === 1) this.tip('start');
    if (this.stats.towersBuilt === 3) this.tip('upgrade');
    if (type === 'radar') this.tip('radar_built');
    return t;
  }
  nextTiers(t) {
    if (t.tier === '1') return ['2'];
    if (t.tier === '2') {
      const tiers = TOWERS[t.type].tiers;
      const out = ['a', 'b'];
      if (tiers.c && this.res.has(tiers.c.research)) out.push('c');
      return out;
    }
    return [];
  }
  upgrade(t, tier) {
    if (!this.nextTiers(t).includes(tier)) return false;
    const cost = TOWERS[t.type].tiers[tier].cost;
    if (this.credits < cost) { this.toast('Nicht genug Credits'); sfx.play('error'); return false; }
    this.credits -= cost; t.spent += cost;
    t.tier = tier; t.spec = towerSpec(t.type, tier);
    t.beams.length = 0;
    t.maxHp = this.towerHp() * (1 + 0.15 * (tierLevel(tier) - 1)); t.hp = t.maxHp; t.offline = 0;
    this.recomputeAuras();
    sfx.play('upgrade', this.pan(t.x));
    this.particles.burst(t.x, t.y, 26, ci(TOWERS[t.type].color), 160, 0.6, 6);
    this.rings.push({ x: t.x, y: t.y, r0: 6, r1: 50, life: 0.5, max: 0.5, color: '#ffffff', w: 3 });
    if (tierLevel(tier) === 3) this.ach('variant');
    return true;
  }
  sellValue(t) { return t.hasFired ? Math.floor(t.spent * (this.res.has('b5') ? 0.85 : 0.7)) : t.spent; }
  sell(t) {
    const v = this.sellValue(t);
    this.credits += v;
    this.towers.splice(this.towers.indexOf(t), 1);
    this.recomputeAuras();
    sfx.play('sell', this.pan(t.x));
    this.particles.burst(t.x, t.y, 14, C.yellow, 100, 0.5, 4);
    this.texts.push({ x: t.x, y: t.y - 10, text: '+' + v, life: 1, max: 1, color: '#ffd23e' });
  }
  recomputeAuras() {
    for (const t of this.towers) { const b = t.buffs; b.rangeMul = 1; b.dmgMul = 1; b.rateMul = 1; b.shieldCap = 0; b.shieldRegen = 0; }
    this.radars = this.towers.filter(t => t.spec.kind === 'radar');
    for (const s of this.towers) {
      const sp = s.spec;
      if (sp.kind === 'radar' && (sp.rangeBuff || sp.dmgBuff)) {
        const R2 = (sp.auraRange * TILE) ** 2;
        for (const t of this.towers) if (t !== s && dist2(s.x, s.y, t.x, t.y) <= R2) {
          if (sp.rangeBuff) t.buffs.rangeMul = Math.max(t.buffs.rangeMul, 1 + sp.rangeBuff);
          if (sp.dmgBuff) t.buffs.dmgMul = Math.max(t.buffs.dmgMul, 1 + sp.dmgBuff);
        }
      }
      if (sp.kind === 'shieldgen') {
        const R2 = (sp.range * TILE) ** 2;
        for (const t of this.towers) if (dist2(s.x, s.y, t.x, t.y) <= R2) {
          t.buffs.shieldCap = Math.max(t.buffs.shieldCap, sp.shieldCap);
          t.buffs.shieldRegen = Math.max(t.buffs.shieldRegen, sp.shieldRegen);
          if (sp.rateBuff && t !== s) t.buffs.rateMul = Math.max(t.buffs.rateMul, 1 + sp.rateBuff);
        }
      }
    }
    for (const t of this.towers) if (t.shield > t.buffs.shieldCap) t.shield = t.buffs.shieldCap;
  }
  towerRange(t) {
    let r = t.spec.range * TILE * t.buffs.rangeMul;
    if (this.res.has('a5') && t.spec.kind !== 'shieldgen') r *= 1.08;
    if (this.activeEvent?.type === 'sand' && t.spec.kind !== 'shieldgen' && t.spec.kind !== 'radar') r *= 0.75;
    return r;
  }
  towerRate(t) {
    let r = t.spec.rate * t.buffs.rateMul;
    const h = this.hero;
    if (h && h.od > 0 && h.dead <= 0 && dist2(h.x, h.y, t.x, t.y) < (2.5 * TILE) ** 2) r *= 1.5;
    return r;
  }
  towerDmg(t, base) { return base * this.rules.towerDmgMul; }
  damageTower(t, amt) {
    if (t.offline > 0) return;
    t.lastHit = this.time;
    if (t.shield > 0) {
      const a = Math.min(t.shield, amt); t.shield -= a; amt -= a;
      this.rings.push({ x: t.x, y: t.y, r0: 26, r1: 30, life: 0.25, max: 0.25, color: '#4f9dff', w: 3 });
    }
    if (amt <= 0) return;
    t.hp -= amt;
    this.particles.burst(t.x, t.y, 5, C.orange, 90, 0.3, 3, P_SPARK);
    if (t.hp <= 0) {
      t.hp = 0; t.offline = 9; t.beams.length = 0;
      this.particles.burst(t.x, t.y, 16, C.orange, 150, 0.6, 6);
      this.particles.burst(t.x, t.y, 5, C.smoke, 30, 1.2, 16, P_SMOKE, 1);
      sfx.play('explode', this.pan(t.x), 0.7);
      this.toast(`${t.spec.tierName} ausgefallen – startet neu`, 'warn');
      this.tip('towerdown');
    }
  }

  canSee(e) { return !e.cloaked || e.revealed; }
  pickTarget(t, range, out, n) {
    const sp = t.spec, R2 = range * range;
    out.length = 0;
    const scores = this._scores || (this._scores = []);
    scores.length = 0;
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.air ? !sp.air : !sp.ground) continue;
      if (e.cloaked && !e.revealed) continue;
      const d2 = dist2(t.x, t.y, e.x, e.y);
      if (d2 > R2) continue;
      let s;
      if (t.mode === 'first') s = e.dist - e.path.total;
      else if (t.mode === 'strong') s = e.hp + e.shield;
      else s = -d2;
      // in absteigender Reihenfolge einsortieren
      let i = out.length;
      if (i >= n && s <= scores[n - 1]) continue;
      if (i < n) { out.push(e); scores.push(s); }
      else { i = n - 1; out[i] = e; scores[i] = s; }
      while (i > 0 && scores[i] > scores[i - 1]) {
        const ts = scores[i]; scores[i] = scores[i - 1]; scores[i - 1] = ts;
        const te = out[i]; out[i] = out[i - 1]; out[i - 1] = te; i--;
      }
    }
    return out;
  }

  newProj(kind, x, y, target) {
    const p = this.projPool.pop() || {};
    p.active = true; p.kind = kind; p.x = x; p.y = y; p.target = target; p.tuid = target ? target.uid : 0;
    p.tx = target ? target.x : x; p.ty = target ? target.y : y; p.vx = 0; p.vy = 0; p.life = 3; p.src = null;
    p.dmg = 0; p.splash = 0; p.color = C.white; p.speed = 600; p.hitAir = true; p.hitGround = true; p.airMul = 1;
    p.burn = null; p.stun = 0; p.cluster = 0; p.h = 0; p.trail = 0; p.ang = 0; p.size = 1; p.tower = null;
    this.projectiles.push(p);
    return p;
  }
  muzzle(t, ang, len, color, size = 1) {
    const x = t.x + Math.cos(ang) * len, y = t.y + Math.sin(ang) * len;
    this.flashes.push({ x, y, ang, life: 0.07, max: 0.07, color, size });
    if (this.lights.length < 60) this.lights.push({ x, y, r: 26 + size * 14, color, life: 0.08, max: 0.08 });
    return { x, y };
  }

  updateTower(t, dt) {
    if (t.offline > 0) {
      t.offline -= dt;
      if (Math.random() < dt * 8) this.particles.spawn(t.x + rand(-14, 14), t.y + rand(-14, 14), rand(-20, 20), rand(-60, -20), 0.4, 3, C.orange, P_SPARK, 2);
      if (t.offline <= 0) { t.offline = 0; t.hp = t.maxHp * 0.5; }
      return;
    }
    if (t.buffs.shieldCap > 0 && this.time - t.lastHit > 2) t.shield = Math.min(t.buffs.shieldCap, t.shield + t.buffs.shieldRegen * dt);
    t.recoil = Math.max(0, t.recoil - dt * 6);
    const sp = t.spec;
    const range = this.towerRange(t);
    const col = ci(TOWERS[t.type].color);
    t.cd -= dt;
    switch (sp.kind) {
      case 'bolt': {
        if (t.cd > 0) { this.aim(t, range); return; }
        const tg = this.pickTarget(t, range, this._tg || (this._tg = []), sp.multi || 1);
        if (!tg.length) return;
        t.cd = 1 / this.towerRate(t);
        t.angle = Math.atan2(tg[0].y - t.y, tg[0].x - t.x);
        for (const e of tg) {
          const a = Math.atan2(e.y - t.y, e.x - t.x);
          const m = this.muzzle(t, a, 22, col, 0.8);
          const p = this.newProj('bolt', m.x, m.y, e);
          p.dmg = this.towerDmg(t, sp.dmg); p.speed = sp.projSpeed; p.color = col; p.src = t; p.life = 1;
        }
        t.recoil = 1; t.hasFired = true;
        sfx.play('laser', this.pan(t.x));
        return;
      }
      case 'beam': {
        const n = sp.multi || 1;
        // ungültige Ziele entfernen
        for (let i = t.beams.length - 1; i >= 0; i--) {
          const b = t.beams[i], e = b.e;
          if (!e.active || e.uid !== b.uid || !this.canSee(e) || dist2(t.x, t.y, e.x, e.y) > range * range || (e.air ? !sp.air : !sp.ground)) t.beams.splice(i, 1);
        }
        if (t.beams.length < n) {
          const tg = this.pickTarget(t, range, this._tg || (this._tg = []), n);
          for (const e of tg) { if (t.beams.length >= n) break; if (!t.beams.some(b => b.e === e)) t.beams.push({ e, uid: e.uid, time: 0 }); }
        }
        if (!t.beams.length) return;
        t.angle = angleLerp(t.angle, Math.atan2(t.beams[0].e.y - t.y, t.beams[0].e.x - t.x), 0.3);
        const rateMul = this.towerRate(t) / sp.rate;
        for (const b of t.beams) {
          b.time += dt;
          const ramp = 1 + (sp.ramp - 1) * Math.min(1, b.time / sp.rampTime);
          b.ramp = ramp;
          this.damageEnemy(b.e, this.towerDmg(t, sp.dps * ramp * rateMul) * dt, t);
          if (Math.random() < dt * 20) this.particles.spawn(b.e.x + rand(-4, 4), b.e.y + rand(-4, 4), rand(-80, 80), rand(-80, 80), 0.25, 3, col, P_SPARK, 4);
        }
        t.hasFired = true;
        if (t.cd <= 0) { t.cd = 0.18; sfx.play('beam', this.pan(t.x)); }
        return;
      }
      case 'shell': {
        if (t.cd > 0) { this.aim(t, range); return; }
        const tg = this.pickTarget(t, range, this._tg || (this._tg = []), 1);
        if (!tg.length) return;
        const e = tg[0];
        const d = Math.sqrt(dist2(t.x, t.y, e.x, e.y));
        const flight = clamp(d / sp.projSpeed, 0.35, 1.0);
        const fut = e.air ? tmp : posAt(e.path, e.dist + e.speed * this.speedFactor(e) * flight, tmp);
        t.cd = 1 / this.towerRate(t);
        t.angle = Math.atan2(fut.y - t.y, fut.x - t.x);
        const m = this.muzzle(t, t.angle, 20, col, 1.4);
        const p = this.newProj('shell', m.x, m.y, null);
        p.sx = m.x; p.sy = m.y; p.tx = fut.x; p.ty = fut.y; p.t = 0; p.dur = flight; p.arc = 26 + d * 0.12;
        p.dmg = this.towerDmg(t, sp.dmg); p.splash = sp.splash * TILE; p.color = col; p.src = t; p.burn = sp.burn || null; p.cluster = sp.cluster || 0;
        p.hitAir = false; t.recoil = 1; t.hasFired = true;
        sfx.play('plasma', this.pan(t.x));
        return;
      }
      case 'rail': {
        if (t.extraShot > 0) { t.extraShot -= dt; if (t.extraShot <= 0) this.fireRail(t, range, col); }
        if (t.cd > 0) { this.aim(t, range); return; }
        if (this.fireRail(t, range, col)) {
          t.cd = 1 / this.towerRate(t);
          if (sp.shots > 1) t.extraShot = 0.14;
        }
        return;
      }
      case 'pulse': {
        if (t.cd > 0) return;
        const R2 = range * range;
        let any = false;
        for (const e of this.enemies) if (e.active && dist2(t.x, t.y, e.x, e.y) <= R2) { any = true; break; }
        if (!any) return;
        t.cd = 1 / this.towerRate(t);
        t.pulses++;
        const freeze = sp.freezeEvery && t.pulses % sp.freezeEvery === 0;
        for (const e of this.enemies) {
          if (!e.active || dist2(t.x, t.y, e.x, e.y) > R2) continue;
          if (e.shield > 0) { e.shield = Math.max(0, e.shield - sp.shieldDmg); e.shieldHit = 0.2; }
          const res = e.boss ? 0.5 : 1;
          if (sp.slow * res >= e.slowAmt || e.slowT <= 0) { e.slowAmt = sp.slow * res; }
          e.slowT = Math.max(e.slowT, sp.slowDur);
          if (freeze && !e.boss) e.stunT = Math.max(e.stunT, sp.freezeDur);
          if (sp.shred) { e.shredAmt = sp.shred; e.shredT = sp.shredDur; }
          this.damageEnemy(e, this.towerDmg(t, sp.dmg), t);
        }
        t.hasFired = true;
        this.rings.push({ x: t.x, y: t.y, r0: 10, r1: range, life: 0.45, max: 0.45, color: freeze ? '#ffffff' : TOWERS.emp.color, w: freeze ? 5 : 3 });
        sfx.play('emp', this.pan(t.x));
        return;
      }
      case 'missile': {
        if (t.cd > 0) { this.aim(t, range); return; }
        const tg = this.pickTarget(t, range, this._tg || (this._tg = []), 1);
        if (!tg.length) return;
        t.cd = 1 / this.towerRate(t);
        const e = tg[0];
        t.angle = Math.atan2(e.y - t.y, e.x - t.x);
        const n = sp.missiles || 1;
        for (let i = 0; i < n; i++) {
          const a = t.angle + (i - (n - 1) / 2) * 0.5 + rand(-0.1, 0.1);
          const p = this.newProj('missile', t.x + Math.cos(a) * 14, t.y + Math.sin(a) * 14, e);
          p.ang = a; p.speed = sp.projSpeed * 0.45; p.maxSpeed = sp.projSpeed; p.dmg = this.towerDmg(t, sp.dmg); p.splash = sp.splash * TILE;
          p.airMul = sp.airMul || 1; p.color = col; p.src = t; p.life = 3; p.hitGround = sp.ground !== false; p.hitAir = true;
        }
        this.muzzle(t, t.angle, 18, ci('#ffcf3a'), 1.2);
        t.recoil = 1; t.hasFired = true;
        sfx.play('missile', this.pan(t.x));
        return;
      }
      case 'chain': {
        if (t.cd > 0) return;
        const tg = this.pickTarget(t, range, this._tg || (this._tg = []), 1);
        if (!tg.length) return;
        t.cd = 1 / this.towerRate(t);
        const hit = [tg[0]];
        let cur = tg[0];
        const CR2 = (sp.chainRange * TILE) ** 2;
        while (hit.length < sp.chains) {
          let best = null, bd = CR2;
          for (const e of this.enemies) {
            if (!e.active || hit.includes(e) || !this.canSee(e)) continue;
            const d = dist2(cur.x, cur.y, e.x, e.y);
            if (d < bd) { bd = d; best = e; }
          }
          if (!best) break;
          hit.push(best); cur = best;
        }
        const pts = [t.x, t.y - 10];
        let dmg = this.towerDmg(t, sp.dmg);
        for (const e of hit) {
          const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
          const segs = 4;
          for (let s = 1; s < segs; s++) {
            const k = s / segs;
            pts.push(lx + (e.x - lx) * k + rand(-9, 9), ly + (e.y - ly) * k + rand(-9, 9));
          }
          pts.push(e.x, e.y);
          if (sp.stun && !e.boss) e.stunT = Math.max(e.stunT, sp.stun);
          this.particles.burst(e.x, e.y, 4, col, 90, 0.25, 3, P_SPARK);
        }
        for (const e of hit) { this.damageEnemy(e, dmg, t); dmg *= sp.falloff; }
        this.bolts.push({ pts, life: 0.16, max: 0.16, color: TOWERS.tesla.color });
        if (hit.length >= 6) this.ach('chain6');
        this.stats.maxChain = Math.max(this.stats.maxChain, hit.length);
        t.hasFired = true;
        sfx.play('tesla', this.pan(t.x));
        return;
      }
      case 'drones': this.updateDrones(t, dt, range, col); return;
      case 'radar': t.spin += dt * 1.6; return;
      case 'shieldgen': t.spin += dt; return;
    }
  }
  aim(t, range) {
    if (t._aimCd === undefined) t._aimCd = 0;
    t._aimCd -= 1;
    if (t._aimCd <= 0) {
      t._aimCd = 6;
      const tg = this.pickTarget(t, range * 1.1, this._tg || (this._tg = []), 1);
      t.aimAt = tg.length ? tg[0] : null;
    }
    if (t.aimAt && t.aimAt.active) t.angle = angleLerp(t.angle, Math.atan2(t.aimAt.y - t.y, t.aimAt.x - t.x), 0.15);
  }
  fireRail(t, range, col) {
    const sp = t.spec;
    const tg = this.pickTarget(t, range, this._tg || (this._tg = []), 1);
    if (!tg.length) return false;
    const e = tg[0];
    const a = Math.atan2(e.y - t.y, e.x - t.x);
    t.angle = a;
    const dx = Math.cos(a), dy = Math.sin(a);
    const L = range * 1.05;
    const list = [];
    for (const o of this.enemies) {
      if (!o.active || (o.air ? !sp.air : !sp.ground) || !this.canSee(o)) continue;
      const rx = o.x - t.x, ry = o.y - t.y;
      const along = rx * dx + ry * dy;
      if (along < 0 || along > L) continue;
      const perp = Math.abs(rx * dy - ry * dx);
      if (perp <= o.r + 7) list.push([along, o]);
    }
    list.sort((p, q) => p[0] - q[0]);
    const n = Math.min(sp.pierce, list.length);
    let endD = L;
    if (sp.pierce < 50 && n > 0 && n === sp.pierce) endD = list[n - 1][0] + 10;
    for (let i = 0; i < n; i++) {
      let dmg = this.towerDmg(t, sp.dmg);
      if (sp.crit && Math.random() < sp.crit) { dmg *= sp.critMul; this.texts.push({ x: list[i][1].x, y: list[i][1].y - 14, text: 'KRIT', life: 0.7, max: 0.7, color: '#ffffff' }); }
      const o = list[i][1];
      this.particles.cone(o.x, o.y, a, 0.8, 6, col, 260, 0.3, 3);
      this.damageEnemy(o, dmg, t, { pierceArmor: sp.pierceArmor });
    }
    const m = this.muzzle(t, a, 26, col, 1.6);
    this.rails.push({ x1: m.x, y1: m.y, x2: t.x + dx * endD, y2: t.y + dy * endD, life: 0.3, max: 0.3, color: TOWERS[t.type].color, w: t.tier === 'a' ? 6 : 4 });
    t.recoil = 1.5; t.hasFired = true;
    this.addShake(0.6);
    sfx.play('rail', this.pan(t.x));
    return true;
  }
  updateDrones(t, dt, range, col) {
    const sp = t.spec;
    while (t.drones.length < sp.drones) t.drones.push({ x: t.x, y: t.y, a: Math.random() * 6.28, cd: Math.random(), e: null, uid: 0, ang: 0 });
    if (t.drones.length > sp.drones) t.drones.length = sp.drones;
    const R2 = range * range;
    let retarget = (t._dr = (t._dr || 0) + 1) % 8 === 0;
    for (let i = 0; i < t.drones.length; i++) {
      const d = t.drones[i];
      d.a += dt * 3;
      let e = d.e;
      if (e && (!e.active || e.uid !== d.uid || !this.canSee(e) || dist2(t.x, t.y, e.x, e.y) > R2)) { e = d.e = null; }
      if (!e && (retarget || i === 0)) {
        let best = null, bd = Infinity;
        for (const o of this.enemies) {
          if (!o.active || (o.air ? !sp.air : !sp.ground) || !this.canSee(o)) continue;
          if (dist2(t.x, t.y, o.x, o.y) > R2) continue;
          const dd = dist2(d.x, d.y, o.x, o.y) + (i * 997 % 7) * 400;
          if (dd < bd) { bd = dd; best = o; }
        }
        if (best) { d.e = e = best; d.uid = best.uid; }
      }
      let gx, gy;
      if (e) { gx = e.x + Math.cos(d.a + i * 2) * 28; gy = e.y + Math.sin(d.a + i * 2) * 28; }
      else { gx = t.x + Math.cos(d.a * 0.5 + i * 6.28 / sp.drones) * 30; gy = t.y + Math.sin(d.a * 0.5 + i * 6.28 / sp.drones) * 30; }
      const dx = gx - d.x, dy = gy - d.y, dl = Math.hypot(dx, dy) || 1;
      const v = Math.min(dl / dt, e ? 240 : 120);
      d.x += dx / dl * v * dt; d.y += dy / dl * v * dt;
      d.ang = e ? Math.atan2(e.y - d.y, e.x - d.x) : Math.atan2(dy, dx);
      d.cd -= dt;
      if (e && d.cd <= 0 && dist2(d.x, d.y, e.x, e.y) < 110 * 110) {
        d.cd = 1 / this.towerRate(t);
        if (sp.bomb) {
          const p = this.newProj('bomb', d.x, d.y, null);
          p.sx = d.x; p.sy = d.y; p.tx = e.x; p.ty = e.y; p.t = 0; p.dur = 0.3; p.arc = -8;
          p.dmg = this.towerDmg(t, sp.dmg); p.splash = sp.splash * TILE; p.color = col; p.src = t; p.hitAir = false;
        } else {
          const p = this.newProj('drone', d.x, d.y, e);
          p.dmg = this.towerDmg(t, sp.dmg); p.speed = 700; p.color = col; p.src = t; p.life = 0.8;
          sfx.play('drone', this.pan(d.x));
        }
        t.hasFired = true;
      }
    }
  }
  speedFactor(e) {
    if (e.stunT > 0) return 0;
    let f = e.slowT > 0 ? 1 - e.slowAmt : 1;
    if (this.warpT > 0) f *= e.boss ? 0.7 : 0.5;
    return f;
  }

  // ---------------------------------------------------------------- Basis
  baseCannon() {
    const lv = this.base.up.cannon;
    const c = BASE.cannon;
    if (lv === 0) return { dmg: c.dmg, rate: c.rate, range: c.range, twin: false };
    const L = BASE_UPGRADES.cannon.levels[lv - 1];
    return { dmg: c.dmg * L.mul, rate: L.rate, range: L.range, twin: !!L.twin };
  }
  baseUpgradeCost(branch) {
    const lv = this.base.up[branch];
    const L = BASE_UPGRADES[branch].levels;
    return lv < L.length ? L[lv].cost : null;
  }
  buyBaseUpgrade(branch) {
    const cost = this.baseUpgradeCost(branch);
    if (cost === null) return false;
    if (this.credits < cost) { this.toast('Nicht genug Credits'); sfx.play('error'); return false; }
    this.credits -= cost;
    this.applyBaseUpgrade(branch);
    sfx.play('upgrade');
    const b = this.base;
    this.rings.push({ x: b.x, y: b.y, r0: 20, r1: 90, life: 0.6, max: 0.6, color: '#36f1ff', w: 4 });
    this.particles.burst(b.x, b.y, 30, C.cyan, 180, 0.7, 6);
    if (b.up[branch] >= BASE_UPGRADES[branch].levels.length) this.ach('base_max');
    if (branch === 'pulse' && b.up.pulse === 1) this.toast('Fähigkeit „Pulswelle“ freigeschaltet (Taste R)', 'good');
    return true;
  }
  applyBaseUpgrade(branch) {
    const b = this.base;
    const L = BASE_UPGRADES[branch].levels[b.up[branch]];
    b.up[branch]++;
    if (branch === 'armor') { b.maxHp += L.hp; b.hp += L.hp; if (L.reduce) b.reduce += L.reduce; }
    if (branch === 'shield') { b.shieldMax = L.cap; b.shieldRegen = L.regen; b.shield = L.cap; }
  }

  // ---------------------------------------------------------------- Fähigkeiten
  abilityInfo(id) {
    const a = ABILITIES[id];
    let energy = a.energy, cd = a.cd;
    if (id === 'repair' && this.res.has('c4')) energy -= 15;
    if (id === 'orbital' && this.res.has('c2')) cd *= 0.75;
    if (id === 'pulse') { const lv = this.base.up.pulse; if (lv) cd = BASE_UPGRADES.pulse.levels[lv - 1].cd; }
    const locked = id === 'pulse' && this.base.up.pulse === 0;
    return { energy, cd, locked, ready: !locked && this.cooldowns[id] <= 0 && this.energy >= energy, left: this.cooldowns[id] };
  }
  useAbility(id, x, y) {
    if (this.state !== 'playing') return false;
    const info = this.abilityInfo(id);
    if (info.locked) { this.toast('Erst im Kern-Ausbau freischalten'); sfx.play('error'); return false; }
    if (this.cooldowns[id] > 0) { sfx.play('error'); return false; }
    if (this.energy < info.energy) { this.toast('Nicht genug Energie'); sfx.play('error'); return false; }
    const hs = hpScale(Math.max(1, this.wave)) * this.rules.hpMul;
    const b = this.base;
    if (id === 'orbital') {
      const dmg = 260 * hs * (this.res.has('c2') ? 1.25 : 1);
      this.strikes.push({ x, y, t: 0.85, max: 0.85, r: 1.5 * TILE, dmg });
      sfx.play('orbital_charge', this.pan(x));
    } else if (id === 'warp') {
      this.warpT = ABILITIES.warp.dur + (this.res.has('c3') ? 3 : 0);
      sfx.play('warp');
      this.rings.push({ x: WORLD_W / 2, y: WORLD_H / 2, r0: 10, r1: WORLD_W, life: 1, max: 1, color: '#8a7dff', w: 8 });
    } else if (id === 'repair') {
      b.heal = 4;
      for (const t of this.towers) {
        t.hp = t.maxHp; t.offline = 0;
        this.rings.push({ x: t.x, y: t.y, r0: 30, r1: 6, life: 0.6, max: 0.6, color: '#5dffb0', w: 3 });
        this.particles.burst(t.x, t.y, 6, C.green, 60, 0.6, 4);
      }
      if (this.hero && this.hero.dead <= 0) this.hero.hp = this.hero.maxHp;
      sfx.play('repair');
    } else if (id === 'pulse') {
      const L = BASE_UPGRADES.pulse.levels[b.up.pulse - 1];
      const R = L.radius * TILE, R2 = R * R;
      for (const e of this.enemies) {
        if (!e.active || dist2(b.x, b.y, e.x, e.y) > R2) continue;
        if (!e.air) { e.dist = Math.max(0, e.dist - (e.boss ? 20 : 70)); e.seg = 0; this.updatePos(e, 0); }
        if (!e.boss) e.stunT = Math.max(e.stunT, 0.6);
        this.damageEnemy(e, L.dmg * hs * 0.5, null);
      }
      this.rings.push({ x: b.x, y: b.y, r0: 30, r1: R, life: 0.7, max: 0.7, color: '#36f1ff', w: 10 });
      this.rings.push({ x: b.x, y: b.y, r0: 20, r1: R * 0.8, life: 0.5, max: 0.5, color: '#ffffff', w: 4 });
      this.addShake(10);
      sfx.play('pulse');
    }
    this.energy -= info.energy;
    this.cooldowns[id] = info.cd;
    return true;
  }

  // ---------------------------------------------------------------- Hauptschritt
  step(dt) {
    if (this.state !== 'playing') { this.updateFx(dt); return; }
    this.time += dt;
    const r = this.rules;

    // Spawns
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
      const s = this.spawnQueue.shift();
      this.spawnEnemy(s.type, s.elite, s.path, 0, s.w);
    }
    if (this.wave > 0 && this.countdown === null && this.wave < this.totalWaves && !this.spawnQueue.length && this.time >= this.spawnEnd) {
      this.countdown = r.countdown;
      if (r.manual) this.countdownPaused = true;
    }
    if (this.countdown !== null && this.wave > 0 && !this.countdownPaused) {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.countdown = null; this.startWave(); }
    }

    // Energie & Abklingzeiten
    this.energy = Math.min(this.energyMax(), this.energy + this.energyIncome() * dt);
    if (this.energy >= 50) this.tip('abilities');
    const cdRate = this.activeEvent?.type === 'storm' ? 2 : 1;
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt * cdRate);
    if (this.warpT > 0) this.warpT -= dt;

    this.updateEvents(dt);

    // Sichtbarkeit getarnter Gegner + Markierung
    const b = this.base;
    const BS2 = (BASE.scan * TILE) ** 2;
    const h = this.hero;
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.markT > 0) e.markT -= dt;
      if (!e.cloaked) continue;
      let rev = dist2(e.x, e.y, b.x, b.y) < BS2 || (h && h.dead <= 0 && dist2(e.x, e.y, h.x, h.y) < (2 * TILE) ** 2);
      if (!rev) for (const t of this.radars) { if (t.offline <= 0 && dist2(e.x, e.y, t.x, t.y) <= (this.towerRange(t)) ** 2) { rev = true; break; } }
      if (rev && !e.wasRevealed) { e.wasRevealed = true; sfx.play('cloak', this.pan(e.x)); }
      e.revealed = rev;
    }
    for (const t of this.radars) {
      if (!t.spec.markDmg || t.offline > 0) continue;
      const R2 = this.towerRange(t) ** 2;
      for (const e of this.enemies) if (e.active && dist2(e.x, e.y, t.x, t.y) <= R2 && this.canSee(e)) e.markT = 0.2;
    }

    // Gegner
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;
      this.updateEnemy(e, dt);
    }

    // Türme
    for (const t of this.towers) this.updateTower(t, dt);

    // Basis
    this.updateBase(dt);
    if (h) this.updateHero(dt);

    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateFx(dt);

    // aufräumen
    let w = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.active) this.enemies[w++] = e; else this.enemyPool.push(e);
    }
    this.enemies.length = w;

    // Welle geschafft?
    if (!this.spawnQueue.length && this.enemies.length === 0 && this.clearedUpTo < this.wave) {
      let bonus = 0;
      for (let k = this.clearedUpTo + 1; k <= this.wave; k++) bonus += 15 + k * 3;
      this.clearedUpTo = this.wave;
      this.addCredits(bonus);
      this.energy = Math.min(this.energyMax(), this.energy + 10);
      this.toast(`Welle ${this.wave} abgewehrt  +${bonus} Credits`, 'good');
      if (this.wave >= 1) this.ach('first_wave');
      if (this.wave >= 10) this.ach('wave10');
      if (this.wave >= 10 && this.stats.baseDamage === 0) this.ach('flawless');
      if (this.endless && this.wave >= 40) this.ach('endless40');
      if (this.progress) this.progress.stats.wavesTotal++;
      if (this.wave >= this.totalWaves) this.endGame(true);
      else this.emit({ t: 'cleared' });
    }
  }

  updateEnemy(e, dt) {
    const def = e.def;
    e.age += dt; e.anim += dt;
    if (e.hit > 0) e.hit -= dt;
    if (e.shieldHit > 0) e.shieldHit -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }
    if (e.stunT > 0) e.stunT -= dt;
    if (e.shredT > 0) e.shredT -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt;
      this.damageEnemy(e, e.burnDps * dt, e.burnSrc);
      if (Math.random() < dt * 14) this.particles.spawn(e.x + rand(-6, 6), e.y + rand(-6, 6), rand(-10, 10), rand(-50, -20), 0.4, 4, C.orange, P_GLOW, 1);
      if (!e.active) return;
    }
    if (e.elite && e.type === 'tank') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015 * dt);
    const f = this.speedFactor(e);
    e.dist += e.speed * f * dt;
    if (e.dist >= e.path.total) {
      e.active = false;
      this.stats.leaks++;
      const dmg = e.boss ? e.dmg : e.dmg * (e.elite ? 2 : 1);
      this.particles.burst(e.x, e.y, 14, ci(def.color), 120, 0.5, 5);
      this.damageBase(dmg);
      return;
    }
    this.updatePos(e, dt);

    // Fähigkeiten
    if (e.charge > 0) {
      // Boss lädt sichtbar auf, bevor er feuert
      const tw = e.chargeTower;
      if (!tw || tw.offline > 0 || !this.towers.includes(tw) || e.stunT > 0) { e.charge = 0; e.chargeTower = null; }
      else {
        e.charge -= dt;
        if (e.charge <= 0) {
          e.chargeTower = null;
          const p = this.newProj('ebolt', e.x, e.y, null);
          p.tower = tw; p.tid = tw.id; p.tx = tw.x; p.ty = tw.y; p.speed = 420;
          p.dmg = def.shoot.dmg * (1 + this.wave * 0.03); p.color = C.red; p.life = 2; p.size = 1.8;
          sfx.play('ebolt', this.pan(e.x));
        }
      }
    }
    if (def.shoot && e.stunT <= 0) {
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = def.shoot.cd;
        const R2 = (def.shoot.range * TILE) ** 2;
        let best = null, bd = R2;
        for (const t of this.towers) { if (t.offline > 0) continue; const d = dist2(e.x, e.y, t.x, t.y); if (d < bd) { bd = d; best = t; } }
        if (best && def.shoot.charge) { e.charge = def.shoot.charge; e.chargeTower = best; best = null; }
        if (best) {
          const p = this.newProj('ebolt', e.x, e.y, null);
          p.tower = best; p.tid = best.id; p.tx = best.x; p.ty = best.y; p.speed = e.boss ? 380 : 300;
          p.dmg = def.shoot.dmg * (1 + this.wave * 0.03); p.color = C.red; p.life = 2; p.size = e.boss ? 1.6 : 1;
          sfx.play('ebolt', this.pan(e.x));
        }
      }
    }
    if (def.spawn && e.stunT <= 0) {
      e.spawnCd -= dt;
      if (e.spawnCd <= 0) {
        e.spawnCd = def.spawn.cd;
        for (let i = 0; i < def.spawn.n; i++) {
          const c = this.spawnEnemy(def.spawn.type, false, e.pathIdx, Math.max(0, e.dist - 10 - i * 14), this.wave);
          c.reward = 1;
        }
        this.rings.push({ x: e.x, y: e.y, r0: 10, r1: 60, life: 0.4, max: 0.4, color: def.color, w: 3 });
      }
    }
    if (e.elite) {
      e.abilCd -= dt;
      if (e.abilCd <= 0) {
        if (e.type === 'shield') {
          e.abilCd = 4;
          for (const o of this.enemies) if (o.active && o !== e && dist2(o.x, o.y, e.x, e.y) < (1.5 * TILE) ** 2) { o.maxShield = Math.max(o.maxShield, o.maxHp * 0.3); o.shield = Math.min(o.maxShield, o.shield + o.maxHp * 0.3); }
          this.rings.push({ x: e.x, y: e.y, r0: 10, r1: 1.5 * TILE, life: 0.5, max: 0.5, color: '#4fc3ff', w: 3 });
        } else if (e.type === 'phantom') {
          e.abilCd = 4.5;
          this.particles.burst(e.x, e.y, 10, ci(def.color), 60, 0.4, 5);
          e.dist = Math.min(e.path.total - 10, e.dist + 70);
          this.updatePos(e, 0);
          this.particles.burst(e.x, e.y, 10, ci(def.color), 60, 0.4, 5);
        } else if (e.type === 'flyer') {
          e.abilCd = 3;
          let best = null, bd = (1.4 * TILE) ** 2;
          for (const t of this.towers) { const d = dist2(e.x, e.y, t.x, t.y); if (d < bd && t.offline <= 0) { bd = d; best = t; } }
          if (best) {
            const p = this.newProj('ebomb', e.x, e.y, null);
            p.sx = e.x; p.sy = e.y; p.tx = best.x; p.ty = best.y; p.t = 0; p.dur = 0.5; p.arc = -10; p.tower = best; p.tid = best.id;
            p.dmg = 15 * (1 + this.wave * 0.03); p.color = C.yellow;
          }
        } else e.abilCd = 99;
      }
    }
  }

  updateBase(dt) {
    const b = this.base;
    if (b.shieldMax > 0 && this.time - b.lastHit > 4) b.shield = Math.min(b.shieldMax, b.shield + b.shieldRegen * dt);
    if (b.heal > 0) { b.heal -= dt; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.08 * dt); }
    b.recoil = Math.max(0, b.recoil - dt * 5);
    b.cd -= dt;
    const c = this.baseCannon();
    const R = c.range * TILE;
    if (b.cd <= 0) {
      let best = null, bs = -Infinity;
      for (const e of this.enemies) {
        if (!e.active || !this.canSee(e)) continue;
        if (dist2(b.x, b.y, e.x, e.y) > R * R) continue;
        const s = e.dist / e.path.total;
        if (s > bs) { bs = s; best = e; }
      }
      if (best) {
        b.cd = 1 / c.rate;
        b.angle = Math.atan2(best.y - b.y, best.x - b.x);
        const shots = c.twin ? [-0.18, 0.18] : [0];
        for (const off of shots) {
          const a = b.angle + off;
          const x = b.x + Math.cos(a) * 30, y = b.y + Math.sin(a) * 30;
          this.flashes.push({ x, y, ang: b.angle, life: 0.08, max: 0.08, color: C.cyan, size: 1.5 });
          const p = this.newProj('cannon', x, y, best);
          p.dmg = c.dmg * this.rules.towerDmgMul; p.speed = 800; p.color = C.cyan; p.life = 1.2; p.size = 1.4;
        }
        b.recoil = 1;
        sfx.play('cannon', this.pan(b.x));
      }
    }
  }

  updateHero(dt) {
    const h = this.hero;
    for (let i = 0; i < 2; i++) h.abil[i] = Math.max(0, h.abil[i] - dt);
    if (h.od > 0) h.od -= dt;
    if (h.dead > 0) {
      h.dead -= dt;
      if (h.dead <= 0) { h.dead = 0; h.x = this.base.x - 60; h.y = this.base.y; h.tx = h.x; h.ty = h.y; h.hp = h.maxHp; this.toast('Kommandant ist zurück im Einsatz', 'good'); }
      return;
    }
    const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy);
    h.moving = d > 3;
    if (h.moving) { const v = Math.min(d, HERO.speed * dt); h.x += dx / d * v; h.y += dy / d * v; h.walk += dt * 10; if (!h.target) h.angle = Math.atan2(dy, dx); }
    // Kontakt-Schaden
    let hurt = 0;
    for (const e of this.enemies) {
      if (!e.active || e.air) continue;
      const rr = e.r + 14;
      if (dist2(e.x, e.y, h.x, h.y) < rr * rr) hurt += e.dmg * (e.boss ? 18 : 5);
    }
    if (hurt > 0) {
      h.hp -= hurt * dt * (1 + this.wave * 0.02); h.lastHit = this.time;
      if (h.hp <= 0) {
        h.dead = 20; h.hp = 0;
        this.particles.burst(h.x, h.y, 30, C.green, 200, 0.7, 6);
        sfx.play('explode', this.pan(h.x), 1);
        this.toast('Kommandant ausgefallen – Rückkehr in 20 s', 'warn');
        return;
      }
    } else if (this.time - h.lastHit > 3) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.05 * dt);
    // Angriff
    h.cd -= dt;
    h.target = null;
    let best = null, bd = h.range * h.range;
    for (const e of this.enemies) {
      if (!e.active || !this.canSee(e)) continue;
      const dd = dist2(e.x, e.y, h.x, h.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    if (best) {
      h.target = best;
      h.angle = Math.atan2(best.y - h.y, best.x - h.x);
      if (h.cd <= 0) {
        h.cd = 1 / HERO.rate;
        const p = this.newProj('hero', h.x + Math.cos(h.angle) * 14, h.y + Math.sin(h.angle) * 14, best);
        p.dmg = h.dmg * (h.od > 0 ? 2 : 1) * this.rules.towerDmgMul; p.speed = 900; p.color = C.green; p.src = h; p.life = 1;
        this.flashes.push({ x: p.x, y: p.y, ang: h.angle, life: 0.05, max: 0.05, color: C.green, size: 0.8 });
        sfx.play('laser', this.pan(h.x), 0.6);
      }
    }
  }

  explode(x, y, radius, dmg, src, o = {}) {
    const R = radius;
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.air && !o.hitAir) continue;
      if (!e.air && o.hitGround === false) continue;
      const rr = R + e.r;
      const d2 = dist2(x, y, e.x, e.y);
      if (d2 > rr * rr) continue;
      const fall = 1 - 0.5 * Math.sqrt(d2) / rr;
      let d = dmg * fall * (e.air ? (o.airMul || 1) : 1);
      if (o.burn) { e.burnT = o.burn.dur; e.burnDps = o.burn.dps * this.rules.towerDmgMul * hpScale(Math.max(1, this.wave)) ** 0.5; e.burnSrc = src; }
      if (o.stun && !e.boss) e.stunT = Math.max(e.stunT, o.stun);
      this.damageEnemy(e, d, src);
    }
    const col = o.color ?? C.orange;
    this.lights.push({ x, y, r: radius * 1.6 + 40, color: col, life: 0.35, max: 0.35 });
    if (radius > 28 && this.decals.length < 40) this.decals.push({ x, y, r: radius * 0.75 });
    if (radius > 40) {
      this.particles.burst(x, y, 4, C.orange, radius * 1.5, 0.7, radius * 0.45, P_GLOW, 4);
      for (let k = 0; k < 3; k++) this.particles.spawn(x + rand(-10, 10), y + rand(-6, 6), rand(-6, 6), rand(-26, -14), 1.1, radius * 0.5, C.white, P_HEAT, 0.5);
      this.particles.burst(x, y, 5, C.amber, 150, 0.9, 4, P_DEBRIS, 2.5);
    }
    this.particles.burst(x, y, 8 + radius * 0.25, col, radius * 3.2, 0.45, 8, P_GLOW, 3.5);
    this.particles.burst(x, y, 6 + radius * 0.1, C.white, radius * 4, 0.25, 3, P_SPARK, 3);
    if (radius > 50) this.particles.burst(x, y, 3, C.smoke, 30, 1, 14, P_SMOKE, 1.5);
    this.rings.push({ x, y, r0: 4, r1: radius, life: 0.3, max: 0.3, color: '#ffd2a0', w: 3 });
    if (radius > 70) this.addShake(1.5);
    sfx.play('explode', this.pan(x), Math.min(1, radius / 90));
  }

  updateProjectiles(dt) {
    const P = this.particles;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      p.life -= dt;
      switch (p.kind) {
        case 'bolt': case 'drone': case 'hero': case 'cannon': {
          const e = p.target;
          const valid = e && e.active && e.uid === p.tuid;
          if (valid) { p.tx = e.x; p.ty = e.y; }
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
          const step = p.speed * dt;
          p.ang = Math.atan2(dy, dx);
          if (d <= step + (valid ? e.r * 0.5 : 0)) {
            if (valid) {
              this.damageEnemy(e, p.dmg, p.src);
              P.burst(p.tx, p.ty, 3, p.color, 80, 0.2, 3, P_SPARK, 4);
            }
            p.active = false;
          } else { p.x += dx / d * step; p.y += dy / d * step; }
          if (p.life <= 0) p.active = false;
          break;
        }
        case 'missile': {
          let e = p.target;
          if (!(e && e.active && e.uid === p.tuid)) {
            e = null;
            let bd = 200 * 200;
            for (const o of this.enemies) {
              if (!o.active || !this.canSee(o) || (o.air ? !p.hitAir : !p.hitGround)) continue;
              const d = dist2(o.x, o.y, p.x, p.y); if (d < bd) { bd = d; e = o; }
            }
            p.target = e; p.tuid = e ? e.uid : 0;
          }
          if (e) {
            const want = Math.atan2(e.y - p.y, e.x - p.x);
            p.ang = angleLerp(p.ang, want, Math.min(1, dt * 7));
          }
          p.speed = Math.min(p.maxSpeed, p.speed + 900 * dt);
          p.x += Math.cos(p.ang) * p.speed * dt; p.y += Math.sin(p.ang) * p.speed * dt;
          p.trail -= dt;
          if (p.trail <= 0) {
            p.trail = 0.02;
            P.spawn(p.x - Math.cos(p.ang) * 6, p.y - Math.sin(p.ang) * 6, rand(-10, 10), rand(-10, 10), 0.5, 7, C.smoke, P_SMOKE, 1);
            P.spawn(p.x - Math.cos(p.ang) * 6, p.y - Math.sin(p.ang) * 6, 0, 0, 0.12, 6, C.yellow, P_GLOW, 0);
          }
          if (e && dist2(p.x, p.y, e.x, e.y) < (e.r + 6) ** 2) {
            this.explode(p.x, p.y, p.splash, p.dmg, p.src, { hitAir: true, hitGround: p.hitGround, airMul: p.airMul, color: C.yellow });
            p.active = false;
          } else if (p.life <= 0) { this.explode(p.x, p.y, p.splash, p.dmg * 0.5, p.src, { hitAir: true, airMul: p.airMul, color: C.yellow }); p.active = false; }
          break;
        }
        case 'shell': case 'bomb': case 'grenade': case 'ebomb': {
          p.t += dt / p.dur;
          const t = Math.min(1, p.t);
          p.x = p.sx + (p.tx - p.sx) * t; p.y = p.sy + (p.ty - p.sy) * t;
          p.h = Math.sin(Math.PI * t) * p.arc;
          if (p.kind === 'shell' && Math.random() < 0.6) P.spawn(p.x, p.y - p.h, rand(-15, 15), rand(-15, 15), 0.25, 6, p.color, P_GLOW, 2);
          if (t >= 1) {
            p.active = false;
            if (p.kind === 'ebomb') {
              const tw = p.tower;
              if (tw && this.towers.includes(tw) && tw.id === p.tid) this.damageTower(tw, p.dmg);
              P.burst(p.x, p.y, 10, C.yellow, 100, 0.4, 5);
              sfx.play('explode', this.pan(p.x), 0.4);
            } else if (p.kind === 'grenade') {
              this.explode(p.x, p.y, p.splash, p.dmg, this.hero, { hitAir: true, stun: p.stun, color: C.green });
              this.rings.push({ x: p.x, y: p.y, r0: 10, r1: p.splash * 1.2, life: 0.5, max: 0.5, color: '#5dffb0', w: 5 });
              this.addShake(3);
              sfx.play('grenade', this.pan(p.x));
            } else {
              this.explode(p.x, p.y, p.splash, p.dmg, p.src, { hitAir: false, burn: p.burn, color: p.color });
              if (p.cluster) {
                for (let k = 0; k < p.cluster; k++) {
                  const a = Math.random() * 6.28, rr = rand(25, 55);
                  const q = this.newProj('bomb', p.x, p.y, null);
                  q.sx = p.x; q.sy = p.y; q.tx = p.x + Math.cos(a) * rr; q.ty = p.y + Math.sin(a) * rr; q.t = 0; q.dur = 0.3; q.arc = 18;
                  q.dmg = p.dmg * 0.45; q.splash = p.splash * 0.6; q.color = p.color; q.src = p.src;
                }
              }
            }
          }
          break;
        }
        case 'ebolt': {
          const tw = p.tower;
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
          p.ang = Math.atan2(dy, dx);
          if (d <= step) {
            p.active = false;
            if (tw && this.towers.includes(tw) && tw.id === p.tid) this.damageTower(tw, p.dmg);
            P.burst(p.tx, p.ty, 5, C.red, 80, 0.25, 4, P_SPARK);
          } else { p.x += dx / d * step; p.y += dy / d * step; }
          if (p.life <= 0) p.active = false;
          break;
        }
      }
    }
    let w = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (p.active) this.projectiles[w++] = p; else { p.target = null; p.src = null; p.tower = null; this.projPool.push(p); }
    }
    this.projectiles.length = w;
  }

  updateStrikes(dt) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.strikes.splice(i, 1);
        this.orbitalCount = 0;
        this.explode(s.x, s.y, s.r, s.dmg, null, { hitAir: true, color: C.orange });
        for (let k = 0; k < 3; k++) this.particles.burst(s.x, s.y, 20, k === 0 ? C.white : C.orange, 300, 0.8, 9);
        this.rings.push({ x: s.x, y: s.y, r0: 10, r1: s.r * 1.6, life: 0.6, max: 0.6, color: '#ffffff', w: 8 });
        this.lights.push({ x: s.x, y: s.y, r: 320, color: C.orange, life: 0.8, max: 0.8 });
        this.decals.push({ x: s.x, y: s.y, r: s.r * 1.1 });
        this.addShake(12);
        sfx.play('orbital', this.pan(s.x));
        this.emit({ t: 'flash', color: 'rgba(255,200,150,0.35)' });
        if (this.orbitalCount >= 10) this.ach('orbital10');
        this.orbitalCount = -1;
      }
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t -= dt;
      if (m.t <= 0) {
        this.meteors.splice(i, 1);
        for (const t of this.towers) if (dist2(t.x, t.y, m.x, m.y) < (m.r + 20) ** 2) this.damageTower(t, 32);
        this.explode(m.x, m.y, m.r, 70 * hpScale(Math.max(1, this.wave)) * 0.5, null, { hitAir: false, color: C.amber });
        this.particles.burst(m.x, m.y, 8, C.smoke, 40, 1.2, 16, P_SMOKE, 1.2);
        this.addShake(3);
      }
    }
  }

  updateEvents(dt) {
    const pe = this.pendingEvent;
    if (pe && this.time >= pe.at) {
      this.pendingEvent = null;
      const dur = { meteor: 14, sand: 18, storm: 18 }[pe.type];
      this.activeEvent = { type: pe.type, end: this.time + dur, dur };
      const info = {
        meteor: ['METEORITENSCHAUER', 'Türme können beschädigt werden'],
        sand: ['SANDSTURM', 'Reichweite der Türme sinkt um 25 %'],
        storm: ['ENERGIESTURM', 'Fähigkeiten laden doppelt so schnell'],
      }[pe.type];
      this.announce(info[0], info[1], pe.type === 'storm' ? 'good' : 'warn');
      this.emit({ t: 'event', type: pe.type });
    }
    const ev = this.activeEvent;
    if (!ev) return;
    if (this.time >= ev.end) { this.activeEvent = null; this.toast('Ereignis vorbei'); return; }
    if (ev.type === 'meteor') {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        this.eventTimer = rand(0.45, 0.8);
        let x, y;
        if (this.towers.length && Math.random() < 0.45) { const t = this.towers[(Math.random() * this.towers.length) | 0]; x = t.x + rand(-30, 30); y = t.y + rand(-30, 30); }
        else { x = rand(30, WORLD_W - 30); y = rand(30, WORLD_H - 30); }
        this.meteors.push({ x, y, t: 1.5, max: 1.5, r: 42 });
        sfx.play('meteor', this.pan(x));
      }
    }
  }

  updateFx(dt) {
    this.particles.update(dt);
    const dec = (arr) => { let w = 0; for (let i = 0; i < arr.length; i++) { const o = arr[i]; o.life -= dt; if (o.life > 0) arr[w++] = o; } arr.length = w; };
    dec(this.rails); dec(this.bolts); dec(this.rings); dec(this.flashes); dec(this.lights);
    let w = 0;
    for (let i = 0; i < this.texts.length; i++) { const o = this.texts[i]; o.life -= dt; o.y -= 30 * dt; if (o.life > 0) this.texts[w++] = o; }
    this.texts.length = w;
    if (this.texts.length > 40) this.texts.splice(0, this.texts.length - 40);
  }

  // ---------------------------------------------------------------- Ende & Wertung
  score() {
    const won = this.state === 'won';
    return Math.round((this.stats.creditsEarned + this.wave * 120 + this.stats.kills * 2 + (won ? 3000 + this.base.hp * 25 : 0)) * this.rules.scoreMul);
  }
  researchEarned() {
    if (this.mode !== 'expert') return 0;
    return Math.round((Math.floor(this.clearedUpTo / 2) + this.stats.bossKills * 2 + (this.state === 'won' ? 10 : 0)) * this.rules.scoreMul);
  }
  endGame(won) {
    if (this.state !== 'playing') return;
    this.state = won ? 'won' : 'lost';
    if (won) {
      sfx.play('victory');
      if (this.mode === 'standard') this.ach('win_std');
      if (this.mode === 'expert') this.ach('win_exp');
      if (this.mode === 'daily') this.ach('daily');
    } else {
      sfx.play('bigboom'); sfx.play('defeat');
      const b = this.base;
      for (let i = 0; i < 6; i++) this.particles.burst(b.x + rand(-30, 30), b.y + rand(-30, 30), 30, i % 2 ? C.red : C.orange, 300, 1.2, 10);
      this.rings.push({ x: b.x, y: b.y, r0: 20, r1: 400, life: 1.2, max: 1.2, color: '#ff3d5a', w: 10 });
      this.addShake(18);
    }
    this.emit({ t: 'end', won });
  }

  // ---------------------------------------------------------------- Speichern zwischen den Wellen
  canSave() { return this.state === 'playing' && this.wave > 0 && !this.spawnQueue.length && this.enemies.length === 0; }
  serialize() {
    const b = this.base;
    return {
      v: 1, mode: this.mode, difficulty: this.difficulty, endless: this.endless, daily: this.daily, mapDef: this.mapDef, research: [...this.res],
      wave: this.wave, cleared: this.clearedUpTo, credits: this.credits, energy: this.energy,
      base: { hp: b.hp, shield: b.shield, up: { ...b.up } },
      towers: this.towers.map(t => ({ type: t.type, tier: t.tier, x: t.x, y: t.y, mode: t.mode, spent: t.spent, kills: t.kills, dmg: t.dmg })),
      hero: this.hero ? { level: this.hero.level, xp: this.hero.xp } : null,
      stats: { ...this.stats, built: [...this.stats.built] }, savedAt: Date.now(),
    };
  }
  static fromSave(s, progress) {
    const g = new Game({ mode: s.mode, difficulty: s.difficulty || 'schwer', endless: s.endless, daily: s.daily, mapDef: s.mapDef, research: s.research, progress });
    g.events.length = 0;
    // Basis-Ausbau wiederherstellen
    const b = g.base;
    b.up = { armor: 0, shield: 0, cannon: 0, energy: 0, pulse: 0 };
    b.maxHp = g.rules.baseHp + (g.res.has('b2') ? 30 : 0); b.reduce = 0; b.shieldMax = 0;
    for (const k of Object.keys(s.base.up)) for (let i = 0; i < s.base.up[k]; i++) g.applyBaseUpgrade(k);
    b.hp = s.base.hp; b.shield = s.base.shield;
    for (const ts of s.towers) {
      g.credits = 1e9;
      const t = ts.x !== undefined ? g.build(ts.type, ts.x, ts.y) : g.build(ts.type, (ts.tx + 0.5) * TILE, (ts.ty + 0.5) * TILE);
      if (!t) continue;
      if (ts.tier !== '1') { t.tier = ts.tier; t.spec = towerSpec(t.type, ts.tier); t.maxHp = g.towerHp() * (1 + 0.15 * (tierLevel(ts.tier) - 1)); t.hp = t.maxHp; }
      t.mode = ts.mode; t.spent = ts.spent; t.kills = ts.kills; t.dmg = ts.dmg; t.hasFired = true;
    }
    g.recomputeAuras();
    g.credits = s.credits; g.energy = s.energy;
    g.wave = s.wave; g.clearedUpTo = s.cleared;
    g.nextWaveDef = g.wave < g.totalWaves ? makeWave(g.wave + 1, g.seed, g.rules, g.map.paths.length) : null;
    g.countdown = g.rules.countdown;
    if (g.hero && s.hero) { g.hero.level = s.hero.level; g.hero.xp = s.hero.xp; g.heroStats(); g.hero.hp = g.hero.maxHp; }
    Object.assign(g.stats, s.stats, { built: new Set(s.stats.built || []) });
    g.particles.clear(); g.rings.length = 0; g.texts.length = 0;
    g.events.length = 0;
    g.countdownPaused = true;
    return g;
  }
}

export { ENEMIES, ELITE_INFO, BASE_UPGRADE_ORDER };
