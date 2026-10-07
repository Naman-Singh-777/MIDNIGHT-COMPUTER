import type { Patient } from '../sim/types';

/** First words out of each kind of visitor. Short on purpose. */
export function greeting(p: Patient, nth: number): string {
  if (p.registryId === 'R209') return 'There you are. I could see your lamp from the road. Open the glass, love. My feet are bare.';
  switch (p.archetype) {
    case 'plain':
      return 'Evening. I have my slip. The road was empty, so I walked. Sorry about the puddle.';
    case 'chatty':
      return nth < 4
        ? 'Evening! Two admissions, please. This is my sister. She is ceramic, but she is very nervous.'
        : 'Evening. Does the ward get soup? I am asking for me, mostly.';
    case 'strange_innocent':
      return 'Mm mm mm mm. Oh. Evening. Do not mind the humming, it keeps the walls from listening.';
    case 'tragic':
      return 'Is the children\'s ward on this floor? I have his cap. I only need to give him the cap.';
    case 'slipping_mimic':
      return 'Good evening. Good evening, Officer. Good evening.';
    case 'fluent_mimic':
      return 'Evening. Long night? You look like you have been awake since the war.';
    case 'voice_mimic':
      return 'It is Sister Imogen, love. Open the gate. I have locked myself out. Mind the ledger.';
  }
}

export const SPEAKER_VOICE: Record<string, { pitch: number; radio: boolean }> = {
  'Sister Imogen': { pitch: 205, radio: true },
  'Orderly Pell': { pitch: 112, radio: true },
  'Night Nurse Kessler': { pitch: 168, radio: true },
  "Matron's Office": { pitch: 142, radio: true },
  'Ada Wren': { pitch: 188, radio: true },
};

export const TITLE_HTML = `
  <h1>Asylum Intake</h1>
  <h2>The Midnight Shift &middot; Night 00</h2>
  <p>Vesper Hollow Sanatorium, October 1963. Your mother has been on Ward B since April. Night staff may sit with family at six, so you took the night intake window.</p>
  <p>People come to the glass with a slip. Check it against the ledger, ask your five questions, and decide who goes through the gate. Anyone you admit sleeps on her ward.</p>
  <p>Something has been coming to the window wearing people. It does not break in. It applies. Keep it out until six, then go and see her.</p>
  <p class="note">Pell's list: mop the corridor, file the slips, count Ward B at half twelve. Do not hold their eye.</p>
  <button class="btn big" data-begin>Begin shift</button>
  <div class="keys">
    AT THE DESK &nbsp; mouse: look &nbsp; 1-5: ask &nbsp; Z: ledger &nbsp; X: study the face &nbsp; A / O / R / L: admit, observe, refuse, lever<br>
    C: duck below the sill &nbsp; hold right mouse: lean in &nbsp; Tab: push the papers aside &nbsp; Q: stand up<br>
    ON YOUR FEET &nbsp; WASD: walk &nbsp; Shift: run &nbsp; C: crouch &nbsp; E: use or hold &nbsp; F: flashlight &nbsp; M: mute &nbsp; F3: performance
  </div>`;

export const PAUSE_HTML = `
  <h1>Paused</h1>
  <h2>The rain does not stop</h2>
  <button class="btn big" data-begin>Back to work</button>`;

const ENDINGS: Record<string, [string, string]> = {
  clean: [
    'Bed 9',
    'Eleven beds, eleven people, and the twelfth chair is yours. She wakes when you sit down and says your name the way she always has, a little wrong at the end. Nothing on the ward is folded. You stay until the day staff come.',
  ],
  crowded: [
    'Bed 9 and the others',
    'She is asleep in bed 9. You count the room again and get more than the register. Some of the extra ones are sitting up, facing her bed, very still and very polite. One of them has started breathing the way she breathes.',
  ],
  taken: [
    'There you are',
    'Bed 9 is made. Hospital corners. Folded. Behind you, in the corridor, someone says your name in her voice, and then says it again a little better.',
  ],
  absent: [
    'You did not go',
    'The day staff find the list on the desk with the last line not ticked. By the time anyone looks, bed 9 has been stripped and the ledger has a new line in your handwriting.',
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
  <p>Right calls: ${score.correct}. Wrong calls: ${score.wrong}. Let through that were not people: ${score.admittedUnderstudies}. People turned away or contained: ${score.refusedHumans}. Jobs done: ${score.tasksDone ?? 0}, missed: ${score.tasksMissed ?? 0}. Composure: ${score.sanity}%.</p>
  <p class="note">On your way out you open the intake ledger at the first page. Entry 000. Your handwriting, dated tonight, 22:00.<br>${name}: admitted.</p>
  <button class="btn big" data-begin>Work another night</button>`;
}
