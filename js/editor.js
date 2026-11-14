// Karten-Editor: Weg, Startpunkt und Bauflächen setzen, speichern, spielen
import { TILE, COLS, ROWS, WORLD_W, WORLD_H, CUSTOM_THEME } from './data.js';
import { buildMap, autoPads, orthogonalize } from './game.js';
import { store } from './storage.js';
import { sfx } from './audio.js';
import { el, rgba } from './util.js';
import { glow, ci, roundRect } from './sprites.js';

export class Editor {
  constructor(renderer, ui) {
    this.r = renderer; this.ui = ui;
    this.reset();
  }
  reset() {
    this.id = 'eigene-' + Date.now().toString(36);
    this.name = '';
    this.wps = [];
    this.pads = new Set();
    this.tool = 'path';
    this.history = [];
    this.dirty = true;
    this.hover = null;
    this.paint = null;
  }
  snapshot() { this.history.push({ wps: this.wps.map(p => p.slice()), pads: new Set(this.pads) }); if (this.history.length > 60) this.history.shift(); }
  undo() {
    const h = this.history.pop();
    if (!h) { sfx.play('error'); return; }
    this.wps = h.wps; this.pads = h.pads; this.dirty = true; this.refreshInfo(); sfx.play('click');
  }

  open() {
    this.ui.hideScreens();
    const s = document.getElementById('scrEditor');
    s.innerHTML = '';
    const t = el('div', 'etool');
    t.innerHTML = `<h3>KARTEN-EDITOR</h3>`;
    const name = el('input'); name.type = 'text'; name.placeholder = 'Name der Karte'; name.maxLength = 28; name.value = this.name;
    name.oninput = () => { this.name = name.value; };
    t.appendChild(name);
    const tools = el('div', 'tools');
    const mk = (id, label) => { const b = this.ui.btn(label, 'btn' + (this.tool === id ? ' on' : ''), () => { this.tool = id; this.open(); }); return b; };
    tools.appendChild(mk('path', 'Weg zeichnen'));
    tools.appendChild(mk('start', 'Startpunkt'));
    tools.appendChild(mk('pads', 'Bauflächen'));
    tools.appendChild(this.ui.btn('Rückgängig', 'btn', () => this.undo()));
    t.appendChild(tools);
    const hints = {
      path: 'Tippe Felder nacheinander an: Das erste ist der Startpunkt der Gegner, das letzte wird zum Reaktorkern. Ecken entstehen automatisch. Letzten Punkt erneut antippen = entfernen.',
      start: 'Tippe ein Feld an, um den Startpunkt der Gegner dorthin zu verschieben.',
      pads: 'Tippe oder wische über Felder, um Bauflächen zu setzen oder zu entfernen.',
    };
    t.appendChild(el('div', 'hint', hints[this.tool]));
    const row2 = el('div', 'tools');
    row2.appendChild(this.ui.btn('Auto-Flächen', 'btn', () => { this.snapshot(); const m = buildMap(this.def(true)); this.pads = autoPads(m.pathTiles, m.blocked); this.dirty = true; this.refreshInfo(); }));
    row2.appendChild(this.ui.btn('Leeren', 'btn', () => { this.snapshot(); this.wps = []; this.pads.clear(); this.dirty = true; this.refreshInfo(); }));
    t.appendChild(row2);
    this.info = el('div', 'estat');
    t.appendChild(this.info);
    t.appendChild(this.ui.btn('Speichern', 'btn primary', () => this.save()));
    const play = el('div', 'tools');
    play.appendChild(this.ui.btn('Standard spielen', 'btn', () => this.play('standard')));
    play.appendChild(this.ui.btn('Experte spielen', 'btn', () => this.play('expert')));
    t.appendChild(play);
    t.appendChild(el('div', 'sectlabel', 'Gespeicherte Karten'));
    const list = el('div', 'elist');
    const maps = store.data.customMaps;
    if (!maps.length) list.appendChild(el('div', 'hint', 'Noch keine eigenen Karten.'));
    for (const m of maps) {
      const r = el('div', '', `<span title="${m.name}">${m.name}</span>`);
      r.appendChild(this.ui.btn('Laden', '', () => this.load(m)));
      r.appendChild(this.ui.btn('✕', '', () => this.ui.confirm('Karte löschen?', `„${m.name}“ wird endgültig gelöscht.`, 'Löschen', () => {
        store.data.customMaps = store.data.customMaps.filter(x => x.id !== m.id); store.save(true);
        this.ui.mode = 'editor'; this.open();
      }, 'scrEditor')));
      list.appendChild(r);
    }
    t.appendChild(list);
    t.appendChild(el('div', '', '<div style="flex:1"></div>'));
    t.appendChild(this.ui.btn('Neue Karte', 'btn', () => { this.reset(); this.open(); }));
    t.appendChild(this.ui.btn('Zurück zum Menü', 'btn', () => this.exit()));
    s.appendChild(t);
    this.ui.showScreen('scrEditor');
    this.ui.mode = 'editor';
    this.ui.layout();
    this.dirty = true;
    this.refreshInfo();
  }
  exit() { this.ui.mode = 'menu'; this.ui.hideScreens(); this.ui.layout(); this.ui.showMenu(); }
  load(m) {
    this.reset();
    this.id = m.id; this.name = m.name;
    this.wps = (m.editorWps || m.paths[0]).map(p => p.slice());
    for (const [x, y] of m.pads || []) this.pads.add(y * COLS + x);
    this.open();
  }

