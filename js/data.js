// Spieldaten: Türme, Gegner, Karten, Basis-Ausbau, Fähigkeiten, Forschung, Erfolge

export const TILE = 64;
export const COLS = 20;
export const ROWS = 14;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
// Neigung der Kamera: Boden wird gestaucht, Gebäude stehen aufrecht (leichte Seitenansicht)
export const TILT = 0.78;

export const GAME_TITLE = 'KERNWACHT';
export const VERSION = '1.0.5';

// ---------------------------------------------------------------- Türme
// Stufe '1' → '2' → Variante 'a' | 'b' | ('c' per Forschung). Werte vererben sich.
export const TOWERS = {
  laser: {
    name: 'Pulslaser', key: '1', color: '#36f1ff',
    desc: 'Schnell und günstig, aber schwach gegen Panzerung. Trifft Flieger.',
    tiers: {
      1: { cost: 60, kind: 'bolt', dmg: 6, rate: 4, range: 2.6, air: true, ground: true, projSpeed: 950 },
      2: { cost: 75, dmg: 10, rate: 4.6, range: 2.8 },
      a: { cost: 170, name: 'Dauerstrahl', desc: 'Ein Strahl, der immer heißer brennt, je länger er ein Ziel hält.', kind: 'beam', dps: 40, ramp: 3, rampTime: 2.2, range: 3 },
      b: { cost: 170, name: 'Fächerlaser', desc: 'Feuert auf bis zu 3 Ziele gleichzeitig.', dmg: 12, rate: 5, range: 3, multi: 3 },
      c: { cost: 230, name: 'Prismenlaser', desc: 'Drei brennende Strahlen auf einmal.', kind: 'beam', dps: 30, ramp: 2.5, rampTime: 2, range: 3.2, multi: 3, research: 'a2' },
    },
  },
  plasma: {
    name: 'Plasmawerfer', key: '2', color: '#ff6b3d',
    desc: 'Plasmakugeln mit Flächenschaden. Nur Bodenziele.',
    tiers: {
      1: { cost: 100, kind: 'shell', dmg: 22, rate: 0.8, range: 2.6, splash: 0.9, air: false, ground: true, projSpeed: 360 },
      2: { cost: 110, dmg: 38, rate: 0.85, range: 2.8, splash: 1.0 },
      a: { cost: 240, name: 'Sonnenkern', desc: 'Riesige Explosion, die Gegner nachbrennen lässt.', dmg: 85, rate: 0.7, splash: 1.35, burn: { dps: 14, dur: 3 } },
      b: { cost: 240, name: 'Streuplasma', desc: 'Die Kugel zerplatzt in 4 Splitterbomben.', dmg: 40, rate: 0.95, splash: 0.85, cluster: 4 },
    },
  },
  rail: {
    name: 'Schienenkanone', key: '3', color: '#dfe8ff',
    desc: 'Riesige Reichweite, durchschlägt mehrere Gegner in einer Linie.',
    tiers: {
      1: { cost: 140, kind: 'rail', dmg: 70, rate: 0.42, range: 4.6, pierce: 2, air: true, ground: true },
      2: { cost: 150, dmg: 120, rate: 0.46, range: 5, pierce: 3 },
      a: { cost: 320, name: 'Ionenlanze', desc: 'Durchschlägt alles in der Schusslinie.', dmg: 200, range: 5.6, pierce: 99 },
      b: { cost: 320, name: 'Präzisionsschuss', desc: 'Ignoriert Panzerung, 25 % Chance auf dreifachen Schaden.', dmg: 300, rate: 0.5, range: 6.8, pierce: 1, crit: 0.25, critMul: 3, pierceArmor: true },
      c: { cost: 380, name: 'Gauss-Doppellauf', desc: 'Zwei schnelle Durchschlagsschüsse pro Salve.', dmg: 170, rate: 0.55, range: 5.4, pierce: 4, shots: 2, research: 'a3' },
    },
  },
  emp: {
    name: 'EMP-Turm', key: '4', color: '#7d7bff',
    desc: 'Pulse verlangsamen alle Gegner in der Nähe und zerstören Schilde.',
    tiers: {
      1: { cost: 90, kind: 'pulse', dmg: 4, rate: 0.65, range: 2.0, slow: 0.35, slowDur: 1.6, shieldDmg: 30, air: true, ground: true },
      2: { cost: 100, dmg: 7, slow: 0.45, shieldDmg: 60, range: 2.3 },
      a: { cost: 220, name: 'Stasisfeld', desc: 'Starke Verlangsamung, jeder 3. Puls friert Gegner kurz ein.', slow: 0.6, range: 2.6, freezeEvery: 3, freezeDur: 0.7 },
      b: { cost: 220, name: 'Überlast', desc: 'Zerfetzt Schilde und schwächt die Panzerung.', shieldDmg: 200, dmg: 28, shred: 3, shredDur: 4 },
    },
  },
  rocket: {
    name: 'Raketenwerfer', key: '5', color: '#ffcf3a',
    desc: 'Zielsuchende Raketen. Doppelt stark gegen Flieger.',
    tiers: {
      1: { cost: 120, kind: 'missile', dmg: 30, rate: 0.9, range: 3.5, splash: 0.5, airMul: 2.5, air: true, ground: true, projSpeed: 430 },
      2: { cost: 120, dmg: 50, rate: 1.0, range: 3.8 },
      a: { cost: 260, name: 'Schwarmraketen', desc: 'Feuert 4 Raketen pro Salve.', dmg: 34, missiles: 4, rate: 0.9 },
      b: { cost: 260, name: 'Flakbatterie', desc: 'Nur gegen Flieger – dafür vernichtend.', dmg: 120, rate: 1.6, range: 4.2, airMul: 3, ground: false },
    },
  },
  tesla: {
    name: 'Bogenspule', key: '6', color: '#c9a7ff',
    desc: 'Blitze springen von Gegner zu Gegner.',
    tiers: {
      1: { cost: 130, kind: 'chain', dmg: 18, rate: 1.0, range: 2.4, chains: 3, chainRange: 1.7, falloff: 0.85, air: true, ground: true },
      2: { cost: 130, dmg: 30, chains: 4 },
      a: { cost: 280, name: 'Gewitterkrone', desc: 'Der Blitz springt auf bis zu 8 Ziele.', dmg: 40, chains: 8 },
      b: { cost: 280, name: 'Überspannung', desc: 'Lähmt getroffene Gegner kurz.', dmg: 55, chains: 4, stun: 0.5 },
      c: { cost: 340, name: 'Kugelblitz', desc: 'Schneller, stärker, lähmend.', dmg: 70, chains: 6, stun: 0.3, rate: 1.15, research: 'a4' },
    },
  },
  drone: {
    name: 'Drohnenhangar', key: '7', color: '#5dffb0',
    desc: 'Kampfdrohnen jagen Gegner im Umkreis.',
    tiers: {
      1: { cost: 150, kind: 'drones', drones: 2, dmg: 8, rate: 2, range: 3.4, air: true, ground: true },
      2: { cost: 150, drones: 3, dmg: 12 },
      a: { cost: 300, name: 'Jägerstaffel', desc: '5 schnelle Jagddrohnen.', drones: 5, dmg: 15, rate: 2.5 },
      b: { cost: 300, name: 'Bomberdrohnen', desc: 'Drohnen werfen Bomben mit Flächenschaden (nur Boden).', drones: 3, dmg: 48, rate: 0.8, bomb: true, splash: 0.8, air: false },
    },
  },
  shield: {
    name: 'Schildgenerator', key: '8', color: '#4f9dff',
    desc: 'Schützt benachbarte Türme mit einem Energieschild.',
    tiers: {
      1: { cost: 110, kind: 'shieldgen', range: 1.6, shieldCap: 60, shieldRegen: 6 },
      2: { cost: 110, shieldCap: 120, shieldRegen: 12 },
      a: { cost: 240, name: 'Bollwerk', desc: 'Sehr starke Schilde mit größerem Radius.', shieldCap: 300, shieldRegen: 20, range: 2.3 },
      b: { cost: 240, name: 'Resonanzfeld', desc: 'Schilde plus 15 % schnelleres Feuern für Nachbarn.', shieldCap: 150, shieldRegen: 15, rateBuff: 0.15 },
    },
  },
  radar: {
    name: 'Radarmast', key: '9', color: '#66ffcc',
    desc: 'Scanner: macht getarnte Gegner sichtbar. Ab Stufe 2 mehr Reichweite für Nachbarn.',
    tiers: {
      1: { cost: 80, kind: 'radar', range: 3, auraRange: 1.6 },
      2: { cost: 80, range: 3.8, rangeBuff: 0.1 },
      a: { cost: 180, name: 'Tiefenscan', desc: 'Riesiger Scanbereich, erkannte Gegner nehmen 15 % mehr Schaden.', range: 5, markDmg: 0.15 },
      b: { cost: 180, name: 'Zielrechner', desc: 'Nachbartürme: +15 % Schaden und Reichweite.', rangeBuff: 0.15, dmgBuff: 0.15 },
    },
  },
};
export const TOWER_ORDER = ['laser', 'plasma', 'rail', 'emp', 'rocket', 'tesla', 'drone', 'shield', 'radar'];
// Bauform: Grundriss, Radius, Höhe (Weltpixel), Kopfhöhe
export const TOWER_LOOK = {
  laser:  { shape: 'hex',     R: 13, H: 30, wall: '#2e3a4a' },
  plasma: { shape: 'round',   R: 16, H: 17, wall: '#3a3330' },
  rail:   { shape: 'rect',    R: 15, H: 14, wall: '#33373f' },
  emp:    { shape: 'tiers',   R: 15, H: 28, wall: '#2c2c48' },
  rocket: { shape: 'square',  R: 13, H: 25, wall: '#383a2c' },
  tesla:  { shape: 'round',   R: 10, H: 44, wall: '#3a2f2a' },
  drone:  { shape: 'oct',     R: 17, H: 13, wall: '#2b3a34' },
  shield: { shape: 'diamond', R: 12, H: 36, wall: '#2a3450' },
  radar:  { shape: 'mast',    R: 9,  H: 54, wall: '#2c3a38' },
};
// Kombi-Effekte: Turm A in der Nähe von Turm B (Abstand in Feldern)
export const COMBOS = [
  { id: 'netz', a: 'tesla', b: 'emp', name: 'Überladungsnetz', desc: 'Bogenspule neben EMP-Turm: Blitze springen 2 Ziele weiter.' },
  { id: 'ziel', a: 'rail', b: 'radar', name: 'Zielerfassung', desc: 'Schienenkanone neben Radarmast: 15 % mehr Schaden.' },
  { id: 'brand', a: 'plasma', b: 'rocket', name: 'Brandteppich', desc: 'Plasmawerfer neben Raketenwerfer: 25 % größere Explosionen.' },
  { id: 'relais', a: 'drone', b: 'shield', name: 'Drohnenrelais', desc: 'Drohnenhangar neben Schildgenerator: eine Drohne mehr.' },
];
export const COMBO_RANGE = 2.2;
// Erfahrung der Türme
export const VET_RANKS = [
  { kills: 25, name: 'Veteran', dmg: 0.05, range: 0 },
  { kills: 75, name: 'Elite', dmg: 0.1, range: 0 },
  { kills: 200, name: 'Legende', dmg: 0.15, range: 0.05 },
];
export const TOWER_HP = 100;

