import type { ShiftSlot } from '../sim/types';

/** Night 00. About 22 real minutes. Minutes count from 22:00; the wall clock runs 1.6 times faster. */
export const SHIFT00_END = 300;
export const SHIFT00_BREAKER_AT = 105;
export const SHIFT00_FINALE_AT = 268;

export const SHIFT00: ShiftSlot[] = [
  { at: 8, archetype: 'plain', cast: 'walter' },
  { at: 24, archetype: 'chatty', cast: 'bernard' },
  { at: 40, archetype: 'plain', cast: 'dolly' },
  { at: 58, archetype: 'strange_innocent', cast: 'tobias' },
  // Walter again. Same face, same slippers line. Dry. If you let the real one in, the records say so.
  { at: 70, archetype: 'plain', cast: 'hester' },
  { at: 84, archetype: 'slipping_mimic', cast: 'walter', copy: true },
  { at: 112, archetype: 'plain', cast: 'ivor' },
  { at: 124, archetype: 'plain', cast: 'hollis' },
  { at: 132, archetype: 'tragic', cast: 'mae' },
  { at: 160, archetype: 'slipping_mimic', cast: 'penhale' },
  { at: 176, archetype: 'plain', cast: 'rosa' },
  // Walter's wife, who died in 1961. Built from what Walter carries around.
  { at: 186, archetype: 'slipping_mimic', cast: 'june' },
  { at: 196, archetype: 'fluent_mimic', cast: 'marsh' },
  { at: 214, archetype: 'plain', cast: 'gus' },
  { at: 232, archetype: 'fluent_mimic', special: 'mother', quirk: 'Your mother, barefoot in a ward nightgown, outside in the rain. She knows your name. She has not known your name since spring.' },
  { at: 250, archetype: 'plain', cast: 'edie' },
];
