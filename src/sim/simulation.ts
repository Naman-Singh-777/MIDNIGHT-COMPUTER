import { Bus } from '../core/events';
import { Rng } from '../core/rng';
import { SHIFT00, SHIFT00_BREAKER_AT, SHIFT00_END, SHIFT00_FINALE_AT } from '../data/shift00';
import { Director } from './director';
import { distortionFor } from './perception';
import { QUESTION_TEXT, makePatient, makeRegistry } from './patients';
import type {
  Consequence,
  Patient,
  QuestionId,
  RegistryEntry,
  ShiftScore,
  SimEvents,
  Verdict,
} from './types';

/** Shift minutes that pass per real second. 300 minutes is about 22 real minutes. */
export const MINUTES_PER_SECOND = 1 / 4.5;

export type PatientPhase = 'none' | 'approaching' | 'present' | 'leaving';
export type Zone = 'booth' | 'corridor' | 'breaker';

export interface SimState {
  minute: number;
  ended: boolean;
  powerOn: boolean;
  breakerTripped: boolean;
  zone: Zone;
  flashlight: boolean;
  registry: RegistryEntry[];
  current: Patient | null;
  phase: PatientPhase;
  phaseTime: number;
  patience: number;
  asked: QuestionId[];
  lastLine: string; // last thing the officer said, for echoes
  lookedUp: boolean;
  faceChecked: boolean;
  history: Patient[];
  queue: Patient[]; // patients coming back
  slotIndex: number;
  finaleDone: boolean;
  consequences: Consequence[];
  stage: number; // Understudy stage 0..7
  sanity: number;
  fear: number;
  score: ShiftScore;
  seq: number;
}

