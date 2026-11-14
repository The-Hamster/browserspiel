// Selbst erzeugte Sounds per WebAudio
class Sfx {
  constructor() {
    this.ctx = null; this.master = null; this.volume = 0.7; this.muted = false; this.musicOn = true;
    this.last = {}; this.voices = 0; this.music = null;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 6;
    this.master = c.createGain();
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.55; this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    const len = c.sampleRate * 1.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.startMusic();
  }
  setVolume(v) { this.volume = v; this.apply(); }
  setMuted(m) { this.muted = m; this.apply(); }
  setMusic(on) { this.musicOn = on; this.apply(); }
  apply() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.22 : 0, t, 0.3);
  }

  // ---- Bausteine
  _out(pan) {
    const c = this.ctx;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.sfxBus); return p;
    }
    return this.sfxBus;
  }
  _env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  tone(type, f0, f1, dur, vol, pan, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this._env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(this._out(pan));
    o.start(t); o.stop(t + dur + 0.02);
  }
  noiseBurst(filter, f0, f1, dur, vol, pan, q = 1, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = filter; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); this._env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(this._out(pan));
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ---- Effekte
  play(name, pan = 0, strength = 1) {
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const now = performance.now();
    const minGap = { pop: 60, firework: 80, laser: 45, drone: 60, hit: 40, bolt: 50, tesla: 70, plasma: 70, missile: 80, emp: 90, rail: 60, explode: 45, ebolt: 120, cannon: 90 }[name] || 25;
    if (this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    const v = strength;
    switch (name) {
      case 'laser': this.tone('square', 1500, 500, 0.07, 0.05 * v, pan); break;
      case 'beam': this.tone('sawtooth', 220, 180, 0.12, 0.02 * v, pan); break;
      case 'plasma': this.tone('sawtooth', 300, 70, 0.22, 0.07 * v, pan); this.noiseBurst('lowpass', 1500, 200, 0.2, 0.05 * v, pan); break;
      case 'rail': this.noiseBurst('highpass', 6000, 1500, 0.12, 0.12 * v, pan); this.tone('sine', 2400, 160, 0.35, 0.09 * v, pan); break;
      case 'emp': this.tone('sine', 160, 40, 0.4, 0.12 * v, pan); this.tone('square', 80, 70, 0.25, 0.025 * v, pan); break;
      case 'missile': this.noiseBurst('bandpass', 900, 3000, 0.3, 0.09 * v, pan, 2); break;
      case 'tesla': this.noiseBurst('bandpass', 3000, 1800, 0.12, 0.1 * v, pan, 4); this.tone('sawtooth', 90 + Math.random() * 60, 60, 0.12, 0.05 * v, pan); break;
      case 'drone': this.tone('triangle', 1800, 1200, 0.05, 0.035 * v, pan); break;
      case 'cannon': this.tone('square', 600, 200, 0.12, 0.06 * v, pan); this.noiseBurst('lowpass', 3000, 400, 0.1, 0.05 * v, pan); break;
      case 'ebolt': this.tone('square', 420, 300, 0.1, 0.03 * v, pan); break;
      case 'hit': this.noiseBurst('bandpass', 2500, 800, 0.05, 0.04 * v, pan, 3); break;
      case 'explode': this.noiseBurst('lowpass', 2200, 90, 0.45 * v + 0.15, 0.16 * v, pan); this.tone('sine', 120, 35, 0.35, 0.12 * v, pan); break;
      case 'bigboom': this.noiseBurst('lowpass', 1800, 50, 1.4, 0.4, pan); this.tone('sine', 90, 25, 1.2, 0.35, pan); break;
      case 'shieldhit': this.tone('sine', 900, 1400, 0.12, 0.05, pan); break;
      case 'basehit': this.tone('sine', 110, 40, 0.35, 0.25, pan); this.noiseBurst('lowpass', 800, 60, 0.3, 0.2, pan); break;
      case 'alarm':
        for (let i = 0; i < 3; i++) { this.tone('square', 660, 660, 0.18, 0.06, 0, i * 0.4); this.tone('square', 880, 880, 0.18, 0.06, 0, i * 0.4 + 0.2); }
        break;
      case 'boss':
        this.tone('sawtooth', 70, 50, 2.2, 0.16, 0); this.tone('sawtooth', 73, 52, 2.2, 0.12, 0);
        for (let i = 0; i < 2; i++) this.tone('square', 220, 165, 0.6, 0.05, 0, i * 0.8);
        break;
      case 'wave': this.tone('sawtooth', 110, 110, 0.5, 0.08, 0); this.tone('sawtooth', 165, 165, 0.5, 0.06, 0, 0.12); break;
      case 'build': [440, 660, 880].forEach((f, i) => this.tone('triangle', f, f, 0.1, 0.07, pan, i * 0.05)); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.07, pan, i * 0.06)); break;
      case 'sell': [660, 440, 330].forEach((f, i) => this.tone('triangle', f, f, 0.1, 0.06, pan, i * 0.05)); break;
      case 'click': this.tone('sine', 1200, 900, 0.04, 0.05, 0); break;
      case 'error': this.tone('square', 140, 110, 0.18, 0.06, 0); break;
      case 'coin': this.tone('sine', 1600, 2200, 0.08, 0.04, pan); break;
      case 'orbital_charge': this.tone('sawtooth', 200, 2000, 0.7, 0.06, pan); break;
      case 'orbital': this.noiseBurst('lowpass', 3000, 60, 1.1, 0.4, pan); this.tone('sine', 70, 25, 1, 0.35, pan); break;
      case 'warp': this.tone('sine', 900, 80, 1.2, 0.12, 0); this.tone('sine', 905, 82, 1.2, 0.08, 0, 0.15); break;
      case 'repair': for (let i = 0; i < 6; i++) this.tone('sine', 600 + i * 150, 900 + i * 150, 0.08, 0.05, 0, i * 0.07); break;
      case 'pulse': this.tone('sine', 60, 30, 1, 0.4, 0); this.noiseBurst('bandpass', 400, 4000, 0.8, 0.15, 0, 1); break;
      case 'meteor': this.tone('sine', 1800, 300, 0.9, 0.04, pan); break;
      case 'levelup': [392, 523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.12, 0.05, 0, i * 0.08)); break;
      case 'grenade': this.noiseBurst('lowpass', 2500, 100, 0.5, 0.2, pan); this.tone('square', 300, 60, 0.3, 0.06, pan); break;
      case 'achieve': [784, 988, 1175, 1568].forEach((f, i) => this.tone('sine', f, f, 0.25, 0.07, 0, i * 0.09)); break;
      case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.09, 0, i * 0.14)); break;
      case 'defeat': [392, 330, 262, 196, 131].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.45, 0.07, 0, i * 0.22)); break;
      case 'firework': this.tone('sine', 400, 1600, 0.5, 0.03, pan); this.noiseBurst('highpass', 3000, 6000, 0.4, 0.02, pan); break;
      case 'pop': this.noiseBurst('lowpass', 3000, 300, 0.35, 0.14, pan); for (let i = 0; i < 4; i++) this.noiseBurst('highpass', 5000, 3000, 0.05, 0.03, pan, 1, 0.08 + i * 0.07); break;
      case 'cloak': this.tone('sine', 300, 1200, 0.2, 0.03, pan); break;
    }
  }

  // Boss-Musik: treibender Bass und Schlagwerk, solange ein Boss lebt
  setBoss(on) {
    if (!this.ctx) return;
    if (on === !!this.bossTimer) return;
    if (!on) { clearInterval(this.bossTimer); this.bossTimer = null; return; }
    const c = this.ctx, step = 0.15;
    let beat = 0, next = c.currentTime + 0.05;
    const notes = [55, 55, 65.4, 55, 49, 55, 73.4, 65.4];
    const tick = () => {
      if (!this.musicOn || this.muted) { next = c.currentTime + 0.05; return; }
      while (next < c.currentTime + 0.3) {
        const f = notes[(beat >> 1) % notes.length];
        const o = c.createOscillator(), gg = c.createGain(), lp = c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 500 + (beat % 4 === 0 ? 400 : 0);
        gg.gain.setValueAtTime(0.0001, next); gg.gain.exponentialRampToValueAtTime(0.16, next + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, next + step * 0.9);
        o.connect(lp); lp.connect(gg); gg.connect(this.musicBus); o.start(next); o.stop(next + step);
        if (beat % 2 === 0) {
          const s = c.createBufferSource(); s.buffer = this.noise; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = beat % 8 === 4 ? 1500 : 7000;
          const ng = c.createGain(); const v = beat % 8 === 4 ? 0.12 : 0.04;
          ng.gain.setValueAtTime(v, next); ng.gain.exponentialRampToValueAtTime(0.0001, next + (beat % 8 === 4 ? 0.18 : 0.05));
          s.connect(hp); hp.connect(ng); ng.connect(this.musicBus); s.start(next); s.stop(next + 0.2);
        }
        if (beat % 8 === 0) { const k = c.createOscillator(), kg = c.createGain(); k.frequency.setValueAtTime(120, next); k.frequency.exponentialRampToValueAtTime(40, next + 0.15); kg.gain.setValueAtTime(0.35, next); kg.gain.exponentialRampToValueAtTime(0.0001, next + 0.2); k.connect(kg); kg.connect(this.musicBus); k.start(next); k.stop(next + 0.22); }
        next += step; beat++;
      }
    };
    this.bossTimer = setInterval(tick, 100);
    tick();
  }

  // Ruhiger Klangteppich
  startMusic() {
    const c = this.ctx;
    const notes = [55, 82.4, 110, 130.8];
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3;
    lp.connect(this.musicBus);
    const lfo = c.createOscillator(); const lfoG = c.createGain();
    lfo.frequency.value = 0.05; lfoG.gain.value = 350; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    for (const f of notes) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const g = c.createGain(); g.gain.value = 0.05;
        o.connect(g); g.connect(lp); o.start();
      }
    }
    // gelegentliche Glockentöne
    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
    const ping = () => {
      if (this.musicOn && !this.muted && this.ctx.state === 'running') {
        const t = c.currentTime, f = scale[Math.floor(Math.random() * scale.length)];
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f * 2;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
        const dl = c.createDelay(); dl.delayTime.value = 0.38; const fb = c.createGain(); fb.gain.value = 0.4;
        o.connect(g); g.connect(this.musicBus); g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.musicBus);
        o.start(t); o.stop(t + 2.6);
        setTimeout(() => { try { dl.disconnect(); fb.disconnect(); } catch (e) {} }, 6000);
      }
      setTimeout(ping, 2500 + Math.random() * 4000);
    };
    setTimeout(ping, 3000);
  }
}

export const sfx = new Sfx();
