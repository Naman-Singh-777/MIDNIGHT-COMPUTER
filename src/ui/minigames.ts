import type { Ending, WardCount } from '../sim/types';

/**
 * The jobs on Pell's list that happen away from the glass. Each one takes over the screen
 * while the shift keeps running behind it, so a patient can be waiting at the window while you work.
 */

interface Slip {
  name: string;
  date: string;
  note: string;
  drawer: 0 | 1 | 2;
}

const DRAWERS = ['A to H', 'I to Q', 'R to Z'];
const SLIPS: Slip[] = [
  { name: 'PRYCE, Leonard', date: '29/09/1963', note: 'Ward A. Settled.', drawer: 1 },
  { name: 'ASHDOWN, Mabel', date: '30/09/1963', note: 'Ward B. Asks for the window open.', drawer: 0 },
  { name: 'TULLY, Edmund', date: '01/10/1963', note: 'Ward A. Refused soup.', drawer: 2 },
  { name: 'HARGREAVE, Clem', date: '02/10/1963', note: 'Discharged to family.', drawer: 0 },
  { name: 'KELL, Oonagh', date: '03/10/1963', note: 'Ward B. Counts the beds out loud.', drawer: 1 },
  { name: 'WREN, ______', date: 'TONIGHT, 22:00', note: 'Ward B, bed 10. Night officer. Treatment: memory.', drawer: 2 },
];

export class FilingGame {
  private el: HTMLDivElement;
  private i = 0;
  private wrong = 0;
  private keyFn = (e: KeyboardEvent): void => {
    const k = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (k >= 0) this.file(k);
    if (e.code === 'Escape' || e.code === 'KeyQ') this.close(false);
  };

  constructor(
    root: HTMLElement,
    private readonly sound: (kind: 'drawer' | 'paper' | 'wrong' | 'sting') => void,
    private readonly done: (finished: boolean, wrong: number) => void,
  ) {
    this.el = document.createElement('div');
    this.el.id = 'mini';
    this.el.innerHTML = `<div class="filing"><div class="cardslot"></div><div class="drawers">${DRAWERS.map((d, i) => `<button class="drawer" data-d="${i}"><kbd>${i + 1}</kbd>${d}</button>`).join('')}</div><div class="minihint">File each form by surname. 1, 2, 3 or click. Q to leave it for later.</div></div>`;
    root.appendChild(this.el);
    this.el.querySelectorAll<HTMLButtonElement>('.drawer').forEach((b) => (b.onclick = () => this.file(Number(b.dataset.d))));
    window.addEventListener('keydown', this.keyFn);
    this.show();
  }

  private show(): void {
    const s = SLIPS[this.i];
    const last = this.i === SLIPS.length - 1;
    this.el.querySelector('.cardslot')!.innerHTML = `<div class="icard ${last ? 'own' : ''}"><span class="no">${String(this.i + 1).padStart(3, '0')}</span><b>${s.name}</b><i>Admitted ${s.date}</i><em>${s.note}</em>${last ? '<u>not yet</u>' : ''}</div>`;
    if (last) this.sound('sting');
  }

  private file(d: number): void {
    const s = SLIPS[this.i];
    if (d !== s.drawer) {
      this.wrong++;
      this.sound('wrong');
      this.el.querySelector('.icard')?.classList.add('shake');
      setTimeout(() => this.el.querySelector('.icard')?.classList.remove('shake'), 300);
      return;
    }
    this.sound('drawer');
    this.i++;
    if (this.i >= SLIPS.length) this.close(true);
    else this.show();
  }

  close(finished: boolean): void {
    window.removeEventListener('keydown', this.keyFn);
    this.el.remove();
    this.done(finished, this.wrong);
  }
}

// ---------------------------------------------------------------- the Ward B door slot

interface Body {
  x: number;
  y: number;
  s: number;
  kind: 'sleeper' | 'mother' | 'standing' | 'sitting';
  counted: boolean;
  seen: number;
  bed: number;
}

