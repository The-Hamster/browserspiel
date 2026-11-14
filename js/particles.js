// Partikelsystem mit typisierten Arrays (kein Müll für den Garbage Collector)
export const P_GLOW = 0;
export const P_SPARK = 1;
export const P_SMOKE = 2;
export const P_DEBRIS = 3;
export const P_HEAT = 4;

export class Particles {
  constructor(max = 3000) {
    this.max = max; this.n = 0;
    this.x = new Float32Array(max); this.y = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.color = new Uint8Array(max); this.kind = new Uint8Array(max);
    this.quality = 1;
  }
  spawn(x, y, vx, vy, life, size, color, kind = P_GLOW, drag = 2, grav = 0) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = (Math.random() * this.max) | 0; // ältestes überschreiben wäre teurer
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
    this.color[i] = color; this.kind[i] = kind; this.drag[i] = drag; this.grav[i] = grav;
  }
  burst(x, y, count, color, speed = 120, life = 0.5, size = 6, kind = P_GLOW, drag = 3) {
    count = Math.max(1, Math.round(count * this.quality));
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.7), color, kind, drag);
    }
  }
  cone(x, y, ang, spread, count, color, speed, life, size, kind = P_SPARK) {
    count = Math.max(1, Math.round(count * this.quality));
    for (let k = 0; k < count; k++) {
      const a = ang + (Math.random() - 0.5) * spread, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.6), color, kind, 4);
    }
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) {
          this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
          this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.size[i] = this.size[j];
          this.color[i] = this.color[j]; this.kind[i] = this.kind[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
        }
        continue;
      }
      const d = 1 - this.drag[i] * dt;
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      i++;
    }
  }
  clear() { this.n = 0; }
}
