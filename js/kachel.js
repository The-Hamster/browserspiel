// Frontbau (Kachelspiel): Nach jeder Welle eine von drei Karten wählen – Wegstück, Turm oder Spezialkarte.
import { COLS, ROWS, TOWERS, BIOMES } from './data.js';
import { mulberry32, hashString } from './util.js';

export const KCELL = 2;                         // eine Kachel = 2 × 2 Felder
export const KW = Math.floor(COLS / KCELL);
export const KH = Math.floor(ROWS / KCELL);
export const KBASE = [11, 6];                   // Kachel des Reaktorkerns

// Wegstücke: F = geradeaus, L/R = abbiegen und ein Feld weiter
export const PATH_CARDS = {
  gerade: { name: 'Gerades Stück', moves: ['F', 'F'], desc: 'Verlängert den Weg um 2 Kacheln.' },
  lang:   { name: 'Lange Gerade', moves: ['F', 'F', 'F', 'F'], desc: 'Verlängert den Weg um 4 Kacheln.' },
  links:  { name: 'Kurve links', moves: ['F', 'L', 'F'], desc: 'Biegt den Weg nach links ab.' },
  rechts: { name: 'Kurve rechts', moves: ['F', 'R', 'F'], desc: 'Biegt den Weg nach rechts ab.' },
  eckeL:  { name: 'Ecke links', moves: ['L'], desc: 'Kurzes Stück, sofort nach links.' },
  eckeR:  { name: 'Ecke rechts', moves: ['R'], desc: 'Kurzes Stück, sofort nach rechts.' },
  hakenL: { name: 'Haken links', moves: ['L', 'F', 'L'], desc: 'Kehrt den Weg nach links um – sehr lang im Feuer.' },
  hakenR: { name: 'Haken rechts', moves: ['R', 'F', 'R'], desc: 'Kehrt den Weg nach rechts um – sehr lang im Feuer.' },
};
export const SPECIAL_CARDS = {
  credits: { name: 'Nachschub', desc: 'Sofort Credits für Ausbauten.', unlock: 0 },
  orbital: { name: 'Orbitalladung', desc: 'Orbitalschlag sofort bereit und +50 Energie.', unlock: 2 },
  kern:    { name: 'Kernverstärkung', desc: 'Kern +15 maximale Leben und volle Heilung.', unlock: 4 },
  doppel:  { name: 'Doppelzug', desc: 'Du darfst gleich noch eine Karte wählen.', unlock: 8 },
};
// Turmkarten: freigeschaltet über die Zahl der Erfolge
export const TOWER_UNLOCK = { laser: 0, plasma: 0, rail: 0, emp: 0, rocket: 0, tesla: 0, radar: 0, drone: 3, shield: 6 };

export function unlockedCards(achCount) {
  const towers = Object.keys(TOWER_UNLOCK).filter(t => achCount >= TOWER_UNLOCK[t]);
  const specials = Object.keys(SPECIAL_CARDS).filter(k => achCount >= SPECIAL_CARDS[k].unlock);
  return { towers, specials };
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // rechts, unten, links, oben (im Uhrzeigersinn)

// Neue Kacheln für ein Wegstück berechnen (oder null, wenn es nicht passt)
export function pathCells(state, cardId, towers) {
  const card = PATH_CARDS[cardId];
  let [x, y] = state.cells[state.cells.length - 1];
  let d = state.dir;
  const taken = new Set(state.cells.map(c => c[0] + ',' + c[1]));
  const out = [];
  for (const m of card.moves) {
    if (m === 'L') d = (d + 3) % 4; else if (m === 'R') d = (d + 1) % 4;
    x += DIRS[d][0]; y += DIRS[d][1];
    if (x < 2 || y < 2 || x > KW - 3 || y > KH - 3) return null;      // Abstand zur Grenze (Berge, Schluchten)
    const k = x + ',' + y;
    if (taken.has(k)) return null;
    taken.add(k);
    out.push([x, y]);
  }
  // Türme dürfen nicht im neuen Weg stehen (Abstand zu jedem neuen Wegabschnitt)
  const cen = (c) => [(c[0] * KCELL + 1) * 64, (c[1] * KCELL + 1) * 64];
  let prev = cen(state.cells[state.cells.length - 1]);
  for (const c of out) {
    const [bx, by] = cen(c), [ax, ay] = prev, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    for (const t of towers) {
      const k = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.y - ay) * dy) / l));
      if (Math.hypot(ax + dx * k - t.x, ay + dy * k - t.y) < 52) return null;
    }
    prev = [bx, by];
  }
  // der Eingang danach muss frei sein
  const ex = x + DIRS[d][0], ey = y + DIRS[d][1];
  if (ex < 2 || ey < 2 || ex > KW - 3 || ey > KH - 3 || taken.has(ex + "," + ey)) return null;
  return { cells: out, dir: d };
}

