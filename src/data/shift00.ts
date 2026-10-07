import type { ShiftSlot } from '../sim/types';

/** Shift 00. About 22 real minutes. Minutes count from 22:00. */
export const SHIFT00_END = 300;
export const SHIFT00_BREAKER_AT = 105;
export const SHIFT00_FINALE_AT = 268;

export const SHIFT00: ShiftSlot[] = [
  { at: 8, archetype: 'plain', quirk: 'Polite. Dripping from the rain. Apologizes for the puddle.' },
  { at: 30, archetype: 'chatty', quirk: 'Carries a ceramic goose and insists it is his sister. Gives the goose a separate admission slip.' },
  { at: 58, archetype: 'strange_innocent', quirk: 'Hums the same four notes. The slip has a typo. He is exactly who he says he is.' },
  { at: 84, archetype: 'slipping_mimic', quirk: 'Smiles slightly too long. Rain does not seem to bother them.' },
  { at: 132, archetype: 'tragic', quirk: 'Asks if the children\'s ward is on this floor. Holds a knitted cap with no child in it.' },
  { at: 162, archetype: 'slipping_mimic', quirk: 'Very calm. Repeats back what you say, softly, like practising.' },
  { at: 198, archetype: 'fluent_mimic', quirk: 'Almost perfect. Tells a story you think you have heard before.' },
  { at: 232, archetype: 'fluent_mimic', special: 'mother', quirk: 'Your mother, barefoot in a ward cardigan, on the wrong side of the glass. She has never once been this calm.' },
];