export function towerSpec(type, tier) {
  const t = TOWERS[type].tiers;
  const s = Object.assign({}, t[1]);
  if (tier !== '1') Object.assign(s, t[2]);
  if (tier !== '1' && tier !== '2') Object.assign(s, t[tier]);
  delete s.cost;
  s.cost = t[tier].cost;
  s.tierName = tier === '1' || tier === '2' ? TOWERS[type].name : t[tier].name;
  return s;
}
export function tierLevel(tier) { return tier === '1' ? 1 : tier === '2' ? 2 : 3; }

// ---------------------------------------------------------------- Gegner
export const ENEMIES = {
  swarm:    { name: 'Schwärmer', hp: 28, speed: 80, armor: 0, reward: 3, dmg: 1, r: 9, color: '#8dff5a', cost: 1, spacing: 0.33, desc: 'Viele, schnell, schwach.' },
  tank:     { name: 'Belagerer', hp: 240, speed: 32, armor: 5, reward: 15, dmg: 4, r: 17, color: '#ff9a3c', cost: 7, spacing: 1.7, shoot: { dmg: 8, cd: 3, range: 2.1 }, desc: 'Langsam, gepanzert, beschießt Türme.' },
  shield:   { name: 'Schildträger', hp: 110, shield: 110, speed: 44, armor: 1, reward: 12, dmg: 2, r: 14, color: '#4fc3ff', cost: 5, spacing: 1.1, desc: 'Trägt ein Schild. EMP hilft.' },
  phantom:  { name: 'Phantom', hp: 75, speed: 62, armor: 0, reward: 11, dmg: 2, r: 12, color: '#c58bff', cost: 4, spacing: 0.9, cloak: true, desc: 'Getarnt – nur mit Radarmast sichtbar.' },
  flyer:    { name: 'Gleiter', hp: 65, speed: 58, armor: 0, reward: 9, dmg: 2, r: 13, color: '#ffe14d', cost: 3, spacing: 0.9, air: true, desc: 'Fliegt direkt zum Kern.' },
  splitter: { name: 'Teiler', hp: 140, speed: 42, armor: 0, reward: 10, dmg: 2, r: 16, color: '#ff4fa0', cost: 5, spacing: 1.2, split: { type: 'mite', n: 3 }, desc: 'Zerfällt in kleine Splitterlinge.' },
  mite:     { name: 'Splitterling', hp: 26, speed: 86, armor: 0, reward: 2, dmg: 1, r: 7, color: '#ff8cc6', cost: 1, spacing: 0.3 },
  boss:     { name: 'Schwarmträger', hp: 2000, shield: 400, speed: 20, armor: 3, reward: 250, dmg: 30, r: 36, color: '#ff3d6e', cost: 60, spacing: 8, boss: true, spawn: { type: 'swarm', cd: 4.5, n: 3 }, shoot: { dmg: 14, cd: 4.5, range: 2.8, charge: 1.1 }, desc: 'Riesiges Mutterschiff. EMP zerstört sein Schild.' },
  boss2:    { name: 'Maschinenkoloss', hp: 2600, shield: 0, speed: 17, armor: 6, reward: 300, dmg: 35, r: 34, color: '#ffb02e', cost: 60, spacing: 8, boss: true, jam: { cd: 7, range: 2.6, dur: 3 }, desc: 'Schwerer Kampfläufer. Sein Störimpuls legt Türme in der Nähe kurz lahm.' },
};
// Tipps für das Gegner-Lexikon
export const ENEMY_TIPS = {
  swarm: { strong: 'Kommen in großer Zahl.', weak: 'Flächenschaden: Plasmawerfer, Bogenspule.' },
  tank: { strong: 'Dicke Panzerung, beschießt Türme.', weak: 'Starke Einzeltreffer: Schienenkanone, Plasma. EMP-Überlast schwächt die Panzerung.' },
  shield: { strong: 'Energieschild schluckt Schaden.', weak: 'EMP-Turm zerstört Schilde sofort.' },
  phantom: { strong: 'Unsichtbar für Türme.', weak: 'Radarmast in der Nähe des Weges.' },
  flyer: { strong: 'Fliegt direkt zum Kern, ignoriert den Weg.', weak: 'Raketenwerfer (doppelter Schaden), Laser, Drohnen.' },
  splitter: { strong: 'Zerfällt in mehrere Splitterlinge.', weak: 'Flächenschaden am Ende des Weges.' },
  mite: { strong: 'Sehr schnell.', weak: 'Bogenspule und Laser.' },
  boss: { strong: 'Riesig, setzt Schwärmer ab, beschießt Türme.', weak: 'EMP gegen das Schild, Orbitalschlag, Zeitverzerrung.' },
  boss2: { strong: 'Sehr zäh, legt Türme mit Störimpulsen lahm.', weak: 'Türme mit großer Reichweite weit vom Weg, Schienenkanone, Orbitalschlag.' },
};
export const ENEMY_UNLOCK = { swarm: 1, tank: 3, flyer: 4, shield: 5, splitter: 6, phantom: 7 };
export const ELITE_INFO = {
  swarm: 'Elite: deutlich schneller.',
  tank: 'Elite: repariert sich selbst.',
  shield: 'Elite: schützt Nachbarn mit Schilden.',
  phantom: 'Elite: springt plötzlich nach vorn.',
  flyer: 'Elite: wirft Bomben auf Türme.',
  splitter: 'Elite: zerfällt in 5 Teile.',
  mite: 'Elite: zäher.',
};

