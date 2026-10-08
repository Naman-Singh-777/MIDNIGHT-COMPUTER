# MIDNIGHT: Round 5 report

## Executive summary

Round 5 upgraded the Round 4 game. Nothing was rebuilt. The work went into five areas:

* Characters have real eyeballs that track you, plus per-person face bones.
* Bodies have sloped shoulders and two-jointed fingers, and fewer clipping problems.
* A fear director runs harmless scares and red herrings, makes the booth gradually stop being safe, and turns some harmless-looking events into real ones later.
* The tall one searches, waits and learns. Dawn is now a scripted walk.
* Story and cast: three new people, a central answer to what the fakes are, goodbye lines, a choice with a cost, phone calls you have to answer, and better desk materials.

Checks: typecheck, 35 tests, build and smoke test all pass, and every new event ran in a headless browser with no errors. All checks were headless in the cloud. Nothing was played on your laptop.

## What already existed before Round 5

Rounds 1 to 4 built:

* the desk loop, the booth, hall and corridor;
* the pacing director, jobs (mop, file, head count, dawn) and four endings;
* painted faces, jointed bodies, 13 named visitors plus the finale, staff arcs;
* the 2.45 m sound-hunting creature, fakes breaking the glass, death that wipes the night;
* the modelled desk, corridor light behaviour, and the Pages workflow.

See `docs/WORK_LOG_ALL_ROUNDS.md` and `docs/TASKS.md`.

## What was changed

| Area | Files |
|---|---|
| Eyes, face bones, nose, hairline, jaw | `src/render/faces.ts`, `src/render/patientView.ts`, `src/render/looks.ts` |
| Shoulders, hands, clothing fabrics, clipping | `src/render/humanoid.ts`, `src/render/faces.ts` (fabrics), `src/render/patientView.ts` |
| Fear director | new `src/sim/fear.ts`, `src/sim/simulation.ts`, `src/game.ts` |
| Creature behaviour | `src/sim/stalker.ts` |
| Dawn set piece | `src/sim/simulation.ts`, `src/game.ts` |
| Story, cast, choices | `src/data/cast.ts`, `src/data/story.ts`, `src/data/shift00.ts`, `src/data/dialogue.ts`, `src/data/motive.ts`, `src/ui/minigames.ts`, `src/ui/hud.ts` |
| Desk materials and detail | `src/render/desk.ts` |
| Desk interactions | `src/render/desk.ts`, `src/render/environment.ts` (hit boxes added to the interactable list only), `src/game.ts` |
| Tests and tools | `tests/sim.test.ts`, `tools/look.mjs` |

## Character improvements

* **Shoulders.** The torso profile now slopes from the neck to the arm. A trapezius shape runs from each side of the neck, and a deltoid runs a third of the way down the upper arm. The flat shelf is gone.
* **Shoulder width.** It is set from the ribcage, and the resting arm angle was raised, so hanging arms clear the belly and hips. In headless renders from front, side, back and three-quarter, arms no longer pass through the torso at rest.
* **Hands.** A wrist, a palm with a heel, a knuckle ridge, four two-jointed fingers of different lengths, and a two-jointed thumb set across the palm. Fingers curl when holding and straighten flat on the glass.
* **Clothing.** Five cloth types, each with its own texture and response to light: wool (coats, suits, cassock), cotton (uniform, nightgown, shirts, aprons), knit rib (cardigans), oilcloth with a sheen (raincoats), creased leather (work jackets). Shirt collars are a thin band with two turned-down points instead of a thick ring. Coat hems swing out over the knees when walking, which cuts knee clipping.

## Character roster additions

| Who | Real or fake | Purpose |
|---|---|---|
| Hester Bloom, blind, 81 | Real | Watcher red herring: "There's someone standing behind you. Don't turn round." Teaches the hum rule: the corridor hums lower when something walks in it. |
| Abel Hollis, night porter | Real | Huge and scarred, gentle. Protective entity: if you let him in, the creature at dawn is one step slower. |
| June Quill, Walter's late wife | Fake | Records say she died in 1961. Built from what Walter carries. Wearing the slippers he brought. |

That makes 16 named visitors, plus your mother's copy and Imogen's copy. Walter's arc now runs through four scenes:

1. Walter gives his goodbye line when let in: "Mind the step, love."
2. His copy comes back and repeats that private phrase over and over.
3. His dead wife comes to the window.
4. He talks about knocking on doors nobody answers.

Every real visitor now has a goodbye line when let in.

## Face improvements

* **Real eyeballs.** A separate sphere for each eye, with a painted sclera, veins, an iris with threads and a dark rim, and a wet surface. An upper-lid shell blinks and widens, and there is a lower lid. The painted texture now draws only the dark opening, the creases and the lashes.
* **How people look at you.** They look at the camera with small darting moves and sometimes glance down at their papers.
* **How fakes look at you.** Their eyes lock on before the head turns, the right eye trails the left, and they hardly blink. From stage 3 the eyes freeze in place until a stare starts.
* **Face bones per person:** jaw, chin, cheek, brow, sunken sockets, and left/right asymmetry. Every named person has their own settings, and others get seeded ones.
* **Nose.** Now a bridge, two nostril wings and a smaller tip, sized per person.
* **Hairlines** moved down.
* **The head has a jaw underside**, so the chin and the jaw angle read as edges.

## Animation improvements

* Finger joints follow the arm poses: curled when holding, flat on the glass.
* The coat hem flares while walking.
* The eyes move separately from the head, and fakes break the normal timing.
* The creature searches the spot it last heard you in a sweeping pattern before giving up.

Not done: foot IK, per-person idle animations, cloth simulation.

## Desk improvements

* **Oak.** A dedicated quarter-sawn texture with long grain, ray flecks, scratches, a darker worn band where forearms rest, and old cup rings. It uses a physical material with roughness.
* **Brass.** Bright where hands go, brown and green tarnish elsewhere, fine scratches, metallic.
* **Leather blotter.** Pebbled grain, a lighter worn patch, stitching, scuffs.
* **Terminal plastic.** Yellowed, fine speckle, a moulding seam around the case, screws on the bezel.
* **Drawers.** A shadow gap above each drawer and two screws on each pull.
* **Papers.** Six bent sheets in slightly different tones, the top one dog-eared.

## Environment improvements

Inside the map lock, only desk materials and detail changed. Booth, hall and corridor geometry, materials and light positions were not touched.

## Horror improvements

### The fear director (`src/sim/fear.ts`)

* **Cooldowns.** 50 s early in the night, 35 s mid-night, 26 s late. Nothing fires while the creature is out.
* **Teaching first.** The first corridor event is always a harmless rat.
* **Corridor red herrings:** a pipe bang with a hiss, and Pell's false alarm (heavy steps, then "Only me! Sorry").
* **Corridor anticipation:**
  * Steps behind you that keep time with yours and take one more step after you stop.
  * Something running at the far end.
  * The creature standing at the far end for a second and a half during a flicker.
  * Breathing in the wall.
* **The booth stops being safe in four stages:** safe until about 23:30, uncertain, compromised, then unsafe. Changes mostly happen right after you come back from the corridor:
  * the mug has moved;
  * the terminal shows a record you did not open: your own, let in at 22:00;
  * her photograph is face down;
  * the phone rings on a dead line and your own voice says "Night intake", then Pell asks who you were talking to, because those lines have been dead since the storm;
  * the desk lamp dies for four seconds;
  * someone knocks on the booth door from the corridor.
* **Reversal.** After about 02:30, once the fakes are at stage 2, the steps behind you have a 50 percent chance of being real. Seven seconds after they stop, the creature is in the corridor six metres behind you.

## Entity improvements (`src/sim/stalker.ts`)

* **Search mode.** When it loses you, it sweeps the spot for seven seconds before roaming again.
* **Learning.** Every time you make it hunt, it roams faster and hears you at a lower threshold.
* **Waiting.** At a shut booth door it bangs, then goes quiet and waits about twelve seconds outside before leaving. Open the door during that and it hunts.
* **Patrol bounds**, used at dawn.

## Gameplay and exploration

* **Answering the phone.** Calls now ring until you click the phone or press Space at the desk. They give up after four rings, and a missed call means the information is gone. You cannot answer from the corridor, so being away costs you.
* **The photograph.** You can pick it up and look at it. If it has been laid face down, you set it back up.
* **The mop.** You have to take it out of the bucket first. Finishing tells you the trail goes under the Ward B door.
* **The head count choice.** After the 2 a.m. count, press 1 to report it or 2 to say nothing.
  * Reporting means Pell locks Ward B from the inside. Fakes that escape later no longer bring the creature out, but Pell is gone.
  * At dawn, the voice holding the door is not his.

