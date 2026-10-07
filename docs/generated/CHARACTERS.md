# Characters

This is the cast as it exists in code (`src/render/patientView.ts`, `src/sim/patients.ts`, `src/data/story.ts`) plus what is still planned. Every character needs a silhouette you can read at 2.5 metres through glass, one thing they do with their hands, and one thing that is off.

## The officer (the player)

Night intake officer at Vesper Hollow. Never seen, never named on screen. The only evidence of who they are is the handwriting on notes and the first page of the ledger. The ending says the officer is Entry 000.

## Staff (voices on the intercom and the desk phone)

**Sister Imogen.** Ward sister, about fifty, warm and brisk. Says "love" and "mind the ledger". She trained the officer on the first night and her word is the only password the building has. Voice: high, kind, slightly nasal through the radio. She is the safe voice, which is why the finale uses her. Tell for her mimic: it answers before the question ends, and it repeats the officer's own words.

**Orderly Pell.** Late twenties, nervous, jokes badly and counts things. Counts Ward B over and over and the number is sometimes one too many. Voice: low, a little hoarse. Pell notices; Pell does not understand what he notices.

**Night Nurse Kessler.** Early forties, dry, practical, never raises her voice. She reports physical facts (folded blankets, open doors) and does not guess. Voice: mid pitch, clipped.

**The Matron's Office.** An unseen office that speaks like a form letter. It reminds the officer that Entry 000 is a legal record and must not be amended.

## Patients, as built

Each patient is generated from the registry entry plus an archetype. The look is seeded from the patient, so the same person looks the same every time they come back to the window. Sex is read from the first name, so the slip and the face agree.

**Plain (Walter Quill type).** Fifties, soaked brown overcoat with a darker wet patch across the shoulders, trilby or cloche, furled umbrella. Round glasses half the time. Hands hang low. Says sorry about the puddle. The honest control case: nothing is wrong with him.

**Chatty (the goose).** Forties, green tweed overcoat, flat cap, glasses, stubble. Hugs a cracked ceramic goose with a blue ribbon and insists it is his sister. Gestures when he talks, rocks slightly. Gives the goose its own admission slip. Harmless and funny, which makes the next patient worse.

**Strange innocent (the hummer).** Early twenties, oversized oatmeal cardigan with one red button that does not match, long damp hair over the forehead, arms folded across the chest. Rocks side to side while humming four notes and shivers in the cold. His slip has a typo and he is exactly who he says he is. He also stares at you for a few seconds at a time. It is harmless, and it teaches the stare rule safely before an Understudy uses it.

**Tragic (the cap).** Early forties, grey headscarf tied under the chin, long navy coat, head slightly bowed. Holds a small red knitted cap in both hands and worries it. Asks for the children's ward. Her registry note says next of kin deceased, 1958. Never threatening, always the hardest decision of the night.

**Slipping mimic.** Dull grey-brown coat that is a little too clean and dry. Smooth, slightly grey skin, eyes a touch too large, smile slightly too wide. Does not fidget. Blinks rarely, then never once the Understudy reaches stage 2. Hand and forearm get longer from stage 3, and the smile shows too many even teeth.

**Fluent mimic.** Charcoal suit, white shirt, dark tie, slicked hair, cream folder held at the chest. Almost perfect. Tells a story you think you have heard before, because it has: it borrows a memory from an earlier patient. Holds your eye on purpose.

**Voice mimic (the finale).** Dark cape over a white bib, white coif and a black veil, hands folded. Stands at the gate saying Sister Imogen's catchphrase in Sister Imogen's voice. Answers too fast and repeats back what you say. This is the one the whole shift prepares you for.

## The Understudy

One entity, many faces. It learns from the questions you ask and the decisions you make. Stage runs 0 to 7 and goes up when you admit one, refuse one, or let one stay under observation.

| Stage | What the player can notice |
|---|---|
| 0 | Wrong paperwork, three tells at once. It breathes no fog sometimes. |
| 1 | Two tells. It can hold your eye (the stare rule starts). |
| 2 | It stops blinking. Voice tells are subtler. |
| 3 | Longer arms, too many teeth. The booth lamp becomes unreliable. |
| 4 to 5 | One tell only, a borrowed memory. The ward starts to report things. |
| 6 to 7 | Fluent voice, near perfect face. Tells are social, not documentary. |

## Rules for new characters

1. Silhouette first. A new patient must be readable as a black shape.
2. One honest oddity for humans (a goose, a cap, a hum) so odd does not equal monster.
3. One tell for the Understudy that is a different kind from the last one (paper, speech, body, behaviour).
4. A line the character says in their first five seconds that tells you who they are.
5. A reason the player would feel bad making the wrong call.

## Still to do

Hand-modelled GLB bodies and faces for every archetype (the current ones are procedural and stylised, readable but not finished). Per-character voice recordings or a better voice synth. Eye gaze that actually tracks. Hands that hold props with fingers. More patients per archetype so the same face does not come twice. Child characters are not planned.