// ---------------------------------------------------------------- Basis
export const BASE = { hp: 100, cannon: { dmg: 14, rate: 1.2, range: 3 }, scan: 2.2, energyIncome: 1, energyMax: 150 };
export const BASE_UPGRADES = {
  armor: {
    name: 'Panzerung', desc: 'Mehr Lebenspunkte. Ab Stufe 3 weniger Schaden.',
    levels: [{ cost: 100, hp: 40 }, { cost: 180, hp: 40 }, { cost: 280, hp: 50, reduce: 0.1 }, { cost: 400, hp: 60, reduce: 0.1 }],
  },
  shield: {
    name: 'Energieschild', desc: 'Fängt Treffer ab und lädt sich nach kurzer Zeit wieder auf.',
    levels: [{ cost: 150, cap: 40, regen: 4 }, { cost: 220, cap: 80, regen: 6 }, { cost: 320, cap: 130, regen: 9 }, { cost: 450, cap: 200, regen: 13 }],
  },
  cannon: {
    name: 'Kernkanone', desc: 'Der Reaktor schießt stärker, schneller und weiter.',
    levels: [{ cost: 120, mul: 1.7, range: 3.4, rate: 1.4 }, { cost: 200, mul: 2.8, range: 3.8, rate: 1.6 }, { cost: 320, mul: 4.4, range: 4.2, rate: 1.9 }, { cost: 460, mul: 6.5, range: 4.7, rate: 2.3, twin: true }],
  },
  energy: {
    name: 'Energiefluss', desc: 'Mehr Energie pro Sekunde für Spezialfähigkeiten.',
    levels: [{ cost: 120, income: 0.5 }, { cost: 200, income: 0.5 }, { cost: 320, income: 0.7 }],
  },
  pulse: {
    name: 'Notfall-Pulswelle', desc: 'Schaltet die Fähigkeit Pulswelle frei: Druckwelle um den Kern.',
    levels: [{ cost: 200, dmg: 220, radius: 4, cd: 50 }, { cost: 300, dmg: 380, radius: 4.8, cd: 42 }, { cost: 420, dmg: 600, radius: 5.6, cd: 34 }],
  },
};
export const BASE_UPGRADE_ORDER = ['armor', 'shield', 'cannon', 'energy', 'pulse'];

