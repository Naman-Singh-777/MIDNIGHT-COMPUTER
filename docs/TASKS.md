# MIDNIGHT: task log, round 4

Round 5 is done. Read `docs/generated/MIDNIGHT_ROUND5_REPORT.md` for the latest state.

Live build (after the two clicks below): https://naman-singh-777.github.io/MIDNIGHT/
Repo: https://github.com/Naman-Singh-777/MIDNIGHT-COMPUTER (to be renamed MIDNIGHT).

Two settings only the owner can change (the cloud session is not allowed to edit repository settings):
1. Settings, General, Repository name: `MIDNIGHT`, then Rename. GitHub redirects the old URL, so existing clones keep working.
2. Settings, Pages, Build and deployment, Source: GitHub Actions. Then Actions, "Deploy MIDNIGHT to GitHub Pages", Run workflow (or push any commit).
Until step 1 the site address is https://naman-singh-777.github.io/MIDNIGHT-COMPUTER/.

This file records what round 4 did, how each part was checked, and what is still open, in priority order. Read it before `docs/HANDOFF_FOR_OPUS.md`.

## 1. The owner's brief for this round

1. Characters looked like eggs on cones. Wanted humanoid bodies with caricature faces, like the Shift at Midnight and PS2-era references, and far more characters with unique designs.
2. The desk and its props looked machine-made and unrealistic. Low poly was too low.
3. No threat of death and nothing to lose. "I absolutely hate that."
4. Build-up and anticipation. The second location (the corridor) has to be scary too.
5. Player-facing words made no sense (Understudy, lamp, ledger, "open the glass").
6. Story should be heartbreaking with character development, and each character should sound different.
7. Reviewing people through glass is passive. The entity has to reach the player.
8. Host it on GitHub Pages, named MIDNIGHT.
9. Read the research and the MD files in full. Write this task file at the end.

## 2. What was built

### 2.1 Danger, death, and losing the night

| System | Where | How it plays |
|---|---|---|
| The tall one | `src/sim/stalker.ts`, `src/render/creature.ts`, `Game.feedStalker` | A 2.45 m skinless figure with long arms and the fakes' grin. Blind. It walks the east corridor. Your noise raises its suspicion based on distance: running carries 13 m, walking 6 m, crouching is silent. At 0.4 it stops and listens (growl), at 1.0 it hunts the spot it last heard you (shriek) at 2.75 m/s plus 0.3 per fake you let in. A torch pointed into its face from under 7 m counts as noise. Contact kills. A shut booth door stops it: it bangs four times and leaves. |
| When it comes | `Simulation` | The power cut (it stands between you and the fuse box), any ward incident (a fake you let in gets out), the 2 a.m. head count if a fake is loose or the stage is 2 or more, and the walk to Ward B at dawn, where it hunts faster for every fake you admitted. |
| Fakes come through the glass | `Simulation.runBreach`, `PatientView.setBreach` | From stage 2, a fake left waiting runs out of patience in about 110 s. Then it presses its face and hands to the window, the glass cracks over 8 s (six hits), and it climbs in. You survive by dropping it through the trapdoor during the cracking, or by being under the desk (C) when it is inside. Standing up in the booth while it searches means death. The cracks stay on the glass for the rest of the night. |
| Nerves | `Simulation.tick` | Nerves at zero ends the night. |
| Death | `Game.die`, `deathHtml` | A short in-world scare (it rushes the camera, or the fake comes at you face first), a death sting, then a sheet naming what happened. The only button is "Start the night again", which reloads a fresh night. Everything is lost. |

The rules are taught before they matter: Pell warns about the tall thing in the yard, Dolly saw it, Ivor heard it copy his steps, and Gus tells you exactly how it hunts ("When I ran, it turned its head. When I stood still, it didn't know where I was"). Kessler explains what happens to fakes left waiting.

### 2.2 Bodies and faces

* `src/render/humanoid.ts`: a jointed body from smooth lathe parts, about 7.5 heads tall. Pelvis, waist, chest with shoulders, neck, upper and lower arms, hands with four fingers and a thumb, thighs, shins, shoes or bare feet. Clothes are separate shapes: sleeves, trousers, a coat skirt hanging from the waist that opens at the front, collars, lapels, a tie, buttons, a fur collar, an apron, a priest's collar. Outfits: overcoat, raincoat, suit, cardigan, fur, cassock, nurse uniform, nightgown, work jacket, nun's habit, creature.
* Walk cycle with hips, knees and opposite arm swing; a fake glides with a smaller stride. Breathing and weight shifts for people, none for fakes. Arm poses: rest, hold, hug, folded, bag, and palms on the glass.
* Heads: the sculpted heads and painted faces from round 3, now 84 percent scale on a neck, with a two-part nose, glasses as real frames, moustaches, lipstick, coal dust.
* Fakes press their hands and face to the glass when they hold your eye, stand in the corner of the hall watching after you turn them away, and climb into the booth during a breach.
* Character looks: `src/render/looks.ts`. Anyone without an authored look is built from the seed.

