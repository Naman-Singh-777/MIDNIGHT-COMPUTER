import type { DeathCause, Patient } from '../sim/types';

/** First words out of each visitor. Named visitors bring their own line. */
export function greeting(p: Patient, nth: number): string {
  if (p.greet) return p.greet;
  if (p.registryId === 'R209') return "There you are. I could see your little window from the road. Let me in, love. My feet are bare.";
  switch (p.archetype) {
    case 'plain':
      return "Evening. I've got my form. The road was empty, so I walked. Sorry about the puddle.";
    case 'chatty':
      return nth < 4 ? 'Evening! Lovely night for it. Is the kettle on?' : 'Evening. Does the ward do soup? Asking for me, mostly.';
    case 'strange_innocent':
      return 'Mm mm mm mm. Oh. Evening.';
    case 'tragic':
      return "Is the children's ward on this floor?";
    case 'slipping_mimic':
      return 'Good evening. Good evening, Officer. Good evening.';
    case 'fluent_mimic':
      return 'Evening. Long night? You look like you have been awake since the war.';
    case 'voice_mimic':
      return "It's Imogen, pet. Open the gate for me.";
  }
}

export const SPEAKER_VOICE: Record<string, { pitch: number; radio: boolean }> = {
  'Sister Imogen': { pitch: 205, radio: true },
  'Orderly Pell': { pitch: 118, radio: true },
  'Night Nurse Kessler': { pitch: 168, radio: true },
  "Matron's Office": { pitch: 142, radio: true },
  'Ada Wren': { pitch: 188, radio: true },
};

export const TITLE_HTML = `
  <h1>Midnight</h1>
  <h2>Asylum Intake &middot; Night 00</h2>
  <p>Vesper Hollow Hospital, October 1963. Your mother has been on Ward B since spring. Most days she doesn't know your name. Staff can sit with family at six in the morning, so you took the night job on the front window.</p>
  <p>People knock on the glass all night. Check their form against the records, ask your questions, and decide who goes through. Some of them are fakes: things wearing the face of someone real. Every one you let in sleeps on her ward.</p>
  <p>If you keep a fake waiting, it comes through the glass. If the power goes, something walks the corridor. It can't see you. It can hear you.</p>
  <p class="note">Get to six. Then go and see her. If you die, the whole night starts again.</p>
  <button class="btn big" data-begin>Start the shift</button>
  <div class="keys">
    AT THE DESK &nbsp; mouse: look &nbsp; 1-5: ask &nbsp; Z: records &nbsp; X: study the face &nbsp; A let in &nbsp; O hold &nbsp; R turn away &nbsp; T trapdoor<br>
    C: get under the desk &nbsp; hold right mouse: lean in &nbsp; Tab: push the papers aside &nbsp; Q: stand up<br>
    ON YOUR FEET &nbsp; WASD: walk &nbsp; Shift: run (loud) &nbsp; C: crouch (silent) &nbsp; E: use or hold &nbsp; F: torch &nbsp; M: mute
  </div>`;

export const PAUSE_HTML = `
  <h1>Paused</h1>
  <h2>The rain does not stop</h2>
  <button class="btn big" data-begin>Back to work</button>`;

const DEATHS: Record<DeathCause, [string, string]> = {
  stalker: ['It heard you', 'It found the sound you made and then it found you. Nobody comes to the window after that. In the morning bed 9 is empty and nobody can say when she left.'],
  breach: ['It came through the glass', 'You kept it waiting. It got tired of waiting. The day staff find the window in pieces and the desk chair still turning.'],
  nerves: ['You stopped answering', "The phone rings until it gives up. When the day staff get to you, you're sitting very straight, smiling at the glass, and you can't tell them your name."],
};

export function deathHtml(cause: DeathCause, clock: string): string {
  const [title, text] = DEATHS[cause];
  return `
  <h1>${clock}</h1>
  <h2>${title}</h2>
  <p>${text}</p>
  <p class="note">The night is gone. Everything you did tonight is gone with it.</p>
  <button class="btn big" data-restart>Start the night again</button>`;
}

const ENDINGS: Record<string, [string, string]> = {
  clean: [
    'Bed 9',
    "Eleven beds, eleven people, and a chair for you. She wakes when you sit down. For a long moment she doesn't know you. Then she says your name, the old way, the way she did when you were small, and holds your hand until the day staff come.",
  ],
  crowded: [
    'Bed 9 and the others',
    'She is asleep in bed 9. You count the room and get more than the sheet. The extra ones sit up around her bed, very still and very polite. One of them has started breathing the way she breathes.',
  ],
  taken: [
    'There you are',
    'Bed 9 is made, the blanket folded into a square. Behind you in the corridor someone says your name in her voice. She has not said your name since spring. It says it again, a little better.',
  ],
  absent: [
    'You never went',
    'Six came and went and you stayed at the desk. By the time anyone looks, bed 9 has been stripped and the records have a new line in your handwriting.',
  ],
};

export function endHtml(
  score: { correct: number; wrong: number; admittedUnderstudies: number; refusedHumans: number; sanity: number; ending?: string; tasksDone?: number; tasksMissed?: number },
  name: string,
): string {
  const [title, text] = ENDINGS[score.ending ?? 'absent'] ?? ENDINGS.absent;
  return `
  <h1>06:00</h1>
  <h2>Night 00 &middot; ${title}</h2>
  <p>${text}</p>
  <p>Right calls: ${score.correct}. Wrong calls: ${score.wrong}. Fakes let in: ${score.admittedUnderstudies}. Real people turned away or dropped: ${score.refusedHumans}. Jobs done: ${score.tasksDone ?? 0}, missed: ${score.tasksMissed ?? 0}. Nerves left: ${score.sanity}%.</p>
  <p class="note">On your way out you open the admissions book at page one. The first line is in your handwriting, dated tonight, 22:00.<br>${name}: let in.</p>
  <button class="btn big" data-restart>Work another night</button>`;
}
