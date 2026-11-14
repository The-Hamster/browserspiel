// Frontbau (Kachelspiel): Nach jeder Welle eine von drei Karten wählen – Wegstück, Turm, Hindernis oder Spezialkarte.
// Alles liegt auf einem Quadratraster: ein Kästchen = ein Feld. Die Basis belegt 4 × 4 Kästchen, ein Turm eines.
import { COLS, ROWS, TOWERS, BIOMES } from './data.js';
import { mulberry32, hashString } from './util.js';

export const KW = COLS;
export const KH = ROWS;
export const KBASE = [22, 12];                  // Mitte der Basis (Kästchen-Ecke): belegt 20..23 × 10..13
// Bereich, in dem der Weg wachsen darf (Abstand zu Bergen und Schluchten)
export const KMIN_X = 5;
export const KMAX_X = KW - 6;
export const KMIN_Y = 5;
export const KMAX_Y = KH - 6;

// Reichweite in Kästchen (Stufe 3 +1)
export const KRANGE = { laser: 2, plasma: 2, rail: 3, emp: 1, rocket: 3, tesla: 1, drone: 2, shield: 1, radar: 2 };

// Wegstücke: F = geradeaus, L/R = abbiegen (jeder Schritt ein Kästchen)
export const PATH_CARDS = {
  gerade: { name: 'Gerades Stück', moves: ['F', 'F', 'F'], desc: 'Verlängert den Weg um 3 Kästchen.', rar: 0 },
  lang:   { name: 'Lange Gerade', moves: ['F', 'F', 'F', 'F', 'F'], desc: 'Verlängert den Weg um 5 Kästchen.', rar: 0 },
  links:  { name: 'Kurve links', moves: ['F', 'L', 'F', 'F'], desc: 'Biegt den Weg nach links ab.', rar: 0 },
  rechts: { name: 'Kurve rechts', moves: ['F', 'R', 'F', 'F'], desc: 'Biegt den Weg nach rechts ab.', rar: 0 },
  eckeL:  { name: 'Ecke links', moves: ['L', 'F'], desc: 'Kurzes Stück, sofort nach links.', rar: 0 },
  eckeR:  { name: 'Ecke rechts', moves: ['R', 'F'], desc: 'Kurzes Stück, sofort nach rechts.', rar: 0 },
  hakenL: { name: 'Haken links', moves: ['L', 'F', 'F', 'L', 'F'], desc: 'Kehrt den Weg nach links um – lange im Feuer.', rar: 0 },
  hakenR: { name: 'Haken rechts', moves: ['R', 'F', 'F', 'R', 'F'], desc: 'Kehrt den Weg nach rechts um – lange im Feuer.', rar: 0 },
  sumpf:  { name: 'Sumpfstück', moves: ['F', 'F', 'F'], tile: 'sumpf', desc: '3 Kästchen Sumpf: Gegner werden dort langsamer.', rar: 1 },
  glut:   { name: 'Glutstück', moves: ['F', 'F', 'F'], tile: 'glut', desc: '3 Kästchen Glut: Gegner verbrennen dort.', rar: 1 },
  abzw:   { name: 'Abzweigung', moves: ['F', 'F'], branch: true, desc: 'Der Weg teilt sich: ein zweiter Eingang entsteht.', rar: 2 },
};
export const SPECIAL_CARDS = {
  credits: { name: 'Nachschub', desc: 'Sofort Credits für Ausbauten.', unlock: 0, rar: 0 },
  risiko:  { name: 'Risiko', desc: 'Nächste Welle 40 % zäher – dafür doppelte Credits.', unlock: 0, rar: 1 },
  kristall:{ name: 'Energiekristall', desc: 'Belegt ein Kästchen. Türme direkt daneben +1 Kästchen Reichweite.', unlock: 1, rar: 1, place: true },
  orbital: { name: 'Orbitalladung', desc: 'Orbitalschlag sofort bereit und +50 Energie.', unlock: 2, rar: 1 },
  kern:    { name: 'Kernverstärkung', desc: 'Kern +15 maximale Leben und volle Heilung.', unlock: 4, rar: 1 },
  doppel:  { name: 'Doppelzug', desc: 'Du darfst gleich noch eine Karte wählen.', unlock: 8, rar: 2 },
};
export const RARITY = [
  { name: 'gewöhnlich', color: '#8a96ab' },
  { name: 'selten', color: '#4f9dff' },
  { name: 'episch', color: '#c084fc' },
];
// Turmkarten: freigeschaltet über die Zahl der Erfolge
export const TOWER_UNLOCK = { laser: 0, plasma: 0, rail: 0, emp: 0, rocket: 0, tesla: 0, radar: 0, drone: 3, shield: 6 };