// ---------------------------------------------------------------- Fähigkeiten
export const ABILITIES = {
  orbital: { name: 'Orbitalschlag', key: 'Q', energy: 50, cd: 30, color: '#ff5a3a', desc: 'Ein Strahl aus dem All trifft eine Stelle deiner Wahl.' },
  warp:    { name: 'Zeitverzerrung', key: 'W', energy: 40, cd: 40, dur: 6, color: '#8a7dff', desc: 'Alle Gegner werden 6 Sekunden lang halb so schnell.' },
  repair:  { name: 'Reparaturdrohnen', key: 'E', energy: 35, cd: 35, color: '#5dffb0', desc: 'Repariert Kern und alle Türme.' },
  pulse:   { name: 'Pulswelle', key: 'R', energy: 60, cd: 50, color: '#36f1ff', desc: 'Druckwelle um den Kern. Ausbau der Basis nötig.' },
};
export const ABILITY_ORDER = ['orbital', 'warp', 'repair', 'pulse'];

// ---------------------------------------------------------------- Kommandant
export const HERO = {
  name: 'Kommandant', hp: 220, hpLvl: 40, dmg: 14, dmgLvl: 5, rate: 2.5, range: 2.3, speed: 125, maxLevel: 10,
  abilities: [
    { id: 'grenade', name: 'Schockgranate', key: 'Y', cd: 14, desc: 'Explosion, die Gegner kurz lähmt.' },
    { id: 'overdrive', name: 'Überladung', key: 'X', cd: 32, dur: 8, desc: 'Türme in der Nähe feuern 50 % schneller.' },
  ],
};
export const heroXpNeed = (lvl) => Math.round(45 * Math.pow(lvl, 1.55));

