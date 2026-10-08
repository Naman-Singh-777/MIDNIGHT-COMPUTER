/**
 * The fear director. It sits on top of the pacing director and decides what happens to the player
 * between visitors: harmless things that look like threats, real threats that start out looking harmless,
 * and small changes to the desk that tell you the booth is no longer yours.
 *
 * Research it follows: tension needs release (no event inside a cooldown, and never while something is
 * already hunting); teach the harmless version first (the rat, Pell's false alarm) so the real version
 * later is a betrayal; safe spaces erode in stages; the best event is sometimes nothing.
 * Pure logic. No DOM, no Three.js.
 */
import type { Rng } from '../core/rng';

export type FearEvent =
  | 'rat' // harmless scurry near you
  | 'pipe_burst' // harmless bang and hiss
  | 'pell_false_alarm' // heavy steps, then it's only Pell
  | 'echo_steps' // steps behind you that copy yours
  | 'run_far' // something running at the far end, stops when you stop
  | 'figure_far' // the tall one standing at the end, gone on the next flicker
  | 'breath_wall' // breathing through the wall
  | 'mug_moved' // desk
  | 'terminal_line' // desk: a record you did not open
  | 'photo_down' // desk: her photograph face down
  | 'dead_line_call' // desk: the phone rings on a dead line
  | 'lamp_out' // desk: the lamp dies for a few seconds
  | 'door_knock'; // someone knocks on the booth door from the corridor

export interface FearCtx {
  minute: number;
  zone: 'booth' | 'corridor' | 'breaker';
  moving: boolean;
  stalkerActive: boolean;
  stage: number;
  patientPresent: boolean;
  powerOn: boolean;
}

/** How safe the booth is, by time. Safe, then uncertain, then compromised, then not safe at all. */
export function boothSafety(minute: number): 0 | 1 | 2 | 3 {
  return minute < 60 ? 0 : minute < 150 ? 1 : minute < 225 ? 2 : 3;
}

export class FearDirector {
  private since = 30; // seconds since the last event
  private boothAway = 0; // seconds the player spent outside the booth
  private cameBack = 0; // seconds since they came back into the booth
  private lastZone: FearCtx['zone'] = 'booth';
  private corridorT = 0;
  private counts: Partial<Record<FearEvent, number>> = {};
  /** The next echo will be real: the tall one is behind you when the steps stop. */
  realEcho = false;

  constructor(private readonly rng: Rng) {}

  private used(e: FearEvent): number {
    return this.counts[e] ?? 0;
  }

  tick(dt: number, c: FearCtx): FearEvent | null {
    this.since += dt;
    if (c.zone !== 'booth') {
      this.boothAway += dt;
      this.corridorT += dt;
    } else {
      if (this.lastZone !== 'booth') this.cameBack = 0;
      this.cameBack += dt;
      this.corridorT = 0;
    }
    this.lastZone = c.zone;
    // never stack scares, and leave room to breathe. Later in the night the gaps get shorter.
    const cooldown = c.minute < 120 ? 50 : c.minute < 220 ? 35 : 26;
    if (this.since < cooldown || c.stalkerActive) return null;
    const pick = this.choose(c);
    if (!pick) return null;
    this.since = 0;
    this.counts[pick] = this.used(pick) + 1;
    return pick;
  }

  private choose(c: FearCtx): FearEvent | null {
    const r = this.rng;
    if (c.zone !== 'booth') {
      if (this.corridorT < 4) return null; // let them take a few steps first
      // the first time out there, teach them that some noises are nothing
      if (!this.used('rat')) return 'rat';
      const pool: FearEvent[] = ['pipe_burst'];
      if (c.minute < 140 && !this.used('pell_false_alarm') && c.minute > 30) pool.push('pell_false_alarm');
      if (c.moving && this.used('echo_steps') < 3) pool.push('echo_steps', 'echo_steps');
      if (c.minute > 90 && this.used('run_far') < 2) pool.push('run_far');
      if (c.minute > 110 && c.powerOn && this.used('figure_far') < 2) pool.push('figure_far');
      if (c.stage >= 1) pool.push('breath_wall');
      const e = r.pick(pool);
      // the betrayal: later on, steps behind you are not your echo
      this.realEcho = e === 'echo_steps' && c.minute > 170 && c.stage >= 2 && r.chance(0.5);
      return r.chance(0.6) ? e : null;
    }
    // the booth: only when nobody is at the glass, and mostly right after you come back in
    if (c.patientPresent) return null;
    const safety = boothSafety(c.minute);
    if (safety === 0) return null;
    const fresh = this.cameBack < 12 && this.boothAway > 20;
    if (!fresh && !r.chance(0.25)) return null;
    this.boothAway = 0;
    const pool: FearEvent[] = [];
    if (safety >= 1) pool.push('mug_moved', 'terminal_line');
    if (safety >= 2 && !this.used('photo_down')) pool.push('photo_down', 'photo_down');
    if (safety >= 2 && this.used('dead_line_call') < 1) pool.push('dead_line_call');
    if (safety >= 3) pool.push('lamp_out', 'door_knock');
    const fresh2 = pool.filter((e) => this.used(e) < 2);
    return fresh2.length ? r.pick(fresh2) : null;
  }
}
