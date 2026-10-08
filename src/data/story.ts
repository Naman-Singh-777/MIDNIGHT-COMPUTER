/**
 * Staff on the phone and the intercom. Each has a voice:
 *  Sister Imogen: Irish, warm, calls you pet, runs her sentences together.
 *  Orderly Pell: nervous, counts things, makes jokes that do not land, repeats himself.
 *  Night Nurse Kessler: German, exact, never uses a contraction.
 *  The Matron's office: a typed memo read aloud.
 */
export interface Beat {
  id: string;
  at: number; // shift minutes since 22:00
  who: string;
  text: string;
  call?: boolean; // the desk phone rings first
  minStage?: number; // skipped if not enough fakes have got through by at + 40
  needsFinale?: boolean;
  wrong?: boolean; // the voice is not quite theirs any more
}

export const BEATS: Beat[] = [
  { id: 'open', at: 0.6, who: 'Sister Imogen', text: "Evening, pet. Imogen, up on the ward. Your mam's asleep in bed 9, she had her tea, she's grand. Now listen, because this is the job. People come to that window all night. Most of them are people. Some of them are fakes, things wearing a person's face. You check the form against the records, you ask your questions, and you decide. Let them in, hold them, turn them away, or the trapdoor. Get to six and you can sit with her." },
  { id: 'list', at: 6, who: 'Orderly Pell', text: "Pell here. Orderly. Hello. I left you a list on the desk. Mop by the bucket, I spilled something. It's rust. Mostly rust. And the filing cabinet. Two jobs. Two. Do them before the door gets busy." },
  { id: 'rules', at: 20, who: 'Night Nurse Kessler', call: true, text: 'Kessler, Ward A. Three things. A fake does not breathe, so watch for breath on the cold glass. A fake does not have to think, so it answers too fast. And a fake that is kept waiting at your window does not go home. It comes through the glass. Do not keep them waiting.' },
  { id: 'gaze', at: 38, who: 'Sister Imogen', call: true, text: "Something I forgot, pet. If one of them holds your eye and won't let go, look away, or get down under the desk. Don't stare back. They like being stared at." },
  { id: 'pell1', at: 52, who: 'Orderly Pell', text: "Ward B's quiet. Eleven beds, eleven heads. I counted twice. Three times. It's fine. It's fine." },
  { id: 'tall', at: 70, who: 'Orderly Pell', call: true, text: "Pell. Don't laugh. There's something tall standing in the yard. It's been there twenty minutes. It can't see, I don't think. It listens. If the lights ever go, stay low in that corridor and don't run. Don't run." },
  { id: 'breaker_warn', at: 96, who: 'Sister Imogen', text: "The fuse box trips when the weather's like this. If the lights go, it's at the far end of the east corridor. Walk, don't run, and mind yourself." },
  { id: 'imogen_mum', at: 122, who: 'Sister Imogen', call: true, text: "She woke up a minute ago, pet. She asked for you. Then she asked me who you were. That's the illness talking, not her. She sang a bit of something after. I didn't know it. You'd know it." },
  { id: 'pell2', at: 150, who: 'Orderly Pell', text: "Head count's due. I'm not going in there. I'm not. Will you look through the slot in the Ward B door for me? Count the full beds. Click each one." },
  { id: 'kessler_daughter', at: 170, who: 'Night Nurse Kessler', call: true, minStage: 1, text: 'Kessler. I had a daughter on Ward B. Liesl. Nineteen fifty one. One morning there were two of her in the bed, holding hands, and both of them called me Mutti. I chose wrong. I wanted you to know that it can be done wrong. That is all.' },
  { id: 'pell3', at: 190, who: 'Orderly Pell', call: true, minStage: 1, text: "Did you hear a music box? Nobody here owns one. I checked the drawers. I checked under the beds. I'm not checking under the beds again." },
  { id: 'imogen_last', at: 205, who: 'Sister Imogen', call: true, text: "I'm going to look in on your mam, pet. If I don't ring back, don't you fret. And if I ever turn up at your window, ask me what I remember of tonight. I'll tell you about Biscuit, my dog. Anything else, it isn't me." },
  { id: 'mum_call', at: 222, who: 'Ada Wren', call: true, wrong: true, text: "Love? It's Mum. I don't know where I am. There's a big door and it's raining. I can see your little window from here. Come and let me in. Please. It's so cold." },
  { id: 'pell_mum', at: 226, who: 'Orderly Pell', text: "Pell. I'm standing at bed 9. Your mum's asleep. I'm looking right at her. Whoever rang you, it wasn't her." },
  { id: 'kessler_ward', at: 240, who: 'Night Nurse Kessler', call: true, text: 'Kessler. Imogen went onto Ward B forty minutes ago. She has not come out. I am going in to count them myself. If I do not ring back, close your door.' },
  { id: 'matron', at: 246, who: "Matron's Office", call: true, text: "This is the Matron's office. We have no record of a night officer being employed tonight. Please remain at your post until this is resolved." },
  { id: 'kessler_wrong', at: 258, who: 'Night Nurse Kessler', call: true, wrong: true, minStage: 2, text: 'Kessler. I counted them. They are all very well. They are all asleep. You should come and see. You should come and see.' },
  { id: 'dawn', at: 287, who: 'Orderly Pell', text: "It's nearly six. I'm holding the ward door for you. Come now. Quiet. Quiet. It's in the corridor with us." },
];