export type WardMode = 'count1' | 'dawn';

/** A 2D view through the slot in the Ward B door. Flashlight follows the mouse. Click each person to count them. */
export class WardView {
  private el: HTMLDivElement;
  private c: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private scene: HTMLCanvasElement;
  private sg: CanvasRenderingContext2D;
  private light: HTMLCanvasElement;
  private lg: CanvasRenderingContext2D;
  private bodies: Body[] = [];
  private mx = 0.5;
  private my = 0.55;
  private t = 0;
  private raf = 0;
  private tally = 0;
  private closed = false;
  private scareT = -1;
  private textShown = false;
  private last = 0;
  private keyFn = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE' || e.code === 'Enter') this.finish();
    if ((e.code === 'Escape' || e.code === 'KeyQ') && this.mode === 'count1') this.close(false);
  };

  constructor(
    root: HTMLElement,
    private readonly mode: WardMode,
    private readonly count: WardCount,
    private readonly ending: Ending,
    private readonly sound: (kind: 'tick' | 'scare' | 'breath' | 'glitch') => void,
    private readonly done: (finished: boolean, tally: number) => void,
    private readonly face: HTMLCanvasElement | null = null,
  ) {
    this.started = performance.now();
    this.el = document.createElement('div');
    this.el.id = 'ward';
    this.el.innerHTML = `<canvas></canvas><div class="wardtext"></div><div class="wardhint">${
      mode === 'count1'
        ? 'Move the light. Click every person once. E when you are done counting. Q to step back.'
        : 'Bed 9 is on the left, halfway down. She sleeps facing the door.'
    }</div><div class="tally"></div>`;
    root.appendChild(this.el);
    this.c = this.el.querySelector('canvas')!;
    this.g = this.c.getContext('2d')!;
    this.scene = document.createElement('canvas');
    this.sg = this.scene.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lg = this.light.getContext('2d')!;
    this.build();
    this.c.addEventListener('mousemove', (e) => {
      this.mx = e.clientX / innerWidth;
      this.my = e.clientY / innerHeight;
    });
    this.c.addEventListener('click', (e) => this.click(e.clientX / innerWidth, e.clientY / innerHeight));
    window.addEventListener('keydown', this.keyFn);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    this.setTally();
  }

  private build(): void {
    // two rows of beds receding from the door; bed 9 is front left
    const beds: [number, number, number][] = [];
    for (let i = 0; i < 7; i++) {
      const depth = i / 7;
      const s = 1.25 - depth * 0.9;
      beds.push([0.5 - 0.3 * s, 0.8 - depth * 0.3, s], [0.5 + 0.3 * s, 0.8 - depth * 0.3, s]);
    }
    const order = [8, 0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13]; // index 0 of this list is bed 9
    const sleepers = Math.min(this.count.register, 14);
    const motherHome = !(this.mode === 'dawn' && this.ending === 'taken');
    for (let k = 0; k < sleepers; k++) {
      const bi = order[k] ?? k;
      const [x, y, s] = beds[bi];
      const isMother = k === 0;
      if (isMother && !motherHome) continue;
      this.bodies.push({ x, y, s, kind: isMother ? 'mother' : 'sleeper', counted: false, seen: 0, bed: bi });
    }
    // the ones that are not on the register. They stand in the aisle, or sit up facing bed 9.
    const ex = this.count.extras;
    for (let k = 0; k < ex; k++) {
      const depth = 0.15 + ((k * 0.37) % 0.75);
      const s = 1.25 - depth * 0.9;
      const sit = this.mode === 'dawn' && k % 2 === 0;
      this.bodies.push({ x: 0.5 + (k % 2 ? 0.07 : -0.09) * s, y: 0.8 - depth * 0.3, s, kind: sit ? 'sitting' : 'standing', counted: false, seen: 0, bed: -1 });
    }
    this.beds = beds;
  }
  private beds: [number, number, number][] = [];
  private started = 0;

  private setTally(): void {
    const el = this.el.querySelector('.tally') as HTMLElement;
    if (this.mode === 'dawn') {
      el.textContent = '';
      return;
    }
    el.textContent = `Counted: ${'|'.repeat(Math.min(this.tally, 30))} ${this.tally}   Register: ${this.count.register}`;
  }

  private click(x: number, y: number): void {
    if (this.mode !== 'count1') return;
    const W = innerWidth, H = innerHeight;
    for (const b of this.bodies) {
      if (b.counted) continue;
      const dx = (b.x - x) * W, dy = (b.y - 0.04 * b.s - y) * H;
      const lit = Math.hypot((this.mx - b.x) * W, (this.my - b.y) * H) < 170;
      if (Math.hypot(dx, dy) < 60 * b.s + 14 && lit) {
        b.counted = true;
        this.tally++;
        this.sound('tick');
        this.setTally();
        return;
      }
    }
  }

  private finish(): void {
    if (this.mode === 'dawn' && !this.textShown) return;
    this.close(true);
  }

  close(finished: boolean): void {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.keyFn);
    this.el.remove();
    this.done(finished, this.tally);
  }

  private frame(now: number): void {
    if (this.closed) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.3, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const W = innerWidth, H = innerHeight;
    for (const cv of [this.c, this.scene, this.light]) if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    this.drawScene(W, H, dt);
    const g = this.g;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    // the room barely there in the dark
    g.globalAlpha = 0.07;
    g.drawImage(this.scene, 0, 0);
    g.globalAlpha = 1;
    // the flashlight
    const lg = this.lg;
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, W, H);
    lg.drawImage(this.scene, 0, 0);
    lg.globalCompositeOperation = 'destination-in';
    const r = Math.min(W, H) * 0.24;
    const flick = 0.92 + Math.sin(this.t * 37) * 0.04 + (Math.random() < 0.01 ? -0.4 : 0);
    const gr = lg.createRadialGradient(this.mx * W, this.my * H, r * 0.1, this.mx * W, this.my * H, r);
    gr.addColorStop(0, `rgba(0,0,0,${flick})`);
    gr.addColorStop(0.7, `rgba(0,0,0,${flick * 0.55})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = gr;
    lg.fillRect(0, 0, W, H);
    g.drawImage(this.light, 0, 0);
    // the slot: you only see through a letterbox in the door
    const top = H * 0.2, bot = H * 0.84;
    g.fillStyle = '#0b0a09';
    g.fillRect(0, 0, W, top);
    g.fillRect(0, bot, W, H - bot);
    g.fillRect(0, 0, W * 0.06, H);
    g.fillRect(W * 0.94, 0, W * 0.06, H);
    g.strokeStyle = '#2a2520';
    g.lineWidth = 6;
    g.strokeRect(W * 0.06, top, W * 0.88, bot - top);
    // grain
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    if (this.scareT > 0) this.drawFaceAtSlot(W, H, dt);
    this.dawnScript();
  }

  private dawnScript(): void {
    if (this.mode !== 'dawn' || this.textShown) return;
    if (performance.now() - this.started > 7000) {
      this.textShown = true;
      const lines: Record<Ending, string> = {
        clean: 'She turns her head on the pillow and finds you through the slot. "There you are." Her breath fogs in the cold. You count eleven, and then you stop counting. Press E.',
        crowded: `She is asleep in bed 9. ${this.count.extras === 1 ? 'Someone is' : `${['Two', 'Three', 'Four', 'Five', 'Six'][this.count.extras - 2] ?? 'Too many'} of them are`} sitting up around her bed, facing her, breathing when she breathes. Press E.`,
        taken: 'Bed 9 is made. The blanket is folded into a square at the foot of it. Behind you, in the corridor, someone says your name in her voice. Press E.',
        absent: 'Press E.',
      };
      (this.el.querySelector('.wardtext') as HTMLElement).textContent = lines[this.ending];
      if (this.ending !== 'clean') this.sound('breath');
    }
  }

  private drawFaceAtSlot(W: number, H: number, dt: number): void {
    // anticipated, and still too close: her face, the wrong way, fills the slot for half a second
    const g = this.g;
    const k = 1 - this.scareT / 0.6;
    const cx = W / 2 + (Math.random() - 0.5) * 10, cy = H * 0.52, s = H * (0.62 + k * 0.12);
    g.save();
    g.beginPath();
    g.rect(W * 0.06, H * 0.2, W * 0.88, H * 0.64);
    g.clip();
    if (this.face) {
      g.save();
      g.beginPath();
      g.ellipse(cx, cy, s * 0.4, s * 0.56, 0.06, 0, 7);
      g.clip();
      g.filter = 'contrast(1.25) brightness(0.8)';
      g.drawImage(this.face, cx - s * 0.48, cy - s * 0.58, s * 0.96, s * 1.16);
      g.filter = 'none';
      g.restore();
    }
    const v = g.createRadialGradient(cx, cy, s * 0.2, cx, cy, s * 0.6);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    g.restore();
    this.scareT -= dt;
  }

  private drawScene(W: number, H: number, dt: number): void {
    const g = this.sg;
    const t = this.t;
    // floor and walls
    const fl = g.createLinearGradient(0, H * 0.4, 0, H);
    fl.addColorStop(0, '#2a2a26');
    fl.addColorStop(1, '#55534b');
    g.fillStyle = '#3b3d38';
    g.fillRect(0, 0, W, H);
    g.fillStyle = fl;
    g.beginPath();
    g.moveTo(W * 0.38, H * 0.48);
    g.lineTo(W * 0.62, H * 0.48);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    // a tall window at the back with rain light
    g.fillStyle = '#5d6a72';
    g.fillRect(W * 0.46, H * 0.24, W * 0.08, H * 0.2);
    g.strokeStyle = '#1b1c1c';
    g.lineWidth = 3;
    g.strokeRect(W * 0.46, H * 0.24, W * 0.08, H * 0.2);
    g.beginPath();
    g.moveTo(W * 0.5, H * 0.24);
    g.lineTo(W * 0.5, H * 0.44);
    g.stroke();
    // beds back to front so the near ones cover the far ones
    const sorted = [...this.beds.map((b, i) => ({ b, i }))].sort((a, b) => a.b[1] - b.b[1]);
    for (const { b, i } of sorted) {
      const [x, y, s] = b;
      const bw = 210 * s, bh = 70 * s;
      const X = x * W, Y = y * H;
      g.fillStyle = '#1a1a19';
      g.fillRect(X - bw / 2, Y - bh * 0.1, 6 * s, bh * 0.9);
      g.fillRect(X + bw / 2 - 6 * s, Y - bh * 0.1, 6 * s, bh * 0.9);
      g.fillStyle = '#c9c6ba';
      g.fillRect(X - bw / 2, Y - bh * 0.3, bw, bh * 0.45);
      g.fillStyle = '#e4e1d6';
      g.fillRect(X - bw / 2 + 4 * s, Y - bh * 0.42, bw * 0.28, bh * 0.2); // pillow
      // bed number card
      g.fillStyle = '#d8d0b0';
      g.fillRect(X + bw / 2 - 26 * s, Y - bh * 0.6, 20 * s, 14 * s);
      g.fillStyle = '#222';
      g.font = `${Math.max(8, 11 * s)}px "Special Elite", monospace`;
      g.fillText(String(i + 1), X + bw / 2 - 23 * s, Y - bh * 0.6 + 11 * s);
      if (this.mode === 'dawn' && this.ending === 'taken' && i === 8) {
        g.fillStyle = '#efece2';
        g.fillRect(X + bw * 0.15, Y - bh * 0.32, bw * 0.25, bh * 0.22); // folded square
      }
    }
    // people
    const ordered = [...this.bodies].sort((a, b) => a.y - b.y);
    for (const b of ordered) {
      const X = b.x * W, Y = b.y * H, s = b.s;
      const lit = Math.hypot((this.mx - b.x) * W, (this.my - b.y) * H) < 160;
      if (lit) b.seen += dt;
      if (b.kind === 'sleeper' || b.kind === 'mother') {
        const breathe = Math.sin(t * 1.3 + b.x * 20) * 2 * s;
        g.fillStyle = '#9b988c';
        g.beginPath();
        g.ellipse(X + 10 * s, Y - 26 * s - breathe * 0.4, 70 * s, 15 * s + breathe, 0, 0, 7);
        g.fill();
        g.fillStyle = b.kind === 'mother' ? '#b9b4aa' : '#3a2e26';
        g.beginPath();
        g.arc(X - 72 * s, Y - 32 * s, 14 * s, 0, 7);
        g.fill();
        if (b.kind === 'mother') {
          // her face, turned toward the door once you have looked at her long enough
          const turn = this.mode === 'dawn' && this.ending === 'clean' ? Math.min(1, Math.max(0, (t - 3) / 2)) : 0;
          g.fillStyle = '#d8b9a0';
          g.beginPath();
          g.ellipse(X - 70 * s + turn * 4 * s, Y - 28 * s, 9 * s, 11 * s, 0, 0, 7);
          g.fill();
          if (turn > 0.5) {
            g.fillStyle = '#2a1a14';
            g.fillRect(X - 74 * s, Y - 31 * s, 2.5 * s, 2 * s);
            g.fillRect(X - 67 * s, Y - 31 * s, 2.5 * s, 2 * s);
          }
        }
      } else {
        // the extras: grey, a head too high, a face you can see from across the room
        const grow = b.kind === 'standing' ? 1 + Math.min(0.6, b.seen * 0.05) : 1;
        const hgt = (b.kind === 'standing' ? 200 : 95) * s * grow;
        const by = b.kind === 'sitting' ? Y - 30 * s : Y;
        const tilt = Math.sin(t * 0.4 + b.x * 9) * 0.05 + 0.18;
        g.save();
        g.translate(X, by - hgt);
        // a thin grey gown, arms hanging past the knees
        g.fillStyle = '#2b2d2e';
        g.fillRect(-15 * s, 0, 30 * s, hgt);
        g.fillRect(-21 * s, 6 * s, 6 * s, hgt * 0.75);
        g.fillRect(15 * s, 6 * s, 6 * s, hgt * 0.75);
        g.rotate(tilt);
        // a long face, holes for eyes, a mouth that is open too far
        g.fillStyle = '#c4c3b8';
        g.beginPath();
        g.ellipse(0, -24 * s, 12 * s, 25 * s, 0, 0, 7);
        g.fill();
        g.fillStyle = '#050304';
        g.beginPath();
        g.ellipse(-5 * s, -31 * s, 3.4 * s, 5.5 * s, 0, 0, 7);
        g.ellipse(5 * s, -32 * s, 3.4 * s, 5.5 * s, 0, 0, 7);
        g.ellipse(0, -12 * s, 3.2 * s, 8 * s, 0, 0, 7);
        g.fill();
        g.restore();
        // stare at one long enough and it is at the door
        if (b.kind === 'standing' && b.seen > 3.2 && this.scareT < 0) {
          this.scareT = 0.6;
          b.seen = -999;
          this.sound('scare');
        }
      }
      if (b.counted) {
        g.strokeStyle = 'rgba(40,40,40,0.9)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(X - 8, Y - 70 * s);
        g.lineTo(X - 2, Y - 62 * s);
        g.lineTo(X + 10, Y - 80 * s);
        g.stroke();
      }
    }
  }
}
