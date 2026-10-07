import type { Zone } from '../sim/simulation';

export interface AudioState {
  tension: number;
  fear: number;
  zone: Zone;
  power: boolean;
  quiet: boolean;
  sanity: number;
  rainGain: number;
}

type V3 = { x: number; y: number; z: number };

/**
 * Procedural audio director. Every sound is synthesized, so the build ships
 * with zero audio files. Ambience layers follow game state; one-shots are
 * placed in 3D; speech is a stylised blip voice (subtitles carry the words).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private amb!: GainNode;
  private sfx!: GainNode;
  private voiceBus!: GainNode;
  private revBooth!: ConvolverNode;
  private revCorr!: ConvolverNode;
  private sendBooth!: GainNode;
  private sendCorr!: GainNode;
  private white!: AudioBuffer;
  private brown!: AudioBuffer;
  private hum!: GainNode;
  private rain!: GainNode;
  private rainFilter!: BiquadFilterNode;
  private drone!: GainNode;
  private whine!: GainNode;
  private whisperBed!: GainNode;
  private heartT = 0;
  private stepDist = 0;
  private duck = 0;
  private lastState: AudioState | null = null;
  private listenerPos: V3 = { x: 0, y: 1.3, z: 0.5 };
  private tickT = 6;
  private stareNodes: { stop: () => void } | null = null;
  muted = false;

  get ready(): boolean {
    return this.ctx !== null;
  }

  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp).connect(ctx.destination);
    this.amb = ctx.createGain();
    this.sfx = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.amb.connect(this.master);
    this.sfx.connect(this.master);
    this.voiceBus.connect(this.master);

    this.white = this.noiseBuffer(false);
    this.brown = this.noiseBuffer(true);
    this.revBooth = ctx.createConvolver();
    this.revBooth.buffer = this.impulse(0.55, 3.5);
    this.revCorr = ctx.createConvolver();
    this.revCorr.buffer = this.impulse(2.4, 2.6);
    this.sendBooth = ctx.createGain();
    this.sendCorr = ctx.createGain();
    this.sendBooth.connect(this.revBooth).connect(this.master);
    this.sendCorr.connect(this.revCorr).connect(this.master);
    this.sendBooth.gain.value = 0.25;
    this.sendCorr.gain.value = 0.0;

    // layers
    this.hum = this.loopNoise(this.brown, 'lowpass', 220, 0.0);
    const o = ctx.createOscillator();
    o.frequency.value = 50;
    const og = ctx.createGain();
    og.gain.value = 0.02;
    o.connect(og).connect(this.hum);
    o.start();
    this.rain = ctx.createGain();
    this.rain.gain.value = 0.0;
    const rs = ctx.createBufferSource();
    rs.buffer = this.white;
    rs.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.4;
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 900;
    rs.connect(bp).connect(this.rainFilter).connect(this.rain).connect(this.amb);
    rs.start();
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    for (const f of [41, 43.3, 61.7]) {
      const d = ctx.createOscillator();
      d.type = 'sawtooth';
      d.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 150;
      d.connect(lp).connect(this.drone);
      d.start();
    }
    this.drone.connect(this.amb);
    this.whine = ctx.createGain();
    this.whine.gain.value = 0;
    const w = ctx.createOscillator();
    w.frequency.value = 15734;
    w.connect(this.whine).connect(this.amb);
    w.start();
    this.whisperBed = this.loopNoise(this.white, 'bandpass', 2600, 0);
  }

  private noiseBuffer(brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private loopNoise(buf: AudioBuffer, type: BiquadFilterType, freq: number, gain: number): GainNode {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    s.connect(f).connect(g).connect(this.amb);
    s.start();
    return g;
  }

  // -------------------------------------------------------------------- state
  setListener(pos: V3, fwd: V3): void {
    if (!this.ctx) return;
    this.listenerPos = { x: pos.x, y: pos.y, z: pos.z };
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = pos.y;
      l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x;
      l.forwardY.value = fwd.y;
      l.forwardZ.value = fwd.z;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
  }

  update(dt: number, s: AudioState): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lastState = s;
    this.duck = Math.max(0, this.duck - dt);
    const duckMul = this.duck > 0 ? 0.45 : 1;
    const quietMul = s.quiet ? 0.18 : 1;
    this.amb.gain.setTargetAtTime(duckMul * quietMul, t, 0.4);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, t, 0.1);
    this.hum.gain.setTargetAtTime(s.power ? 0.5 : 0.12, t, 0.5);
    this.whine.gain.setTargetAtTime(s.power && s.zone === 'booth' ? 0.0016 : 0, t, 0.3);
    const inBooth = s.zone === 'booth';
    this.rain.gain.setTargetAtTime(s.rainGain * (inBooth ? 0.3 : 0.5), t, 0.5);
    this.rainFilter.frequency.setTargetAtTime(inBooth ? 800 : 1700, t, 0.4);
    this.drone.gain.setTargetAtTime(Math.max(0, s.tension - 0.15) * 0.22, t, 1.2);
    this.whisperBed.gain.setTargetAtTime(Math.max(0, (1 - s.sanity / 100) - 0.35) * 0.05, t, 1);
    this.sendBooth.gain.setTargetAtTime(inBooth ? 0.28 : 0.04, t, 0.3);
    this.sendCorr.gain.setTargetAtTime(inBooth ? 0.02 : 0.38, t, 0.3);
    // the building settling: dry wood ticks, rarer when the room is held quiet
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = (s.quiet ? 14 : 6) + Math.random() * 9;
      const lp = this.listenerPos;
      const a = Math.random() * 6.28;
      this.noiseHit(900 + Math.random() * 700, 0.04, 0.12, 0.002, { x: lp.x + Math.cos(a) * 2.5, y: 1.2, z: lp.z + Math.sin(a) * 2.5 }, 'bandpass');
    }
    // heartbeat under high fear
    this.heartT -= dt;
    if (s.fear > 0.4 && this.heartT <= 0) {
      this.thump(70, 0.5 * s.fear, 0);
      this.thump(58, 0.35 * s.fear, 0.2);
      this.heartT = 1.1 - s.fear * 0.5;
    }
  }

  /** Footsteps are triggered by distance walked. Wood in the booth, tile in the corridor. */
  walk(dist: number, sprint: boolean, crouch = false): void {
    if (!this.ctx) return;
    this.stepDist += dist;
    const stride = crouch ? 0.6 : sprint ? 1.25 : 0.85;
    if (this.stepDist >= stride) {
      this.stepDist = 0;
      const tile = this.lastState?.zone !== 'booth';
      const g = crouch ? 0.1 : sprint ? 0.5 : 0.28;
      if (tile) {
        this.noiseHit(1900 + Math.random() * 500, 0.07, g, 0.003, null, 'bandpass');
        this.tone(160 + Math.random() * 30, 0.08, g * 0.7, 'sine', null, 90);
      } else {
        this.noiseHit(520 + Math.random() * 120, 0.11, g * 1.1, 0.006, null);
        if (Math.random() < 0.18) this.tone(210 + Math.random() * 60, 0.22, g * 0.25, 'sawtooth', null, 160); // a board gives
      }
    }
  }

  // -------------------------------------------------------------------- one-shots
  private route(pos: V3 | null): AudioNode {
    const ctx = this.ctx!;
    if (!pos) return this.sfx;
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 1.5;
    p.rolloffFactor = 1.2;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z;
    p.connect(this.sfx);
    p.connect(this.lastState?.zone === 'booth' ? this.sendBooth : this.sendCorr);
    return p;
  }

  private noiseHit(freq: number, dur: number, gain: number, attack: number, pos: V3 | null, type: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = ctx.createBufferSource();
    s.buffer = this.white;
    s.loopStart = Math.random() * 3;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(attack, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.route(pos));
    s.start(t, Math.random() * 3, dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType, pos: V3 | null, slideTo?: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.route(pos));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private thump(freq: number, gain: number, delay: number, pos: V3 | null = null): void {
    this.tone(freq, 0.22, gain, 'sine', pos, freq * 0.5, delay);
  }

  knock(pos: V3, n = 3): void {
    for (let i = 0; i < n; i++) {
      this.thump(130, 0.7, i * 0.28 + Math.random() * 0.05, pos);
      this.noiseHit(500, 0.08, 0.35, 0.005, pos);
    }
  }
  creak(pos: V3): void {
    this.tone(180, 1.1, 0.12, 'sawtooth', pos, 330);
    this.tone(176, 1.1, 0.1, 'sawtooth', pos, 322);
  }
  distantStep(pos: V3): void {
    for (let i = 0; i < 4; i++) setTimeout(() => this.noiseHit(500, 0.09, 0.22, 0.01, pos), i * 520);
  }
  phoneRing(): void {
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 8; i++) {
        this.tone(i % 2 ? 1400 : 1100, 0.045, 0.1, 'square', { x: -0.3, y: 0.9, z: -0.9 }, undefined, r * 1.4 + i * 0.05);
      }
  }
  thunder(): void {
    this.noiseHit(160, 3.2, 0.9, 0.2, null);
    this.noiseHit(500, 1.2, 0.4, 0.05, null);
  }
  stamp(): void {
    this.thump(110, 0.8, 0);
    this.noiseHit(1400, 0.05, 0.4, 0.003, null, 'highpass');
    this.noiseHit(700, 0.14, 0.25, 0.01, null, 'lowpass'); // the ink pad
  }
  lever(): void {
    this.noiseHit(300, 0.25, 0.9, 0.01, null);
    this.tone(75, 0.8, 0.8, 'square', null, 38);
    this.duck = 1.2;
  }
  powerDown(): void {
    this.tone(220, 1.6, 0.35, 'sawtooth', null, 30);
    this.noiseHit(800, 0.8, 0.5, 0.02, null);
    for (let i = 0; i < 4; i++) setTimeout(() => this.noiseHit(1500, 0.03, 0.45, 0.002, null, 'bandpass'), 150 + i * 190 + Math.random() * 60); // relays
    this.tone(3200, 1.2, 0.04, 'sine', null, 2400, 0.2); // a tube dying
  }
  powerUp(): void {
    this.tone(40, 1.4, 0.4, 'sine', null, 110);
    this.noiseHit(1200, 0.5, 0.3, 0.1, null);
    for (let i = 0; i < 4; i++) this.tone(2800 + Math.random() * 600, 0.04, 0.06, 'sine', null, undefined, 0.3 + i * 0.22 + Math.random() * 0.1); // tubes strike
    this.noiseHit(160, 0.9, 0.5, 0.05, null);
  }
  click(): void {
    this.noiseHit(3000, 0.02, 0.18, 0.002, null, 'highpass');
  }
  whisper(pos: V3, gain = 0.25): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const s = ctx.createBufferSource();
      s.buffer = this.white;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(900 + Math.random() * 1600, t + i * 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.22);
      g.gain.linearRampToValueAtTime(gain, t + i * 0.22 + 0.08);
      g.gain.linearRampToValueAtTime(0, t + i * 0.22 + 0.2);
      s.connect(f).connect(g).connect(this.route(pos));
      s.start(t + i * 0.22, Math.random() * 3, 0.3);
    }
  }
  jingle(): void {
    this.tone(523, 0.5, 0.1, 'sine', null);
    this.tone(659, 0.6, 0.1, 'sine', null, undefined, 0.15);
  }

  // -------------------------------------------------------------------- paperwork
  clack(): void {
    this.noiseHit(3400, 0.012, 0.22, 0.001, null, 'highpass');
    this.tone(180, 0.035, 0.16, 'square', null, 110);
  }
  ding(): void {
    this.tone(2637, 0.9, 0.09, 'sine', null);
    this.tone(5274, 0.5, 0.025, 'sine', null);
    this.noiseHit(1800, 0.05, 0.1, 0.002, null, 'bandpass');
  }
  paper(): void {
    this.noiseHit(2600, 0.22, 0.09, 0.05, null, 'bandpass');
  }

  // -------------------------------------------------------------------- scares
  /** A music box that should not be playing. It runs down faster as the Understudy learns. */
  musicBox(pos: V3 | null, stage: number): void {
    const tune = [0, 3, 7, 5, 3, 2, 0, -5, 0, 3, 7, 5, 3, 2, 3, 0];
    let t = 0;
    const base = 0.42;
    tune.forEach((st, i) => {
      const warp = 1 + i * 0.045 * (stage + 1) * 0.5;
      const f = 440 * Math.pow(2, st / 12) * Math.pow(2, ((Math.random() - 0.5) * stage * 0.014) + (i > 8 ? -0.003 * (i - 8) * stage : 0));
      this.tone(f, 1.6, 0.075, 'sine', pos, undefined, t);
      this.tone(f * 2.76, 0.5, 0.02, 'sine', pos, undefined, t);
      this.tone(f * 5.4, 0.2, 0.008, 'sine', pos, undefined, t);
      this.noiseHit(5000, 0.012, 0.03, 0.001, pos, 'highpass');
      t += base * warp;
    });
    // the comb sticks on the last note
    for (let k = 0; k < 4; k++) this.tone(440, 0.5 - k * 0.1, 0.05 / (k + 1), 'sine', pos, 436, t + k * 0.7 + k * k * 0.12);
  }

  /** Slow breathing close behind the listener. */
  breathBehind(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const lp = this.listenerPos;
    const pos = { x: lp.x, y: lp.y - 0.1, z: lp.z + 0.5 };
    const out = this.route(pos);
    const t0 = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const s = ctx.createBufferSource();
      s.buffer = this.white;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.2;
      const g = ctx.createGain();
      const t = t0 + k * 3.3;
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(1100, t + 1.3);
      f.frequency.linearRampToValueAtTime(420, t + 3.0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.32, t + 1.3);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
      g.gain.linearRampToValueAtTime(0.4, t + 2.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
      s.connect(f).connect(g).connect(out);
      s.start(t, Math.random() * 3, 3.1);
    }
  }

  /** Fingernails working at plaster. */
  scratch(pos: V3): void {
    const n = 6 + Math.floor(Math.random() * 5);
    let t = 0;
    for (let i = 0; i < n; i++) {
      const dur = 0.09 + Math.random() * 0.16;
      setTimeout(() => this.noiseHit(3200 + Math.random() * 2400, dur, 0.2, 0.01, pos, 'bandpass'), t * 1000);
      t += dur + 0.03 + Math.random() * (i % 3 === 2 ? 0.5 : 0.08);
    }
  }

  /** Knuckle ticks on glass: one, then a beat, then two. */
  windowTap(pos: V3): void {
    for (const [d, g] of [[0, 0.5], [0.9, 0.45], [1.12, 0.4]] as const) {
      setTimeout(() => {
        this.tone(2300 + Math.random() * 300, 0.04, g, 'sine', pos, 1400);
        this.noiseHit(4000, 0.02, g * 0.6, 0.001, pos, 'highpass');
      }, d * 1000);
    }
  }

  knobRattle(pos: V3): void {
    for (let i = 0; i < 12; i++) setTimeout(() => this.noiseHit(1800 + Math.random() * 1800, 0.035, 0.28, 0.002, pos, 'bandpass'), i * 55 + Math.random() * 25);
    setTimeout(() => this.thump(95, 0.5, 0, pos), 760);
  }

  chairCreak(): void {
    const lp = this.listenerPos;
    const pos = { x: lp.x - 0.4, y: 0.6, z: lp.z + 1.3 };
    this.tone(150, 0.55, 0.1, 'sawtooth', pos, 210);
    this.noiseHit(700, 0.3, 0.12, 0.05, pos);
  }

  overheadSteps(): void {
    const lp = this.listenerPos;
    for (let i = 0; i < 5; i++)
      setTimeout(() => {
        const pos = { x: lp.x + (i - 2) * 0.7, y: 4.0, z: lp.z - 0.5 };
        this.thump(78, 0.55, 0, pos);
        this.noiseHit(260, 0.2, 0.3, 0.01, pos);
      }, i * 1150 + Math.random() * 120);
  }

  pipeKnock(pos: V3): void {
    for (const [d, g] of [[0, 0.7], [0.65, 0.5]] as const) {
      for (const f of [210, 337, 561, 903]) this.tone(f, 1.8, g * 0.12, 'sine', pos, undefined, d);
      this.noiseHit(1100, 0.06, g * 0.5, 0.002, pos, 'bandpass');
    }
  }

  /** A child humming the music box tune, never to the end of it. */
  childHum(pos: V3): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const notes = [0, 3, 7, 5, 3, 2];
    let t = ctx.currentTime + 0.1;
    const out = this.route(pos);
    for (const st of notes) {
      const f = 330 * Math.pow(2, st / 12);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.3;
      const lg = ctx.createGain();
      lg.gain.value = f * 0.012;
      lfo.connect(lg).connect(o.frequency);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 950;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.12);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.8);
      o.connect(bp).connect(g).connect(out);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.9);
      lfo.stop(t + 0.9);
      t += 0.78;
    }
  }

  /** Rubber wheel and a dry axle, rolling a little way and stopping. */
  wheelchair(pos: V3): void {
    this.noiseHit(130, 2.2, 0.25, 0.4, pos);
    for (let i = 0; i < 5; i++) this.tone(1900 + Math.random() * 300, 0.11, 0.07, 'sine', pos, 2400, i * 0.42 + Math.random() * 0.05);
  }

  /** Low sting when the Understudy learns something. Never a scream. */
  stageUp(level: number): void {
    const g = 0.18 + level * 0.1;
    this.noiseHit(300, 0.9, 0.35, 0.8, null); // inhale
    for (const f of [55, 58.3, 82.4]) this.tone(f, 3.2, g * 0.5, 'sawtooth', null, f * 0.96, 0.9);
    this.thump(46, 0.7, 0.95);
  }

  /** Rising inhale into a peak. */
  riser(dur = 2.6): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = ctx.createBufferSource();
    s.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(3400, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.92);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, 0, dur + 0.1);
  }

  /** The room goes still and something thin rings in your ears while it holds your eye. */
  stareOn(): void {
    const ctx = this.ctx;
    if (!ctx || this.stareNodes) return;
    const o = ctx.createOscillator();
    o.frequency.value = 3150;
    const o2 = ctx.createOscillator();
    o2.frequency.value = 39;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 3.5);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, ctx.currentTime);
    g2.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 3);
    o.connect(g).connect(this.sfx);
    o2.connect(g2).connect(this.sfx);
    o.start();
    o2.start();
    this.stareNodes = {
      stop: () => {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.15);
        g2.gain.cancelScheduledValues(t);
        g2.gain.setTargetAtTime(0, t, 0.25);
        o.stop(t + 1.2);
        o2.stop(t + 1.5);
      },
    };
  }

  stareHit(): void {
    this.thump(52, 0.9, 0.05);
    this.noiseHit(2800, 0.4, 0.3, 0.02, null, 'bandpass');
  }

  stareOff(hit: boolean): void {
    this.stareNodes?.stop();
    this.stareNodes = null;
    if (hit) {
      this.thump(52, 0.9, 0.05);
      this.noiseHit(2800, 0.4, 0.3, 0.02, null, 'bandpass');
    } else {
      this.noiseHit(500, 0.9, 0.12, 0.3, null, 'bandpass'); // a breath let go
    }
  }

  /** Stylised speech: syllable blips with a formant sweep. Returns duration in seconds. */
  speak(text: string, pitch: number, radio: boolean, mimic = false): number {
    const ctx = this.ctx;
    if (!ctx) return Math.min(6, text.length * 0.05);
    const words = text.split(/\s+/).filter(Boolean);
    let t = ctx.currentTime + 0.05;
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    let out: AudioNode = bus;
    if (radio) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.9;
      bus.connect(bp);
      out = bp;
      const hiss = ctx.createBufferSource();
      hiss.buffer = this.white;
      const hg = ctx.createGain();
      hg.gain.value = 0.015;
      hiss.connect(hg).connect(bp);
      hiss.start(t, 0, Math.min(8, words.length * 0.28 + 0.4));
    }
    out.connect(this.voiceBus);
    if (radio) {
      this.noiseHit(2600, 0.06, 0.22, 0.003, null, 'bandpass'); // key up
      const total = words.length * 0.33 + 0.3;
      setTimeout(() => this.noiseHit(2200, 0.05, 0.18, 0.002, null, 'bandpass'), total * 1000);
    }
    if (mimic) {
      const d = ctx.createDelay(0.5);
      d.delayTime.value = 0.09;
      const dg = ctx.createGain();
      dg.gain.value = 0.35;
      out.connect(d).connect(dg).connect(this.voiceBus);
    }
    this.duck = Math.max(this.duck, words.length * 0.28 + 0.5);
    for (const w of words) {
      const syl = Math.max(1, Math.round(w.length / 3));
      for (let k = 0; k < syl; k++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const f0 = pitch * (0.85 + Math.random() * 0.35) * (/[?]/.test(w) ? 1.2 : 1);
        o.frequency.setValueAtTime(f0, t);
        o.frequency.linearRampToValueAtTime(f0 * (0.92 + Math.random() * 0.12), t + 0.1);
        const fm = ctx.createBiquadFilter();
        fm.type = 'bandpass';
        fm.Q.value = 5;
        fm.frequency.setValueAtTime(500 + Math.random() * 700, t);
        fm.frequency.linearRampToValueAtTime(900 + Math.random() * 1100, t + 0.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.025);
        g.gain.linearRampToValueAtTime(0, t + 0.11);
        o.connect(fm).connect(g).connect(bus);
        o.start(t);
        o.stop(t + 0.14);
        t += 0.11 + Math.random() * 0.03;
      }
      t += 0.07 + (/[.,!?]/.test(w) ? 0.18 : 0);
    }
    return t - ctx.currentTime;
  }
}
