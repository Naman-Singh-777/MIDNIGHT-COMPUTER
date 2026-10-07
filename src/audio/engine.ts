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
    // heartbeat under high fear
    this.heartT -= dt;
    if (s.fear > 0.4 && this.heartT <= 0) {
      this.thump(70, 0.5 * s.fear, 0);
      this.thump(58, 0.35 * s.fear, 0.2);
      this.heartT = 1.1 - s.fear * 0.5;
    }
  }

  /** Footsteps are triggered by distance walked, not by a timer. */
  walk(dist: number, sprint: boolean): void {
    if (!this.ctx) return;
    this.stepDist += dist;
    const stride = sprint ? 1.25 : 0.85;
    if (this.stepDist >= stride) {
      this.stepDist = 0;
      const corr = this.lastState?.zone !== 'booth';
      this.noiseHit(corr ? 1800 : 600, corr ? 0.07 : 0.1, sprint ? 0.5 : 0.28, 0.07, null);
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
  }
  lever(): void {
    this.noiseHit(300, 0.25, 0.9, 0.01, null);
    this.tone(75, 0.8, 0.8, 'square', null, 38);
    this.duck = 1.2;
  }
  powerDown(): void {
    this.tone(220, 1.6, 0.35, 'sawtooth', null, 30);
    this.noiseHit(800, 0.8, 0.5, 0.02, null);
  }
  powerUp(): void {
    this.tone(40, 1.4, 0.4, 'sine', null, 110);
    this.noiseHit(1200, 0.5, 0.3, 0.1, null);
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
