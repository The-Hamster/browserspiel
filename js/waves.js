// Wellen-Generator und Regeln je Modus
import { ENEMIES, ENEMY_UNLOCK, DAILY_MODS, MAPS, TOWER_ORDER } from './data.js';
import { mulberry32, hashString, todayKey, clamp } from './util.js';

export function makeRules(mode, opts = {}) {
  const r = {
    mode, hpMul: mode === 'standard' ? 0.9 : 1, speedMul: 1, startCredits: 360, baseHp: 100, elite: false, eliteMul: 1, eliteRewardMul: 1,
    events: false, eventEvery: 0, hero: false, research: false, totalWaves: 30, countdown: 22,
    rewardMul: 1, countMul: 1, armorAdd: 0, towerDmgMul: 1, banned: [], mods: [], tutorial: mode === 'standard',
  };
  if (mode === 'expert' || mode === 'daily') {
    Object.assign(r, { hpMul: 1.3, speedMul: 1.08, startCredits: 250, baseHp: 80, elite: true, events: true, hero: true, countdown: 17, rewardMul: 0.95 });
    r.research = mode === 'expert';
  }
  if (mode === 'daily') {
    r.totalWaves = 20;
    for (const id of opts.mods || []) {
      r.mods.push(id);
      if (id === 'swarmy') { r.countMul *= 1.5; r.hpMul *= 0.7; }
      if (id === 'armored') r.armorAdd += 3;
      if (id === 'budget') { r.startCredits = Math.round(r.startCredits * 0.7); r.rewardMul *= 1.2; }
      if (id === 'glass') { r.baseHp = Math.round(r.baseHp * 0.5); r.towerDmgMul *= 1.25; }
      if (id === 'fast') r.speedMul *= 1.2;
      if (id === 'banned') r.banned = opts.banned || [];
      if (id === 'storms') r.eventEvery = 2;
      if (id === 'elite') { r.eliteMul = 2; r.eliteRewardMul = 1.3; }
    }
  }
  if (opts.endless) r.totalWaves = Infinity;
  return r;
}

export function dailyConfig(date = new Date()) {
  const key = todayKey(date);
  const seed = hashString('kernwacht-daily-' + key);
  const rng = mulberry32(seed);
  const map = MAPS[Math.floor(rng() * MAPS.length)];
  const pool = DAILY_MODS.map(m => m.id);
  const mods = [];
  while (mods.length < 2) {
    const m = pool[Math.floor(rng() * pool.length)];
    if (!mods.includes(m)) mods.push(m);
  }
  const banned = [];
  if (mods.includes('banned')) {
    const options = TOWER_ORDER.filter(t => t !== 'laser');
    while (banned.length < 3) {
      const t = options[Math.floor(rng() * options.length)];
      if (!banned.includes(t)) banned.push(t);
    }
  }
  return { key, seed, mapId: map.id, mods, banned };
}

export const hpScale = (w) => (1 + 0.1 * (w - 1) + 0.0088 * (w - 1) * (w - 1)) * (w > 30 ? Math.pow(1.05, w - 30) : 1);

// Liefert { groups, spawns:[{t,type,elite,path}], summary:{type:{n,elite}} }
export function makeWave(w, seed, rules, pathCount) {
  const rng = mulberry32(hashString(seed + ':w' + w));
  const avail = Object.keys(ENEMY_UNLOCK).filter(t => w >= ENEMY_UNLOCK[t]);
  let budget = (8 + 6 * w + 0.22 * w * w) * rules.countMul;
  const groups = [];
  const isBoss = w % 10 === 0;
  if (isBoss) {
    const n = 1 + Math.floor((w - 10) / 30);
    groups.push({ type: 'boss', count: n, spacing: 9, delay: 3 });
    budget *= 0.55;
  }
  const intro = Object.keys(ENEMY_UNLOCK).find(t => ENEMY_UNLOCK[t] === w && w > 1);
  const picks = [];
  if (intro) picks.push([intro, 0.55]);
  const extra = w < 3 ? 1 : rng() < 0.5 ? 2 : 3;
  for (let i = 0; i < extra; i++) {
    // neuere Typen etwas häufiger
    let t = avail[Math.floor(Math.pow(rng(), 0.8) * avail.length)];
    if (rng() < 0.25) t = 'swarm';
    picks.push([t, 1]);
  }
  const totalW = picks.reduce((s, p) => s + p[1], 0) || 1;
  let delay = isBoss ? 6 : 0;
  for (const [type, wgt] of picks) {
    const def = ENEMIES[type];
    const share = budget * (wgt / totalW);
    const count = Math.max(1, Math.round(share / def.cost));
    const spacing = Math.max(0.18, Math.min(def.spacing * (0.85 + rng() * 0.3), 16 / count));
    groups.push({ type, count, spacing, delay });
    delay += count * spacing * (0.45 + rng() * 0.3) + 1.5;
  }
  const eliteChance = rules.elite ? clamp((w - 5) * 0.028, 0, 0.42) * rules.eliteMul : 0;
  const spawns = [];
  const summary = {};
  let pathIdx = 0;
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      const elite = g.type !== 'boss' && rng() < eliteChance;
      const path = pathCount > 1 ? (rng() < 0.5 ? pathIdx++ % pathCount : Math.floor(rng() * pathCount)) : 0;
      spawns.push({ t: g.delay + i * g.spacing, type: g.type, elite, path });
      const s = summary[g.type] || (summary[g.type] = { n: 0, elite: 0 });
      s.n++; if (elite) s.elite++;
    }
  }
  spawns.sort((a, b) => a.t - b.t);
  // Ereignis für die Welle (Experte)
  let event = null;
  if (rules.events && w >= 5 && !isBoss) {
    const every = rules.eventEvery;
    const hit = every ? (w % every === 0) : rng() < 0.32;
    if (hit) event = ['meteor', 'sand', 'storm'][Math.floor(rng() * 3)];
  }
  return { w, groups, spawns, summary, isBoss, event, duration: spawns.length ? spawns[spawns.length - 1].t : 0 };
}