export function unlockedCards(achCount) {
  const towers = Object.keys(TOWER_UNLOCK).filter(t => achCount >= TOWER_UNLOCK[t]);
  const specials = Object.keys(SPECIAL_CARDS).filter(k => achCount >= SPECIAL_CARDS[k].unlock);
  return { towers, specials };
}
export function cardRarity(c) {
  if (c.kind === 'path') return PATH_CARDS[c.id].rar;
  if (c.kind === 'tower') return c.tier === '3' ? 2 : c.tier === '2' ? 1 : 0;
  return SPECIAL_CARDS[c.id].rar;
}

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // rechts, unten, links, oben (im Uhrzeigersinn)
export const ckey = (x, y) => x + ',' + y;
export const cellCenter = (x, y) => ({ x: (x + 0.5) * 64, y: (y + 0.5) * 64 });

export function baseCells() {
  const [bx, by] = KBASE, out = [];
  for (let y = by - 2; y < by + 2; y++) for (let x = bx - 2; x < bx + 2; x++) out.push([x, y]);
  return out;
}
const inArea = (x, y) => x >= KMIN_X && y >= KMIN_Y && x <= KMAX_X && y <= KMAX_Y;

// Weg aus Kästchen: Baum mit Wurzel an der Basis; jede Spitze ist ein Eingang
export function startState() {
  const [bx, by] = KBASE;
  const y = by - 1;
  const cells = [];
  for (let i = 0; i < 6; i++) cells.push({ x: bx - 3 - i, y, p: i - 1 });
  return { cells, tips: [{ i: 5, dir: 2 }], tiles: {}, version: 0 };
}

// belegte Kästchen: Weg, Basis, dazu Türme und Kristalle (blocked)
export function occupied(state, blocked) {
  const s = new Set(blocked || []);
  for (const c of state.cells) s.add(ckey(c.x, c.y));
  for (const [x, y] of baseCells()) s.add(ckey(x, y));
  return s;
}

function walk(from, dir, moves, taken) {
  let x = from.x, y = from.y, d = dir;
  const out = [];
  for (const m of moves) {
    if (m === 'L') d = (d + 3) % 4; else if (m === 'R') d = (d + 1) % 4;
    x += DIRS[d][0]; y += DIRS[d][1];
    if (!inArea(x, y) || taken.has(ckey(x, y))) return null;
    taken.add(ckey(x, y));
    out.push([x, y]);
  }
  // der Eingang danach muss frei sein
  const ex = x + DIRS[d][0], ey = y + DIRS[d][1];
  if (ex < KMIN_X - 1 || ey < KMIN_Y - 1 || ex > KMAX_X + 1 || ey > KMAX_Y + 1 || taken.has(ckey(ex, ey))) return null;
  return { cells: out, dir: d };
}

// Neue Kästchen für ein Wegstück an Spitze `tip` (oder null, wenn es nicht passt)
export function pathCells(state, cardId, blocked, tip = 0) {
  const card = PATH_CARDS[cardId], T = state.tips[tip];
  if (!card || !T) return null;
  const taken = occupied(state, blocked);
  const from = state.cells[T.i];
  const main = walk(from, T.dir, card.moves, taken);
  if (!main) return null;
  if (card.branch) {
    if (state.tips.length >= 3) return null;
    // Abzweig zur Seite: erst links probieren, dann rechts
    for (const turn of ['L', 'R']) {
      const br = walk(from, T.dir, [turn, 'F', 'F'], new Set(taken));
      if (br) return { ...main, branch: br };
    }
    return null;
  }
  return main;
}

export function applyPath(state, res, cardId, tip = 0) {
  const card = PATH_CARDS[cardId], T = state.tips[tip];
  const add = (list, parent) => {
    let p = parent;
    for (const [x, y] of list) { state.cells.push({ x, y, p }); p = state.cells.length - 1; if (card.tile) state.tiles[ckey(x, y)] = card.tile; }
    return p;
  };
  const from = T.i;
  T.i = add(res.cells, from); T.dir = res.dir;
  if (res.branch) { const bi = add(res.branch.cells, from); state.tips.push({ i: bi, dir: res.branch.dir }); }
  state.version++;
}

