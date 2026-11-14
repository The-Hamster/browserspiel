// Karten-Editor: Weg frei zeichnen, Startpunkt, Landschaft, Hindernisse, speichern, spielen
import { TILE, COLS, ROWS, WORLD_W, WORLD_H, BIOMES, BIOME_ORDER, TILT } from './data.js';
import { buildMap, normalizeDef } from './game.js';
import { store } from './storage.js';
import { sfx } from './audio.js';
import { el } from './util.js';
import { glow, ci, obstacleSprite } from './sprites.js';

const OBST = [['rock', 'Fels'], ['tree', 'Pflanze'], ['crystal', 'Kristall']];
const snap = (v) => Math.round(v * 4) / 4;

export class Editor {
  constructor(renderer, ui) {
    this.r = renderer; this.ui = ui;
    this.reset();
  }
  reset() {
    this.id = 'eigene-' + Date.now().toString(36);
    this.name = '';
    this.biome = 'wueste';
    this.wps = [];
    this.obstacles = [];
    this.tool = 'path';
    this.obstKind = 'rock';
    this.history = [];
    this.dirty = true;
    this.hover = null;
  }
  snapshot() {
    this.history.push({ wps: this.wps.map(p => p.slice()), obstacles: this.obstacles.map(o => o.slice()), biome: this.biome });
    if (this.history.length > 60) this.history.shift();
  }
  undo() {
    const h = this.history.pop();
    if (!h) { sfx.play('error'); return; }
    Object.assign(this, h); this.dirty = true; this.refreshInfo(); sfx.play('click');
  }

  open() {
    this.ui.hideScreens();
    const s = document.getElementById('scrEditor');
    s.innerHTML = '';
    const t = el('div', 'etool');
    t.appendChild(el('h3', '', 'KARTEN-EDITOR'));
    const name = el('input'); name.type = 'text'; name.placeholder = 'Name der Karte'; name.maxLength = 28; name.value = this.name;
    name.oninput = () => { this.name = name.value; };
    t.appendChild(name);
    t.appendChild(el('div', 'lbl', 'Werkzeug'));
    const tools = el('div', 'tools');
    const mk = (id, label) => this.ui.btn(label, 'btn' + (this.tool === id ? ' on' : ''), () => { this.tool = id; this.open(); });
    tools.appendChild(mk('path', 'Weg zeichnen'));
    tools.appendChild(mk('start', 'Startpunkt'));
    tools.appendChild(mk('obst', 'Hindernisse'));
    tools.appendChild(this.ui.btn('Rückgängig', 'btn', () => this.undo()));
    t.appendChild(tools);
    if (this.tool === 'obst') {
      const ob = el('div', 'seg');
      for (const [k, l] of OBST) ob.appendChild(this.ui.btn(l, this.obstKind === k ? 'on' : '', () => { this.obstKind = k; this.open(); }));
      t.appendChild(ob);
    }
    const hints = {
      path: 'Tippe Punkte nacheinander an – Kurven werden automatisch rund. Der erste Punkt ist der Start der Gegner, der letzte wird zum Reaktorkern. Letzten Punkt erneut antippen = entfernen.',
      start: 'Tippe eine Stelle an, um den Startpunkt der Gegner dorthin zu verschieben.',
      obst: 'Tippe auf die Karte, um ein Hindernis zu setzen. Auf ein vorhandenes Hindernis tippen = entfernen. Dort kann nicht gebaut werden.',
    };
    t.appendChild(el('div', 'hint', hints[this.tool]));
    t.appendChild(el('div', 'lbl', 'Landschaft'));
    const bs = el('div', 'tools');
    for (const b of BIOME_ORDER) bs.appendChild(this.ui.btn(BIOMES[b].name, 'btn' + (this.biome === b ? ' on' : ''), () => { this.snapshot(); this.biome = b; this.dirty = true; this.open(); }));
    t.appendChild(bs);
    t.appendChild(this.ui.btn('Alles leeren', 'btn', () => { this.snapshot(); this.wps = []; this.obstacles = []; this.dirty = true; this.refreshInfo(); }));
    this.info = el('div', 'estat');
    t.appendChild(this.info);
    t.appendChild(this.ui.btn('Speichern', 'btn primary', () => this.save()));
    const play = el('div', 'tools');
    play.appendChild(this.ui.btn('Standard spielen', 'btn', () => this.play('standard')));
    play.appendChild(this.ui.btn('Advance spielen', 'btn', () => this.play('expert')));
    t.appendChild(play);
    t.appendChild(el('div', 'lbl', 'Gespeicherte Karten'));
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
    const d = normalizeDef(m);
    this.id = m.id; this.name = m.name; this.biome = d.biome || 'wueste';
    this.wps = (d.editorWps || d.paths[0] || []).map(p => p.slice());
    this.obstacles = (d.obstacles || []).map(o => o.slice());
    this.open();
  }