// Kartendefinition aus dem Weg erzeugen
export function kachelDef(state, biome) {
  const cen = ([cx, cy]) => [cx * KCELL + 1, cy * KCELL + 1];
  const last = state.cells[state.cells.length - 1];
  const entry = [last[0] + DIRS[state.dir][0], last[1] + DIRS[state.dir][1]];
  const wps = [cen(entry), ...state.cells.slice().reverse().map(cen)];
  return {
    v: 4, id: 'kachel-' + state.version, name: (BIOMES[biome] || BIOMES.kristall).name, desc: 'Frontbau', custom: true, kachel: true, decoSeed: 'kachel-' + biome, biome,
    paths: [wps], base: cen(state.cells[0]), water: [], obstacles: [],
  };
}

export function startState() {
  const [bx, by] = KBASE;
  return { cells: [[bx, by], [bx - 1, by], [bx - 2, by]], dir: 2, version: 0, round: 0 };
}

// Drei Karten ziehen (fester Zufall je Runde, damit die Tagesrunde für alle gleich ist)
export function drawHand(seed, round, deck, state, towers) {
  const rng = mulberry32(hashString(seed + ':hand:' + round));
  const pathIds = Object.keys(PATH_CARDS).filter(id => pathCells(state, id, towers));
  const hand = [];
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  // erste Karte der Partie: drei verschiedene Türme zur Wahl
  if (round === 0) {
    const pool = deck.towers.filter(t => t !== 'radar' && t !== 'shield');
    while (hand.length < 3 && pool.length) hand.push({ kind: 'tower', id: pool.splice(Math.floor(rng() * pool.length), 1)[0], tier: '1' });
    return hand;
  }
  // mindestens ein passendes Wegstück, solange es eins gibt
  if (pathIds.length) hand.push({ kind: 'path', id: pick(pathIds) });
  while (hand.length < 3) {
    const r = rng();
    if (r < 0.3 && pathIds.length) hand.push({ kind: 'path', id: pick(pathIds) });
    else if (r < 0.82 && deck.towers.length) {
      const type = pick(deck.towers);
      hand.push({ kind: 'tower', id: type, tier: rng() < 0.12 + round * 0.006 ? '2' : '1' });
    } else if (deck.specials.length) hand.push({ kind: 'special', id: pick(deck.specials) });
    else hand.push({ kind: 'tower', id: pick(deck.towers), tier: '1' });
  }
  // Reihenfolge mischen
  for (let i = hand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [hand[i], hand[j]] = [hand[j], hand[i]]; }
  return hand;
}

export function cardTitle(c) {
  if (c.kind === 'path') return PATH_CARDS[c.id].name;
  if (c.kind === 'tower') return TOWERS[c.id].name + (c.tier === '2' ? ' (Stufe 2)' : '');
  return SPECIAL_CARDS[c.id].name;
}
export function cardDesc(c) {
  if (c.kind === 'path') return PATH_CARDS[c.id].desc;
  if (c.kind === 'tower') return 'Kostenlos bauen – oder auf einen gleichen Turm legen, um ihn aufzurüsten.';
  return SPECIAL_CARDS[c.id].desc;
}