// ---------------------------------------------------------------- Forschung (Advance)
export const RESEARCH = [
  { id: 'a1', branch: 0, name: 'Verstärkte Rahmen', cost: 2, req: [], desc: 'Türme haben 25 % mehr Lebenspunkte.' },
  { id: 'a2', branch: 0, name: 'Prismenlaser', cost: 4, req: ['a1'], desc: 'Neue Variante für den Pulslaser.' },
  { id: 'a3', branch: 0, name: 'Gauss-Doppellauf', cost: 5, req: ['a1'], desc: 'Neue Variante für die Schienenkanone.' },
  { id: 'a4', branch: 0, name: 'Kugelblitz', cost: 5, req: ['a1'], desc: 'Neue Variante für die Bogenspule.' },
  { id: 'a5', branch: 0, name: 'Präzisionsoptik', cost: 6, req: ['a2', 'a3'], desc: 'Alle Türme +8 % Reichweite.' },
  { id: 'b1', branch: 1, name: 'Startkapital', cost: 2, req: [], desc: '+60 Credits zu Beginn.' },
  { id: 'b2', branch: 1, name: 'Reaktorpanzer', cost: 3, req: ['b1'], desc: 'Kern startet mit 30 Lebenspunkten mehr.' },
  { id: 'b3', branch: 1, name: 'Effizienter Kern', cost: 4, req: ['b1'], desc: '25 % mehr Energie-Einkommen.' },
  { id: 'b4', branch: 1, name: 'Vorgeladenes Schild', cost: 5, req: ['b2'], desc: 'Energieschild Stufe 1 ab Start.' },
  { id: 'b5', branch: 1, name: 'Recycling', cost: 4, req: ['b1'], desc: 'Verkaufen bringt 85 % statt 70 % zurück.' },
  { id: 'c1', branch: 2, name: 'Feldtraining', cost: 2, req: [], desc: 'Kommandant startet auf Stufe 3.' },
  { id: 'c2', branch: 2, name: 'Orbitalkalibrierung', cost: 4, req: ['c1'], desc: 'Orbitalschlag: 25 % mehr Schaden, kürzere Abklingzeit.' },
  { id: 'c3', branch: 2, name: 'Chrono-Spule', cost: 4, req: ['c1'], desc: 'Zeitverzerrung hält 3 Sekunden länger.' },
  { id: 'c4', branch: 2, name: 'Drohnenwartung', cost: 3, req: ['c1'], desc: 'Reparaturdrohnen kosten 15 Energie weniger.' },
  { id: 'c5', branch: 2, name: 'Kommando-Schnittstelle', cost: 6, req: ['c2'], desc: 'Fähigkeiten des Kommandanten laden 30 % schneller.' },
];
export const RESEARCH_BRANCHES = ['Arsenal', 'Basis', 'Kommando'];

// ---------------------------------------------------------------- Erfolge
export const ACHIEVEMENTS = [
  { id: 'first_wave', name: 'Erster Kontakt', desc: 'Überstehe die erste Welle.' },
  { id: 'wave10', name: 'Feuertaufe', desc: 'Erreiche Welle 10 in einem Spiel.' },
  { id: 'boss1', name: 'Kolossbrecher', desc: 'Besiege einen Schwarmträger.' },
  { id: 'win_std', name: 'Stationsretter', desc: 'Gewinne eine Partie im Standard-Modus.' },
  { id: 'win_exp', name: 'Veteran von Veyra', desc: 'Gewinne eine Partie im Advance-Modus.' },
  { id: 'builder', name: 'Ingenieurin des Jahres', desc: 'Baue 20 Türme in einem Spiel.' },
  { id: 'variant', name: 'Spezialist', desc: 'Rüste einen Turm auf eine Variante auf.' },
  { id: 'base_max', name: 'Festung', desc: 'Baue einen Zweig des Kerns komplett aus.' },
  { id: 'kills1000', name: 'Schwarmvernichter', desc: 'Besiege insgesamt 1.000 Gegner.' },
  { id: 'flawless', name: 'Unberührt', desc: 'Erreiche Welle 10 ohne Schaden am Kern.' },
  { id: 'hasty', name: 'Ungeduldig', desc: 'Starte 10 Wellen in einem Spiel früher.' },
  { id: 'orbital10', name: 'Orbitale Präzision', desc: 'Triff 10 Gegner mit einem einzigen Orbitalschlag.' },
  { id: 'mapper', name: 'Kartograf', desc: 'Speichere eine eigene Karte.' },
  { id: 'hero10', name: 'Legendärer Kommandant', desc: 'Bringe den Kommandanten auf Stufe 10.' },
  { id: 'daily', name: 'Tagesgeschäft', desc: 'Schließe eine tägliche Herausforderung ab.' },
  { id: 'research5', name: 'Forschungsleitung', desc: 'Schalte 5 Forschungen frei.' },
  { id: 'chain6', name: 'Kettenreaktion', desc: 'Ein Blitz trifft 6 Gegner auf einmal.' },
  { id: 'rich', name: 'Großverdiener', desc: 'Verdiene 5.000 Credits in einem Spiel.' },
  { id: 'endless40', name: 'Ohne Ende', desc: 'Erreiche Welle 40 im Endlos-Modus.' },
  { id: 'all_towers', name: 'Volles Arsenal', desc: 'Baue alle 9 Turmarten in einem Spiel.' },
];

