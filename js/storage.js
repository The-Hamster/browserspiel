// Speicherung im localStorage
const KEY = 'kernwacht.v1';

const DEFAULTS = () => ({
  settings: { volume: 0.7, muted: false, music: true, shake: true, quality: 'hoch', showFps: false, tips: true },
  stats: { kills: 0, games: 0, wins: 0, wavesTotal: 0, playTime: 0 },
  best: {},          // "modus:karte:endlos" -> { wave, score, won }
  highscore: 0,
  research: { points: 0, unlocked: [] },
  achievements: {},  // id -> Zeitstempel
  tips: {},          // gesehene Tipps
  customMaps: [],
  daily: {},         // Datum -> { score, wave, done }
  save: null,        // laufende Partie (zwischen Wellen)
});

let data = DEFAULTS();
let timer = 0;

function merge(def, val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val === undefined ? def : val;
  const out = Array.isArray(def) ? [] : { ...def };
  for (const k in val) out[k] = (def && typeof def[k] === 'object' && !Array.isArray(def[k]) && def[k] !== null) ? merge(def[k], val[k]) : val[k];
  return out;
}

export const store = {
  get data() { return data; },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = merge(DEFAULTS(), JSON.parse(raw));
    } catch (e) { data = DEFAULTS(); }
    return data;
  },
  save(now = false) {
    clearTimeout(timer);
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* voll oder gesperrt */ } };
    if (now) write(); else timer = setTimeout(write, 300);
  },
  reset() { data = DEFAULTS(); this.save(true); },
};