### 2.3 Cast (`src/data/cast.ts`, `src/data/shift00.ts`)

Thirteen visitors plus the finale, each with a voice pitch and speed, a greeting and personal answers:

| Time | Who | Real or fake | The thing you remember |
|---|---|---|---|
| 22:12 | Walter Quill, retired postman | real | His late wife June's pink slippers |
| 22:38 | Bernard Fitch | real | His ceramic goose "sister" Marjorie |
| 23:04 | Dolly Rusk, club singer | real | Saw a very tall man in the yard |
| 23:32 | Tobias Hale | real | Hums, stares, harmless, form has a typo |
| 00:14 | Walter Quill again | fake | Dry, same line, and the records say he is already on the ward if you let the real one in |
| 00:59 | Ivor Pugh, miner | real | Something copied his footsteps on the lane |
| 01:31 | Mae Calder | real | Her dead son's red cap |
| 02:16 | Father Penhale | fake | Repeats himself, too long a smile |
| 02:41 | Rosa Ferreira, agency nurse | real | Suspicious (wrong form) but innocent |
| 03:13 | Dr. Lionel Marsh | fake | "I said ten minutes" |
| 03:42 | Gus Brennan, ex-boxer | real | Explains how the tall one hunts |
| 04:11 | Your mother | fake | Knows your name. The real one has not since spring |
| 04:40 | Edith Marsh | real | Waiting for a husband who "never says ten minutes" |
| 05:08 | Sister Imogen | fake | Does not mention Biscuit the dog |

### 2.4 Story and voices

* Plain words everywhere the player reads: fakes, records, admission form, let in, hold, turn away, trapdoor (T, L still works), fuse box.
* The wall clock now runs 22:00 to 06:00 (the shift used to end at 03:00 on the clock while the text said six).
* Staff voices (`src/data/story.ts`): Imogen is Irish and warm ("pet"), Pell is nervous and counts things, Kessler is exact and never uses contractions. Arcs: Imogen goes to check on your mother and never rings back, then something wearing her comes to the window. Kessler tells you about her daughter Liesl, goes into Ward B to count, and calls back in a voice that is not quite hers. The Matron's office says there is no record of a night officer being employed. Pell holds the ward door for you at dawn.
* The heart of it: your mother has dementia and has not known your name since spring. The fake at the window knows it perfectly. The clean ending has her slowly remembering you.
* Framed photo on the desk: "Mum and me, Margate 1949".

### 2.5 The desk (`src/render/desk.ts`)

Oak pedestal desk with three drawers a side, brass pulls and card holders, a centre drawer and plinths; green leather blotter with corners; banker's lamp in brass with a green glass shade and pull chain; beige records terminal with bezel, vents, tapered back, curved screen and a 52-key keyboard; rotary phone with dial, cradle, handset and coiled cord; clipboard with the form; loose papers; pen pot; three rubber stamps and an ink pad; mug with coffee and a ring stain; ashtray; the photo. Positions match the old desk, so the locked lights and camera did not move. The old dynamic mug, stamp and clipboard props were removed.

### 2.6 The corridor

One tube is dead, the others stutter, and the ones near the tall one cut out as it passes (spatial flicker with sound, from the research). Corridor lights dropped from 5.5 to 3.2. Its steps, growl, shriek and door bangs are positioned in 3D.

### 2.7 Hosting

`.github/workflows/pages.yml` runs tests, builds and deploys `dist` to Pages on every push to `main`. `index.html` title is MIDNIGHT, and asset paths are relative, so the build works under any repo name. Renaming the repo and switching Pages on are the two owner steps at the top of this file.

## 3. How it was checked

All checks ran headless in the cloud container (Chromium with software GL). Nothing was played on the i7-1255U laptop.

