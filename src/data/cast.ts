import type { QuestionId } from '../sim/types';

/**
 * Night 00's visitors. Each person has a way of talking, a reason to be out in the rain, and one detail
 * the player will remember. Fakes copy someone on this list, so a face can come to the window twice.
 * Templates: {dob} {sender} {kin} are filled from the patient's answers, so a fake's wrong answers still show.
 */
export interface CastMember {
  id: string;
  name: string;
  female: boolean;
  mark: string; // what the photo on the form shows
  greet: string;
  say: Partial<Record<QuestionId, string>>;
  quirk: string;
  voice: { pitch: number; rate: number };
  note?: string; // registry note
  typo?: boolean; // the form has a harmless mistake
  dead?: boolean; // the records say this person died
  bye?: string; // what they say as you let them through
}

export const CAST: CastMember[] = [
  {
    id: 'walter',
    name: 'Walter Quill',
    female: false,
    mark: 'a scar over the left brow',
    greet: "Evening. Sorry. I'm dripping all over your floor. I've brought June's slippers. She's on Ward A, she'll want them.",
    say: {
      name: 'Walter Quill. Two Ls. People always put one.',
      dob: "{dob}. Sorry. I had to think about it.",
      sender: '{sender}. Nice man. Cold hands.',
      kin: "{kin}. She won't come. Put her down anyway.",
      memory: "Forty years of letters. Some houses never answered. You keep knocking anyway. That's the job.",
    },
    quirk: 'Retired postman. Soaked through. Holding a pair of pink slippers.',
    bye: "Thank you. Mind the step, love. That's what June always said. Mind the step.",
    voice: { pitch: 98, rate: 0.9 },
  },
  {
    id: 'bernard',
    name: 'Bernard Fitch',
    female: false,
    mark: 'a mole on the right cheek',
    greet: "Evening! Two to admit. Me, and my sister Marjorie. She's ceramic, but she has a very delicate constitution.",
    say: {
      name: "Bernard Fitch. And Marjorie Fitch. Write her down too, she's sensitive about being left out.",
      dob: "Mine's {dob}. Marjorie won't say. A lady never does.",
      sender: "{sender}. He said, Bernard, you need a rest. Marjorie said nothing, which is how I knew she agreed.",
      kin: 'Marjorie. Obviously.',
      memory: 'A fox walked right past us on the road. Marjorie was very brave about it.',
    },
    quirk: 'Hugs a cracked ceramic goose and introduces it as his sister.',
    bye: 'Say goodnight to the officer, Marjorie. She says goodnight.',
    voice: { pitch: 132, rate: 1.08 },
  },
  {
    id: 'dolly',
    name: 'Dolores Rusk',
    female: true,
    mark: 'a gap between the front teeth',
    greet: "Don't look at me like that, sweetheart, I'm here voluntarily. Mostly. Got a light?",
    say: {
      name: "Dolores Rusk. Put Dolly. Nobody's called me Dolores since the christening.",
      dob: "{dob}. Say it out loud and I'll scream.",
      sender: '{sender}. Lovely man. Awful taste in music.',
      kin: "{kin}. My sister. We don't speak. Ring her anyway, it'll ruin her week.",
      memory: "There was a man standing in your yard in the rain. Very tall. No umbrella. Didn't seem to mind.",
    },
    quirk: 'Club singer. Smudged lipstick, fur collar, a voice like gravel.',
    bye: "Save me a bed by the window, sweetheart. I like to see who's coming.",
    voice: { pitch: 168, rate: 0.95 },
  },
  {
    id: 'tobias',
    name: 'Tobias Hale',
    female: false,
    mark: 'a notched right ear',
    greet: "Mm mm mm mm. Oh. Sorry. Evening. The humming keeps the walls quiet.",
    say: {
      name: 'Tobias. Hale. Toby.',
      dob: "{dob}. I think. The form says so, so it's true.",
      sender: '{sender}. She smelled of pears.',
      kin: "My mother. {kin}. She doesn't answer the phone after nine.",
      memory: 'I counted the windows on the way up. There are more on the outside than the inside.',
    },
    quirk: 'Hums the same four notes. Stares. Means nothing by it. His form has a typo.',
    bye: "Mm mm mm mm. Thank you. Don't let them count the windows.",
    voice: { pitch: 120, rate: 0.82 },
  },
  {
    id: 'ivor',
    name: 'Ivor Pugh',
    female: false,
    mark: 'a crooked nose, healed badly',
    greet: "Power's gone all down the valley, did you know? Walked the last mile in the black. Right. Where do you want me, boyo?",
    say: {
      name: 'Ivor Pugh. P, U, G, H. Not Pew. Not Pug.',
      dob: '{dob}. Same week as the pit fire. My mam never let me forget it.',
      sender: "{sender}. Says it's my chest. It's not my chest, it's my head, but there we are.",
      kin: '{kin}. Good woman. Better than I deserve, she says, and she\'s right.',
      memory: "Something was walking behind me on the lane. Stopped when I stopped. Just the echo, I told myself. There's no echo on that lane.",
    },
    quirk: 'Coal miner with a wet cough. Talks to fill silence.',
    bye: 'Ta. Keep your head down, boyo. I mean it.',
    voice: { pitch: 104, rate: 1.0 },
  },
  {
    id: 'mae',
    name: 'Mae Calder',
    female: true,
    mark: 'a freckle under the left eye',
    greet: "Is the children's ward on this floor? I've brought Danny's cap. He gets cold. He always gets cold.",
    say: {
      name: "Mae Calder. Mrs. I'm still Mrs.",
      dob: '{dob}.',
      sender: "{sender}. He was kind about it. They're always kind about it.",
      kin: 'Danny. Daniel Calder. You can ring the house. Someone might pick up.',
      memory: "I knitted the cap in the hospital. I never finished the second one.",
    },
    quirk: 'Holds a small red knitted cap with both hands.',
    bye: 'If you see a little boy in a red cap. No. Thank you. Thank you.',
    voice: { pitch: 176, rate: 0.84 },
    note: 'Next of kin: Daniel Calder, deceased 1958, aged 6.',
  },
  {
    id: 'penhale',
    name: 'Father Aldous Penhale',
    female: false,
    mark: 'a burn on the chin',
    greet: 'Peace be with you. Peace be with you, Officer. Peace. Be with you.',
    say: {
      name: 'Aldous Penhale. Father. Father Aldous Penhale. Father.',
      dob: '{dob}.',
      sender: '{sender} sent me. Sent me. To you.',
      kin: '{kin}. The Lord. {kin}.',
      memory: 'I have come to sit with the sick. I have come to sit with them for a long time.',
    },
    quirk: 'Parish priest. Bone dry. Smiles a little too long.',
    voice: { pitch: 110, rate: 0.88 },
  },
  {
    id: 'rosa',
    name: 'Rosa Ferreira',
    female: true,
    mark: 'a mole on the right cheek',
    greet: "I'm agency. St. Bride's sent me for the night. Yes, I know the form's wrong, I didn't fill it in. Can I come through? I'm soaked.",
    say: {
      name: 'Rosa Ferreira. F, E, double R. Ferreira.',
      dob: "{dob}. The one on the form is wrong. Someone at St. Bride's can't type.",
      sender: "{sender}, apparently. Never met him.",
      kin: "{kin}. My husband. Don't ring him, he works mornings.",
      memory: 'Your gate light is broken. I nearly walked into the fence.',
    },
    quirk: 'Agency night nurse. Impatient. Her form has a mistake on it and she knows.',
    bye: "Right. Where's the sluice room. Never mind, I'll find it.",
    voice: { pitch: 182, rate: 1.12 },
    typo: true,
  },
  {
    id: 'marsh',
    name: 'Dr. Lionel Marsh',
    female: false,
    mark: 'a chipped front tooth',
    greet: "Good evening. Marsh, consultant. I left my keys on Ward B an hour ago. Silly of me. If you'd just open up.",
    say: {
      name: 'Lionel Marsh. Doctor Marsh. You will have seen the name on the doors.',
      dob: '{dob}.',
      sender: "I'm staff. {sender} will vouch for me.",
      kin: '{kin}. My wife. She is waiting in the car.',
      memory: 'I kissed my wife in the car and said ten minutes.',
    },
    quirk: 'A consultant with a cream folder. Perfectly pleasant. Perfectly dry.',
    voice: { pitch: 112, rate: 0.96 },
  },
  {
    id: 'gus',
    name: 'Gus Brennan',
    female: false,
    mark: 'a crooked nose, healed badly',
    greet: "Let me in. Please. There's something in your yard. It's tall. It hasn't got a face, honest to God, it hasn't got a face.",
    say: {
      name: 'Gus. Augustus Brennan. Come on, mate.',
      dob: "{dob}! Does it matter? It's out there!",
      sender: '{sender}. For my nerves. And now look at me.',
      kin: "{kin}. My brother. Tell him I'm sorry about the van.",
      memory: "It stood at the edge of the light and listened. When I ran, it turned its head. When I stood still, it didn't know where I was.",
    },
    quirk: 'Ex-boxer. Shaking. Keeps looking over his shoulder at the door.',
    bye: 'Thank you. Lock it after me. Lock it.',
    voice: { pitch: 118, rate: 1.22 },
  },
  {
    id: 'edie',
    name: 'Edith Marsh',
    female: true,
    mark: 'a scar over the left brow',
    greet: "I'm terribly sorry to bother you. My husband came in for his keys and he hasn't come out. Lionel Marsh? Dr. Marsh?",
    say: {
      name: 'Edith Marsh. Mrs. Lionel Marsh.',
      dob: '{dob}.',
      sender: "Nobody sent me. Well. {sender} signed it so they'd let me wait inside. Is that dreadful?",
      kin: "Lionel. He's in there somewhere.",
      memory: "Lionel kissed me in the car and said ten minutes. He never says ten minutes. He says won't be long.",
    },
    quirk: "The doctor's wife. Pearls, good coat, hands that will not stay still.",
    bye: "If you see Lionel, tell him I waited. Tell him I'm not cross.",
    voice: { pitch: 186, rate: 1.0 },
  },
  {
    id: 'hester',
    name: 'Hester Bloom',
    female: true,
    mark: 'a freckle under the left eye',
    greet: "Don't mind me, dear. There's someone standing behind you. No, don't turn round. It's only listening.",
    say: {
      name: 'Hester Bloom. Mrs. Widowed, blind, and eighty one, in that order.',
      dob: '{dob}. I was born in a thunderstorm. My mother said it explained a great deal.',
      sender: '{sender}. He talks to me very slowly, as if blind meant deaf.',
      kin: "{kin}. My nephew. He'll be cross I came out in this.",
      memory: "Your corridor hums, dear. It hums lower when something walks in it. Listen for that.",
    },
    quirk: 'Blind. Milky eyes, a white cane, faces you exactly anyway.',
    voice: { pitch: 160, rate: 0.82 },
    bye: 'Goodnight, dear. Walk softly out there. Softly.',
  },
  {
    id: 'hollis',
    name: 'Abel Hollis',
    female: false,
    mark: 'a burn on the chin',
    greet: "Hollis. Porter, Ward A. They sent me home with a cough and I came back. Let me through and I'll walk that corridor with you at six. Nobody should walk it alone.",
    say: {
      name: 'Abel Hollis. Porter. Twenty two years.',
      dob: '{dob}.',
      sender: "{sender}. Says I've got a chest. I've got a job, is what I've got.",
      kin: "{kin}. Sister. She'll say I'm daft for coming back. She's right.",
      memory: "Pell told me about the count. I don't count them. I just say goodnight to each one by name.",
    },
    quirk: 'Huge, scarred, frightening to look at. Gentle as anything.',
    voice: { pitch: 92, rate: 0.85 },
    bye: "I'll be on the ward. At six, I'll be at the door. Don't run to me. Walk.",
  },
  {
    id: 'june',
    name: 'June Quill',
    female: true,
    mark: 'a mole on the right cheek',
    greet: "Is Walter here? He's got my slippers. Tell him I'm not cross. Mind the step, love.",
    say: {
      name: 'June Quill. Mrs. Walter Quill.',
      dob: '{dob}.',
      sender: '{sender}.',
      kin: 'Walter. My Walter. He brought my slippers.',
      memory: 'Walter always walks me to the door. He always says mind the step.',
    },
    quirk: "Walter's wife. Neat coat, pink slippers on her feet. Bone dry.",
    voice: { pitch: 178, rate: 0.9 },
    note: 'DIED 1961. Walter Quill, husband, informed.',
    dead: true,
  },
];

export const CAST_BY_ID: Record<string, CastMember> = Object.fromEntries(CAST.map((c) => [c.id, c]));

/** Lines the fakes use when they copy someone. Close enough to pass. Not quite. */
export const COPY_GREET: Record<string, string> = {
  // it heard Walter say goodbye, and it kept the part that mattered
  walter: "Evening. Mind the step, love. That's what June always said. Mind the step. Mind the step.",
};