  // Kartendefinition aus dem Editor-Zustand
  def(forAuto = false) {
    let wps = this.wps.map(p => p.slice());
    if (wps.length) {
      const [x, y] = wps[0];
      let ext = null;
      if (x === 0) ext = [-1, y]; else if (x === COLS - 1) ext = [COLS, y]; else if (y === 0) ext = [x, -1]; else if (y === ROWS - 1) ext = [x, ROWS];
      if (ext && wps.length > 1) wps.unshift(ext);
    }
    const pads = [...this.pads].map(i => [i % COLS, Math.floor(i / COLS)]);
    return {
      id: this.id, name: this.name.trim() || 'Eigene Karte', desc: 'Eigene Karte aus dem Editor.', theme: CUSTOM_THEME,
      paths: wps.length >= 2 ? [wps] : [], base: wps.length ? wps[wps.length - 1] : [-9, -9],
      pads: pads.length || forAuto ? pads : [[-5, -5]], editorWps: this.wps.map(p => p.slice()),
    };
  }
  pathLength() {
    if (this.wps.length < 2) return 0;
    const o = orthogonalize(this.wps);
    let n = 0; for (let i = 1; i < o.length; i++) n += Math.abs(o[i][0] - o[i - 1][0]) + Math.abs(o[i][1] - o[i - 1][1]);
    return n;
  }
  problems() {
    const p = [];
    if (this.wps.length < 2) p.push('Weg fehlt (mindestens Start und Ziel).');
    else if (this.pathLength() < 10) p.push('Weg ist zu kurz (mindestens 10 Felder).');
    if (this.wps.length) {
      const [bx, by] = this.wps[this.wps.length - 1];
      if (bx < 1 || by < 1 || bx > COLS - 2 || by > ROWS - 2) p.push('Der Kern (Wegende) braucht einen Feld Abstand zum Rand.');
    }
    return p;
  }
  refreshInfo() {
    if (!this.info) return;
    const pr = this.problems();
    const padCount = this.pads.size;
    this.info.className = 'estat ' + (pr.length ? 'bad' : 'ok');
    this.info.innerHTML = `Weglänge: ${this.pathLength()} Felder · Bauflächen: ${padCount || 'automatisch'}<br>${pr.length ? pr.join('<br>') : 'Karte ist spielbereit.'}`;
  }
  finalDef() {
    const d = this.def();
    if (!this.pads.size) {
      const m = buildMap(this.def(true));
      const auto = autoPads(m.pathTiles, m.blocked);
      d.pads = [...auto].map(i => [i % COLS, Math.floor(i / COLS)]);
    }
    return d;
  }
  save() {
    const pr = this.problems();
    if (pr.length) { this.ui.toast(pr[0], 'warn'); sfx.play('error'); return null; }
    const d = this.finalDef();
    const list = store.data.customMaps;
    const i = list.findIndex(m => m.id === d.id);
    if (i >= 0) list[i] = d; else list.push(d);
    if (!store.data.achievements.mapper) { store.data.achievements.mapper = Date.now(); this.ui.toast('Erfolg freigeschaltet: <b>Kartograf</b>', 'ach'); sfx.play('achieve'); }
    store.save(true);
    this.ui.toast(`Karte „${d.name}“ gespeichert`, 'good');
    sfx.play('build');
    this.open();
    return d;
  }
  play(mode) {
    const d = this.save();
    if (!d) return;
    this.ui.hideScreens();
    this.ui.startGame({ mode, mapDef: d, endless: false });
  }