// Kartendefinition aus dem Weg erzeugen
export function kachelDef(state, biome, crystals = []) {
  const cen = (x, y) => [x + 0.5, y + 0.5];
  const paths = state.tips.map(T => {
    const c = state.cells[T.i];
    const wps = [cen(c.x + DIRS[T.dir][0], c.y + DIRS[T.dir][1])];
    let i = T.i;
    while (i >= 0) { const n = state.cells[i]; wps.push(cen(n.x, n.y)); i = n.p; }
    const [bx, by] = KBASE;
    wps.push([bx - 1, by - 0.5]);
    return wps;
  });
  return {
    v: 4, id: 'kachel-' + state.version + '-' + crystals.length, name: (BIOMES[biome] || BIOMES.kristall).name, desc: 'Frontbau', custom: true, kachel: true, decoSeed: 'kachel-' + biome, biome,
    paths, base: KBASE.slice(), water: [], obstacles: crystals.map(([x, y]) => [x + 0.5, y + 0.5, 0.34, 'crystal']),
    kTiles: Object.entries(state.tiles).map(([k, t]) => { const [x, y] = k.split(',').map(Number); return [x, y, t]; }),
  };
}

// Drei Karten ziehen (fester Zufall je Runde, damit die Tagesrunde für alle gleich ist)
export function drawHand(seed, round, deck, state, blocked, extra = '') {
  const rng = mulberry32(hashString(seed + ':hand:' + round + extra));
  const valid = (id) => state.tips.some((_, ti) => pathCells(state, id, blocked, ti));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const hand = [];
  // erste Karte der Partie: drei verschiedene Türme zur Wahl
  if (round === 0 && !extra) {
    const pool = deck.towers.filter(t => t !== 'radar' && t !== 'shield');
    while (hand.length < 3 && pool.length) hand.push({ kind: 'tower', id: pool.splice(Math.floor(rng() * pool.length), 1)[0], tier: '1' });
    return hand;
  }
  const byRar = [[], [], []];
  for (const id of Object.keys(PATH_CARDS)) if (valid(id)) byRar[PATH_CARDS[id].rar].push({ kind: 'path', id });
  const pathAny = byRar.flat();
  const rollRar = () => { const r = rng(); return r < 0.05 + round * 0.002 ? 2 : r < 0.3 ? 1 : 0; };
  const card = () => {
    const rar = rollRar(), r = rng();
    if (r < 0.32) {
      const pool = byRar[rar].length ? byRar[rar] : pathAny;
      if (pool.length) return pick(pool);
    }
    if (r < 0.8 && deck.towers.length) return { kind: 'tower', id: pick(deck.towers), tier: ['1', '2', '3'][rar] };
    const sp = deck.specials.filter(k => SPECIAL_CARDS[k].rar === rar);
    if (sp.length) return { kind: 'special', id: pick(sp) };
    return { kind: 'tower', id: pick(deck.towers), tier: '1' };
  };
  // mindestens ein passendes Wegstück, solange es eins gibt
  const normal = byRar[0].length ? byRar[0] : pathAny;
  if (normal.length) hand.push(pick(normal));
  while (hand.length < 3) hand.push(card());
  for (let i = hand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [hand[i], hand[j]] = [hand[j], hand[i]]; }
  return hand;
}

export function cardTitle(c) {
  if (c.kind === 'path') return PATH_CARDS[c.id].name;
  if (c.kind === 'tower') return TOWERS[c.id].name + (c.tier === '3' ? ' (Stufe 3)' : c.tier === '2' ? ' (Stufe 2)' : '');
  return SPECIAL_CARDS[c.id].name;
}
export function cardDesc(c) {
  if (c.kind === 'path') return PATH_CARDS[c.id].desc;
  if (c.kind === 'tower') return `Reichweite ${KRANGE[c.id] + (c.tier === '3' ? 1 : 0)} Kästchen. Kostenlos bauen – oder auf einen gleichen Turm legen zum Aufrüsten.`;
  return SPECIAL_CARDS[c.id].desc;
}
