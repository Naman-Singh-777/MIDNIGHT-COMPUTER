import type { Patient } from '../sim/types';

/** First words out of each kind of visitor. Short on purpose. */
export function greeting(p: Patient, nth: number): string {
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
};

export const TITLE_HTML = `
  <h1>Asylum Intake</h1>
  <h2>The Midnight Shift &middot; Night 00</h2>
  <p>Vesper Hollow Sanatorium, October 1963. Rain on the road, one lamp on the desk, and you on the night intake window until six.</p>
  <p>People come to the glass with a slip. Check the slip against the ledger. Ask your five questions. Then decide who goes through the gate.</p>
  <p>Not everyone who comes to the window is someone. The lamp is honest. For now.</p>
  <p class="note">Standing orders: keep the lamp lit. Do not hold their eye.</p>
  <button class="btn big" data-begin>Begin shift</button>
  <div class="keys">
    AT THE DESK &nbsp; mouse: look &nbsp; 1-5: ask &nbsp; Z: ledger &nbsp; X: study the face &nbsp; A: admit &nbsp; O: observe &nbsp; R: refuse &nbsp; L: lever<br>
    C: duck below the sill &nbsp; hold right mouse: lean in &nbsp; Q: stand up or sit down<br>
    ON YOUR FEET &nbsp; WASD: walk &nbsp; Shift: run &nbsp; C: crouch &nbsp; E: use &nbsp; F: flashlight &nbsp; M: mute &nbsp; F3: performance
  </div>`;

export const PAUSE_HTML = `
  <h1>Paused</h1>
  <h2>The rain does not stop</h2>
  <button class="btn big" data-begin>Back to work</button>`;

export function endHtml(score: { correct: number; wrong: number; admittedUnderstudies: number; refusedHumans: number; sanity: number }, name: string): string {
  const verdict =
    score.admittedUnderstudies > 1
      ? 'The ward is not quiet any more.'
      : score.wrong === 0
        ? 'A clean night. Nobody wrote anything down about you.'
        : 'The ward is still standing. Some of the paperwork is not.';
  return `
  <h1>06:00</h1>
  <h2>Night 00 complete</h2>
  <p>${verdict}</p>
  <p>Right calls: ${score.correct}. Wrong calls: ${score.wrong}. Understudies admitted: ${score.admittedUnderstudies}. People turned away or contained: ${score.refusedHumans}. Composure: ${score.sanity}%.</p>
  <p class="note">Before you close the book you turn to the first page of the intake ledger. Entry 000. Your handwriting, dated tonight, 22:00.<br>${name}: admitted.</p>
  <button class="btn big" data-begin>Work another night</button>`;
}
