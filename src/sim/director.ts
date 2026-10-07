import { Rng } from '../core/rng';
import type { DirectorCue, Pace } from './types';

export interface DirectorContext {
  minute: number;
  shiftLength: number;
  fear: number;
  sanity: number;
  stage: number; // Understudy stage 0..7
  patientPresent: boolean;
  powerOn: boolean;
  zone: 'booth' | 'corridor' | 'breaker';
}

export interface DirectorOut {
  cue: DirectorCue;
  intensity: number;
}

/**
 * Pacing director. Builds a rising tension curve with smaller waves inside it,
 * spends a scare budget on cues, and always schedules a release window after a
 * peak. The booth lamp stays honest for the first half of the shift so that
 * it can betray the player later.
 */
export class Director {
  tension = 0.15;
  pace: Pace = 'calm';
  quiet = false; // true during intentional silence
  private paceT = 0;
  private cueT = 6;
  private budget = 1;
  private sincePeak = 999;
  peaks = 0;

  constructor(private readonly rng: Rng) {}

  target(minute: number, len: number): number {
    const p = Math.min(1, minute / len);
    const wave = Math.sin(p * 18) * 0.07 + Math.sin(p * 47) * 0.04;
    return Math.max(0.08, Math.min(0.95, 0.14 + 0.62 * p * p + wave));
  }

  tick(dt: number, ctx: DirectorContext): DirectorOut[] {
    const out: DirectorOut[] = [];
    const tgt = this.target(ctx.minute, ctx.shiftLength) + ctx.stage * 0.025 + (ctx.zone !== 'booth' ? 0.12 : 0);
    this.tension += (tgt - this.tension) * Math.min(1, dt * 0.12);
    this.budget = Math.min(3, this.budget + dt * (0.02 + this.tension * 0.03));
    this.paceT += dt;
    this.sincePeak += dt;
    this.cueT -= dt;

    switch (this.pace) {
      case 'calm':
        this.quiet = false;
        if (this.paceT > 25 && this.tension > 0.22) this.setPace('build');
        break;
      case 'build':
        if (this.paceT > 20 && this.tension > 0.35 && this.budget >= 1.0 && this.sincePeak > 70) this.setPace('peak');
        else if (this.paceT > 55) this.setPace('calm');
        break;
      case 'peak':
        if (this.paceT > this.rng.range(7, 12)) {
          this.setPace('release');
          this.sincePeak = 0;
        }
        break;
      case 'release':
        // intentional silence: nothing scheduled, ambience ducks
        this.quiet = this.paceT < 9;
        if (this.paceT > 40) this.setPace('calm');
        break;
    }

    if (this.cueT <= 0 && this.pace !== 'release') {
      const cue = this.chooseCue(ctx);
      if (cue) {
        const cost = this.pace === 'peak' ? 0.4 : 0.12;
        // outside a peak, keep a reserve so the director can save up for one
        const reserve = this.pace === 'peak' ? 0 : 0.9;
        if (this.budget - cost >= reserve || (this.pace !== 'peak' && this.budget >= 2.6)) {
          this.budget -= cost;
          out.push({ cue, intensity: Math.min(1, this.tension + (this.pace === 'peak' ? 0.3 : 0)) });
        }
      }
      const base = this.pace === 'peak' ? 2.5 : this.pace === 'build' ? 9 : 20;
      this.cueT = base * this.rng.range(0.7, 1.5) * (1.3 - this.tension);
    }
    return out;
  }

  private setPace(p: Pace): void {
    if (p === 'peak') this.peaks++;
    this.pace = p;
    this.paceT = 0;
  }

  private chooseCue(ctx: DirectorContext): DirectorCue | null {
    const t = this.tension;
    const pool: DirectorCue[] = ['drip_stop', 'door_creak', 'distant_step'];
    if (t > 0.3) pool.push('knock', 'phone_ring');
    // the lamp is safe for the first half of the shift. After that it is not.
    if (t > 0.3 && ctx.minute > ctx.shiftLength * 0.45 && ctx.powerOn) pool.push('flicker');
    if (t > 0.55 || ctx.stage >= 3) pool.push('whisper');
    const booth = ctx.zone === 'booth';
    if (booth) {
      pool.push('chair_creak', 'overhead_steps');
      if (t > 0.3 && ctx.minute > 40) pool.push('music_box');
      if (t > 0.38) pool.push('scratch');
      if (t > 0.45 && ctx.stage >= 1) pool.push('knob_rattle');
      if (!ctx.patientPresent && ctx.stage >= 1) pool.push('window_tap');
      if (ctx.stage >= 2 && t > 0.5 && !ctx.patientPresent) pool.push('breath_behind');
    } else {
      pool.push('pipe_knock', 'scratch');
      if (t > 0.35) pool.push('child_hum', 'wheelchair');
      if (t > 0.5 && ctx.stage >= 2) pool.push('breath_behind', 'knob_rattle');
    }
    if (!ctx.powerOn) {
      const dark: DirectorCue[] = ['distant_step', 'whisper', 'door_creak', 'pipe_knock', 'scratch', 'child_hum', 'wheelchair'];
      if (booth) dark.push('chair_creak', 'overhead_steps');
      return this.rng.pick(dark);
    }
    return this.rng.pick(pool);
  }
}
