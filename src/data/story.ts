/** Staff voices over the intercom and the desk phone. Plain, a little tired, a little too careful. */
export interface Beat {
  id: string;
  at: number; // shift minutes since 22:00
  who: string;
  text: string;
  call?: boolean; // arrives as a phone ring first
  minStage?: number; // skipped if the Understudy has not got this far by at + 40
  needsFinale?: boolean;
}

export const BEATS: Beat[] = [
  { id: 'open', at: 0.6, who: 'Sister Imogen', text: 'Night intake, Vesper Hollow. Your mother is settled on Ward B, bed 9, and asleep. You can sit with her at six if the ward is still quiet by then. Until six, check every slip against the ledger, ask your five questions, and trust the lamp more than your nerves. Mind the ledger, love.' },
  { id: 'list', at: 6, who: 'Orderly Pell', text: 'Pell. I left you a list on the desk. The corridor floor wants a mop, I spilled something by the bucket. It is rust. And last week\'s slips want filing in the cabinet. Do both before the door gets busy.' },
  { id: 'gaze', at: 38, who: 'Sister Imogen', call: true, text: 'Old day staff trick, Officer. If anyone holds your eye past a slow count of four, stop looking at them. Duck below the sill if you have to. They get bored. Mostly.' },
  { id: 'pell1', at: 52, who: 'Orderly Pell', text: 'Ward B is quiet. Too quiet, ha. That was a joke, Officer. Please laugh, I have been practising.' },
  { id: 'kessler1', at: 70, who: 'Night Nurse Kessler', call: true, text: 'Kessler, Ward A. The heating is off again, so the cold is the building, not you. If you see breath on the glass, good. People breathe. Make a note of the ones who do not.' },
  { id: 'breaker_warn', at: 96, who: 'Sister Imogen', text: 'The east breaker trips when the weather turns. If it goes, do not linger in that corridor. Warm hands, steady voice.' },
  { id: 'imogen2', at: 122, who: 'Sister Imogen', call: true, text: 'Remember what I told you to mind. That is my word, and nobody else has it. I will be on the ward until dawn.' },
  { id: 'pell2', at: 150, who: 'Orderly Pell', text: 'Quick head count. Ward B has eleven. The register says eleven. I counted twelve for a second. Do not mind me.' },
  { id: 'kessler2', at: 172, who: 'Night Nurse Kessler', call: true, minStage: 2, text: 'Kessler. The admissions you sent up are not in their beds. The blankets are folded. Folded, Officer. Nobody here folds them.' },
  { id: 'pell3', at: 192, who: 'Orderly Pell', call: true, minStage: 1, text: 'Pell again. Did you hear a music box just now? Ward B has no music box. Nobody in this building owns one. I checked the drawers.' },
  { id: 'imogen3', at: 215, who: 'Sister Imogen', text: 'If anyone rings the gate and says my name, ask them what I told you to mind. Only I know the answer.' },
  { id: 'mum_call', at: 222, who: 'Ada Wren', call: true, text: 'Love? It is Mum. They moved me and I do not know where. There is a big door and a lot of rain. I can see your lamp from here. Come and open the glass.' },
  { id: 'pell_mum', at: 226, who: 'Orderly Pell', text: 'Pell. I am standing at bed 9. Your mum is asleep. I am looking right at her. Whoever rang you, it was not from this ward.' },
  { id: 'matron', at: 246, who: "Matron's Office", call: true, text: 'This is the Matron\'s office. A reminder that the intake ledger is a legal record. Entry 000 is not to be amended by the officer on duty.' },
  { id: 'dawn', at: 289, who: 'Sister Imogen', needsFinale: true, text: 'Nearly dawn. Whatever you decided tonight, you decided. Close the book and go home. Do go home.' },
];