## Mini-games

The mop now has steps: fetch, scrub, find out where the trail goes. The head count now has a choice with a cost, and the filing card now says "Treatment: memory". There are no new mini-games, on purpose: none of the candidates had a reason beyond being a mini-game.

## Story

* **The central answer.** At about 02:48 Kessler tells you what Ward B is: the memory ward. Dr. Abara takes out what hurts (grief, names, faces). It does not stay gone: it walks back to your window wearing them. That is what the fakes are. It explains why your mother's copy knows your name when she does not: it is made of what was taken out of her.
* The "taken" ending now says that outright.
* Records show STATUS DECEASED for the dead.
* **Theme:** memory and identity. What is left of a person when the part that knew you is somewhere else, and wants to come in.

## Dialogue

Seventeen new lines across the new cast, goodbye lines, Kessler's explanation, Pell's lock-in call, the dead-line call, the false alarm, and the wrong-voice dawn line. Voices stay distinct:

* Hester: dry, old-fashioned.
* Hollis: plain, protective.
* June: Walter's phrase, wrong.
* Pell: repeats himself.
* Kessler: no contractions.

## Audio

New sounds: a squeak, a pipe hiss, echo footsteps placed behind you, the false-alarm steps walking toward you, running at the far end, a presence swell when something appears, a lamp power-down, and the dead-line call. Nothing has been listened to by a person.

## Browser QA (headless Chromium, cloud)

* `npm run typecheck`, `npm test` (35 tests: 5 new for the fear director, the booth stages, the dawn timeline, the report choice, and June's record), `npm run build`, `node tools/smoke.mjs` with no console errors.
* All 13 fear events were fired in the browser with no errors. Ringing, answering and the photo were checked.
* The dawn walk ran to the creature appearing and pacing (it reached x 10.8 in roam mode).
* Screenshots reviewed: faces close up, side, back, the desk, the corridor at dawn.

## Performance

Not measured on Iris Xe. Each visitor gained about 20 meshes (eyes, lids, fingers, trapezius, nostrils), so about 80 now. The desk gained about 40 small meshes. Draw calls should be measured with F3 on the laptop before adding more.

## Git commits

Checkpoint tag `checkpoint/pre-round5` at `cb9c334`, then the Round 5 commit on `main`.

## What was not changed because of the map lock

Booth, hall and corridor walls. Light positions. The wheelchair and crates. No corridor hiding cupboard. No 3D Ward B behind the slot. No moved doors. The "door left open" style scares were done through sound and desk changes instead.

## Known bugs and weak spots

* Faces still read as caricature dolls up close: painted features on a sculpted sphere. Real eyes help, but it is not near AAA quality. Getting there needs authored head meshes, for example through Blender on your PC.
* Necks look long and thick in close-ups.
* No foot IK, so feet can slide during the hall walk.
* Arm clipping was checked only in static poses from four angles, not through every animation frame.
* The fake's eye lag uses fixed rates and may look like a bug rather than a choice. It needs a playtest.
* Skipping the clock in tests can trigger the breaker and stack story beats. That only happens with debug skips.
* System voices still differ by operating system.

## Remaining tasks

1. Play a full night on the laptop with headphones. Tune fear director cooldowns, breach patience and the dawn walk.
2. Authored head meshes (Blender MCP on your PC), with the painted faces as textures.
3. Foot IK and per-person idles: Walter shifts the slippers, Gus checks the door, Hester tilts her head toward sounds.
4. Recorded voices.
5. Settings: volume, sensitivity, subtitle size, reduced flashing, jumpscare off.
6. Night 01.
7. Performance measurement on Iris Xe.
8. The 3D Ward B and a corridor hiding spot, both if you approve map changes.

## Highest-priority next steps

1. Owner: Settings, Pages, Source: GitHub Actions. Then rename the repo to MIDNIGHT. Then `git pull` on your PC.
2. Playtest one full night and report the three worst moments.
3. Decide whether to approve one map change: a hiding cupboard in the corridor would add a strong new choice.
