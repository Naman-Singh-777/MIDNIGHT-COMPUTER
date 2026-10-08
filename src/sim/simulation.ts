import { Bus } from '../core/events';
import { Rng } from '../core/rng';
import { SHIFT00, SHIFT00_BREAKER_AT, SHIFT00_END, SHIFT00_FINALE_AT } from '../data/shift00';
import { BEATS } from '../data/story';
import { MOTHER_ENTRY, MOTHER_ID, TODO, WARD_B_START } from '../data/motive';
import { CAST, CAST_BY_ID, COPY_GREET } from '../data/cast';
import { Stalker, type StalkerInput } from './stalker';
import { FearDirector } from './fear';
import { swapDigits } from './patients';
import { Director } from './director';
import { distortionFor } from './perception';
import { QUESTION_TEXT, makePatient, makeRegistry } from './patients';
import type {
  Consequence,
  Patient,
  QuestionId,
  RegistryEntry,
  ShiftScore,
  DeathCause,
  ShiftSlot,
  TaskId,
  TodoItem,
  WardCount,
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
  stare: boolean; // the patient is holding your eye
  score: ShiftScore;
  seq: number;
  todo: TodoItem[];
  admittedHumans: number;
  motherTaken: boolean;
  dead: DeathCause | null;
  breach: { phase: 'crack' | 'inside'; t: number } | null;
  dawn: { t: number; figure: boolean } | null;
  hollisIn: boolean; // the porter you let in walks the corridor with you at six
  wardLocked: boolean; // you reported the count; Pell locked himself in with them
  pellGone: boolean;
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
  private readonly gazeRng: Rng;
  private stareT = 10;
  private stareLeft = 0;
  private stareHit = false;
  private ducked = false;
  private gazing = false;

  constructor(readonly seed: number) {
    this.rng = new Rng(seed);
    this.presRng = new Rng(seed ^ 0x9e3779b9);
    this.director = new Director(new Rng(seed ^ 0x51ed270b));
    this.gazeRng = new Rng(seed ^ 0x2545f491);
    this.fearDir = new FearDirector(new Rng(seed ^ 0x6f1d33));
    this.state = {
      minute: 0,
      ended: false,
      powerOn: true,
      breakerTripped: false,
      zone: 'booth',
      flashlight: false,
      registry: [...makeRegistry(this.rng, 14), { ...MOTHER_ENTRY }],
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
      stare: false,
      score: { correct: 0, wrong: 0, admittedUnderstudies: 0, refusedHumans: 0, sanity: 100, ending: 'absent', tasksDone: 0, tasksMissed: 0 },
      seq: 0,
      todo: TODO.map((t) => ({ ...t, shown: false, done: false, missed: false })),
      admittedHumans: 0,
      motherTaken: false,
      dead: null,
      breach: null,
      dawn: null,
      hollisIn: false,
      wardLocked: false,
      pellGone: false,
    };
    this.addCastRecords();
  }

  /** Records for the named visitors, so a copy of someone pulls up the same record. */
  private addCastRecords(): void {
    const filler = makeRegistry(this.rng, CAST.length);
    CAST.forEach((c, i) => {
      const f = filler[i];
      this.state.registry.push({ ...f, id: `C_${c.id}`, name: c.name, photoMark: c.mark, note: c.note ?? '', alive: !c.dead });
    });
  }

  readonly stalker = new Stalker();
  readonly fearDir: FearDirector;
  private pendingSummon: { t: number; x: number } | null = null;
  private stalkerIn: StalkerInput = { x: 0, z: 0.5, noise: 0, noiseRange: 0, torchOnIt: false, inBooth: true, doorClosed: false };

  /** Where the player is and how loud they are. Presentation calls this every frame. */
  setPlayer(i: StalkerInput): void {
    this.stalkerIn = i;
  }

  /** Brings the tall one into the corridor. */
  summonStalker(x: number, life = Infinity): void {
    for (const e of this.stalker.summon(x, life)) this.bus.emit('stalker', { event: e });
  }

  die(cause: DeathCause): void {
    const s = this.state;
    if (s.ended) return;
    s.dead = cause;
    s.ended = true;
    this.bus.emit('death', { cause });
  }

  private runStalker(dt: number): void {
    const s = this.state;
    if (!s.dawn) this.stalker.rage = s.score.admittedUnderstudies;
    for (const e of this.stalker.tick(dt, this.stalkerIn)) {
      this.bus.emit('stalker', { event: e });
      if (e === 'kill') this.die('stalker');
      if (e === 'shriek') this.spike(0.6, 3);
      if (e === 'growl') this.spike(0.3, 0);
    }
    if (this.stalker.active) {
      const d = Math.hypot(this.stalkerIn.x - this.stalker.x, this.stalkerIn.z - this.stalker.z);
      if (d < 6) s.fear = Math.min(1, s.fear + dt * (6 - d) * 0.05);
    }
  }

  private runFear(dt: number): void {
    const s = this.state;
    const i = this.stalkerIn;
    if (this.pendingSummon) {
      this.pendingSummon.t -= dt;
      if (this.pendingSummon.t <= 0) {
        this.summonStalker(this.pendingSummon.x, 45);
        this.pendingSummon = null;
      }
    }
    const e = this.fearDir.tick(dt, {
      minute: s.minute,
      zone: s.zone,
      moving: i.noise > 0,
      stalkerActive: this.stalker.active,
      stage: s.stage,
      patientPresent: s.phase === 'present',
      powerOn: s.powerOn,
    });
    if (!e) return;
    const real = e === 'echo_steps' && this.fearDir.realEcho;
    this.bus.emit('fear', { event: e, real });
    if (real) {
      // when the steps stop, it is standing where they were
      const x = i.x - 6 > 2.6 ? i.x - 6 : i.x + 6;
      this.pendingSummon = { t: 7, x };
    }
    if (e === 'dead_line_call') this.spike(0.4, 3);
  }

  /** Six o'clock. The corridor dies a light at a time, then it walks out of the far end and paces past the ward door. */
  private runDawn(dt: number): void {
    const s = this.state;
    const d = s.dawn;
    if (!d) return;
    d.t += dt;
    if (!d.figure && d.t > 9) {
      d.figure = true;
      this.summonStalker(13.8);
      this.stalker.patrol(6.0, 11.2);
      this.stalker.rage = Math.max(0, s.score.admittedUnderstudies - (s.hollisIn ? 1 : 0));
      this.bus.emit('dawn', { phase: 'figure' });
    }
  }

  /** After the 2 a.m. count: report it and Pell locks Ward B from the inside. Fewer things get out. Pell does not come back. */
  reportCount(report: boolean): void {
    const s = this.state;
    if (!report) return;
    s.wardLocked = true;
    s.pellGone = true;
    this.say('pell_lock', "Right. Right. I'll lock it from this side then. Someone has to. Don't come to the door, whatever you hear. Don't.", 'Orderly Pell', true);
  }

  /** A fake left waiting too long at the glass does not leave. It comes through. Duck under the desk and stay down. */
  private runBreach(dt: number): void {
    const s = this.state;
    const b = s.breach;
    if (!b) return;
    b.t += dt;
    if (b.phase === 'crack' && b.t > 8) {
      b.phase = 'inside';
      b.t = 0;
      this.bus.emit('breach', { phase: 'inside' });
      this.spike(0.9, 10);
    } else if (b.phase === 'inside') {
      if (!this.ducked && s.zone === 'booth' && b.t > 0.9) {
        this.die('breach');
        return;
      }
      if (b.t > 6) {
        s.breach = null;
        this.bus.emit('breach', { phase: 'over' });
        this.leave('timeout');
        this.summonStalker(3, 70);
      }
    }
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
    this.runTodo();
    this.runStare(dt);
    this.runStalker(dt);
    this.runBreach(dt);
    this.runFear(dt);
    this.runDawn(dt);
    if (s.sanity <= 0) this.die('nerves');
    if (s.ended) return;
    this.runBreaker();
    this.runPatients(dt);
    this.runConsequences();
    this.runDirector(dt);
    this.runHallucinations(dt);

    if (s.minute >= SHIFT00_END && !s.ended) this.finish();
  }

  /** Ends the night. The ending depends on what got through the gate and whether you went to see her. */
  finish(): void {
    const s = this.state;
    if (s.ended) return;
    s.ended = true;
    const dawn = s.todo.find((t) => t.id === 'count_dawn')!;
    s.score.sanity = Math.round(s.sanity);
    s.score.ending = !dawn.done ? 'absent' : s.motherTaken ? 'taken' : s.score.admittedUnderstudies > 0 ? 'crowded' : 'clean';
    this.bus.emit('shiftEnded', { score: s.score });
  }

  // ---------------------------------------------------------------- the to-do list
  private runTodo(): void {
    const s = this.state;
    let changed = false;
    for (const t of s.todo) {
      if (!t.shown && s.minute >= t.at) {
        t.shown = true;
        changed = true;
        if (t.id === 'count_dawn') {
          s.dawn = { t: 0, figure: false };
          this.stalker.dismiss();
          this.bus.emit('dawn', { phase: 'start' });
        }
      }
      if (t.shown && !t.done && !t.missed && s.minute >= t.due && t.id !== 'count_dawn') {
        t.missed = true;
        changed = true;
        s.score.tasksMissed++;
        this.spike(0.15, 4);
        const line =
          t.id === 'count1'
            ? "Pell. Nobody did the head count. So nobody knows how many are in there. I'm not going to be the one who checks."
            : "Matron's office. Your list was on the desk, Officer. It is still on the desk.";
        this.say(`miss_${t.id}`, line, t.id === 'count1' ? 'Orderly Pell' : "Matron's Office");
      }
    }
    if (changed) this.bus.emit('todo', { items: s.todo });
  }

  /** Bodies on Ward B against the paperwork. Every Understudy you admitted is lying in a bed. */
  wardCount(): WardCount {
    const s = this.state;
    const register = WARD_B_START + s.admittedHumans;
    const extras = s.score.admittedUnderstudies;
    return { register, actual: register + extras, extras, motherTaken: s.motherTaken, stage: s.stage };
  }

  /** The presentation finished a task's mini game. Returns false if it is not on the list yet. */
  completeTask(id: TaskId): boolean {
    const s = this.state;
    const t = s.todo.find((x) => x.id === id);
    if (!t || !t.shown || t.done || s.ended) return false;
    t.done = true;
    if (!t.missed) s.score.tasksDone++;
    s.sanity = clamp(s.sanity + 3, 0, 100);
    this.bus.emit('todo', { items: s.todo });
    if (id === 'count1' || id === 'count_dawn') {
      const count = this.wardCount();
      this.bus.emit('wardCounted', { id, count });
      if (id === 'count1') {
        this.bus.emit('choice', { id: 'report_count' });
        if (count.extras > 0) {
          this.spike(0.6, 8);
          this.say('count1_res', `You got ${count.actual}? My sheet says ${count.register}. Don't count again. Get back to your desk and shut the door.`, 'Orderly Pell', true);
        } else this.say('count1_res', `${count.register}. Same as my sheet. Good. Good. I'll stop counting now.`, 'Orderly Pell', true);
      }
    }
    return true;
  }

  todoItem(id: TaskId): TodoItem | undefined {
    return this.state.todo.find((t) => t.id === id);
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

  private bumpStage(): void {
    const s = this.state;
    s.stage = Math.min(7, s.stage + 1);
    this.bus.emit('cue', { cue: 'stage_up', intensity: 0.4 + s.stage * 0.08 });
  }

  private spike(fear: number, sanityHit = 0): void {
    const s = this.state;
    s.fear = clamp(s.fear + fear, 0, 1);
    s.sanity = clamp(s.sanity - sanityHit, 0, 100);
  }

  // ---------------------------------------------------------------- story
  private say(id: string, text: string, speaker = 'Sister Imogen', call = false, wrong = false): void {
    if (this.storyDone.has(id)) return;
    this.storyDone.add(id);
    this.bus.emit('story', { id, text, speaker, call, wrong });
  }

  private runStory(): void {
    const s = this.state;
    for (const b of BEATS) {
      if (this.storyDone.has(b.id) || s.minute < b.at) continue;
      if (b.id === 'breaker_warn' && s.breakerTripped) {
        this.storyDone.add(b.id);
        continue;
      }
      if (b.minStage !== undefined && s.stage < b.minStage) {
        if (s.minute > b.at + 40) this.storyDone.add(b.id);
        continue;
      }
      if (b.needsFinale && !s.finaleDone) continue;
      if (b.id === 'dawn' && s.pellGone) {
        // Pell locked himself in at two. Whoever is holding the door now, it is using his voice.
        this.say(b.id, "It's six. Come on. I'm holding the door. Come on. Come on.", 'Orderly Pell', false, true);
        return;
      }
      // never talk over the officer's own interview; wait for a gap
      if (s.phase === 'present' && s.asked.length > 0 && s.minute < b.at + 8) continue;
      this.say(b.id, b.text, b.who, b.call ?? false, b.wrong ?? false);
      return;
    }
  }

  // ---------------------------------------------------------------- the stare rule
  /** Seated player ducked below the sill. */
  setDuck(on: boolean): void {
    this.ducked = on;
  }

  /** Seated player is zoomed on the patient's face. */
  setGaze(on: boolean): void {
    this.gazing = on;
  }

  private runStare(dt: number): void {
    const s = this.state;
    const p = s.current;
    const eligible =
      !!p &&
      s.phase === 'present' &&
      s.powerOn &&
      ((p.truth === 'understudy' && (s.stage >= 1 || p.archetype !== 'slipping_mimic')) || p.archetype === 'strange_innocent');
    if (!eligible) {
      if (s.stare) this.endStare();
      this.stareT = Math.max(this.stareT, 7);
      return;
    }
    if (this.ducked) s.patience -= dt / 150;
    if (s.stare) {
      this.stareLeft -= dt;
      if (this.ducked) this.stareLeft = Math.min(this.stareLeft, 1.2);
      else if (this.gazing) this.contact();
      if (this.stareLeft <= 0) this.endStare();
    } else {
      this.stareT -= dt;
      if (this.stareT <= 0) {
        s.stare = true;
        this.stareLeft = this.gazeRng.range(4, 6.5);
        this.stareHit = false;
        this.bus.emit('stare', { on: true, hit: false });
      }
    }
  }

  private endStare(): void {
    const s = this.state;
    s.stare = false;
    this.stareT = this.gazeRng.range(15, 28);
    this.bus.emit('stare', { on: false, hit: this.stareHit });
  }

  /** Eye contact during a stare. Only the Understudy punishes it. */
  private contact(): void {
    const s = this.state;
    if (!s.stare || this.stareHit || this.ducked || !s.current) return;
    if (s.current.truth !== 'understudy') return;
    this.stareHit = true;
    this.spike(0.45, 9);
    this.bus.emit('stare', { on: true, hit: true });
  }

  // ---------------------------------------------------------------- breaker
  private runBreaker(): void {
    const s = this.state;
    if (!s.breakerTripped && s.minute >= SHIFT00_BREAKER_AT && s.powerOn) {
      s.breakerTripped = true;
      s.powerOn = false;
      this.bus.emit('powerChanged', { on: false });
      this.bus.emit('taskChanged', { id: 'breaker', text: 'Power is out. Get to the fuse box at the far end of the corridor. Something is out there. Crouch.', done: false });
      this.spike(0.5, 4);
      this.summonStalker(11.6);
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
    this.stalker.summon(this.stalker.x, 25);
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
          this.spawn(slot.special === 'mother' ? this.makeMother(slot.quirk ?? '') : slot.cast ? this.makeCast(slot) : this.makeFromSlot(slot.archetype, slot.quirk ?? ''));
        }
      }
    } else if (s.phase === 'approaching' && s.phaseTime > 3.5) {
      s.phase = 'present';
      s.phaseTime = 0;
    } else if (s.phase === 'present') {
      const p = s.current;
      if (!p) {
        s.phase = 'none';
        return;
      }
      const angry = p.truth === 'understudy' && s.stage >= 2;
      if (s.powerOn && !s.breach) s.patience -= dt / (angry ? 110 : s.asked.length ? 330 : 170);
      if (s.patience <= 0 && !s.breach) {
        if (angry) {
          s.breach = { phase: 'crack', t: 0 };
          this.bus.emit('breach', { phase: 'crack' });
          this.spike(0.5, 3);
        } else this.leave('timeout');
      }
    } else if (s.phase === 'leaving' && s.phaseTime > 2.6) {
      s.phase = 'none';
      s.phaseTime = 0;
      s.current = null;
    }
  }

  /** A named visitor, or a fake wearing one. */
  private makeCast(slot: ShiftSlot): Patient {
    const s = this.state;
    const c = CAST_BY_ID[slot.cast!];
    const entry = s.registry.find((r) => r.id === `C_${c.id}`)!;
    const p = makePatient({ rng: this.rng, entry, archetype: slot.archetype, stage: s.stage, previous: s.history, quirk: c.quirk, seq: ++s.seq });
    p.castId = c.id;
    p.greet = slot.copy ? COPY_GREET[c.id] ?? c.greet : c.greet;
    if (c.typo && p.truth === 'human') {
      p.docs.slipDob = swapDigits(entry.dob);
      if (!p.tells.includes('clerk_typo')) p.tells.push('clerk_typo');
    }
    const fill = (t: string): string => t.replace(/\{dob\}/g, p.answers.dob).replace(/\{sender\}/g, p.answers.sender).replace(/\{kin\}/g, p.answers.kin);
    for (const q of ['name', 'dob', 'sender', 'kin'] as QuestionId[]) {
      const t = c.say[q];
      if (t) p.answers[q] = fill(t);
    }
    if (c.say.memory && !p.tells.includes('borrowed_memory')) p.answers.memory = c.say.memory;
    if (slot.copy) p.quirk = `${c.quirk} Bone dry.`;
    return p;
  }

  private makeFromSlot(archetype: Patient['archetype'], quirk: string): Patient {
    const s = this.state;
    const used = new Set(s.history.map((p) => p.registryId));
    const pool = s.registry.filter((r) => r.id !== MOTHER_ID && r.id !== 'R900' && !r.id.startsWith('C_') && !used.has(r.id) && !s.queue.some((q) => q.registryId === r.id));
    const entry = pool[this.rng.int(0, pool.length - 1)];
    if (archetype === 'tragic') {
      entry.kin = `${entry.name.split(' ')[0]} Jr.`;
      entry.note = 'Next of kin deceased, 1958.';
    }
    return makePatient({ rng: this.rng, entry, archetype, stage: s.stage, previous: s.history, quirk, seq: ++s.seq });
  }

  /** Her face, her name, her wristband. But the ledger says she has not left her bed, and the hall is freezing. */
  private makeMother(quirk: string): Patient {
    const s = this.state;
    const entry = s.registry.find((r) => r.id === MOTHER_ID)!;
    const p = makePatient({ rng: this.rng, entry, archetype: 'fluent_mimic', stage: Math.max(4, s.stage), previous: s.history, quirk, seq: ++s.seq });
    p.tells = ['no_breath', 'borrowed_memory'];
    p.faceMark = entry.photoMark;
    p.docs = { slipName: entry.name, slipDob: entry.dob, slipSender: entry.sender, wristband: entry.wristband, photoMark: entry.photoMark };
    p.answers = {
      name: 'Ada. Ada Wren. You know my name, love.',
      dob: entry.dob,
      sender: 'Nobody sent me. I walked. I wanted to see you.',
      kin: 'You. Who else would I put down.',
      memory: 'You used to count the headlights on the ceiling with me. Let me in. It is so cold out here.',
    };
    p.height = 0.95;
    return p;
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
    p.answers.memory = "I looked in on your mam, pet. She's grand. Open up now, it's perishing out here.";
    p.greet = "It's Imogen, pet. I've locked myself out, would you believe it. Open the gate for me.";
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
    s.stare = false;
    this.stareT = this.gazeRng.range(9, 16);
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
    this.contact();
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

    if (v === 'admit' && !mimic) {
      s.admittedHumans++;
      const e = this.registryOf(p);
      e.note = `${e.note ? e.note + ' ' : ''}LET IN TONIGHT. ON THE WARD NOW.`;
    }
    if (s.breach) s.breach = null;
    if (v === 'admit' && p.registryId === MOTHER_ID) s.motherTaken = true;
    if (v === 'admit' && p.castId === 'hollis' && !mimic) s.hollisIn = true;
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
        this.bumpStage();
        this.schedule('ward_incident', p, 22);
        this.spike(0.1, 5);
      } else if (v === 'observe') {
        this.schedule('observation_breach', p, 18);
        this.spike(0.15, 2);
      } else if (v === 'refuse') {
        this.bumpStage();
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
          this.say(`inc_${p.id}`, "Pell! The one you sent up asked me my name, then said it back before I'd answered. It's gone out into the corridor. Shut your door.", 'Orderly Pell');
          this.spike(0.7, 8);
          this.bus.emit('cue', { cue: 'overhead_steps', intensity: 0.8 });
          this.bus.emit('cue', { cue: 'whisper', intensity: 0.8 });
          if (!s.wardLocked) this.summonStalker(13.5, 90);
          break;
        case 'observation_breach':
          this.bumpStage();
          this.say(`obs_${p.id}`, 'Kessler. The observation room is open. Nobody forced the door. Close yours.', 'Night Nurse Kessler');
          this.spike(0.8, 8);
          this.bus.emit('cue', { cue: 'door_creak', intensity: 0.9 });
          break;
        case 'window_return':
          this.say(`ret_${p.id}`, p.truth === 'understudy' ? `Someone's at your window again. Looks like ${p.displayName}. Soaking. No, wait. Bone dry.` : `${p.displayName} is back at your window. Soaked through. Says there's nowhere else to go.`, 'Orderly Pell');
          this.spike(0.3, 3);
          this.bus.emit('cue', { cue: p.truth === 'understudy' ? 'window_tap' : 'knock', intensity: 0.7 });
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
