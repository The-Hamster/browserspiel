// Oberfläche: HUD, Panels, Menüs, Eingabe
import {
  TILE, COLS, ROWS, WORLD_W, WORLD_H, TOWERS, TOWER_ORDER, towerSpec, tierLevel, ENEMIES, ELITE_INFO, BASE, BASE_UPGRADES,
  BASE_UPGRADE_ORDER, ABILITIES, ABILITY_ORDER, HERO, heroXpNeed, RESEARCH, RESEARCH_BRANCHES, ACHIEVEMENTS, DAILY_MODS, MAPS, CUSTOM_THEME, GAME_TITLE, BIOMES,
} from './data.js';
import { Game, buildMap, normalizeDef } from './game.js';
import { dailyConfig, makeWave } from './waves.js';
import { store } from './storage.js';
import { sfx } from './audio.js';
import { towerIcon, enemyIcon } from './sprites.js';
import { drawThumbTerrain } from './terrain.js';
import { DIFFICULTIES, DIFF_ORDER } from './waves.js';
import { fmt, fmtTime, todayKey, el, clamp, rgba } from './util.js';

const svg = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
export const ICON = {
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  play: svg('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  orbital: svg('<circle cx="12" cy="14" r="6"/><path d="M12 2v8M12 18v4M4 14H2M22 14h-2"/><circle cx="12" cy="14" r="1.5" fill="currentColor"/>'),
  warp: svg('<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>'),
  repair: svg('<path d="M14.5 5.5a4 4 0 00-5 5L4 16l4 4 5.5-5.5a4 4 0 005-5l-2.5 2.5-2.5-.5-.5-2.5z"/>'),
  pulse: svg('<circle cx="12" cy="12" r="2.5" fill="currentColor"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>'),
  hero: svg('<path d="M5 13a7 7 0 0114 0v3H5z"/><path d="M8 13h8M7 16v4M17 16v4M12 6V3"/>'),
  grenade: svg('<path d="M12 2l2 6 6-2-4 5 5 3-6 1 1 6-4-5-4 5 1-6-6-1 5-3-4-5 6 2z"/>'),
  overdrive: svg('<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};
const ABIL_ICON = { orbital: ICON.orbital, warp: ICON.warp, repair: ICON.repair, pulse: ICON.pulse };

const TIPS = {
  build: ['Willkommen, Kommandant!', 'Wähle rechts einen Turm und tippe auf eine leuchtende Baufläche neben dem Weg. Oder tippe zuerst die Fläche an und dann den Turm.'],
  start: ['Bereit?', 'Starte die erste Welle oben mit „Welle starten“. Später kommen die Wellen von selbst – früher starten bringt Bonus-Credits.'],
  speed: ['Tempo', 'Oben rechts kannst du auf 2x oder 3x beschleunigen oder pausieren. Abschüsse bringen Credits für neue Türme.'],
  upgrade: ['Aufrüsten', 'Tippe einen gebauten Turm an: Dort rüstest du ihn auf, verkaufst ihn oder wählst sein Ziel. Ab Stufe 3 wählst du eine Spezialisierung.'],
  base: ['Der Reaktorkern', 'Tippe auf den Kern, um Panzerung, Energieschild, Kernkanone, Energiefluss und die Notfall-Pulswelle auszubauen.'],
  tank: ['Belagerer', 'Gepanzert und langsam – und sie beschießen Türme! Starke Einzeltreffer (Schienenkanone, Plasma) wirken besser als schwache Laser.'],
  flyer: ['Gleiter', 'Flieger ignorieren den Weg und fliegen direkt zum Kern. Plasmawerfer treffen sie nicht – Raketenwerfer sind doppelt so stark.'],
  shield: ['Schildträger', 'Ihr Energieschild schluckt Schaden. Der EMP-Turm zerstört Schilde besonders schnell.'],
  phantom: ['Getarnte Phantome', 'Phantome sind unsichtbar. Nur ein Radarmast (oder der Kern aus nächster Nähe) macht sie für deine Türme sichtbar.'],
  abilities: ['Spezialfähigkeiten', 'Links findest du Fähigkeiten. Sie kosten Energie und brauchen danach eine Pause. Orbitalschlag: Knopf antippen (Taste Q), dann ein Ziel auf der Karte wählen.'],
  boss: ['Schwarmträger!', 'Ein Mutterschiff: riesig, mit Schild, setzt Schwärmer ab und beschießt Türme. Zeit für Orbitalschlag und Zeitverzerrung!'],
  basehit: ['Kern getroffen', 'Gegner, die den Kern erreichen, beschädigen ihn. Baue mehr Türme oder verstärke den Kern selbst.'],
  elite: ['Elite-Gegner', 'Gegner mit goldenem Ring sind Elite: zäher und mit Sonderfähigkeiten.'],
  towerdown: ['Turm ausgefallen', 'Türme können beschädigt werden. Schildgeneratoren schützen Nachbarn, Reparaturdrohnen bringen alle sofort zurück.'],
  radar_built: ['Radarmast', 'Getarnte Gegner im Umkreis sind jetzt sichtbar – andere Türme können sie treffen.'],
  hero: ['Dein Kommandant', 'Tippe den Kommandanten an (oder Taste H) und dann irgendwo auf die Karte, um ihn zu bewegen. Er kämpft mit und steigt im Level auf.'],
};

const MODE_NAME = { standard: 'Standard', expert: 'Advance', daily: 'Tägliche Herausforderung' };
const TARGET_MODES = [['first', 'Erster'], ['strong', 'Stärkster'], ['near', 'Nächster']];

export function drawThumb(canvas, def) {
  const g = canvas.getContext('2d');
  let map;
  try { map = buildMap(def); } catch (e) { return; }
  drawThumbTerrain(g, map, canvas.width, canvas.height);
}

export class UI {
  constructor(renderer) {
    this.r = renderer;
    this.$ = (id) => document.getElementById(id);
    this.mode = 'menu';
    this.game = null; this.paused = false; this.speed = 1;
    this.selected = null; this.buildType = null; this.pendingPos = null; this.ghost = null; this.targeting = null; this.heroSelected = false;
    this.mouseWorld = null; this.mouseNX = 0; this.mouseNY = 0;
    this.cache = new Map();
    this.panelTimer = 0; this.lastPreviewWave = -1;
    this.shift = false;
    this.endless = false;
    this.editor = null;
    this.buildHud();
    this.bindInput();
    this.showMenu();
  }
  get settings() { return store.data.settings; }

  // ---------------------------------------------------------------- Hilfen
  set(elm, key, val, prop = 'textContent') {
    const k = key + prop;
    if (this.cache.get(k) === val) return;
    this.cache.set(k, val);
    if (prop === 'width') elm.style.width = val; else elm[prop] = val;
  }
  toast(text, kind = '') {
    const box = this.$('toasts');
    const t = el('div', 'toast ' + kind, text);
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), kind === 'ach' ? 4200 : 2600);
    setTimeout(() => t.remove(), kind === 'ach' ? 4700 : 3100);
  }
  announce(title, sub, kind = '') {
    const a = this.$('announce');
    a.innerHTML = '';
    const d = el('div', 'an ' + kind, `<h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}`);
    a.appendChild(d);
    clearTimeout(this._annT);
    this._annT = setTimeout(() => d.remove(), 2700);
  }
  showTip(id) {
    const t = TIPS[id];
    if (!t || !this.settings.tips) return;
    const box = this.$('tip');
    box.innerHTML = `<div class="tt"><b>${t[0].toUpperCase()}</b>${t[1]}</div><button>Verstanden</button>`;
    box.classList.remove('hidden');
    box.querySelector('button').onclick = () => { box.classList.add('hidden'); sfx.play('click'); };
    clearTimeout(this._tipT);
    this._tipT = setTimeout(() => box.classList.add('hidden'), 14000);
    store.save();
  }
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  }
  hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('show')); }
  btn(label, cls, fn) { const b = el('button', cls, label); b.onclick = (e) => { sfx.init(); sfx.play('click'); fn(e); }; return b; }

  playRect() {
    const W = window.innerWidth, H = window.innerHeight;
    if (this.mode === 'game') {
      const top = this.$('topbar').getBoundingClientRect().bottom;
      const bottom = this.$('bottombar').getBoundingClientRect().top;
      return { x: 6, y: top + 6, w: W - 12, h: bottom - top - 12 };
    }
    if (this.mode === 'editor') {
      const tool = document.querySelector('#scrEditor .etool');
      const left = tool ? tool.getBoundingClientRect().right : 0;
      return { x: left + 10, y: 10, w: W - left - 20, h: H - 20 };
    }
    return { x: 0, y: 0, w: W, h: H };
  }
  layout() { this.r.resize(this.playRect()); }

  // ---------------------------------------------------------------- HUD aufbauen
  buildHud() {
    this.$('btnMenu').innerHTML = ICON.menu;
    this.$('btnPause').innerHTML = ICON.pause;
    this.$('btnMenu').onclick = () => { sfx.play('click'); this.openPause(); };
    this.$('btnPause').onclick = () => { sfx.play('click'); this.togglePause(); };
    this.$('speedSeg').querySelectorAll('button').forEach(b => { b.onclick = () => { sfx.play('click'); this.setSpeed(+b.dataset.s); }; });
    this.$('btnMute').onclick = () => { this.toggleMute(); };
    this.$('btnNext').onclick = () => { sfx.init(); if (this.game && this.game.callNextWave()) { this.paused = false; } else sfx.play('error'); };
    this.updateMuteIcon();
    const bb = this.$('buildbar');
    this.towerBtns = {};
    for (const type of TOWER_ORDER) {
      const T = TOWERS[type];
      const b = el('button', 'tb', `<span class="key">${T.key}</span><img alt="" src="${towerIcon(type)}"><span class="cost">${T.tiers[1].cost}</span>`);
      b.title = `${T.name} (${T.key}) – ${T.desc}`;
      b.onclick = () => { sfx.init(); this.chooseBuild(type); };
      b.onpointerenter = (e) => { if (e.pointerType === 'mouse') this.showBuildInfo(type); };
      b.onpointerleave = (e) => { if (e.pointerType === 'mouse' && this.buildType !== type) this.showBuildInfo(this.buildType); };
      bb.appendChild(b);
      this.towerBtns[type] = b;
    }
    const lb = this.$('abilbar');
    this.abilBtns = {};
    for (const id of ABILITY_ORDER) {
      const A = ABILITIES[id];
      const b = el('button', 'ab', `${ABIL_ICON[id]}<span class="key">${A.key}</span><span class="en"></span><div class="cdov"></div><div class="cdt"></div>`);
      b.style.setProperty('--c', A.color);
      b.title = `${A.name} (${A.key}) – ${A.desc}`;
      b.onclick = () => { sfx.init(); this.ability(id); };
      lb.appendChild(b);
      this.abilBtns[id] = b;
    }
    this.heroBox = el('div', 'herobox', '');
    this.heroBtn = el('button', 'hero-btn', `${ICON.hero}<span class="lv">1</span><div class="hpb"><div></div></div><div class="resp"></div>`);
    this.heroBtn.title = 'Kommandant auswählen (H)';
    this.heroBtn.onclick = () => { sfx.init(); this.toggleHero(); };
    this.heroBox.appendChild(this.heroBtn);
    this.heroAbBtns = HERO.abilities.map((a, i) => {
      const b = el('button', 'ab', `${i === 0 ? ICON.grenade : ICON.overdrive}<span class="key">${a.key}</span><div class="cdov"></div><div class="cdt"></div>`);
      b.style.setProperty('--c', i === 0 ? '#5dffb0' : '#ffcf3a');
      b.title = `${a.name} (${a.key}) – ${a.desc}`;
      b.onclick = () => { sfx.init(); if (this.game) this.game.heroAbility(i); };
      this.heroBox.appendChild(b);
      return b;
    });
    lb.appendChild(this.heroBox);
  }

  updateMuteIcon() { this.$('btnMute').innerHTML = this.settings.muted ? ICON.mute : ICON.sound; }
  toggleMute() {
    this.settings.muted = !this.settings.muted; sfx.setMuted(this.settings.muted); store.save(); this.updateMuteIcon();
    if (!this.settings.muted) { sfx.init(); sfx.play('click'); }
  }
  cycleSpeed() { this.setSpeed(this.speed % 3 + 1); }
  setSpeed(v) { this.speed = v; this.$('speedSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.s === v)); }
  togglePause(force) {
    if (!this.game) return;
    this.paused = force !== undefined ? force : !this.paused;
    this.$('btnPause').innerHTML = this.paused ? ICON.play : ICON.pause;
    this.$('btnPause').classList.toggle('on', this.paused);
  }

  chooseBuild(type) {
    const g = this.game;
    if (!g) return;
    if (g.rules.banned.includes(type)) { this.toast('Diese Turmart ist heute gesperrt'); sfx.play('error'); return; }
    this.targeting = null; this.heroSelected = false;
    if (this.pendingPos) {
      const p = this.pendingPos; this.pendingPos = null;
      const t = g.build(type, p.x, p.y);
      this.buildType = null; this.ghost = null;
      if (t) this.select({ kind: 'tower', tower: t });
      this.refreshBuildSel();
      return;
    }
    this.buildType = this.buildType === type ? null : type;
    if (!this.buildType) this.ghost = null;
    this.select(null);
    this.refreshBuildSel();
    sfx.play('click');
  }
  refreshBuildSel() {
    for (const t of TOWER_ORDER) this.towerBtns[t].classList.toggle('sel', this.buildType === t);
    this.showBuildInfo(this.buildType);
  }
  showBuildInfo(type) {
    const box = this.$('buildinfo');
    if (!type) {
      if (this.pendingPos) { box.innerHTML = '<h4>Bauplatz gewählt</h4><p>Tippe unten auf einen Turm, um ihn hier zu bauen.</p>'; box.classList.remove('hidden'); }
      else box.classList.add('hidden');
      return;
    }
    const T = TOWERS[type], sp = towerSpec(type, '1');
    const lines = statLines(sp, this.game, null).slice(0, 4).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    box.innerHTML = `<h4>${T.name} <span>${T.tiers[1].cost}</span></h4><p>${T.desc}</p><div class="stats">${lines}</div>${this.buildType === type ? '<p style="margin:0;color:#93c5fd">Tippe auf einen freien Platz neben dem Weg.</p>' : ''}`;
    box.classList.remove('hidden');
  }
  ability(id) {
    const g = this.game;
    if (!g || g.state !== 'playing') return;
    if (id === 'orbital') {
      const info = g.abilityInfo(id);
      if (!info.ready) { g.useAbility(id, 0, 0); this.drainEvents(); return; }
      this.targeting = this.targeting ? null : 'orbital';
      this.buildType = null; this.refreshBuildSel();
      if (this.targeting) this.toast('Ziel auf der Karte antippen');
      return;
    }
    g.useAbility(id);
  }
  toggleHero() {
    const g = this.game;
    if (!g || !g.hero) return;
    if (g.hero.dead > 0) { this.toast('Kommandant ist noch nicht zurück'); return; }
    this.heroSelected = !this.heroSelected;
    if (this.heroSelected) { this.buildType = null; this.select(null); this.refreshBuildSel(); this.targeting = null; }
  }

  // ---------------------------------------------------------------- Auswahl & Panel
  select(sel) {
    this.selected = sel;
    if (sel) { this.pendingPos = null; if (!this.buildType) this.ghost = null; }
    this.renderPanel();
  }
  renderPanel() {
    const p = this.$('panel');
    const sel = this.selected, g = this.game;
    if (!sel || !g) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.innerHTML = '';
    p.className = '';
    const inner = el('div', 'scroll');
    p.appendChild(inner);
    if (sel.kind === 'tower') this.towerPanel(inner, sel.tower);
    else { p.classList.add('wide'); this.basePanel(inner); }
    this.placePanel();
  }
  // Fenster direkt neben dem gewählten Turm / Kern platzieren
  placePanel() {
    const p = this.$('panel'), sel = this.selected, g = this.game;
    if (!sel || !g || p.classList.contains('hidden')) return;
    const wx = sel.kind === 'tower' ? sel.tower.x : g.base.x, wy = sel.kind === 'tower' ? sel.tower.y : g.base.y;
    const s = this.r.worldToScreen(wx, wy);
    const off = (sel.kind === 'tower' ? 30 : 76) * this.r.scale + 12;
    const pw = p.offsetWidth, ph = p.offsetHeight;
    const top0 = this.$('topbar').getBoundingClientRect().bottom + 6, bot0 = this.$('bottombar').getBoundingClientRect().top - 6;
    let left = s.x + off, side = 'side-r';
    if (left + pw > window.innerWidth - 6) { left = s.x - off - pw; side = 'side-l'; }
    if (left < 6) { left = 6; side = ''; }
    let top = s.y - ph / 2;
    top = Math.max(top0, Math.min(bot0 - ph, top));
    p.classList.remove('side-r', 'side-l');
    if (side) p.classList.add(side);
    p.style.left = Math.round(left) + 'px'; p.style.top = Math.round(top) + 'px';
    p.style.setProperty('--ay', Math.round(clamp(s.y - top, 14, ph - 14)) + 'px');
    const sc = p.querySelector('.scroll'); if (sc) sc.style.maxHeight = (bot0 - top0 - 20) + 'px';
  }
  towerPanel(p, t) {
    const g = this.game, T = TOWERS[t.type], sp = t.spec, lvl = tierLevel(t.tier);
    const head = el('div', 'ph', `<img alt="" src="${towerIcon(t.type, t.tier)}"><div><h3>${sp.tierName}</h3><small>Stufe ${lvl} · ${T.name}</small></div>`);
    const x = this.btn(ICON.close, 'x', () => this.select(null));
    head.appendChild(x);
    p.appendChild(head);
    const st = el('div', 'stats');
    st.innerHTML = this.towerStatsHtml(t);
    p.appendChild(st);
    if (!['shieldgen', 'radar', 'pulse'].includes(sp.kind)) {
      const seg = el('div', 'seg target', '');
      for (const [m, label] of TARGET_MODES) {
        const b = this.btn(label, t.mode === m ? 'on' : '', () => { t.mode = m; t.beams.length = 0; this.renderPanel(); });
        seg.appendChild(b);
      }
      p.appendChild(seg);
    }
    const up = el('div', 'upg');
    const next = g.nextTiers(t);
    if (!next.length) up.appendChild(el('div', 'ubtn max', '<b>Höchste Stufe erreicht</b>'));
    if (t.tier === '2') up.appendChild(el('div', 'sectlabel', 'Spezialisierung'));
    for (const tier of next) {
      const d = T.tiers[tier];
      const name = tier === '2' ? 'Stufe 2' : d.name;
      const desc = tier === '2' ? 'Mehr Schaden, Feuerrate und Reichweite.' : d.desc;
      const b = this.btn(`<b>${name}${tier === 'c' ? ' ★' : ''}</b><span class="c">${d.cost}</span><small>${desc}</small>`, 'ubtn' + (tier === 'c' ? ' var-c' : ''), () => {
        if (g.upgrade(t, tier)) this.renderPanel(); else this.drainEvents();
      });
      b.dataset.cost = d.cost;
      up.appendChild(b);
    }
    p.appendChild(up);
    const v = g.sellValue(t);
    const sell = this.btn(`Verkaufen +${v}${!t.hasFired ? ' (volle Erstattung)' : ''}`, 'sellbtn', () => { g.sell(t); this.select(null); });
    p.appendChild(sell);
    this.refreshPanelAfford();
  }
  towerStatsHtml(t) {
    const lines = statLines(t.spec, this.game, t);
    lines.push(['Abschüsse', fmt(t.kills)], ['Gesamt', fmt(t.dmg)]);
    lines.push(['Zustand', t.offline > 0 ? 'Ausfall' : Math.ceil(t.hp) + '/' + Math.ceil(t.maxHp)]);
    if (t.buffs.shieldCap) lines.push(['Schild', Math.round(t.shield) + '/' + t.buffs.shieldCap]);
    return lines.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }
  baseStatsHtml() {
    const g = this.game, b = g.base, c = g.baseCannon();
    return [
      ['Leben', Math.ceil(b.hp) + '/' + b.maxHp], ['Schild', b.shieldMax ? Math.round(b.shield) + '/' + b.shieldMax : '–'],
      ['Kanone', Math.round(c.dmg) + ' × ' + c.rate.toFixed(1) + '/s'], ['Reichweite', c.range.toFixed(1)],
      ['Energie', '+' + g.energyIncome().toFixed(1) + '/s'], ['Schaden −', Math.round(b.reduce * 100) + ' %'],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }
  basePanel(p) {
    const g = this.game, b = g.base;
    p.classList.add('wide');
    const head = el('div', 'ph', `<div style="width:44px;height:44px;border-radius:50%;background:radial-gradient(circle,#fff,#36f1ff 30%,#0a2a3a 70%);box-shadow:0 0 18px #36f1ff;flex:none"></div><div><h3>Reaktorkern</h3><small>Herz der Station Aurelis</small></div>`);
    head.appendChild(this.btn(ICON.close, 'x', () => this.select(null)));
    p.appendChild(head);
    const st = el('div', 'stats');
    st.innerHTML = this.baseStatsHtml();
    p.appendChild(st);
    for (const br of BASE_UPGRADE_ORDER) {
      const U = BASE_UPGRADES[br], lv = b.up[br], max = U.levels.length;
      const box = el('div', 'bu');
      box.appendChild(el('h4', '', U.name));
      const pips = el('div', 'pips', Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join(''));
      box.appendChild(pips);
      box.appendChild(el('p', '', U.desc));
      const cost = g.baseUpgradeCost(br);
      const bt = cost === null
        ? el('div', 'ubtn max', '<b>Max</b>')
        : this.btn(`<b>Stufe ${lv + 1}</b><span class="c">${cost}</span>`, 'ubtn', () => { if (g.buyBaseUpgrade(br)) this.renderPanel(); else this.drainEvents(); });
      if (cost !== null) bt.dataset.cost = cost;
      box.appendChild(bt);
      p.appendChild(box);
    }
    this.refreshPanelAfford();
  }
  refreshPanelAfford() {
    if (!this.game) return;
    const c = this.game.credits;
    this.$('panel').querySelectorAll('[data-cost]').forEach(b => b.classList.toggle('poor', c < +b.dataset.cost));
  }

  // ---------------------------------------------------------------- Eingabe
  bindInput() {
    const cv = this.r.canvas;
    let down = null;
    cv.addEventListener('pointerdown', (e) => {
      sfx.init();
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, type: e.pointerType };
      if (this.mode === 'editor' && this.editor) { this.editor.pointer('down', e); return; }
      if (this.mode !== 'game') return;
      this.updateMouse(e);
      if (e.pointerType !== 'mouse' && this.buildType) this.ghost = { ...this.mouseWorld };
    });
    cv.addEventListener('pointermove', (e) => {
      this.mouseNX = e.clientX / window.innerWidth - 0.5; this.mouseNY = e.clientY / window.innerHeight - 0.5;
      if (this.mode === 'editor' && this.editor) { this.editor.pointer('move', e); return; }
      if (this.mode !== 'game') return;
      this.updateMouse(e);
      if (e.pointerType === 'mouse' && this.buildType) this.ghost = { ...this.mouseWorld };
    });
    cv.addEventListener('pointerup', (e) => {
      if (this.mode === 'editor' && this.editor) { this.editor.pointer('up', e); down = null; return; }
      if (this.mode !== 'game' || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (e.button === 2) { down = null; return; }
      if (moved < 14) { this.updateMouse(e); this.tap(this.mouseWorld, e); }
      down = null;
    });
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && this.mode === 'game' && !this.pendingPos) this.ghost = null; });
    cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.mode === 'game') this.cancel(); });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') this.shift = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'game' && this.game?.state === 'playing') this.togglePause(true); });
  }
  updateMouse(e) { this.mouseWorld = this.r.screenToWorld(e.clientX, e.clientY); }
  tileAt(w) {
    if (!w) return null;
    const x = Math.floor(w.x / TILE), y = Math.floor(w.y / TILE);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x, y };
  }
  cancel() {
    this.targeting = null; this.buildType = null; this.pendingPos = null; this.ghost = null; this.heroSelected = false;
    this.select(null); this.refreshBuildSel();
  }
  tap(w, e) {
    const g = this.game;
    if (!g || g.state !== 'playing' || !w) return;
    if (this.targeting) {
      if (g.useAbility(this.targeting, w.x, w.y)) this.targeting = null;
      return;
    }
    const tower = g.towerNear(w.x, w.y, 30);
    const h = g.hero;
    if (this.heroSelected && h) {
      if (Math.hypot(w.x - h.x, w.y - h.y) < 24) { this.heroSelected = false; return; }
      if (tower) { this.heroSelected = false; this.select({ kind: 'tower', tower }); return; }
      g.heroMoveTo(w.x, w.y);
      return;
    }
    if (this.buildType) {
      if (g.canBuild(w.x, w.y)) {
        const t = g.build(this.buildType, w.x, w.y);
        if (t && !(this.shift || e.shiftKey)) { this.buildType = null; this.ghost = null; this.select({ kind: 'tower', tower: t }); }
        this.refreshBuildSel();
        return;
      }
      if (tower) { this.buildType = null; this.ghost = null; this.refreshBuildSel(); this.select({ kind: 'tower', tower }); return; }
      this.ghost = { ...w };
      this.toast('Hier ist kein Platz – wähle eine freie Stelle neben dem Weg');
      sfx.play('error');
      return;
    }
    if (tower) { this.pendingPos = null; this.ghost = null; this.select(this.selected?.tower === tower ? null : { kind: 'tower', tower }); this.showBuildInfo(null); return; }
    if (h && h.dead <= 0 && Math.hypot(w.x - h.x, w.y - h.y) < 26) { this.select(null); this.heroSelected = true; return; }
    if (Math.hypot(w.x - g.base.x, w.y - g.base.y) < 60) { this.select(this.selected?.kind === 'base' ? null : { kind: 'base' }); return; }
    if (g.canBuild(w.x, w.y)) {
      this.select(null);
      this.pendingPos = this.pendingPos && Math.hypot(this.pendingPos.x - w.x, this.pendingPos.y - w.y) < 20 ? null : { ...w };
      this.ghost = this.pendingPos;
      this.showBuildInfo(null);
      return;
    }
    this.pendingPos = null; this.ghost = null; this.showBuildInfo(null);
    this.select(null);
  }
  key(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Shift') this.shift = true;
    sfx.init();
    if (this.mode === 'editor') { if (e.key === 'Escape') this.editor?.exit(); else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) this.editor?.undo(); return; }
    if (this.mode !== 'game' || !this.game) return;
    const g = this.game;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const overlay = document.querySelector('#scrPause.show, #scrEnd.show, #scrSettings.show, #scrConfirm.show');
    if (k === 'Escape') {
      if (overlay) { if (document.querySelector('#scrPause.show')) this.resumeFromPause(); return; }
      if (this.targeting || this.buildType || this.selected || this.heroSelected || this.pendingPos) this.cancel();
      else this.openPause();
      return;
    }
    if (overlay) return;
    const idx = TOWER_ORDER.findIndex(t => TOWERS[t].key === k);
    if (idx >= 0) { this.chooseBuild(TOWER_ORDER[idx]); return; }
    switch (k) {
      case 'q': this.ability('orbital'); break;
      case 'w': this.ability('warp'); break;
      case 'e': this.ability('repair'); break;
      case 'r': this.ability('pulse'); break;
      case 'h': this.toggleHero(); break;
      case 'y': case 'z': if (g.hero) g.heroAbility(0); break;
      case 'x': if (g.hero) g.heroAbility(1); break;
      case ' ': e.preventDefault(); this.togglePause(); break;
      case 'n': case 'Enter': if (g.callNextWave()) this.paused = false; break;
      case 'f': this.cycleSpeed(); break;
      case 'm': this.toggleMute(); break;
      case 'u': {
        const t = this.selected?.tower;
        if (t) { const n = g.nextTiers(t); if (n.length === 1) { g.upgrade(t, n[0]); this.renderPanel(); } else if (n.length) this.toast('Wähle eine Spezialisierung im Turm-Fenster'); }
        break;
      }
      case 'v': case 'Delete': case 'Backspace': { const t = this.selected?.tower; if (t) { g.sell(t); this.select(null); } break; }
      case 't': {
        const t = this.selected?.tower;
        if (t) { const i = TARGET_MODES.findIndex(m => m[0] === t.mode); t.mode = TARGET_MODES[(i + 1) % 3][0]; this.renderPanel(); this.toast('Ziel: ' + TARGET_MODES[(i + 1) % 3][1]); }
        break;
      }
      case 'b': this.select(this.selected?.kind === 'base' ? null : { kind: 'base' }); break;
    }
  }

  // ---------------------------------------------------------------- Spiel starten / beenden
  startGame(opts) {
    sfx.init();
    store.data.save = null; store.save();
    const g = new Game({ difficulty: this.settings.difficulty || 'mittel', ...opts, research: store.data.research.unlocked, progress: store.data });
    this.enterGame(g);
    if (g.hero) setTimeout(() => this.game === g && g.tip('hero'), 2500);
  }
  continueGame() {
    const s = store.data.save;
    if (!s) return;
    let g;
    try { g = Game.fromSave(s, store.data); } catch (err) { console.warn(err); this.toast('Spielstand konnte nicht geladen werden', 'warn'); store.data.save = null; store.save(); this.showMenu(); return; }
    this.enterGame(g);
    this.toast(`Spielstand geladen – Welle ${g.wave} geschafft. Starte die nächste Welle, wenn du bereit bist.`, 'good');
  }
  enterGame(g) {
    this.game = g; this.mode = 'game';
    this.lastOpts = { mode: g.mode, mapDef: g.mapDef, endless: g.endless, daily: g.daily, difficulty: g.difficulty };
    this.$('hDiff').textContent = MODE_NAME[g.mode] + ' · ' + DIFFICULTIES[g.difficulty].name;
    this.hideScreens();
    this.$('hud').classList.remove('hidden');
    this.heroBox.classList.toggle('hidden', !g.hero);
    this.cancel();
    this.paused = false; this.togglePause(false);
    this.setSpeed(1);
    this.cache.clear(); this.lastPreviewWave = -1;
    g.particles.quality = { hoch: 1, mittel: 0.7, niedrig: 0.4 }[this.settings.quality] || 1;
    for (const t of TOWER_ORDER) this.towerBtns[t].classList.toggle('banned', g.rules.banned.includes(t));
    this.$('tip').classList.add('hidden');
    requestAnimationFrame(() => this.layout());
    this.layout();
    this.drainEvents();
  }
  exitToMenu() {
    this.game = null; this.mode = 'menu'; sfx.setBoss(false);
    this.$('hud').classList.add('hidden');
    this.$('tip').classList.add('hidden');
    this.$('panel').classList.add('hidden');
    this.$('buildinfo').classList.add('hidden');
    this.layout();
    this.showMenu();
  }
  restart() {
    if (!this.lastOpts) return this.exitToMenu();
    this.startGame(this.lastOpts);
  }
  openPause() {
    if (!this.game) return;
    this.togglePause(true);
    const s = this.$('scrPause');
    s.innerHTML = '';
    const box = el('div', 'box card', `<h2 class="endt" style="font-size:26px">PAUSE</h2><p class="endsub" style="margin-bottom:14px">${MODE_NAME[this.game.mode]} · ${DIFFICULTIES[this.game.difficulty].name} · ${this.game.map.name} · Welle ${this.game.wave}</p>`);
    box.style.width = 'min(420px,100%)';
    const m = el('nav', 'tmenu pmenu');
    m.appendChild(this.btn('Weiterspielen', 'titem accent', () => this.resumeFromPause()));
    m.appendChild(this.btn('Neu starten', 'titem', () => this.confirm('Partie neu starten?', 'Der aktuelle Fortschritt dieser Partie geht verloren.', 'Neu starten', () => this.restart(), 'scrPause')));
    m.appendChild(this.btn('Einstellungen', 'titem', () => this.showSettings('scrPause')));
    m.appendChild(this.btn('Hauptmenü', 'titem', () => {
      const saved = this.game.canSave();
      if (saved) { store.data.save = this.game.serialize(); store.save(true); }
      this.confirm('Zum Hauptmenü?', saved ? 'Der Spielstand wurde gespeichert – du kannst später fortsetzen.' : 'Gespeichert wird nur zwischen den Wellen. Der Fortschritt seit der letzten geschafften Welle geht verloren.', 'Zum Hauptmenü', () => this.exitToMenu(), 'scrPause');
    }));
    box.appendChild(m);
    s.appendChild(box);
    this.showScreen('scrPause');
  }
  resumeFromPause() { this.hideScreens(); this.togglePause(false); }
  confirm(title, text, yes, onYes, backTo) {
    const s = this.$('scrConfirm');
    s.innerHTML = '';
    const box = el('div', 'box card', `<h2 style="margin:0 0 8px">${title}</h2><p style="color:var(--dim);margin:0 0 16px;line-height:1.4">${text}</p>`);
    box.style.width = 'min(440px,100%)';
    const r = el('div', 'rowbtns');
    r.appendChild(this.btn('Abbrechen', 'btn', () => backTo ? this.showScreen(backTo) : this.hideScreens()));
    r.appendChild(this.btn(yes, 'btn danger', () => { this.hideScreens(); onYes(); }));
    box.appendChild(r);
    s.appendChild(box);
    this.showScreen('scrConfirm');
  }

  // ---------------------------------------------------------------- Ereignisse aus dem Spiel
  drainEvents() {
    const g = this.game;
    if (!g) return;
    for (const ev of g.events) {
      switch (ev.t) {
        case 'toast': this.toast(ev.text, ev.kind); break;
        case 'announce': this.announce(ev.title, ev.sub, ev.kind); break;
        case 'tip': this.showTip(ev.id); break;
        case 'ach': { const a = ACHIEVEMENTS.find(x => x.id === ev.id); if (a) this.toast(`Erfolg freigeschaltet: <b>${a.name}</b> – ${a.desc}`, 'ach'); store.save(); break; }
        case 'basehit': {
          const r = document.querySelector('.stat.hp'); r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
          this.r.flash = 0.25; this.r.flashColor = 'red'; break;
        }
        case 'flash': this.r.flash = 0.3; this.r.flashColor = ev.color; break;
        case 'cleared': if (g.canSave()) { store.data.save = g.serialize(); store.save(); } break;
        case 'end': this.onEnd(g, ev.won); break;
      }
    }
    g.events.length = 0;
  }
  onEnd(g, won) {
    const s = store.data;
    s.stats.games++; if (won) s.stats.wins++;
    const key = `${g.mode}:${g.difficulty}:${g.mapDef.id}:${g.endless ? 1 : 0}`;
    const score = g.score();
    const prev = s.best[key] || { wave: 0, score: 0, won: false };
    const record = score > prev.score;
    s.best[key] = { wave: Math.max(prev.wave, g.wave), score: Math.max(prev.score, score), won: prev.won || won };
    const hsRecord = score > s.highscore;
    s.highscore = Math.max(s.highscore, score);
    const rp = g.researchEarned();
    if (rp) s.research.points += rp;
    if (g.daily) {
      const d = s.daily[g.daily.key] || { score: 0, wave: 0, done: false };
      s.daily[g.daily.key] = { score: Math.max(d.score, score), wave: Math.max(d.wave, g.wave), done: d.done || won };
    }
    s.save = null;
    store.save(true);
    setTimeout(() => { if (this.game === g) this.showEnd(g, won, { score, record, hsRecord, rp }); }, won ? 1500 : 2200);
  }
  showEnd(g, won, info) {
    this.togglePause(true);
    this.$('tip').classList.add('hidden');
    this.select(null);
    const s = this.$('scrEnd');
    s.innerHTML = '';
    const st = g.stats;
    let bestType = null, bestDmg = 0;
    for (const [k, v] of Object.entries(st.dmgByType)) if (v > bestDmg) { bestDmg = v; bestType = k; }
    const box = el('div', 'box card');
    box.innerHTML = `<h1 class="endt ${won ? 'win' : 'lose'}">${won ? 'STATION GERETTET' : 'KERN ZERSTÖRT'}</h1>
      <p style="text-align:center;color:var(--dim);margin:6px 0 0">${MODE_NAME[g.mode]} · ${DIFFICULTIES[g.difficulty].name} · ${g.map.name}${g.endless ? ' · Endlos' : ''}</p>
      <div class="endstats">
        <div class="hl"><span>Punkte${info.record ? ' · neuer Rekord!' : ''}</span><b>${fmt(info.score)}</b></div>
        <div><span>Wellen geschafft</span><b>${g.clearedUpTo}${g.totalWaves !== Infinity ? ' / ' + g.totalWaves : ''}</b></div>
        <div><span>Besiegte Gegner</span><b>${fmt(st.kills)}</b></div>
        <div><span>Verdiente Credits</span><b>${fmt(st.creditsEarned)}</b></div>
        <div><span>Gebaute Türme</span><b>${st.towersBuilt}</b></div>
        <div><span>Schaden am Kern</span><b>${fmt(st.baseDamage)}</b></div>
        <div><span>Bosse besiegt</span><b>${st.bossKills}</b></div>
        <div><span>Spielzeit</span><b>${fmtTime(g.time)}</b></div>
        ${bestType ? `<div><span>Bester Turm</span><b style="font-size:15px">${TOWERS[bestType].name}</b></div>` : ''}
        ${g.hero ? `<div><span>Kommandant</span><b>Stufe ${g.hero.level}</b></div>` : ''}
        ${info.rp ? `<div class="hl"><span>Forschungspunkte</span><b>+${info.rp}</b></div>` : ''}
        <div><span>Highscore</span><b>${fmt(store.data.highscore)}</b></div>
      </div>`;
    const r = el('div', 'rowbtns');
    if (won && !g.endless && g.mode !== 'daily') r.appendChild(this.btn('Endlos weiterspielen', 'btn gold', () => {
      g.state = 'playing'; g.endless = true; g.totalWaves = Infinity; g.rules.totalWaves = Infinity;
      g.nextWaveDef = makeWave(g.wave + 1, g.seed, g.rules, g.map.paths.length); g.countdown = g.rules.countdown; g.spawnEnd = 0;
      this.hideScreens(); this.togglePause(false);
    }));
    r.appendChild(this.btn('Nochmal spielen', 'btn primary', () => this.restart()));
    if (g.mode === 'expert') r.appendChild(this.btn('Forschungslabor', 'btn', () => { this.exitToMenu(); this.showResearch('scrMenu'); }));
    r.appendChild(this.btn('Hauptmenü', 'btn', () => this.exitToMenu()));
    box.appendChild(r);
    s.appendChild(box);
    this.showScreen('scrEnd');
  }

  // ---------------------------------------------------------------- HUD pro Frame
  frame(dt) {
    const g = this.game;
    if (!g || this.mode !== 'game') return;
    this.drainEvents();
    const $ = this.$;
    this.set($('hCredits'), 'cr', fmt(g.credits));
    this.set($('hEnergy'), 'en', Math.floor(g.energy) + '');
    const b = g.base;
    this.set($('hHp'), 'hp', Math.ceil(b.hp) + '');
    this.set($('hHpBar'), 'hpb', (b.hp / b.maxHp * 100).toFixed(1) + '%', 'width');
    this.set($('hEnergyBar'), 'enb', (g.energy / g.energyMax() * 100).toFixed(1) + '%', 'width');
    this.set($('hShBar'), 'shb', (b.shieldMax ? b.shield / b.shieldMax * 100 : 0).toFixed(1) + '%', 'width');
    const total = g.totalWaves === Infinity ? '∞' : g.totalWaves;
    this.set($('hWave'), 'wv', `Welle ${g.wave}/${total}`);
    let cd = '';
    if (g.countdown !== null && g.wave > 0 && !g.countdownPaused) cd = 'nächste in ' + Math.ceil(g.countdown) + ' s';
    else if (g.wave > 0 && (g.spawnQueue.length || g.enemies.length)) cd = g.enemies.length + ' Gegner';
    else if (g.wave === 0 || g.countdownPaused) cd = 'bereit';
    this.set($('hCountdown'), 'cd', cd);
    // Nächste-Welle-Knopf
    const nb = $('btnNext');
    let label, dis = false, pulse = false;
    if (g.wave >= g.totalWaves) { label = 'Letzte Welle'; dis = true; }
    else if (g.wave === 0 || g.countdownPaused) { label = `Welle ${g.wave + 1} starten`; pulse = g.towers.length > 0; }
    else if (g.countdown !== null) { const bon = g.earlyBonus(); label = `Früher starten +${bon}`; }
    else { label = 'Welle läuft …'; dis = true; }
    this.set($('nextLabel'), 'nl', label);
    if (nb.disabled !== dis) nb.disabled = dis;
    nb.classList.toggle('pulse', pulse);
    // Vorschau
    const pw = g.nextWaveDef ? g.nextWaveDef.w : -1;
    if (pw !== this.lastPreviewWave) {
      this.lastPreviewWave = pw;
      const pv = $('preview');
      pv.innerHTML = '';
      if (g.nextWaveDef) {
        pv.appendChild(el('span', 'pvlabel', g.nextWaveDef.isBoss ? 'Boss-Welle:' : 'Nächste:'));
        for (const [type, s] of Object.entries(g.nextWaveDef.summary)) {
          const d = el('div', 'pv' + (s.elite ? ' elite' : '') + (type === 'boss' ? ' boss' : ''), `<img alt="" src="${enemyIcon(type, s.elite > 0)}"><b>${s.n}</b>`);
          const E = ENEMIES[type];
          d.title = `${E.name}: ${E.desc || ''}${s.elite ? ` – davon ${s.elite} Elite. ${ELITE_INFO[type] || ''}` : ''}`;
          pv.appendChild(d);
        }
        if (g.nextWaveDef.event) pv.appendChild(el('span', 'pvlabel', '⚠ Ereignis'));
      }
    }
    // Türme bezahlbar?
    for (const t of TOWER_ORDER) {
      const poor = g.credits < TOWERS[t].tiers[1].cost;
      const k = 'tp' + t;
      if (this.cache.get(k) !== poor) { this.cache.set(k, poor); this.towerBtns[t].classList.toggle('poor', poor); }
    }
    // Fähigkeiten
    for (const id of ABILITY_ORDER) {
      const info = g.abilityInfo(id), bt = this.abilBtns[id];
      const st = (info.locked ? 'L' : '') + (info.ready ? 'R' : '') + (g.energy < info.energy ? 'N' : '') + (this.targeting === id ? 'A' : '');
      if (this.cache.get('as' + id) !== st) {
        this.cache.set('as' + id, st);
        bt.classList.toggle('locked', info.locked); bt.classList.toggle('ready', info.ready);
        bt.classList.toggle('noen', g.energy < info.energy); bt.classList.toggle('active', this.targeting === id);
      }
      this.set(bt.querySelector('.en'), 'ae' + id, info.locked ? '' : info.energy + '');
      const f = info.left > 0 ? info.left / info.cd : 0;
      if (this.cache.get('acdv' + id) !== f.toFixed(3)) { this.cache.set('acdv' + id, f.toFixed(3)); bt.querySelector('.cdov').style.setProperty('--cd', f.toFixed(3)); }
      this.set(bt.querySelector('.cdt'), 'act' + id, info.left > 0 ? Math.ceil(info.left) + '' : '');
    }
    // Kommandant
    const h = g.hero;
    if (h) {
      this.heroBtn.classList.toggle('sel', this.heroSelected);
      this.heroBtn.classList.toggle('dead', h.dead > 0);
      this.set(this.heroBtn.querySelector('.lv'), 'hl', h.level + '');
      this.set(this.heroBtn.querySelector('.hpb div'), 'hhp', (h.hp / h.maxHp * 100).toFixed(0) + '%', 'width');
      this.set(this.heroBtn.querySelector('.resp'), 'hr', h.dead > 0 ? Math.ceil(h.dead) + '' : '');
      if (h.dead > 0 && this.heroSelected) this.heroSelected = false;
      HERO.abilities.forEach((a, i) => {
        const bt = this.heroAbBtns[i], left = h.abil[i];
        const cdMax = a.cd * (g.res.has('c5') ? 0.7 : 1);
        bt.classList.toggle('ready', left <= 0 && h.dead <= 0);
        const f = left > 0 ? (left / cdMax).toFixed(3) : '0';
        if (this.cache.get('hcd' + i) !== f) { this.cache.set('hcd' + i, f); bt.querySelector('.cdov').style.setProperty('--cd', f); }
        this.set(bt.querySelector('.cdt'), 'hct' + i, left > 0 ? Math.ceil(left) + '' : '');
      });
    }
    // Boss-Leiste
    let boss = null;
    for (const e of g.enemies) if (e.boss && e.active) { boss = e; break; }
    $('bossbar').classList.toggle('hidden', !boss);
    sfx.setBoss(!!boss && !this.paused);
    if (boss) {
      this.set($('bossHp'), 'bh', (boss.hp / boss.maxHp * 100).toFixed(1) + '%', 'width');
      this.set($('bossSh'), 'bs', (boss.maxShield ? boss.shield / boss.maxShield * 100 : 0).toFixed(1) + '%', 'width');
    }
    // Ereignis
    const ev = g.activeEvent || g.pendingEvent;
    const eb = $('eventbadge');
    if (ev) {
      const names = { meteor: 'Meteoritenschauer', sand: 'Sandsturm', storm: 'Energiesturm' };
      const txt = g.activeEvent ? `${names[ev.type]} · noch ${Math.ceil(ev.end - g.time)} s` : `${names[ev.type]} in ${Math.ceil(ev.at - g.time)} s`;
      this.set(eb, 'ev', txt);
      eb.className = ev.type === 'storm' ? 'good' : 'warn';
    } else eb.classList.add('hidden');
    $('pausedLabel').classList.toggle('hidden', !this.paused || !!document.querySelector('.screen.show'));
    // Panel aktualisieren
    this.panelTimer -= dt;
    if (this.panelTimer <= 0) {
      this.panelTimer = 0.25;
      if (this.selected?.kind === 'tower' && !g.towers.includes(this.selected.tower)) this.select(null);
      else if (this.selected) {
        // Werte im Panel nachziehen (ohne Neuaufbau bei Interaktion)
        const t = this.selected.tower;
        const sig = t ? `${t.id}|${t.tier}|${t.offline > 0}|${t.hasFired}|${t.mode}` : `base|${JSON.stringify(b.up)}`;
        if (sig !== this._panelSig) { this._panelSig = sig; this.renderPanel(); }
        else {
          const st = $('panel').querySelector('.stats');
          if (st) { const html = t ? this.towerStatsHtml(t) : this.baseStatsHtml(); if (st.innerHTML !== html) st.innerHTML = html; }
          this.refreshPanelAfford();
        }
      }
    }
  }

  // ---------------------------------------------------------------- Menüs
  showMenu() {
    this.mode = 'menu';
    const s = this.$('scrMenu');
    s.innerHTML = '';
    const d = store.data;
    const box = el('div', 'box');
    box.appendChild(el('h1', 'title', GAME_TITLE));
    box.appendChild(el('p', 'subtitle', 'Forschungsstation Aurelis · Planet Veyra IV'));
    const m = el('nav', 'tmenu');
    const item = (label, sub, fn, cls = '') => m.appendChild(this.btn(`${label}${sub ? `<small>${sub}</small>` : ''}`, 'titem ' + cls, fn));
    if (d.save) item('Spiel fortsetzen', `${MODE_NAME[d.save.mode]} · ${d.save.mapDef?.name || ''} · Welle ${d.save.wave}`, () => this.continueGame(), 'accent');
    item('Standard', '30 Wellen · mit Tipps', () => this.showMaps('standard'));
    item('Advance', 'Elite-Gegner · Kommandant · Forschung', () => this.showMaps('expert'));
    const dd = d.daily[todayKey()];
    item('Tägliche Herausforderung', dd ? `heute ${fmt(dd.score)} Punkte${dd.done ? ' · geschafft' : ''}` : 'jeden Tag neue Regeln', () => this.showDaily());
    item('Karten-Editor', 'eigene Wege und Landschaften', () => this.openEditor());
    item('Erfolge', `${Object.keys(d.achievements).length} von ${ACHIEVEMENTS.length}`, () => this.showAch());
    item('Einstellungen', '', () => this.showSettings('scrMenu'));
    box.appendChild(m);
    box.appendChild(el('div', 'menufoot', `<span>Highscore <b>${fmt(d.highscore)}</b></span><span>Forschung <b>${d.research.points} P</b></span><span>Besiegte Gegner <b>${fmt(d.stats.kills)}</b></span>`));
    s.appendChild(box);
    this.showScreen('scrMenu');
  }

  showMaps(mode) {
    const s = this.$('scrMaps');
    s.innerHTML = '';
    const d = store.data, st = this.settings;
    if (!DIFFICULTIES[st.difficulty]) st.difficulty = 'mittel';
    const box = el('div', 'box card');
    const hdr = el('div', 'hdr', `<h2>${MODE_NAME[mode]} · Karte wählen</h2>`);
    if (mode === 'expert') hdr.appendChild(this.btn(`Forschungslabor · ${d.research.points} P`, 'btn', () => this.showResearch('maps-expert')));
    hdr.appendChild(this.btn('Zurück', 'btn', () => this.showMenu()));
    box.appendChild(hdr);
    const opt = el('div', 'optrow', '<span class="lbl">Schwierigkeit</span>');
    const seg = el('div', 'seg');
    for (const k of DIFF_ORDER) seg.appendChild(this.btn(DIFFICULTIES[k].name, st.difficulty === k ? 'on' : '', () => { st.difficulty = k; store.save(); this.showMaps(mode); }));
    opt.appendChild(seg);
    const tg = el('label', 'toggle', `<input type="checkbox" ${this.endless ? 'checked' : ''}><span class="sw"></span>Endlos-Modus`);
    tg.querySelector('input').onchange = (e) => { this.endless = e.target.checked; sfx.play('click'); this.showMaps(mode); };
    opt.appendChild(tg);
    box.appendChild(opt);
    const D = DIFFICULTIES[st.difficulty];
    box.appendChild(el('p', 'diffdesc', `${D.desc} Start mit ${D.startCredits} Credits, Kern mit ${mode === 'expert' ? D.baseHp : D.baseHp} Leben.${mode === 'expert' ? ' Advance: Elite-Gegner, Kommandant, Karten-Ereignisse und Forschungspunkte.' : ''}`));
    const list = el('div', 'mlist');
    const all = [...MAPS, ...d.customMaps.map(m => ({ ...m, custom: true }))];
    for (const m of all) {
      const key = `${mode}:${st.difficulty}:${m.id}:${this.endless ? 1 : 0}`;
      const best = d.best[key];
      const row = el('button', 'mrow');
      const cv = document.createElement('canvas'); cv.width = 264; cv.height = 147;
      row.appendChild(cv);
      drawThumb(cv, m);
      const bn = BIOMES[normalizeDef(m).biome]?.name || '';
      row.appendChild(el('div', '', `<h4>${m.name}</h4><p>${m.desc || 'Eigene Karte aus dem Editor.'}</p><span class="lbl">${bn}${m.custom ? ' · eigene Karte' : ''}</span>`));
      row.appendChild(el('div', 'best' + (best ? '' : ' none'), best ? `Welle ${best.wave}<br>${fmt(best.score)} P${best.won ? '<br>Sieg' : ''}` : 'neu'));
      row.onclick = () => { sfx.init(); sfx.play('click'); this.startGame({ mode, mapDef: m, endless: this.endless, difficulty: st.difficulty }); };
      list.appendChild(row);
    }
    box.appendChild(list);
    s.appendChild(box);
    this.showScreen('scrMaps');
  }

  showDaily() {
    const s = this.$('scrDaily');
    s.innerHTML = '';
    const cfg = dailyConfig();
    const map = MAPS.find(m => m.id === cfg.mapId);
    const rec = store.data.daily[cfg.key];
    const box = el('div', 'box card');
    box.style.width = 'min(640px,100%)';
    const [y, mo, da] = cfg.key.split('-');
    const hdr = el('div', 'hdr', `<h2>Tägliche Herausforderung</h2>`);
    hdr.appendChild(this.btn('Zurück', 'btn', () => this.showMenu()));
    box.appendChild(hdr);
    box.appendChild(el('p', '', `<span style="color:var(--dim)">${da}.${mo}.${y} – heute spielen alle mit denselben Regeln und denselben Wellen. 20 Wellen auf Schwierigkeit Mittel, mit Kommandant und Ereignissen wie im Advance-Modus, aber ohne Forschungs-Boni.</span>`));
    const cv = document.createElement('canvas'); cv.width = 360; cv.height = 200; cv.style.cssText = 'width:100%;max-width:360px;border-radius:12px;display:block;margin:8px auto;border:1px solid var(--line2)';
    drawThumb(cv, map);
    box.appendChild(cv);
    box.appendChild(el('p', '', `<b>Karte:</b> ${map.name}`));
    const rules = el('div', 'dailyrules');
    for (const id of cfg.mods) {
      const m = DAILY_MODS.find(x => x.id === id);
      let extra = '';
      if (id === 'banned') extra = ' Gesperrt: ' + cfg.banned.map(t => TOWERS[t].name).join(', ') + '.';
      rules.appendChild(el('div', '', `<b>${m.name}</b><small>${m.desc}${extra}</small>`));
    }
    box.appendChild(rules);
    box.appendChild(el('p', '', rec ? `Dein Bestwert heute: <b style="color:var(--gold)">${fmt(rec.score)}</b> Punkte, Welle ${rec.wave}${rec.done ? ' – geschafft!' : ''}` : '<span style="color:var(--dim)">Heute noch nicht gespielt.</span>'));
    const r = el('div', 'rowbtns');
    r.appendChild(this.btn('Herausforderung starten', 'btn gold', () => this.startGame({ mode: 'daily', mapDef: map, endless: false, daily: cfg })));
    box.appendChild(r);
    s.appendChild(box);
    this.showScreen('scrDaily');
  }

  showResearch(back) {
    const s = this.$('scrResearch');
    s.innerHTML = '';
    const R = store.data.research;
    const box = el('div', 'box card');
    const hdr = el('div', 'hdr', `<h2>Forschungslabor</h2><span style="font-family:var(--mono);color:var(--violet);font-size:18px;font-weight:800">${R.points} Punkte</span>`);
    hdr.appendChild(this.btn('Zurück', 'btn', () => back === 'maps-expert' ? this.showMaps('expert') : this.showMenu()));
    box.appendChild(hdr);
    box.appendChild(el('p', '', '<span style="color:var(--dim);font-size:13px">Forschungspunkte gibt es für jede Advance-Partie (je 2 geschaffte Wellen 1 Punkt, Bosse und Siege extra, höhere Schwierigkeit bringt mehr). Verbesserungen gelten dauerhaft im Advance-Modus.</span>'));
    const grid = el('div', 'research');
    RESEARCH_BRANCHES.forEach((bn, bi) => {
      const col = el('div', 'rcol', `<h3>${bn}</h3>`);
      for (const n of RESEARCH.filter(r => r.branch === bi)) {
        const owned = R.unlocked.includes(n.id);
        const reqOk = n.req.every(q => R.unlocked.includes(q));
        const can = !owned && reqOk && R.points >= n.cost;
        const reqTxt = !reqOk ? ' Benötigt: ' + n.req.map(q => RESEARCH.find(r => r.id === q).name).join(' + ') : '';
        const b = this.btn(`<b>${n.name}</b><span class="c">${owned ? '✓' : n.cost + ' P'}</span><small>${n.desc}${reqTxt}</small>`, 'rnode' + (owned ? ' owned' : can ? ' can' : !reqOk ? ' locked' : ''), () => {
          if (!can) { sfx.play('error'); return; }
          R.points -= n.cost; R.unlocked.push(n.id); store.save(true);
          sfx.play('upgrade');
          if (R.unlocked.length >= 5 && !store.data.achievements.research5) { store.data.achievements.research5 = Date.now(); this.toast('Erfolg freigeschaltet: <b>Forschungsleitung</b>', 'ach'); sfx.play('achieve'); store.save(true); }
          this.showResearch(back);
        });
        col.appendChild(b);
      }
      grid.appendChild(col);
    });
    box.appendChild(grid);
    if (R.unlocked.length) {
      const rr = el('div', 'rowbtns'); rr.style.marginTop = '12px';
      rr.appendChild(this.btn('Forschung zurücksetzen (Punkte zurück)', 'btn', () => {
        let back2 = 0; for (const id of R.unlocked) back2 += RESEARCH.find(r => r.id === id).cost;
        R.points += back2; R.unlocked = []; store.save(true); this.showResearch(back);
      }));
      box.appendChild(rr);
    }
    s.appendChild(box);
    this.showScreen('scrResearch');
  }

  showAch() {
    const s = this.$('scrAch');
    s.innerHTML = '';
    const A = store.data.achievements;
    const box = el('div', 'box card');
    const hdr = el('div', 'hdr', `<h2>Erfolge</h2><span style="color:var(--gold);font-family:var(--mono);font-weight:800">${Object.keys(A).length} / ${ACHIEVEMENTS.length}</span>`);
    hdr.appendChild(this.btn('Zurück', 'btn', () => this.showMenu()));
    box.appendChild(hdr);
    const grid = el('div', 'achs');
    for (const a of ACHIEVEMENTS) {
      const done = !!A[a.id];
      const date = done ? new Date(A[a.id]).toLocaleDateString('de-DE') : '';
      grid.appendChild(el('div', 'ach' + (done ? ' done' : ''), `<div class="medal">${done ? '' : '<span style="color:var(--dim)">?</span>'}</div><div><b>${a.name}</b><small>${a.desc}${done ? ' · ' + date : ''}</small></div>`));
    }
    box.appendChild(grid);
    s.appendChild(box);
    this.showScreen('scrAch');
  }

  showSettings(back) {
    const s = this.$('scrSettings');
    s.innerHTML = '';
    const st = this.settings;
    const box = el('div', 'box card');
    box.style.width = 'min(760px,100%)';
    const hdr = el('div', 'hdr', '<h2>Einstellungen</h2>');
    hdr.appendChild(this.btn('Zurück', 'btn primary', () => back === 'scrPause' ? this.openPause() : this.showMenu()));
    box.appendChild(hdr);
    const row = (label, ctrl) => { const r = el('div', 'setrow', `<span>${label}</span>`); r.appendChild(ctrl); box.appendChild(r); };
    const vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = st.volume;
    vol.oninput = () => { st.volume = +vol.value; sfx.init(); sfx.setVolume(st.volume); store.save(); };
    vol.onchange = () => sfx.play('laser');
    row('Lautstärke', vol);
    const tog = (key, label, fn) => {
      const t = el('label', 'toggle', `<input type="checkbox" ${st[key] ? 'checked' : ''}><span class="sw"></span>`);
      t.querySelector('input').onchange = (e) => { st[key] = e.target.checked; store.save(); fn && fn(st[key]); sfx.play('click'); };
      row(label, t);
    };
    tog('muted', 'Stumm', (v) => { sfx.setMuted(v); this.updateMuteIcon(); });
    tog('music', 'Hintergrundklang', (v) => sfx.setMusic(v));
    tog('shake', 'Bildschirmwackeln');
    tog('tips', 'Tipps anzeigen');
    tog('showFps', 'Bilder pro Sekunde anzeigen', (v) => this.$('fps').classList.toggle('hidden', !v));
    const q = el('div', 'seg');
    for (const [v, l] of [['hoch', 'Hoch'], ['mittel', 'Mittel'], ['niedrig', 'Niedrig']]) {
      q.appendChild(this.btn(l, st.quality === v ? 'on' : '', () => { st.quality = v; store.save(); if (this.game) this.game.particles.quality = { hoch: 1, mittel: 0.7, niedrig: 0.4 }[v]; this.r.setQuality(v); this.showSettings(back); }));
    }
    row('Grafik', q);
    const rb = el('div', 'rowbtns'); rb.style.justifyContent = 'flex-end';
    rb.appendChild(this.btn('Tipps erneut zeigen', 'btn', () => { store.data.tips = {}; store.save(); this.toast('Tipps werden wieder angezeigt', 'good'); }));
    rb.appendChild(this.btn('Alle Daten löschen', 'btn danger', () => this.confirm('Alle Daten löschen?', 'Rekorde, Forschung, Erfolge, eigene Karten und Einstellungen werden gelöscht.', 'Löschen', () => { store.reset(); location.reload(); }, 'scrSettings')));
    row('Fortschritt', rb);
    box.appendChild(el('div', 'sectlabel', 'Steuerung'));
    box.appendChild(el('div', 'keys', [
      ['Klick / Tippen', 'Bauen, Auswählen'], ['1–9', 'Turm wählen'], ['Rechtsklick', 'Abbrechen'], ['Esc', 'Abbrechen / Pause-Menü'],
      ['Leertaste', 'Pause'], ['N', 'Nächste Welle'], ['F', 'Tempo 1x/2x/3x'], ['M', 'Ton an/aus'],
      ['Q W E R', 'Fähigkeiten'], ['U', 'Turm aufrüsten'], ['V / Entf', 'Turm verkaufen'], ['T', 'Zielmodus wechseln'],
      ['B', 'Kern-Ausbau'], ['H', 'Kommandant wählen'], ['Y / X', 'Kommandant-Fähigkeiten'], ['Umschalt', 'Mehrere Türme bauen'],
    ].map(([k, v]) => `<div><kbd>${k}</kbd>${v}</div>`).join('')));
    s.appendChild(box);
    this.showScreen('scrSettings');
  }

  openEditor() {
    if (!this.editor) return;
    this.mode = 'editor';
    this.editor.open();
  }
  setFps(v) { this.$('fps').textContent = v + ' FPS'; }
}

