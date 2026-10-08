import type { RegistryEntry, TodoItem } from '../sim/types';

/**
 * Why the officer is here. Their mother, Ada Wren, has been on Ward B since April.
 * Night staff may sit with family at six. The officer took the night window to be close to her.
 * Everything the player lets through the gate ends up on her ward.
 */
export const MOTHER_ID = 'R209';
export const MOTHER_BED = 9;
/** Beds already filled on Ward B when the shift starts. Bed 9 is hers. */
export const WARD_B_START = 11;

export const MOTHER_ENTRY: RegistryEntry = {
  id: MOTHER_ID,
  name: 'Ada Wren',
  dob: '19/03/1901',
  sender: 'Dr. Ines Abara',
  kin: 'Her child. On staff, night intake',
  wristband: 'VH-0909',
  alive: true,
  photoMark: 'a freckle under the left eye',
  note: 'WARD B, BED 9. NOT ALLOWED OFF THE WARD. ASLEEP AT 22:00.',
};

export const MOTHER_SLOT_AT = 232;

/** The shift's to-do list. Times are shift minutes from 22:00. */
export const TODO: Omit<TodoItem, 'shown' | 'done' | 'missed'>[] = [
  { id: 'mop', text: "Mop the floor by the bucket. Pell says it's rust.", where: 'East corridor, by the bucket', at: 0, due: 45 },
  { id: 'file', text: "File last week's forms in the cabinet behind your chair.", where: 'Booth, grey filing cabinet', at: 0, due: 45 },
  { id: 'count1', text: '2 a.m. head count. Look through the slot in the Ward B door.', where: 'East corridor, Ward B door', at: 150, due: 190 },
  { id: 'count_dawn', text: 'Six o\'clock. Walk to the Ward B door and look through the slot. Something is in the corridor: crouch and keep quiet.', where: 'East corridor, Ward B door', at: 286, due: 300 },
];
