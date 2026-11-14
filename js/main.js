// Start und Hauptschleife
import { store } from './storage.js';
import { sfx } from './audio.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Editor } from './editor.js';

store.load();
const st = store.data.settings;
sfx.volume = st.volume; sfx.muted = st.muted; sfx.musicOn = st.music;

const canvas = document.getElementById('c');
const renderer = new Renderer(canvas);
renderer.quality = st.quality || 'hoch';
const ui = new UI(renderer);
ui.editor = new Editor(renderer, ui);
document.getElementById('fps').classList.toggle('hidden', !st.showFps);

let resizeT = 0;
const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { ui.layout(); if (ui.selected) ui.placePanel(); if (ui.mode === 'editor') ui.editor.dirty = true; }, 60); };
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
ui.layout();

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
let fpsN = 0, fpsT = 0;
const perf = { frames: 0, slow: 0, worst: 0 };

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  perf.frames++; if (dt > 1 / 40) perf.slow++; perf.worst = Math.max(perf.worst, dt);
  try {
    if (ui.mode === 'game' && ui.game) {
      const g = ui.game;
      if (!ui.paused) {
        acc += dt * ui.speed;
        let n = 0;
        while (acc >= STEP && n < 10) { g.step(STEP); acc -= STEP; n++; }
        if (n >= 10) acc = 0;
      }
      renderer.render(dt, g, ui);
      ui.frame(dt);
    } else if (ui.mode === 'editor') {
      ui.editor.render(dt);
    } else {
      renderer.renderMenu(dt, ui.mouseNX, ui.mouseNY);
    }
  } catch (err) {
    console.error(err);
  }
  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) { if (st.showFps) ui.setFps(Math.round(fpsN / fpsT)); fpsN = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Für automatische Tests
window.__kw = { ui, renderer, store, perf };