  // Kartendefinition aus dem Editor-Zustand
  def() {
    const wps = this.wps.map(p => p.slice());
    if (wps.length > 1) {
      const [x, y] = wps[0];
      const dl = x, dr = COLS - x, dt = y, db = ROWS - y, m = Math.min(dl, dr, dt, db);
      if (m < 0.8) wps.unshift(m === dl ? [-1.2, y] : m === dr ? [COLS + 1.2, y] : m === dt ? [x, -1.2] : [x, ROWS + 1.2]);
    }
    return {
      v: 4, id: this.id, name: this.name.trim() || 'Eigene Karte', desc: 'Eigene Karte aus dem Editor.', custom: true, biome: this.biome,
      paths: wps.length >= 2 ? [wps] : [], base: wps.length ? wps[wps.length - 1] : [-9, -9],
      water: [], obstacles: this.obstacles.map(o => o.slice()), editorWps: this.wps.map(p => p.slice()),
    };
  }
  pathLength() {
    let n = 0;
    for (let i = 1; i < this.wps.length; i++) n += Math.hypot(this.wps[i][0] - this.wps[i - 1][0], this.wps[i][1] - this.wps[i - 1][1]);
    return n;
  }
  problems() {
    const p = [];
    if (this.wps.length < 2) p.push('Weg fehlt (mindestens Start und Ziel).');
    else if (this.pathLength() < 10) p.push('Weg ist zu kurz (mindestens 10 Felder).');
    if (this.wps.length) {
      const [bx, by] = this.wps[this.wps.length - 1];
      if (bx < 1.3 || by < 1.3 || bx > COLS - 1.3 || by > ROWS - 1.3) p.push('Der Kern (Wegende) braucht etwas Abstand zum Rand.');
    }
    return p;
  }
  refreshInfo() {
    if (!this.info) return;
    const pr = this.problems();
    this.info.className = 'estat ' + (pr.length ? 'bad' : 'ok');
    this.info.innerHTML = `Weglänge: ${this.pathLength().toFixed(1)} Felder · Hindernisse: ${this.obstacles.length}<br>${pr.length ? pr.join('<br>') : 'Karte ist spielbereit.'}`;
  }
  save() {
    const pr = this.problems();
    if (pr.length) { this.ui.toast(pr[0], 'warn'); sfx.play('error'); return null; }
    const d = this.def();
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

  posFromEvent(e) {
    const w = this.r.screenToWorld(e.clientX, e.clientY);
    const x = snap(w.x / TILE), y = snap(w.y / TILE);
    if (x < 0 || y < 0 || x > COLS || y > ROWS) return null;
    return { x, y };
  }
  pointer(type, e) {
    const t = this.posFromEvent(e);
    this.hover = t;
    if (type !== 'down' || !t) return;
    if (this.tool === 'path') {
      const last = this.wps[this.wps.length - 1];
      this.snapshot();
      if (last && Math.hypot(last[0] - t.x, last[1] - t.y) < 0.5) this.wps.pop();
      else this.wps.push([t.x, t.y]);
      sfx.play('click');
    } else if (this.tool === 'start') {
      this.snapshot();
      if (this.wps.length) this.wps[0] = [t.x, t.y]; else this.wps.push([t.x, t.y]);
      sfx.play('click');
    } else if (this.tool === 'obst') {
      this.snapshot();
      const i = this.obstacles.findIndex(o => Math.hypot(o[0] - t.x, o[1] - t.y) < o[2] + 0.2);
      if (i >= 0) this.obstacles.splice(i, 1);
      else this.obstacles.push([t.x, t.y, this.obstKind === 'tree' ? 0.65 : 0.55, this.obstKind]);
      sfx.play('click');
    }
    this.dirty = true; this.refreshInfo();
  }

  render(dt) {
    const r = this.r, g = r.ctx;
    r.time += dt;
    r.drawBackground(dt, 0, 0);
    if (this.dirty) {
      this.dirty = false;
      this.preview = buildMap(this.def());
      this.layer = r.buildMapLayer(this.preview);
    }
    r.worldTransform();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.layer, r.wt.tx, r.wt.ty, WORLD_W * r.wt.s, WORLD_H * TILT * r.wt.s);
    for (const o of [...this.preview.obstacles].sort((a, b) => a.y - b.y)) r.sprUp(obstacleSprite(o, this.preview.biome, r.res), o.x, o.y);
    g.globalAlpha = 1;
    r.resetWT();
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * TILE, 0); g.lineTo(x * TILE, WORLD_H); g.stroke(); }
    for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * TILE); g.lineTo(WORLD_W, y * TILE); g.stroke(); }
    // Wegpunkte
    g.font = '600 12px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    this.wps.forEach(([x, y], i) => {
      const cx = x * TILE, cy = y * TILE;
      const first = i === 0, last = i === this.wps.length - 1 && i > 0;
      const col = first ? '#f0506e' : last ? '#38d6f5' : '#f5c542';
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5;
      g.drawImage(glow(ci(col)), cx - 26, cy - 26, 52, 52);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, first || last ? 12 : 9, 0, 7); g.fill();
      g.fillStyle = '#000'; g.fillText(first ? 'S' : last ? 'K' : String(i), cx, cy + 0.5);
    });
    if (this.hover) {
      const cx = this.hover.x * TILE, cy = this.hover.y * TILE;
      g.strokeStyle = this.tool === 'obst' ? '#34d399' : this.tool === 'start' ? '#f0506e' : '#f5c542'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, this.tool === 'obst' ? 36 : 14, 0, 7); g.stroke();
      if (this.tool === 'path' && this.wps.length) {
        const [lx, ly] = this.wps[this.wps.length - 1];
        g.setLineDash([6, 6]); g.beginPath(); g.moveTo(lx * TILE, ly * TILE); g.lineTo(cx, cy); g.stroke(); g.setLineDash([]);
      }
    }
    g.textBaseline = 'alphabetic';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(r.vignette, 0, 0);
  }
}