// ---------------------------------------------------------------- Werte-Texte für Türme
export function statLines(sp, g, t) {
  const L = [];
  const dm = g ? g.rules.towerDmgMul : 1;
  const n = (v) => (Math.round(v * 10) / 10).toLocaleString('de-DE');
  const range = t && g ? g.towerRange(t) / TILE : sp.range;
  switch (sp.kind) {
    case 'bolt': L.push(['Schaden', n(sp.dmg * dm) + (sp.multi ? ' ×' + sp.multi : '')], ['Feuerrate', n(sp.rate) + '/s']); break;
    case 'beam': L.push(['Schaden/s', n(sp.dps * dm) + '→' + n(sp.dps * sp.ramp * dm)], ['Strahlen', sp.multi || 1]); break;
    case 'shell': L.push(['Schaden', n(sp.dmg * dm)], ['Feuerrate', n(sp.rate) + '/s'], ['Fläche', n(sp.splash)]); if (sp.burn) L.push(['Brand', n(sp.burn.dps) + '/s']); if (sp.cluster) L.push(['Splitter', sp.cluster]); break;
    case 'rail': L.push(['Schaden', n(sp.dmg * dm)], ['Feuerrate', n(sp.rate) + '/s'], ['Durchschlag', sp.pierce >= 50 ? 'alle' : sp.pierce]); if (sp.crit) L.push(['Kritisch', Math.round(sp.crit * 100) + ' %']); if (sp.shots) L.push(['Schüsse', sp.shots]); break;
    case 'pulse': L.push(['Bremst', Math.round(sp.slow * 100) + ' %'], ['Schild-Schaden', sp.shieldDmg], ['Pulse', n(sp.rate) + '/s'], ['Schaden', n(sp.dmg * dm)]); if (sp.shred) L.push(['Panzer −', sp.shred]); break;
    case 'missile': L.push(['Schaden', n(sp.dmg * dm) + (sp.missiles ? ' ×' + sp.missiles : '')], ['Feuerrate', n(sp.rate) + '/s'], ['vs. Flieger', '×' + sp.airMul]); break;
    case 'chain': L.push(['Schaden', n(sp.dmg * dm)], ['Sprünge', sp.chains], ['Feuerrate', n(sp.rate) + '/s']); if (sp.stun) L.push(['Lähmung', n(sp.stun) + ' s']); break;
    case 'drones': L.push(['Drohnen', sp.drones], ['Schaden', n(sp.dmg * dm)], ['Feuerrate', n(sp.rate) + '/s']); if (sp.bomb) L.push(['Bomben', 'Fläche']); break;
    case 'shieldgen': L.push(['Schild', sp.shieldCap], ['Laden', sp.shieldRegen + '/s'], ['Radius', n(sp.range)]); if (sp.rateBuff) L.push(['Feuerrate +', Math.round(sp.rateBuff * 100) + ' %']); break;
    case 'radar': L.push(['Scanbereich', n(range)]); if (sp.rangeBuff) L.push(['Reichweite +', Math.round(sp.rangeBuff * 100) + ' %']); if (sp.dmgBuff) L.push(['Schaden +', Math.round(sp.dmgBuff * 100) + ' %']); if (sp.markDmg) L.push(['Markierung', '+15 %']); break;
  }
  if (sp.kind !== 'shieldgen' && sp.kind !== 'radar') L.push(['Reichweite', n(range)]);
  if (sp.kind !== 'shieldgen' && sp.kind !== 'radar') L.push(['Ziele', sp.ground !== false && sp.air ? 'alle' : sp.air ? 'Luft' : 'Boden']);
  return L;
}