  tileFromEvent(e) {
    const w = this.r.screenToWorld(e.clientX, e.clientY);
    const x = Math.floor(w.x / TILE), y = Math.floor(w.y / TILE);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x, y };
  }
  pointer(type, e) {
    const t = this.tileFromEvent(e);
    this.hover = t;
    if (type === 'up') { this.paint = null; return; }
    if (!t) return;
    if (type === 'down') {
      if (this.tool === 'path') {
        const last = this.wps[this.wps.length - 1];
        this.snapshot();
        if (last && last[0] === t.x && last[1] === t.y) this.wps.pop();
        else this.wps.push([t.x, t.y]);
        sfx.play('click');
      } else if (this.tool === 'start') {
        this.snapshot();
        if (this.wps.length) this.wps[0] = [t.x, t.y]; else this.wps.push([t.x, t.y]);
        sfx.play('click');
      } else if (this.tool === 'pads') {
        this.snapshot();
        const i = t.y * COLS + t.x;
        this.paint = !this.pads.has(i);
        this.applyPaint(t);
      }
      this.dirty = true; this.refreshInfo();
    } else if (type === 'move' && this.paint !== null && (e.buttons || e.pointerType !== 'mouse')) {
      if (this.applyPaint(t)) { this.dirty = true; this.refreshInfo(); }
    }
  }
  applyPaint(t) {
    const i = t.y * COLS + t.x;
    const map = this.preview;
    if (map && (map.pathTiles.has(i) || map.blocked.has(i))) return false;
    if (this.paint && !this.pads.has(i)) { this.pads.add(i); return true; }
    if (!this.paint && this.pads.has(i)) { this.pads.delete(i); return true; }
    return false;
  }

  render(dt) {
    const r = this.r, g = r.ctx;
    r.time += dt;
    r.drawBackground(dt, 0, 0);
    if (this.dirty) {
      this.dirty = false;
      // Bauflächen, die auf dem Weg liegen, entfernen
      this.preview = buildMap(this.def());
      for (const i of [...this.pads]) if (this.preview.pathTiles.has(i) || this.preview.blocked.has(i)) this.pads.delete(i);
      this.preview = buildMap(this.def());
      this.layer = r.buildMapLayer(this.preview);
    }
    r.worldTransform();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(this.layer, 0, 0, WORLD_W, WORLD_H);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * TILE, 0); g.lineTo(x * TILE, WORLD_H); g.stroke(); }
    for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * TILE); g.lineTo(WORLD_W, y * TILE); g.stroke(); }
    // Wegpunkte
    g.font = 'bold 14px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    this.wps.forEach(([x, y], i) => {
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
      const first = i === 0, last = i === this.wps.length - 1 && i > 0;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.6;
      g.drawImage(glow(ci(first ? '#ff3d6e' : last ? '#36f1ff' : '#ffd23e')), cx - 30, cy - 30, 60, 60);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = first ? '#ff3d6e' : last ? '#36f1ff' : '#ffd23e';
      g.beginPath(); g.arc(cx, cy, first || last ? 14 : 10, 0, 7); g.fill();
      g.fillStyle = '#000'; g.fillText(first ? 'S' : last ? 'K' : String(i), cx, cy + 1);
    });
    if (this.hover) {
      g.strokeStyle = this.tool === 'pads' ? '#5dffb0' : this.tool === 'start' ? '#ff3d6e' : '#ffd23e'; g.lineWidth = 2;
      roundRect(g, this.hover.x * TILE + 3, this.hover.y * TILE + 3, TILE - 6, TILE - 6, 8); g.stroke();
    }
    g.textBaseline = 'alphabetic';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(r.vignette, 0, 0);
  }
}