* `npm run typecheck`, `npm test` (30 tests, six new: crouching past the tall one, running gets you killed, a shut door saves you, breach kills unless ducked, Walter's record marks him as let in, nerves at zero ends the night), `npm run build`, `node tools/smoke.mjs .work` with no console errors.
* `node tools/look.mjs .work` renders six cast members full body, the desk, and the tall one in the corridor. Screens reviewed by eye.
* A breach was forced on the first visitor and screenshotted (face and hands on the cracking glass), and the death sheet was screenshotted.

Not verified: how anything sounds, real frame rate, the full dawn walk with the tall one hunting, whether 110 s of patience feels fair, whether crouch-walking past it feels tense or tedious, Pages deploy result if the Actions run fails (check the Actions tab).

## 4. Research read

Round 3 read the Shift at Midnight, horror design, story, UI and art transcripts in full. Round 4 read, in full (each transcript appears twice in its file, so the second copy was skipped): Lethal Company multiplayer horror, its graphics breakdown, Experimentation, Maneater, 11 behaviours, Ghost Girl, Eyeless Dog, Fear and Insanity, Bracken, Butler, Masked, Company Monster, Alien Isolation (both files), the Alien Isolation story video, behaviour trees, F.E.A.R. GOAP, Code Monkey's simple enemy and NPC talk, flickering lights, swap your characters, see like an artist, seamless textures, Unity lighting essentials, Unity horror scene setup, Shawcat's horror week, "How to make a horror game fast", "Made a horror game in 24 hours", fail at survival, fail at tutorials, changing genres, and the uploaded materials guide. Also both MD directives.

Not read word for word, to save the budget: the 13 movement transcripts (used in round 2), Jimmy Vegas (170 KB of Unity steps), mobile input tutorials (joystick, swipe, pinch, touch, Android build), mesh generation, low poly terrain, ML agents, Monte Carlo search, scriptable objects, the gorgeous start menu, and the general indie advice videos (engine choice, optimisation, playtesting, marketing, going solo). Read these if a task needs them.

What the research changed this round: sound-based hunting with a suspicion meter and ranges (Eyeless Dog), last-heard-position targeting so crouching works, a learnable rule taught before it kills, a menace that comes and goes rather than constant chase (Alien Isolation front stage and backstage), safe place that can be lost (booth door), anticipated scares instead of random ones, consistent art style, and PBR-style material thinking (bump maps on the procedural textures).

## 5. What is left, in priority order

1. **Play a full night on the laptop.** Listen to every sound, time the breach patience, walk past the tall one during the blackout, and do the dawn walk. Write down anything flat or unfair.
2. **Turn Pages on and rename the repo** (top of this file). The first workflow run will fail at the deploy step until Pages is set to GitHub Actions; re-run it after.
3. **Dawn walk as a set piece.** Right now the tall one is simply summoned at 05:47. Script it: lights out on the corridor, Pell's voice at the far end, the ward door open, the creature between you and it.
4. **Hiding spots.** The corridor alcove at x 11 is fake (wall in front). A real hiding cupboard needs map approval.
5. **Character polish.** Shoulders are still a little square, hands are paddle-like at close range, hair is caps rather than strands, and nobody has knees showing through coats. Next steps: smooth shoulder deltoids into the torso, finger joints, a hair card texture, and per-character idle animations (Walter shifting the slippers, Gus checking the door).
6. **Faces with moving eyes.** Separate eyeballs that track the camera would sell the uncanny stare far better than painted eyes.
7. **Voices.** System voices vary by OS. Record or commission lines per character, keep the subtitles.
8. **Ward B slot view.** Still a flat 2D drawing. A 3D ward behind the door would be better but needs map approval.
9. **More nights.** Night 01 with new cast, the fakes remembering what you did on Night 00, and a reason to come back.
10. **Settings.** Volume sliders, sensitivity, subtitle size, reduced flashing, and an option to turn off the death jumpscare.
11. **Performance.** Each visitor is about 60 meshes and the desk about 90. Merge static desk meshes per material if the laptop struggles. Split the Rapier WASM out of the first bundle.
12. **Old docs.** `PROJECT_REPORT_AND_ROADMAP.md` and `STORY_BIBLE.md` still describe the Understudy, the ledger and the lamp in places. This file and the code are the current truth.

## 6. Files touched this round

New: `src/sim/stalker.ts`, `src/data/cast.ts`, `src/render/humanoid.ts`, `src/render/looks.ts`, `src/render/creature.ts`, `src/render/desk.ts`, `tools/look.mjs`, `.github/workflows/pages.yml`, `docs/TASKS.md`.
Rewritten: `src/render/patientView.ts`, `src/data/story.ts`, `src/data/dialogue.ts`, `src/data/shift00.ts`.
Edited: `src/sim/simulation.ts`, `src/sim/types.ts`, `src/game.ts`, `src/audio/engine.ts`, `src/render/environment.ts` (desk geometry and desk props only), `src/render/faces.ts`, `src/ui/hud.ts`, `src/ui/style.css`, `src/ui/minigames.ts`, `src/data/motive.ts`, `src/data/names.ts`, `tests/sim.test.ts`, `index.html`, `CLAUDE.md`.
Map lock: booth walls, hall, corridor geometry and every light position were left alone. Changed inside the target locations only: the desk and its props, the corridor light behaviour, a crack decal on the window.