// ---------------------------------------------------------------- Tagesregeln
export const DAILY_MODS = [
  { id: 'swarmy', name: 'Dichte Schwärme', desc: '50 % mehr Gegner, dafür 30 % weniger Lebenspunkte.' },
  { id: 'armored', name: 'Gepanzert', desc: 'Alle Gegner haben +3 Panzerung.' },
  { id: 'budget', name: 'Sparhaushalt', desc: '30 % weniger Start-Credits, 20 % mehr Beute.' },
  { id: 'glass', name: 'Glaskanone', desc: 'Kern hat halbe Lebenspunkte, Türme machen 25 % mehr Schaden.' },
  { id: 'fast', name: 'Hyperantrieb', desc: 'Gegner sind 20 % schneller.' },
  { id: 'banned', name: 'Eingeschränktes Arsenal', desc: '3 zufällige Turmarten sind gesperrt.' },
  { id: 'storms', name: 'Sturmfront', desc: 'Karten-Ereignisse jede zweite Welle.' },
  { id: 'elite', name: 'Elitejagd', desc: 'Doppelt so viele Elite-Gegner, 30 % mehr Beute von ihnen.' },
];

// ---------------------------------------------------------------- Landschaften
export const BIOMES = {
  wueste:    { name: 'Glutwüste',     ground: '#3b2217', ground2: '#5b3622', dark: '#1f110a', road: '#8c6446', roadEdge: '#4a2e1d', water: '#ff5a1e', water2: '#ffb347', waterGlow: true,  accent: '#ff8a4a', lane: '#ffb15a', rock: '#6e4632', crystal: '#ffae4a', plant: '#b85c2a', plant2: '#e08a3a' },
  eis:       { name: 'Frostebene',    ground: '#24323f', ground2: '#3d5566', dark: '#141c25', road: '#9fb2bf', roadEdge: '#4f6272', water: '#7fd8ff', water2: '#e6fbff', waterGlow: false, accent: '#46e0ff', lane: '#9cf3ff', rock: '#5b6b7b', crystal: '#9ff6ff', plant: '#7aa6bf', plant2: '#d8f2ff' },
  kristall:  { name: 'Kristallfeld',  ground: '#1f1734', ground2: '#35275a', dark: '#100b1e', road: '#5e5175', roadEdge: '#2b2142', water: '#b04aff', water2: '#f0b8ff', waterGlow: true,  accent: '#b98aff', lane: '#d8bcff', rock: '#463a62', crystal: '#d18cff', plant: '#7a4ab8', plant2: '#ff7ad8' },
  asche:     { name: 'Aschewüste',    ground: '#27221f', ground2: '#3b342f', dark: '#120f0d', road: '#5d5550', roadEdge: '#2a2420', water: '#ff4a1a', water2: '#ffc24a', waterGlow: true,  accent: '#ff6a3a', lane: '#ffa070', rock: '#4c4642', crystal: '#ff7a4a', plant: '#6a3a2a', plant2: '#d0682a' },
  sumpf:     { name: 'Nebelsumpf',    ground: '#14231f', ground2: '#213f38', dark: '#091311', road: '#5c6b5c', roadEdge: '#29332b', water: '#2fe6c0', water2: '#c4fff0', waterGlow: true,  accent: '#3affd0', lane: '#a0ffe8', rock: '#3b4b47', crystal: '#5affe0', plant: '#2a6a5a', plant2: '#7affd0' },
  dschungel: { name: 'Giftdschungel', ground: '#18291a', ground2: '#2b4627', dark: '#0b150b', road: '#6e5d3c', roadEdge: '#352c1b', water: '#6aff3a', water2: '#d8ff9a', waterGlow: true,  accent: '#7dff6a', lane: '#c4ff8a', rock: '#3d4a36', crystal: '#7dffa8', plant: '#2f6e2a', plant2: '#6fbf3a' },
};
export const BIOME_ORDER = ['wueste', 'eis', 'kristall', 'dschungel', 'asche', 'sumpf'];