export interface AskResult {
  text: string;
  delay: number; // seconds before the patient speaks
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export class Simulation {
  readonly bus = new Bus<SimEvents>();
  readonly rng: Rng;
  /** Separate stream for presentation-only randomness so truth stays deterministic. */
  readonly presRng: Rng;
  readonly director: Director;
  state: SimState;
  private hallT = 5;
  private storyDone = new Set<string>();

  constructor(readonly seed: number) {
    this.rng = new Rng(seed);
    this.presRng = new Rng(seed ^ 0x9e3779b9);
    this.director = new Director(new Rng(seed ^ 0x51ed270b));
    this.state = {
      minute: 0,
      ended: false,
      powerOn: true,
      breakerTripped: false,
      zone: 'booth',
      flashlight: false,
      registry: makeRegistry(this.rng, 14),
      current: null,
      phase: 'none',
      phaseTime: 0,
      patience: 1,
      asked: [],
      lastLine: '',
      lookedUp: false,
      faceChecked: false,
      history: [],
      queue: [],
      slotIndex: 0,
      finaleDone: false,
      consequences: [],
      stage: 0,
      sanity: 100,
      fear: 0,
      score: { correct: 0, wrong: 0, admittedUnderstudies: 0, refusedHumans: 0, sanity: 100 },
      seq: 0,
    };
  }

  get distortion() {
    return distortionFor(this.state.sanity, this.state.fear);
  }

  registryOf(p: Patient): RegistryEntry {
    return this.state.registry.find((r) => r.id === p.registryId)!;
  }

  // ---------------------------------------------------------------- time
  tick(dt: number): void {
    const s = this.state;
    if (s.ended) return;
    const prevMinute = s.minute;
    s.minute += dt * MINUTES_PER_SECOND;
    if (Math.floor(s.minute) !== Math.floor(prevMinute)) this.bus.emit('clock', { minute: s.minute });

    s.fear = Math.max(0, s.fear - dt * 0.15);
    this.updateSanity(dt);
    this.runStory();
    this.runBreaker();
    this.runPatients(dt);
    this.runConsequences();
    this.runDirector(dt);
    this.runHallucinations(dt);

    if (s.minute >= SHIFT00_END && !s.ended) {
      s.ended = true;
      s.score.sanity = Math.round(s.sanity);
      this.bus.emit('shiftEnded', { score: s.score });
    }
  }

  private updateSanity(dt: number): void {
    const s = this.state;
    let d = 0;
    if (s.zone === 'booth') {
      if (s.powerOn) d += s.current && s.phase === 'present' ? 0.05 : 0.01;
      else d -= 0.15;
    } else {
      d -= s.flashlight ? 0.06 : 0.14;
    }
    d -= s.fear * 0.12;
    s.sanity = clamp(s.sanity + d * dt, 0, 100);
  }

  private spike(fear: number, sanityHit = 0): void {
    const s = this.state;
    s.fear = clamp(s.fear + fear, 0, 1);
    s.sanity = clamp(s.sanity - sanityHit, 0, 100);
  }

  // ---------------------------------------------------------------- story
  private say(id: string, text: string, speaker = 'Sister Imogen'): void {
    if (this.storyDone.has(id)) return;
    this.storyDone.add(id);
    this.bus.emit('story', { id, text, speaker });
  }

  private runStory(): void {
    const m = this.state.minute;
    if (m > 0.6) this.say('open', 'Night intake, Vesper Hollow. Rain has the road to itself, so you will be a little lonely. Compare the slip to the ledger, ask your five questions, and trust the lamp more than your nerves. Mind the ledger, love.');
    if (m > 52) this.say('pell1', 'Ward B is quiet. Too quiet, ha. That was a joke, Officer. Please laugh, I have been practising.', 'Orderly Pell');
    if (m > 96 && !this.state.breakerTripped) this.say('breaker_warn', 'The east breaker trips when the weather turns. If it goes, do not linger in that corridor. Warm hands, steady voice.');
    if (m > 150) this.say('pell2', 'Quick head count: Ward B has eleven. The register says eleven. I counted twelve for a second. Do not mind me.', 'Orderly Pell');
    if (m > 215) this.say('imogen3', 'If anyone rings the gate and says my name, ask them what I told you to mind. Only I know the answer.');
  }

  // ---------------------------------------------------------------- breaker
  private runBreaker(): void {
    const s = this.state;
    if (!s.breakerTripped && s.minute >= SHIFT00_BREAKER_AT && s.powerOn) {
      s.breakerTripped = true;
      s.powerOn = false;
      this.bus.emit('powerChanged', { on: false });
      this.bus.emit('taskChanged', { id: 'breaker', text: 'Restore power at the east breaker panel (east corridor).', done: false });
      this.spike(0.5, 4);
    }
  }

  restorePower(): boolean {
    const s = this.state;
    if (s.powerOn || s.zone !== 'breaker') return false;
    s.powerOn = true;
    this.bus.emit('powerChanged', { on: true });
    this.bus.emit('taskChanged', { id: 'breaker', text: 'Power restored.', done: true });
    this.bus.emit('cue', { cue: 'power_back', intensity: 0.5 });
    s.sanity = clamp(s.sanity + 4, 0, 100);
    return true;
  }

  setZone(z: Zone): void {
    this.state.zone = z;
  }

  setFlashlight(on: boolean): void {
    this.state.flashlight = on;
  }

  // ---------------------------------------------------------------- patients
  private runPatients(dt: number): void {
    const s = this.state;
    s.phaseTime += dt;

    if (s.phase === 'none') {
      if (!s.powerOn) return;
      const finaleDue = s.minute >= SHIFT00_FINALE_AT && !s.finaleDone;
      if (finaleDue) {
        s.finaleDone = true;
        this.spawn(this.makeFinale());
      } else if (s.queue.length && s.minute > 20) {
        this.spawn(s.queue.shift()!);
      } else {
        const slot = SHIFT00[s.slotIndex];
        if (slot && s.minute >= slot.at) {
          s.slotIndex++;
          this.spawn(this.makeFromSlot(slot.archetype, slot.quirk ?? ''));
        }
      }
    } else if (s.phase === 'approaching' && s.phaseTime > 3.5) {
      s.phase = 'present';
      s.phaseTime = 0;
    } else if (s.phase === 'present') {
      if (s.powerOn) s.patience -= dt / (s.asked.length ? 330 : 170);
      if (s.patience <= 0) this.leave('timeout');
    } else if (s.phase === 'leaving' && s.phaseTime > 2.6) {
      s.phase = 'none';
      s.phaseTime = 0;
      s.current = null;
    }
  }

  private makeFromSlot(archetype: Patient['archetype'], quirk: string): Patient {
    const s = this.state;
    const used = new Set(s.history.map((p) => p.registryId));
    const pool = s.registry.filter((r) => !used.has(r.id) && !s.queue.some((q) => q.registryId === r.id));
    const entry = pool[this.rng.int(0, pool.length - 1)];
    if (archetype === 'tragic') {
      entry.kin = `${entry.name.split(' ')[0]} Jr.`;
      entry.note = 'Next of kin deceased, 1958.';
    }
    return makePatient({ rng: this.rng, entry, archetype, stage: s.stage, previous: s.history, quirk, seq: ++s.seq });
  }

  private makeFinale(): Patient {
    const s = this.state;
    const entry: RegistryEntry = {
      id: 'R900',
      name: 'Sister Imogen',
      dob: '03/02/1911',
      sender: "Matron's Office",
      kin: 'None on file',
      wristband: 'STAFF-01',
      alive: true,
      photoMark: 'a freckle under the left eye',
      note: 'Night staff. On the premises.',
    };
    s.registry.push(entry);
    const p = makePatient({ rng: this.rng, entry, archetype: 'voice_mimic', stage: 7, previous: s.history, quirk: 'The voice on the gate intercom is warm and exactly right. Almost.', seq: ++s.seq });
    p.answers.memory = 'Mind the ledger, love.';
    return p;
  }

  private spawn(p: Patient): void {
    const s = this.state;
    s.current = p;
    s.phase = 'approaching';
    s.phaseTime = 0;
    s.patience = 1;
    s.asked = [];
    s.lastLine = '';
    s.lookedUp = false;
    s.faceChecked = false;
    this.bus.emit('patientArrived', { patient: p });
  }

  /** Query the registry on the CRT. Needs power. */
  lookup(): RegistryEntry | null {
    const s = this.state;
    if (!s.current || s.phase !== 'present' || !s.powerOn) return null;
    s.lookedUp = true;
    return this.registryOf(s.current);
  }

  inspectFace(): string | null {
    const s = this.state;
    if (!s.current || s.phase !== 'present') return null;
    s.faceChecked = true;
    return s.current.faceMark;
  }

  ask(q: QuestionId): AskResult | null {
    const s = this.state;
    const p = s.current;
    if (!p || s.phase !== 'present' || s.asked.includes(q)) return null;
    let text = p.answers[q];
    if (p.tells.includes('echo') && s.lastLine) text = s.lastLine;
    s.asked.push(q);
    s.lastLine = QUESTION_TEXT[q];
    const delay = p.tells.includes('too_fast') ? 0.05 : 0.9 + this.presRng.next() * 0.9;
    this.bus.emit('questionAnswered', { patientId: p.id, q, text });
    return { text, delay };
  }

  /** Visible without any action: does breath show in the cold air? */
  showsBreath(p: Patient): boolean {
    return !p.tells.includes('no_breath');
  }

  // ---------------------------------------------------------------- verdicts
  verdict(v: Verdict): void {
    const s = this.state;
    const p = s.current;
    if (!p || s.phase !== 'present') return;
    if (v === 'contain' && !s.powerOn) return; // the lever is electric
    const mimic = p.truth === 'understudy';
    let wrong = false;

    if (!mimic) {
      if (v === 'refuse') {
        wrong = true;
        s.score.refusedHumans++;
        this.schedule('window_return', p, 28);
        this.spike(0.2, 6);
      } else if (v === 'contain') {
        wrong = true;
        s.score.refusedHumans++;
        this.schedule('guilt', p, 3);
        this.spike(0.5, 14);
      } else if (v === 'observe') {
        this.spike(0, 1);
      }
    } else {
      if (v === 'admit') {
        wrong = true;
        s.score.admittedUnderstudies++;
        s.stage = Math.min(7, s.stage + 1);
        this.schedule('ward_incident', p, 22);
        this.spike(0.1, 5);
      } else if (v === 'observe') {
        this.schedule('observation_breach', p, 18);
        this.spike(0.15, 2);
      } else if (v === 'refuse') {
        s.stage = Math.min(7, s.stage + 1);
        this.schedule('window_return', p, 34);
        this.spike(0.1, 1);
      } else if (v === 'contain') {
        this.schedule('clean_catch', p, 2);
        this.spike(0.6, 0);
      }
    }
    if (wrong) s.score.wrong++;
    else if (!(v === 'observe' || (mimic && v === 'refuse'))) s.score.correct++;
    this.bus.emit('verdictResult', { patient: p, verdict: v, correct: !wrong });
    s.history.push(p);
    this.leave(v);
  }

  private leave(v: Verdict | 'timeout'): void {
    const s = this.state;
    const p = s.current;
    if (!p) return;
    if (v === 'timeout') {
      s.history.push(p);
      if (p.truth === 'human') this.schedule('window_return', p, 20);
      this.spike(0.1, 2);
    }
    s.phase = 'leaving';
    s.phaseTime = 0;
    this.bus.emit('patientLeft', { patient: p, verdict: v });
  }

  // ---------------------------------------------------------------- consequences
  private schedule(kind: Consequence['kind'], p: Patient, delayMin: number): void {
    this.state.consequences.push({ kind, patientId: p.id, due: this.state.minute + delayMin, fired: false });
  }

  private runConsequences(): void {
    const s = this.state;
    for (const c of s.consequences) {
      if (c.fired || s.minute < c.due) continue;
      c.fired = true;
      const p = s.history.find((h) => h.id === c.patientId);
      if (!p) continue;
      switch (c.kind) {
        case 'ward_incident':
          this.say(`inc_${p.id}`, 'Ward B, Pell here. The new admission asked me for my name. Then said it back to me before I answered. Did you let someone through, Officer?', 'Orderly Pell');
          this.spike(0.7, 8);
          this.bus.emit('cue', { cue: 'whisper', intensity: 0.8 });
          break;
        case 'observation_breach':
          s.stage = Math.min(7, s.stage + 1);
          this.say(`obs_${p.id}`, 'Observation room is open. The door was not forced. It was asked nicely.', 'Night Nurse Kessler');
          this.spike(0.8, 8);
          this.bus.emit('cue', { cue: 'door_creak', intensity: 0.9 });
          break;
        case 'window_return':
          this.say(`ret_${p.id}`, `Someone is at the window again. It looks like ${p.displayName}. No coat.`, 'Orderly Pell');
          this.spike(0.3, 3);
          this.bus.emit('cue', { cue: 'knock', intensity: 0.7 });
          if (p.truth === 'understudy') {
            const entry = this.registryOf(p);
            this.state.queue.push(makePatient({ rng: this.rng, entry, archetype: 'slipping_mimic', stage: s.stage, previous: s.history, quirk: 'Back at the window. Knows what you asked last time.', seq: ++s.seq }));
          } else {
            this.state.queue.push({ ...p, id: `P${String(++s.seq).padStart(2, '0')}`, quirk: 'Soaked. Quiet now. Looks at the floor.' });
          }
          break;
        case 'guilt':
          s.sanity = clamp(s.sanity - 6, 0, 100);
          this.bus.emit('cue', { cue: 'whisper', intensity: 0.6 });
          break;
        case 'clean_catch':
          s.sanity = clamp(s.sanity + 6, 0, 100);
          break;
      }
      this.bus.emit('consequence', { c, patient: p });
    }
  }

  // ---------------------------------------------------------------- director + hallucinations
  private runDirector(dt: number): void {
    const s = this.state;
    const cues = this.director.tick(dt, {
      minute: s.minute,
      shiftLength: SHIFT00_END,
      fear: s.fear,
      sanity: s.sanity,
      stage: s.stage,
      patientPresent: s.phase === 'present',
      powerOn: s.powerOn,
      zone: s.zone,
    });
    for (const c of cues) {
      this.spike(c.intensity * 0.35);
      this.bus.emit('cue', c);
    }
  }

  private runHallucinations(dt: number): void {
    this.hallT -= dt;
    if (this.hallT > 0) return;
    const rate = this.distortion.hallucinationRate; // per minute
    this.hallT = rate > 0 ? 60 / rate * this.presRng.range(0.6, 1.4) : 10;
    if (rate <= 0) return;
    const kinds = ['phantom_step', 'phantom_knock', 'whisper_name', 'shadow_figure'] as const;
    this.bus.emit('hallucination', { kind: this.presRng.pick(kinds) });
  }
}
