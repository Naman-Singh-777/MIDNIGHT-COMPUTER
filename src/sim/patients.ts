import { Rng } from '../core/rng';
import { DOCTORS, FIRST, LAST, MARKS, MEMORIES } from '../data/names';
import type { Archetype, Patient, QuestionId, RegistryEntry, TellId } from './types';

export function swapDigits(s: string): string {
  // swap the first two distinct digits in the string so it still looks like a date
  const chars = s.split('');
  const idx: number[] = [];
  chars.forEach((c, i) => /\d/.test(c) && idx.push(i));
  for (let k = 0; k < idx.length - 1; k++) {
    const a = idx[k];
    const b = idx[k + 1];
    if (chars[a] !== chars[b]) {
      [chars[a], chars[b]] = [chars[b], chars[a]];
      return chars.join('');
    }
  }
  return s;
}

function randomDob(rng: Rng): string {
  const d = String(rng.int(1, 28)).padStart(2, '0');
  const m = String(rng.int(1, 12)).padStart(2, '0');
  const y = rng.int(1898, 1941);
  return `${d}/${m}/${y}`;
}

function digits(rng: Rng, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += rng.int(0, 9);
  return s;
}

export function makeRegistry(rng: Rng, count: number): RegistryEntry[] {
  const used = new Set<string>();
  const out: RegistryEntry[] = [];
  while (out.length < count) {
    const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    if (used.has(name)) continue;
    used.add(name);
    out.push({
      id: `R${String(out.length + 1).padStart(3, '0')}`,
      name,
      dob: randomDob(rng),
      sender: rng.pick(DOCTORS),
      kin: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
      wristband: `VH-${digits(rng, 4)}`,
      alive: true,
      photoMark: rng.pick(MARKS),
      note: '',
    });
  }
  return out;
}

const TELL_POOL: TellId[] = ['dob_swap', 'kin_wrong', 'sender_wrong', 'wristband', 'photo', 'no_breath', 'echo'];

/** Fewer, stranger tells as the Understudy learns. */
export function tellsForStage(rng: Rng, stage: number, archetype: Archetype): TellId[] {
  if (archetype === 'voice_mimic') return ['echo', 'too_fast'];
  if (archetype === 'fluent_mimic') return rng.chance(0.5) ? ['borrowed_memory', 'no_breath'] : ['borrowed_memory', 'too_fast'];
  const count = stage <= 1 ? 3 : stage <= 3 ? 2 : 1;
  const picks = rng.shuffle(TELL_POOL).slice(0, count);
  if (stage >= 4 && !picks.includes('borrowed_memory')) picks[0] = 'borrowed_memory';
  return picks;
}

export interface MakeCtx {
  rng: Rng;
  entry: RegistryEntry;
  archetype: Archetype;
  stage: number;
  previous: Patient[];
  quirk: string;
  seq: number;
}

export function makePatient(ctx: MakeCtx): Patient {
  const { rng, entry, archetype, stage, previous, quirk, seq } = ctx;
  const mimic = archetype === 'slipping_mimic' || archetype === 'fluent_mimic' || archetype === 'voice_mimic';
  const tells: TellId[] = mimic ? tellsForStage(rng, stage, archetype) : [];
  if (archetype === 'strange_innocent') tells.push('clerk_typo');

  const docs = {
    slipName: entry.name,
    slipDob: entry.dob,
    slipSender: entry.sender,
    wristband: entry.wristband,
    photoMark: entry.photoMark,
  };
  const answers: Record<QuestionId, string> = {
    name: entry.name,
    dob: entry.dob,
    sender: entry.sender,
    kin: entry.kin,
    memory: rng.pick(MEMORIES),
  };
  let faceMark = entry.photoMark;

  for (const t of tells) {
    switch (t) {
      case 'dob_swap':
        answers.dob = swapDigits(entry.dob);
        break;
      case 'clerk_typo':
        docs.slipDob = swapDigits(entry.dob);
        break;
      case 'kin_wrong': {
        let k = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
        if (k === entry.kin) k = `${rng.pick(FIRST)} Marlowe`;
        answers.kin = k;
        break;
      }
      case 'sender_wrong': {
        let d = rng.pick(DOCTORS);
        if (d === entry.sender) d = DOCTORS[(DOCTORS.indexOf(d) + 1) % DOCTORS.length];
        answers.sender = d;
        break;
      }
      case 'wristband':
        docs.wristband = swapDigits(entry.wristband.replace('VH-', '')).replace(/^/, 'VH-');
        if (docs.wristband === entry.wristband) docs.wristband = 'VH-' + digits(rng, 4);
        break;
      case 'photo': {
        let m = rng.pick(MARKS);
        if (m === entry.photoMark) m = MARKS[(MARKS.indexOf(m) + 1) % MARKS.length];
        faceMark = m;
        break;
      }
      case 'borrowed_memory': {
        const donor = previous.length ? rng.pick(previous) : null;
        if (donor) answers.memory = donor.answers.memory;
        break;
      }
      default:
        break;
    }
  }

  return {
    id: `P${String(seq).padStart(2, '0')}`,
    archetype,
    truth: mimic ? 'understudy' : 'human',
    registryId: entry.id,
    displayName: entry.name,
    docs,
    faceMark,
    answers,
    tells,
    quirk,
    hue: rng.next(),
    height: rng.range(0.92, 1.08),
    sprite: rng.int(0, 2),
  };
}

export const QUESTION_TEXT: Record<QuestionId, string> = {
  name: 'Name for the ledger?',
  dob: 'Date of birth?',
  sender: 'Who sent you?',
  kin: 'Who should we call?',
  memory: 'What do you remember of tonight?',
};