// ---------------------------------------------------------------- Karten
// Wegpunkte in Feld-Einheiten (frei, auch Kommazahlen). Ecken werden automatisch rund.
// water: Flüsse/Seen, obstacles: Hindernisse (x, y, Radius, Art). Gebaut wird frei überall, wo Platz ist.
export const MAPS = [
  {
    id: 'krater', v: 3, name: 'Kraterpass', biome: 'wueste', desc: 'Ein langer, gewundener Weg durch den Glutkrater. Ideal zum Einstieg.',
    paths: [[[-1.2, 2.5], [3, 2.5], [4.5, 4], [4.6, 9.5], [6, 11.2], [8.5, 11.3], [10, 9.8], [10, 5], [11.5, 3], [14, 2.8], [15.8, 4.2], [16, 8], [17.2, 10.2]]],
    base: [17.2, 10.2],
    water: [{ pts: [[10.5, 14.8], [12, 13.1], [14.5, 12.8], [17, 13.4], [20.8, 12.9]], w: 0.9 }],
    obstacles: [[7.3, 6.5, 0.7, 'rock'], [1.6, 8, 0.6, 'rock'], [13, 6.5, 0.55, 'crystal'], [7.5, 2, 0.5, 'crystal']],
  },
  {
    id: 'zwilling', v: 3, name: 'Zwillingsschlucht', biome: 'eis', desc: 'Zwei Angriffswege über die Frostebene, die sich vor dem Kern vereinen.',
    paths: [
      [[-1.2, 2], [3.5, 2], [6, 3.2], [7.5, 5.6], [9.8, 7], [17, 7]],
      [[-1.2, 12], [4, 12], [7, 11], [8.8, 8.6], [10.5, 7.2], [12.5, 7], [17, 7]],
    ],
    base: [17, 7],
    water: [{ pts: [[3.6, -0.8], [3, 3.8], [1.4, 6.4], [-0.8, 7.4]], w: 0.85 }],
    obstacles: [[12.5, 3.5, 0.6, 'crystal'], [14, 11, 0.7, 'rock'], [5.2, 7.2, 0.55, 'tree']],
  },
  {
    id: 'spirale', v: 3, name: 'Spiralkern', biome: 'kristall', desc: 'Ein langer Spiralweg ins Zentrum. Lange Wege, wenig Platz.',
    paths: [[[20.8, 1.3], [1.4, 1.3], [1.4, 12.6], [18.4, 12.6], [18.4, 4.2], [4.6, 4.2], [4.6, 9.6], [14.8, 9.6], [14.8, 7.2], [11.8, 7.2]]],
    base: [11.8, 7.2],
    water: [],
    obstacles: [[7.6, 6.6, 0.5, 'crystal'], [16.6, 8.2, 0.5, 'crystal']],
  },
  {
    id: 'gabel', v: 3, name: 'Toxische Gabelung', biome: 'dschungel', desc: 'Der Weg teilt sich um einen Giftsee – die Gegner wählen zufällig eine Route.',
    paths: [
      [[-1.2, 7], [2.4, 7], [4, 3.8], [7, 2], [12, 2], [15, 3.2], [16.4, 6.2], [18, 7]],
      [[-1.2, 7], [2.4, 7], [4, 10.2], [7, 12], [12, 12], [15, 10.8], [16.4, 7.8], [18, 7]],
    ],
    base: [18, 7],
    water: [{ pts: [[6.6, 6.6], [9.5, 7.6], [12.6, 6.8]], w: 1.8 }],
    obstacles: [[1.3, 2.5, 0.7, 'tree'], [1.5, 11.5, 0.7, 'tree'], [18.4, 2, 0.6, 'tree'], [18.2, 12, 0.65, 'tree']],
  },
  {
    id: 'serpentine', v: 3, name: 'Aschenserpentine', biome: 'asche', desc: 'Der längste Weg: vier Bahnen in Schlangenlinien quer durch die Aschewüste.',
    paths: [[[-1.2, 1.5], [17.5, 1.5], [18.6, 2.5], [18.6, 3.9], [17.5, 4.9], [2.5, 4.9], [1.4, 5.9], [1.4, 7.3], [2.5, 8.3], [17.5, 8.3], [18.6, 9.3], [18.6, 10.7], [17.5, 11.7], [6.2, 11.7]]],
    base: [6.2, 11.7],
    water: [{ pts: [[-0.8, 10.6], [1.8, 11.3], [3, 14.8]], w: 0.8 }],
    obstacles: [[9, 3.2, 0.5, 'rock'], [14, 6.6, 0.55, 'crystal'], [5.5, 6.6, 0.5, 'rock'], [11.5, 10, 0.5, 'crystal']],
  },
  {
    id: 'sumpf', v: 3, name: 'Nebelsumpf', biome: 'sumpf', desc: 'Ein langer Weg in Schleifen um leuchtende Sumpftümpel – mit dichtem Nebel.',
    paths: [[[-1.2, 11.5], [3, 11.5], [4, 10], [4, 3], [5.5, 1.6], [9, 1.6], [10.5, 3], [10.5, 10.5], [12, 12], [15.5, 12], [17, 10.5], [17, 4.5], [15.6, 3.2], [13.8, 4.2], [13.8, 8.2]]],
    base: [13.8, 8.2],
    water: [{ pts: [[6.4, 5.6], [8, 7.4], [7, 9.6]], w: 1.4 }, { pts: [[18.6, 0.6], [19.4, 2], [20.8, 2.4]], w: 0.9 }],
    obstacles: [[1.5, 6, 0.65, 'tree'], [7.3, 12.3, 0.6, 'tree'], [12.2, 6.2, 0.5, 'crystal'], [19, 13, 0.6, 'tree']],
  },
];

