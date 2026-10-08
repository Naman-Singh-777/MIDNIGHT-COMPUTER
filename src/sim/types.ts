export type Nature = 'human' | 'understudy';
export type Verdict = 'admit' | 'observe' | 'refuse' | 'contain';
export type QuestionId = 'name' | 'dob' | 'sender' | 'kin' | 'memory';
export const QUESTIONS: readonly QuestionId[] = ['name', 'dob', 'sender', 'kin', 'memory'];

export type Archetype =
  | 'plain'
  | 'chatty'
  | 'tragic'
  | 'strange_innocent'
  | 'slipping_mimic'
  | 'fluent_mimic'
  | 'voice_mimic';

/** What an inconsistency looks like. A tell is a clue, never proof. */
export type TellId =
  | 'dob_swap' // slip DOB differs from registry by a transposed digit
  | 'kin_wrong' // names a different next of kin than the registry
  | 'sender_wrong' // wrong referring doctor
  | 'echo' // repeats the officer's own words back
  | 'deceased' // registry says the person died
  | 'wristband' // wristband number does not match registry
  | 'photo' // photograph features do not match the face
  | 'no_breath' // no breath fog in the cold
  | 'too_fast' // answers before the question ends
  | 'borrowed_memory' // quotes a memory that belongs to an earlier patient
  | 'clerk_typo'; // harmless paperwork error (human)

export interface RegistryEntry {
  id: string;
  name: string;
  dob: string; // DD/MM/YYYY
  sender: string;
  kin: string;
  wristband: string;
  alive: boolean;
  photoMark: string; // e.g. "scar over left brow"
  note: string;
}

export interface Documents {
  slipName: string;
  slipDob: string;
  slipSender: string;
  wristband: string;
  photoMark: string; // what the photograph shows
}

export interface Patient {
  id: string;
  archetype: Archetype;
  truth: Nature; // hidden simulation truth
  registryId: string;
  displayName: string;
  docs: Documents;
  faceMark: string; // what the actual face shows
  answers: Record<QuestionId, string>;
  tells: TellId[]; // what is actually off about this person
  quirk: string; // spoken character flavour
  hue: number; // 0..1 clothing hue
  height: number; // body scale
  sprite: number; // body shape variant
  castId?: string;
  greet?: string;
}

export interface ShiftSlot {
  at: number; // minutes since 22:00
  archetype: Archetype;
  quirk?: string;
  story?: string;
  special?: 'mother';
  cast?: string; // who from src/data/cast.ts
  copy?: boolean; // a fake wearing that person
}

export type TaskId = 'mop' | 'file' | 'count1' | 'count_dawn';
export interface TodoItem {
  id: TaskId;
  text: string;
  where: string;
  at: number;
  due: number;
  shown: boolean;
  done: boolean;
  missed: boolean;
}

/** What the Ward B slot shows. register is the paperwork, actual is the bodies. */
export interface WardCount {
  register: number;
  actual: number;
  extras: number;
  motherTaken: boolean;
  stage: number;
}

export type Ending = 'clean' | 'crowded' | 'taken' | 'absent';
export type DeathCause = 'stalker' | 'breach' | 'nerves';

export type ConsequenceKind =
  | 'ward_incident' // admitted an understudy
  | 'window_return' // refused a real person
  | 'observation_breach' // held an understudy too long
  | 'guilt' // contained a real person
  | 'clean_catch'; // contained an understudy

export interface Consequence {
  kind: ConsequenceKind;
  patientId: string;
  due: number; // shift minutes
  fired: boolean;
}

export type Pace = 'calm' | 'build' | 'peak' | 'release';

export type DirectorCue =
  | 'flicker'
  | 'knock'
  | 'distant_step'
  | 'phone_ring'
  | 'whisper'
  | 'power_out'
  | 'power_back'
  | 'door_creak'
  | 'drip_stop'
  | 'music_box'
  | 'scratch'
  | 'breath_behind'
  | 'window_tap'
  | 'knob_rattle'
  | 'chair_creak'
  | 'overhead_steps'
  | 'pipe_knock'
  | 'child_hum'
  | 'wheelchair'
  | 'stage_up';

export type SimEvents = {
  clock: { minute: number };
  patientArrived: { patient: Patient };
  patientLeft: { patient: Patient; verdict: Verdict | 'timeout' };
  questionAnswered: { patientId: string; q: QuestionId; text: string };
  verdictResult: { patient: Patient; verdict: Verdict; correct: boolean };
  cue: { cue: DirectorCue; intensity: number };
  consequence: { c: Consequence; patient: Patient };
  powerChanged: { on: boolean };
  taskChanged: { id: string; text: string; done: boolean };
  story: { id: string; text: string; speaker?: string; call?: boolean; wrong?: boolean };
  stare: { on: boolean; hit: boolean };
  hallucination: { kind: 'phantom_step' | 'phantom_knock' | 'whisper_name' | 'shadow_figure' };
  shiftEnded: { score: ShiftScore };
  todo: { items: TodoItem[] };
  wardCounted: { id: TaskId; count: WardCount };
  stalker: { event: import('./stalker').StalkerEvent };
  breach: { phase: 'crack' | 'inside' | 'over' };
  death: { cause: DeathCause };
  fear: { event: import('./fear').FearEvent; real: boolean };
  dawn: { phase: 'start' | 'figure' };
  choice: { id: 'report_count' };
};

export interface ShiftScore {
  correct: number;
  wrong: number;
  admittedUnderstudies: number;
  refusedHumans: number;
  sanity: number;
  ending: Ending;
  tasksDone: number;
  tasksMissed: number;
}