// ---------------------------------------------------------------- Kampagne
export const CAMPAIGN = [
  { id: 'm1', name: 'Erstkontakt', map: 'krater', mode: 'standard', difficulty: 'leicht', waves: 8,
    goal: 'Halte 8 Wellen durch.', radio: { 0: 'Leitstelle Aurelis an Kommandant: Unbekannte Lebensformen im Kraterpass. Bauen Sie Abwehrstellungen am Weg!', 4: 'Gute Arbeit. Die Belagerer sind gepanzert – setzen Sie auf starke Einzeltreffer.', end: 'Kraterpass gesichert. Willkommen an Bord, Kommandant.' } },
  { id: 'm2', name: 'Funkstille', map: 'zwilling', mode: 'standard', difficulty: 'leicht', waves: 10, allowed: ['laser', 'plasma', 'rail', 'radar'],
    goal: 'Nur Laser, Plasma, Schienenkanone und Radar sind verfügbar.', radio: { 0: 'Unser Nachschub ist abgeschnitten. Wir haben nur noch vier Turmarten auf Lager.', 7: 'Phantome auf dem Radar! Halten Sie einen Radarmast bereit.', end: 'Die Schlucht ist ruhig. Nachschub ist unterwegs.' } },
  { id: 'm3', name: 'Unsichtbare Gefahr', map: 'spirale', mode: 'standard', difficulty: 'mittel', waves: 12,
    goal: 'Halte 12 Wellen im Kristallfeld.', radio: { 0: 'Im Kristallfeld bewegt sich etwas Getarntes. Die Nacht macht es nicht leichter.', 7: 'Phantome im Anflug – Radar einschalten!', end: 'Kristallfeld gesichert. Ausgezeichnet.' } },
  { id: 'm4', name: 'Ohne Netz', map: 'gabel', mode: 'standard', difficulty: 'mittel', waves: 12, banned: ['shield'],
    goal: 'Keine Schildgeneratoren – schütze deine Türme anders.', radio: { 0: 'Die Schildgeneratoren sind ausgefallen. Die Giftgabelung muss trotzdem halten.', 6: 'Teiler gesichtet. Viel Flächenschaden am Ende des Weges hilft.', end: 'Die Gabelung hält. Die Techniker reparieren die Schilde.' } },
  { id: 'm5', name: 'Kältefront', map: 'zwilling', mode: 'expert', difficulty: 'mittel', waves: 15, eventEvery: 3,
    goal: 'Advance-Regeln mit vielen Karten-Ereignissen.', radio: { 0: 'Ein Sturmsystem zieht über die Frostebene. Ihr Kommandant ist vor Ort.', 5: 'Ereignis-Warnung! Achten Sie auf die Ankündigungen.', end: 'Die Front ist durchgezogen. Hervorragend.' } },
  { id: 'm6', name: 'Der Schwarmträger', map: 'krater', mode: 'standard', difficulty: 'mittel', waves: 10,
    goal: 'Besiege das erste Mutterschiff in Welle 10.', radio: { 0: 'Fernsensoren melden ein riesiges Mutterschiff. Bereiten Sie sich vor.', 9: 'Da ist es! EMP gegen sein Schild, dann alles auf den Rumpf!', end: 'Das Mutterschiff ist vernichtet. Die Station feiert Sie.' } },
  { id: 'm7', name: 'Maschinenherz', map: 'spirale', mode: 'expert', difficulty: 'mittel', waves: 10, finalBoss: 'boss2',
    goal: 'Stoppe den Maschinenkoloss.', radio: { 0: 'Ein Kampfläufer der Maschinenwesen marschiert auf den Kern zu.', 9: 'Der Koloss stört unsere Türme! Bauen Sie mit Abstand zum Weg.', end: 'Der Koloss ist gefallen. Unglaublich.' } },
  { id: 'm8', name: 'Letzte Bastion', map: 'gabel', mode: 'expert', difficulty: 'schwer', waves: 20,
    goal: 'Überstehe 20 Wellen auf Schwer.', radio: { 0: 'Alle Schwärme ziehen zusammen. Das ist die Entscheidung, Kommandant.', 10: 'Halbzeit. Halten Sie durch!', 19: 'Letzte Welle – alles, was wir haben!', end: 'Aurelis ist gerettet. Die Kolonie verdankt Ihnen alles.' } },
];

export const CUSTOM_THEME = { ground: '#10141c', ground2: '#18202c', accent: '#ffd23e', lane: '#ffe48a' };
