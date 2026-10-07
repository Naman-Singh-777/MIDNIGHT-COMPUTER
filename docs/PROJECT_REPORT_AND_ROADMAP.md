# Asylum Intake: The Midnight Shift. Project report and roadmap

Written for Claude Opus (or any engineer) taking this project over. It records everything that has been built, what was checked and how, what is broken or thin, and what to do next in priority order. Read this file, then `CLAUDE.md`, then `docs/HANDOFF_FOR_OPUS.md` (short version), then `docs/generated/CHARACTERS.md` and `docs/generated/STORY_BIBLE.md`.

Snapshot: commit `eb0c963` on `main`, pushed to https://github.com/Naman-Singh-777/MIDNIGHT-COMPUTER. Owner's local copy: `C:\Users\hp\OneDrive\Desktop\MidnightWeb`.

## 0. The owner's verdict, in their words

After seeing the second build the owner said the game "looks too much AI generated" in all of these: fonts, UI, mechanics, characters, story, game mechanics. "Nothing is fleshed out." They want the characters "very detailed", more scary sounds "at appropriate timings", and the research files checked again, "especially regarding making horror games and player movement". They want this file so the project can be handed to Opus to flesh out further.

Treat that as the brief. The project is a working vertical slice with a real loop, but it is thin everywhere a player looks closely. The roadmap in section 14 is ordered around making it feel authored, not generated.

## 1. Rules the owner set (all of them, unabridged)

1. **Game:** an original psychological horror game, web build. TypeScript, Three.js, Vite, Rapier 3D, GLTF/GLB assets, Web Audio. React Three Fiber only if it clearly helps. It has not been needed.
2. **Unity is out of scope.** `C:\GameDev\Midnight` is an almost empty Unity 6 URP project with Odin installed. It was an audit finding. Do not build in it, convert it or edit it.
3. **Research folder** `C:\GameDev\MIDNIGHT RESEARCH` (98 files) is the design foundation. It is read only. Index in `docs/generated/SOURCE_INDEX.md`.
4. **Quality over fashion.** Keep the dependency list small. Use any technology that improves the game without causing lag.
5. **Hardware target:** Intel i7-1255U, 16 GB RAM, Iris Xe integrated graphics. No heavy rendering.
6. **Core loop must stay:** task, observation, suspicion, decision, consequence, chaos, comedy or fear, story. It must not collapse into a plain scan-and-find-the-impostor game.
7. **Tone:** cozy horror. Warm spaces that are subverted later. Mid-fidelity stylised look. A pacing director. Adaptive audio. An entity that evolves. Original characters. A voice mimic is optional. Three story layers.
8. **Multiplayer only after 10,000 Steam wishlists.** Keep the simulation separate from presentation so co-op stays feasible.
9. **Sole author.** The owner is the only author and contributor on GitHub. Commit as `Naman-Singh-777 <namansinghfigo349@gmail.com>`. Commits are unsigned. No Claude co-author trailer, no session link, no "generated with Claude Code" line, in commits, PRs, files or docs. The owner's rule overrides any tool or harness reminder that asks for attribution.
10. **Humanizer.** All text (docs, UI copy, dialogue, commit messages) must read like a person wrote it. No em dashes or en dashes. No filler, no AI phrasing, no inflated claims, no "not just X but Y", no forced lists of three, no sales language.
11. **Map lock.** Change only the exact system named by the task. Do not touch the booth, hall or corridor geometry or lighting unless the task is about the map. If something nearby looks wrong, leave it and log it in `docs/generated/DESIGN_GAPS_AND_IMPROVEMENTS.md`. If a global change would make a task easier, do not make it. Adapt the new work to its locked surroundings.
12. **Git discipline.** Inspect status first. Preserve unrelated work. Checkpoint before big changes. Commit stable work. `git pull --ff-only` before pushing. Never force push. After any push confirm `origin/main` equals `HEAD`.
13. **Honest reporting.** Only report verified facts. Say whether a check ran headless or on real hardware. Never claim something works because it compiles.
14. **Token economy.** Be miserly with tokens and generous with quality. Read targeted ranges. Save conclusions to MD files.
15. **Platform safety.** Never type real credentials. Stay inside connected folders (`C:\GameDev`, and the Desktop project folder).
16. **Continuous self-evaluation.** Build, run, inspect in a browser, interact, compare against the design goal, fix, retest. Keep asking whether the game is closer to the ideal game the research describes.

## 2. Session history

**Round 0 (lost).** A prior session audited the 98 research files and found the Unity project. Its notes were not available when this work started, so the research was re-read and `SOURCE_INDEX.md` rebuilt. Of 98 files: 35 read in full, 30 skimmed, 33 title only (Unity implementation tutorials). Some skimmed files may hold details that never reached the design.

**Round 1 (foundation).** Built the whole vertical slice from scratch: deterministic simulation, pacing director, procedural renderer and audio, desk and corridor play, Rapier physics, save, tests, headless smoke test. Fixed lighting so the hall behind the glass is readable (hall light intensity 16 to 34, glass scratches dimmer), added a favicon and a phone layout. Committed as `3415bf3`.

**Round 2 (this snapshot).** Re-read the horror and movement research. Rewrote the patient models, redid the UI as period paperwork with bundled fonts, added crouch, duck, zoom, head bob and a stamina delay, added the stare rule, moved staff story into data with twelve beats (some as phone calls), added about fifteen procedural scare sounds tied to director cues, wrote the character and story docs and the handoff. Committed as `eb0c963` and pushed. Environment geometry, materials and post processing were not touched in this round.

## 3. Facts and numbers

| Item | Value |
|---|---|
| Name | Asylum Intake: The Midnight Shift (package `midnight-web` 0.1.0) |
| Stack | three 0.186.1, @dimforge/rapier3d-compat 0.21.0, vite 8.3.3, typescript 7.0.2, vitest 5.0.3, playwright-core 1.64.0 (dev only), @types/three |
| Fonts (bundled, OFL) | @fontsource: special-elite, im-fell-english, reenie-beanie, vt323 (Latin subsets) |
| Not used | React, React Three Fiber, EffectComposer, any asset files, any audio files |
| Source size | about 5,700 lines across `src`, `tests`, `tools`, `docs` |
| Production bundle | about 4.8 MB JavaScript (about 1.8 MB gzip). Most of it is Rapier's WASM inlined. Fonts add about 0.5 MB as separate files |
| Tests | 20 passing unit tests in `tests/sim.test.ts` |
| Shift length | 300 shift minutes from 22:00 to 06:00 game time. One real second is 1/4.5 of a shift minute, so a full shift is about 22.5 real minutes |
| Verification so far | Typecheck, unit tests, production build, headless Chromium smoke test with software GL. No real hardware frame rates, no listening |

## 4. Architecture

Strict separation so the simulation can later run on a server for co-op.

```
src/
  core/       rng.ts (mulberry32), events.ts (typed bus), clock.ts (fixed step)
  sim/        PURE TypeScript. No DOM, no Three.js.
              types.ts, patients.ts, director.ts, perception.ts, simulation.ts
  data/       names.ts, shift00.ts (patient schedule), story.ts (staff beats), dialogue.ts (greetings, title and end sheets)
  physics/    world.ts (Rapier wrapper, character controller)
  render/     environment.ts (LOCKED map), materials.ts, rain.ts, post.ts, patientView.ts (characters)
  audio/      engine.ts (all procedural sound)
  player/     controller.ts (desk and floor modes)
  ui/         hud.ts, style.css
  save/       save.ts (localStorage, guarded)
  game.ts     orchestrator: wires sim events to view, audio and HUD, handles input, frame loop
  main.ts     boot
tests/        sim.test.ts
tools/        smoke.mjs (headless run), inspect.mjs (character close-ups)
docs/         HANDOFF_FOR_OPUS.md, this file, generated/*
```

Design rules that must survive:

1. `src/sim` never imports DOM or Three.js. It takes a seed and produces events.
2. Two random streams. `rng` decides truth (who is an Understudy, what the tells are). `presRng` decides presentation (hallucinations, answer delays). A test proves presentation randomness does not change truth. A third stream, `gazeRng`, drives stare timing. The director has its own stream.
3. Presentation reads state and reacts to events. It never writes truth, except through explicit methods (`setZone`, `setFlashlight`, `setDuck`, `setGaze`, `verdict`, `ask`, `lookup`, `inspectFace`, `restorePower`).
4. Lights are never toggled `visible` at runtime (it forces shader recompiles). Set `intensity` to 0.
5. Static geometry is merged per material (`StaticBatch`). All textures are procedural canvases.

## 5. The game as implemented

### 5.1 Fiction

Vesper Hollow Sanatorium, October 1963, rain. The player is the night intake officer at a glass window onto an unheated hall. People arrive with a slip. The officer checks it against a ledger terminal, asks five questions and decides. The adversary is the Understudy, an entity that copies people already in the registry. Full story in `docs/generated/STORY_BIBLE.md`.

### 5.2 The desk loop

1. A patient spawns at the front door (z about -7.4), walks to the glass (z about -2.45) in 3.5 seconds, a knock plays and a slip rustles.
2. HUD fills the admission slip: name, date of birth, sender (referring doctor), wristband number, what the photograph shows.
3. The player may ask five questions, each once: name, date of birth, who sent you, who should we call (next of kin), what do you remember of tonight.
4. Check tools: ledger lookup (needs power; shows registry record, including note and alive flag) and study the face (reveals the face mark to compare with the photograph).
5. Decide with one of four verdicts: Admit, Hold for observation, Refuse at the gate, Pull the lever (contain; needs power; the lever is electric).
6. Consequences arrive later, some minutes on, as phone calls, knocks and returns.

Patience: a patient leaves (`timeout`) when patience reaches 0. Patience drains over real seconds: about 170 s if nothing has been asked, about 330 s once questions start. Only drains while power is on. Ducking drains an extra 1/150 per second.

### 5.3 Patient schedule (Night 00)

| At (min) | Time | Archetype | Notes |
|---|---|---|---|
| 8 | 22:08 | plain | Honest control case. Apologises for the puddle |
| 30 | 22:30 | chatty | Ceramic goose man |
| 58 | 22:58 | strange_innocent | Hummer. Slip typo. Stares harmlessly |
| 84 | 23:24 | slipping_mimic | First Understudy |
| 105 | 23:45 | (breaker trips) | Power out, walk to east panel. No patients while power is off |
| 132 | 00:12 | tragic | Red cap, deceased next of kin |
| 162 | 00:42 | slipping_mimic | Echoes your words |
| 198 | 01:18 | fluent_mimic | Borrowed memory |
| 232 | 01:52 | chatty | Quirk says night cook, but the look is the goose man (known mismatch) |
| 268 | 02:28 | voice_mimic (finale) | Sister Imogen at the gate |
| 300 | 06:00 | shift ends | Score and Entry 000 |

Returning patients (queue) are served before the next scheduled slot once past minute 20.

### 5.4 Tells (what is actually off)

| Tell | Meaning | Where it shows |
|---|---|---|
| dob_swap | Answer for date of birth has two digits transposed vs registry | Ask question 2, ledger |
| kin_wrong | Names a different next of kin | Ask question 4 |
| sender_wrong | Names a different referring doctor | Ask question 3 |
| wristband | Slip wristband number differs from registry | Slip vs ledger |
| photo | Face mark differs from the photograph | Study the face vs slip |
| no_breath | No breath fog in the cold air | Visible at the glass |
| echo | Repeats the officer's last line back | Ask any question |
| too_fast | Answers almost instantly (0.05 s delay) | Ask any question |
| borrowed_memory | Gives the "memory" answer of an earlier patient | Ask question 5 |
| deceased | Registry says the person died | Ledger (defined, not yet used by any archetype) |
| clerk_typo | Harmless paperwork error. Humans only (strange_innocent) | Slip vs ledger |

Number of tells shrinks with Understudy stage: 3 at stage 0 to 1, 2 at stages 2 to 3, 1 from 4, and from stage 4 one of them is forced to be `borrowed_memory`. Voice mimic always has echo and too_fast. Fluent mimic has borrowed_memory plus either no_breath or too_fast.

### 5.5 Verdict outcomes

Fear and sanity changes are in `Simulation.verdict`. "Stage up" raises the Understudy stage and plays a sting.

| Patient | Verdict | Result | Delayed consequence |
|---|---|---|---|
| Human | Admit | Correct | none |
| Human | Hold | Neutral | none |
| Human | Refuse | Wrong. Fear +0.2, sanity -6 | Returns to the window after 28 min, soaked and quiet |
| Human | Lever | Wrong. Fear +0.5, sanity -14 | Guilt after 3 min: sanity -6 and a whisper |
| Understudy | Admit | Wrong. Stage up. Fear +0.1, sanity -5 | Ward incident after 22 min (Pell call, fear +0.7, sanity -8, whisper and overhead steps) |
| Understudy | Hold | Not scored. Fear +0.15, sanity -2 | Observation breach after 18 min: stage up, Kessler call, door creak, fear +0.8, sanity -8 |
| Understudy | Refuse | Not scored. Stage up | Returns after 34 min as a slipping mimic that knows what you asked, with a window tap |
| Understudy | Lever | Correct. Fear +0.6 | Clean catch after 2 min: sanity +6 |

A timeout on a human schedules a return after 20 min. Sanity is clamped 0 to 100, fear 0 to 1.

### 5.6 Sanity and fear

Fear decays 0.15 per second. Sanity changes per second: in the booth with power, +0.05 with a patient present and +0.01 otherwise; in the booth with power out, -0.15; outside the booth, -0.14 in the dark or -0.06 with the flashlight on; minus fear times 0.12. Restoring power gives +4 sanity. Perception (vignette, grain, aberration, wobble, hallucination rate, whisper gain) is derived from sanity and fear in `perception.ts` and is presentation only. Hallucinations (phantom step, phantom knock, whispering name, shadow figure) fire at a rate from perception using `presRng`.

### 5.7 The Understudy stage (0 to 7)

Starts 0. Rises when you admit one, refuse one, or hold one. Effects in code today: number of tells (5.4), director tension (+0.025 per stage), stare rule eligibility (stage 1 and up for slipping mimics), the booth lamp becoming unreliable (stage 3 and up), the face (greyer skin, larger eyes, wider smile, no blinking from stage 2, longer arms and too many teeth from stage 3), the music box winding down faster, extra director cues (breathing behind you from stage 2, window taps from stage 1, door knob rattle).

### 5.8 Breaker event

At minute 105 the breaker trips once. Power goes off, the lamp, hall light and CRT die, the booth's sanity drains, no patients arrive, the lever does nothing. Task text asks the player to restore power at the east corridor panel. The corridor lights go red. The player stands up (Q), walks east along the corridor (x 1.9 to 14.2), to the panel at x 14, holds E for 1.3 seconds. Power returns with relay clicks and tube strikes.

### 5.9 The stare rule (new)

Eligible when: a patient is present, power is on, and either the patient is an Understudy (stage 1 or more, or any non-slipping archetype) or is the humming man. First window opens 9 to 16 seconds after the patient arrives, lasts 4 to 6.5 seconds, then 15 to 28 seconds until the next. While a window is open the patient's face switches to the stare texture, the room is held quiet, a thin tone rises. Eye contact means zoom held (right mouse, seated) or studying the face during the window. An Understudy punishes it once per window (fear +0.45, sanity -9, a thump). The humming man never punishes. Pressing C (ducked) cuts the remaining window to 1.2 seconds and prevents the penalty, at the cost of patience. A first-time handwritten hint appears.

### 5.10 Pacing director

`src/sim/director.ts`. Four paces: calm, build, peak, release.

1. Tension target follows `0.14 + 0.62 p^2 + waves` where p is shift progress, plus 0.025 per stage and +0.12 when the player is out of the booth.
2. Budget accrues at `0.02 + 0.03 * tension` per second up to 3. Cues cost 0.12 (0.4 in a peak). Outside a peak a reserve of 0.9 is kept so the director can save for a peak.
3. Calm goes to build after 25 s if tension above 0.22. Build goes to peak after 20 s if tension above 0.35, budget at least 1.0 and 70 s since the last peak. Build falls back to calm after 55 s. A peak lasts 7 to 12 s. Release lasts 40 s with the first 9 s intentionally silent (ambience ducked, nothing scheduled). Then calm.
4. Cue interval base: 2.5 s in a peak, 9 in build, 20 in calm, times 0.7 to 1.5 and times (1.3 minus tension).
5. A shift gets 3 to 12 peaks (tested).
6. The booth lamp flicker cue only appears after 45% of the shift (minute 135). Before that the lamp is honest.

Cue pool by situation (see `chooseCue`): always drip_stop (silence), door_creak, distant_step. Tension above 0.3 adds knock and phone_ring. After minute 135 with power: flicker. Tension above 0.55 or stage 3 or more: whisper. In the booth: chair_creak, overhead_steps, music_box (tension above 0.3 and after minute 40), scratch (above 0.38), knob_rattle (above 0.45, stage 1 or more), window_tap (no patient, stage 1 or more), breath_behind (stage 2 or more, tension above 0.5, no patient). Out of the booth: pipe_knock, scratch, child_hum and wheelchair (above 0.35), breath_behind and knob_rattle (above 0.5, stage 2 or more). In the dark the pool narrows to distant_step, whisper, door_creak, pipe_knock, scratch, child_hum, wheelchair (and chair_creak, overhead_steps in the booth). The sim also emits `stage_up` itself, and `window_tap`, `overhead_steps`, `knock`, `whisper`, `door_creak` from consequences.

### 5.11 Story beats (`src/data/story.ts`)

Twelve beats, each fires once. `call: true` means the desk phone rings for 3.8 seconds before the voice speaks. A beat waits if the officer is mid-interview. `minStage` beats are dropped silently if the Understudy has not reached that stage 40 minutes after their time.

| Min | Id | Speaker | Call | Gist |
|---|---|---|---|---|
| 0.6 | open | Sister Imogen | no | Welcome, trust the lamp, mind the ledger |
| 38 | gaze | Sister Imogen | yes | If they hold your eye past a count of four, look away or duck |
| 52 | pell1 | Orderly Pell | no | Bad joke about Ward B being quiet |
| 70 | kessler1 | Night Nurse Kessler | yes | Heating off. Note who does not breathe fog |
| 96 | breaker_warn | Sister Imogen | no | The east breaker trips in bad weather (skipped if it already tripped) |
| 122 | imogen2 | Sister Imogen | yes | Remember what I told you to mind. That is my word |
| 150 | pell2 | Orderly Pell | no | Counted twelve in Ward B, register says eleven |
| 172 | kessler2 | Night Nurse Kessler | yes | Blankets folded (needs stage 2) |
| 192 | pell3 | Orderly Pell | yes | Music box nobody owns (needs stage 1) |
| 215 | imogen3 | Sister Imogen | no | If anyone says my name at the gate, ask what I told you to mind |
| 246 | matron | Matron's Office | yes | Entry 000 is not to be amended |
| 289 | dawn | Sister Imogen | no | Close the book, go home (only if the finale happened) |

Consequence calls (ward incident, observation breach, window return) are written inline in `simulation.ts` rather than in `story.ts`. They should move to data.

### 5.12 Finale

At minute 268 (if power is on and no patient is present) a special registry entry R900 "Sister Imogen" (staff, "On the premises", freckle under the left eye) is added and a `voice_mimic` at stage 7 spawns: answers with echo and too_fast, quotes "Mind the ledger, love", and speaks with a doubled voice. Correct answer is to contain it. The sim treats it as an Understudy for scoring.

### 5.13 Shift end

At minute 300 the shift ends. The end sheet shows right and wrong calls, Understudies admitted, people turned away or contained, composure, and the Entry 000 note ("Entry 000. Your handwriting, dated tonight, 22:00. Officer on duty: admitted."). There is one ending text variation by score. The three planned endings are not built.

## 6. Rendering

1. WebGL renderer, no MSAA on the canvas, pixel ratio 1. One shadow-casting spotlight (the desk lamp, 512 map).
2. Scene renders into a half-float render target (2 samples) at an adaptive scale (0.5 to 1.0, starts 0.75), adjusted from smoothed frame time. One fullscreen pass applies ACES tone mapping, barrel distortion, chromatic aberration, vignette, film grain, scanlines, wobble, desaturation and a lightning flash, all driven by sanity and fear.
3. Lights: lamp spot 55, booth fill 7, CRT point 2.2, hall point 34, hemisphere 0.55, three or more corridor point lights (red emergency during the blackout), a flashlight spot (28 when on and standing), lightning directional. The lamp becomes unreliable at stage 3 and up (intensity shimmer scaled by stage).
4. Rain: CPU line segments in two boxes (hall and yard).
5. Textures: wood, plaster, tile, ceiling, metal, glass, all drawn on canvas at start. The slip and CRT in the 3D booth are also canvases using the new fonts.
6. Characters: see section 8.

Perf notes: headless software GL runs about 55 to 72 ms per frame, which says nothing about real hardware. No GPU profiling has been done. The F3 key shows an on-screen performance panel.

## 7. Player and controls

| Mode | Input | Action |
|---|---|---|
| Seated (desk) | Mouse | Look (cursor parallax, yaw about ±0.75 rad, pitch about ±0.45) |
| | 1 to 5 | Ask name, date of birth, sender, kin, memory |
| | Z / X | Ledger lookup / study the face |
| | A / O / R / L | Admit / hold for observation / refuse / pull the lever |
| | C or Ctrl | Duck under the sill (eye 1.28 m to 0.6 m) |
| | Right mouse | Lean in and zoom (FOV 70 to 44, camera moves 0.32 m toward the glass) |
| | Q | Stand up |
| Standing | WASD, arrows | Walk 2.5 m/s |
| | Shift | Sprint 4.6 m/s. Stamina drains 0.22 per second, regeneration waits 1.6 s then 0.12 per second moving or 0.3 idle. FOV +4 |
| | C or Ctrl | Crouch 1.3 m/s, eye 1.05 m, quieter steps |
| | Right mouse | Zoom 1.6 m/s while held |
| | E | Interact. Hold for the breaker (1.3 s) |
| | F | Flashlight |
| | Q | Sit back down |
| Either | M | Mute |
| | F3 | Performance panel |
| URL | `?seed=N` fixed shift, `?autostart`, `?fast=N` run the clock N times faster | |

Controller details: kinematic capsule (radius 0.3, half-height 0.55) with Rapier's KinematicCharacterController (autostep 0.25, snap to ground 0.2, applies impulses to dynamic props). Head bob per state: walk speed 8.5 amount 0.026, sprint 12.5 and 0.05, crouch 6 and 0.012, plus small sway and roll. No jump (the tutorials had one; it was left out on purpose).

Interactables (raycast): the booth door, the chair, the lever (also clickable at the desk), the breaker panel. Dynamic props (crate, cup, and so on) respond to physics and to the `door_creak` impulse.

## 8. Characters

Full cast notes: `docs/generated/CHARACTERS.md`. Implementation: `src/render/patientView.ts`.

1. Looks are derived from the patient (hue, sprite, height) through a seeded RNG, plus archetype overrides. Sex is read from the first name (a fixed female name set).
2. Head: skull sphere, a face patch sphere covering the front 115 degrees mapped with a 256 px canvas, a nose, ears, neck, hair (short, slick, bun, long with strands, scarf, habit with veil) and hats (trilby, flat cap, cloche).
3. Face canvas: skin gradient, pores and age spots (humans only), hairline shadow, cheeks, age lines, eyes with iris colour, pupils, catchlights (humans only), lid lines, lower bags, lashes for women, brows, nose shading, glasses, stubble, lips, mouth variants, teeth rows for the Understudy at stage 3 and up, and the face mark (scar over the left brow, mole, burn, notched ear, chipped tooth and so on). Four states: open, blink, talk, stare. Textures are swapped, not regenerated.
4. Body: lathe coat with a wider hem, shoulder yoke, collar, buttons, lapels, tie (suit), cardigan hem band and mismatched buttons, nurse bib and cape, wet shoulder patches for humans. Arms are two-segment rigs (shoulder pivot, elbow pivot, forearm, hand with a thumb) with poses: rest, bag, hold, hug, folded. Props: furled umbrella, cracked ceramic goose with ribbon, red knitted cap, cream folder.
5. Animation: head tracks the camera with lag (humans, 4) or tight (Understudy, 14), tilts, breathing scale, per-archetype body language (the hummer rocks and shivers, the goose man gestures when speaking, the tragic patient worries the cap, the plain man shifts weight), blinks on a human rhythm, the Understudy blinks rarely then never, stands a degree too straight, glides rather than bobs while walking, comes in dry.
6. Dispose: every geometry, material and texture is tracked and disposed when the patient changes.

Weaknesses: faces and bodies are stylised dolls. Hands have no fingers. Eyes do not move inside the face. Only one head shape. Costumes have no folds or cloth detail. Clothing is flat colour.

## 9. Audio

Everything is synthesised (`src/audio/engine.ts`, about 660 lines). Master gain 0.8 into a dynamics compressor (threshold -14, ratio 5). Buses: ambience, effects, voice. Two convolution reverbs (booth 0.55 s, corridor 2.4 s) crossfaded by zone. One-shots go through a panner with 3D position. Listener follows the camera.

### 9.1 Ambience layers

1. Hum: low-passed brown noise plus a 50 Hz oscillator. Louder with power.
2. Rain: filtered white noise, brighter outside the booth.
3. Drone: three detuned saws (41, 43.3, 61.7 Hz), gain follows director tension above 0.15.
4. CRT whine: 15.7 kHz, very quiet, only in the booth with power.
5. Whisper bed: band-passed noise that rises when sanity drops below 65.
6. Heartbeat: two sine thumps when fear is above 0.4, faster as fear rises.
7. Settling ticks: dry wood ticks every 6 to 15 seconds at a random place around the listener (rarer while the room is held quiet).
8. Quiet: ambience gain drops to 0.18 during director release silence and during a stare. Speech ducks ambience to 0.45.

### 9.2 One-shots and what triggers them

| Sound | Trigger | Notes |
|---|---|---|
| Knock at the hall door | Patient arrives | Two knocks |
| Paper rustle | 4.2 s after a patient arrives | Slip placed |
| Typewriter clack | Asking a question | |
| Carriage bell | Ledger lookup | |
| Stamp (thump, slap, ink pad) | Admit verdict | |
| Lever (clunk, falling square tone) | Contain verdict | Ducks ambience |
| Click | Refuse, hold, tools | |
| Phone ring | `phone_ring` cue and every `call` story beat | |
| Radio speech (blips, band-pass, hiss, key-up and key-off squelch) | Staff speaking | Pitch per speaker |
| Patient speech | Answers | Pitch from hue. Doubled with a delay for the voice mimic |
| Power down (falling saw, relay clicks, a tube dying) | Breaker trips | |
| Power up (rising sub, tubes strike, thump) | Power restored | |
| Thunder | Lightning timer | Lightning also flashes the post pass |
| Knock | `knock` cue | Window in the booth, wall in the corridor |
| Distant steps | `distant_step`, phantom step | |
| Door creak | `door_creak` | Also pushes a prop |
| Whisper | `whisper`, whisper_name hallucination | Behind the listener |
| Music box | `music_box` cue | 16-note minor tune. Tempo and pitch drift with stage. Sticks on the last note |
| Breathing behind you | `breath_behind` | Three slow breaths, close behind |
| Scratching | `scratch` | 6 to 10 irregular nail scrapes |
| Window taps | `window_tap` | One, a beat, two |
| Door knob rattle | `knob_rattle` | Twelve rapid ticks then a latch thud |
| Chair creak | `chair_creak` | Behind the listener |
| Overhead steps | `overhead_steps`, ward incident | Five heavy steps through the ceiling |
| Pipe knock | `pipe_knock` | Two metallic bangs with ring |
| Child humming | `child_hum` | Six notes of the music box tune, never finished, from the alcove |
| Wheelchair | `wheelchair` | Rolling noise and axle squeaks from the alcove |
| Stage-up sting | Any stage increase | Inhale, low cluster, thump. Not a scream |
| Tension riser | Director enters a peak | 2.4 s rising noise sweep |
| Stare drone | Stare window opens | 3.15 kHz thin tone and 39 Hz swell, plus the room goes quiet |
| Stare end | Window closes | A breath let go, or a thump if you were caught |
| Footsteps | Distance walked | Wood in the booth (rare board creak), tile in the corridor, lighter when crouching |

### 9.3 Audio weaknesses

Nobody has listened to any of this. Levels, spatial balance, reverb sends and timing are guesses. The voice is a blip synth with no real phonemes. There is no music except the music box. There are no real foley recordings. Cue-to-sound pairing does not yet consider what is on screen (for example, a music box should sometimes come from the hall when a patient is at the glass). No separate volume sliders. The compressor may pump during peaks.

## 10. UI and fonts

1. Palette: paper cream, ink blue-black, lamp amber, phosphor green, stamp red, green, blue and orange.
2. Fonts: Special Elite (typed forms and buttons), IM Fell English (titles, subtitles, body), Reenie Beanie (pencil notes, labels, task line), VT323 (clock, CRT).
3. HUD: amber VT323 clock, handwritten task line, handwritten "nerves" and "wind" bars drawn as thin pencil lines, an interaction tag with a hold bar, italic subtitles with a small caps speaker line.
4. Desk paperwork (left): typed admission slip (Form 7-B, paperclip, RECEIVED stamp, ruled lines), phosphor ledger card on a thick bezel with scanlines, pencil notes that log what you asked and what the face showed (with a placeholder tip when empty).
5. Blotter (bottom): question tags (kraft paper), tool tags, stamp-style verdict buttons (green, blue, red, orange outlines, double border).
6. Title and end sheets: a Form 7-B intake page with ruled lines, a red "Begin shift" stamp button, a typed controls block.
7. Responsive: breakpoints at 900 px and 640 px. On a phone the cards go side by side and notes hide. The game is keyboard-first. Touch controls do not exist.

Weaknesses: the HTML paperwork covers the 3D monitor and slip, so the diegetic 3D versions are never really read. No settings menu, no accessibility options, no credits, no controller support, no localisation. The stamp buttons are CSS only. Fonts are Latin subsets.

## 11. Save

`localStorage` key `midnight.v1` stores best correct count, nights played, mute flag. All calls are wrapped in try and catch. There is no mid-shift save, no unlock progression, no settings storage.

## 12. Verification

### 12.1 Unit tests (20, all passing)

Determinism (same seed same shift, different seed different shift, presentation randomness does not change truth). Patients (humans carry no mimic tells, strange innocent has a typo but tells the truth, slipping mimics have at least one tell, swapDigits keeps the date shape). Desk actions (each question once, echo tell, lookup needs power). Verdicts and consequences (admit an Understudy raises the stage and fires a ward incident, contain is correct and costs no sanity, refusing a human sends them back, the lever needs power). Breaker (power trips on schedule, restores only at the panel). Director (always a quiet release after a peak, 3 to 12 peaks per shift). Shift end and score. Stare rule (the Understudy punishes eye contact, ducking avoids it, the humming man stares harmlessly). Story beats (each fires once, not before its time).

### 12.2 Headless smoke test (`node tools/smoke.mjs .work`)

Boots the preview build in Chromium with software GL and checks: title screen and desk screenshots at 1280 by 720 and a phone size, no console errors, first patient arrives, keyboard path (ask, lookup, admit) changes state, ducking lowers the eye height (1.28 to 0.60) and right mouse zoom sets the FOV near 44, the breaker trips at minute 105 and restores power when the player is in the breaker zone, and every new audio function runs without throwing. `node tools/inspect.mjs .work` renders close-ups of every archetype in two variants.

### 12.3 Not verified (treat as untested)

1. Any sound by ear.
2. Frame rate and adaptive scaling on the real laptop.
3. Pointer lock, mouse feel, sprint and crouch feel, collision around the alcove, wheelchair and crate.
4. The finale encounter and the end screen in a real run.
5. A full shift for pacing: whether the director feels right over 22 minutes, whether the stare rule is fun or annoying, whether the quiet windows land.
6. The stare rule while ducked and while zooming in different order.
7. Phone-call story timing against interviews.
8. Tab switching, window resize mid-shift, long sessions, pausing and resuming audio.
9. Any browser besides Chromium.

## 13. Known issues and inconsistencies

1. **Quirks are never shown.** Every patient has a `quirk` string (for example "Gives the goose a separate admission slip") but nothing in the UI or world surfaces it. The goose man does not actually get a second slip.
2. **Chatty repeat mismatch.** The second chatty patient (minute 232) is written as a night cook afraid of the corridor, but the model is the same goose man style.
3. **Stale subtitle.** The last patient's line can stay on screen while the player is already walking the corridor.
4. **Paperwork cards hide the 3D CRT and slip** in the desk view.
5. **Breath fog sprites** are very large in close-up. Fine at booth distance.
6. **`deceased` tell** is defined and never used. The tragic patient's kin is deceased in the registry note only.
7. **Window return of an Understudy** always comes back as a slipping mimic regardless of the original archetype.
8. **Magic numbers.** `door_creak` pushes `env.props[4]`. Several world positions in `game.ts` (`WINDOW_POS`, alcove at x 11, z 2.2) are hard-coded copies of map coordinates.
9. **Booth wall calendar** still uses Georgia (map locked, left alone).
10. **Bundle size** about 4.8 MB because Rapier WASM is inlined and loads before the title screen.
11. **Single shift only.** No Night 01. No progression.
12. **Hallucination shadow figure** is a flat plane in the hall. Weak.
13. **Consequence story lines live in the sim**, not in data files.
14. **No pause when the tab loses focus** except the pointer-lock exit while standing. Audio keeps running.
15. **Speech blips** are the same synth for everyone apart from pitch.
16. **No gaze or look at the officer's face for the player**: the officer has no hands or body visible.
17. **Light flicker and lightning** have no photosensitivity setting.
18. **`SOURCE_INDEX.md` statuses** are a triage estimate, not a log of what was read, because the original audit notes were lost.

## 14. Roadmap

Effort: S under half a day, M about a day, L several days, XL a week or more. Order is priority.

### Phase A. Stabilise (do first)

**A1. Play it for real (M).** On the owner's laptop run `npm run dev`, play three full shifts with different seeds (`?seed=`). Record in `docs/generated/PLAYTEST_NOTES.md`: frame time with F3, every moment that felt flat, every bug, every sound that was too loud, too quiet or wrong. Acceptance: notes written, top ten issues triaged into this roadmap.

**A2. Fix the known issues in section 13 that are cheap (S).** Stale subtitle, quirk mismatch, deceased tell for the tragic patient, magic numbers into named constants, pause on tab blur.

**A3. Real-hardware performance pass (M).** Measure on Iris Xe. Target 60 fps at 1080p with adaptive scale at or above 0.75. If not, profile (draw calls, shadow map, post pass, character texture uploads). Split Rapier WASM behind the title screen with a dynamic import so the title appears in under one second. Acceptance: numbers recorded, bundle split, no stutter when a patient arrives (face textures are built on arrival, consider building during the walk).

### Phase B. Characters (the owner's top complaint)

**B1. Character pipeline (XL).** Replace procedural bodies with authored GLB characters. The owner has a Blender MCP on their PC. Steps: define a shared skeleton and a small set of base meshes (adult male, adult female, young adult, older adult), author clothing and hair as separate meshes, bake simple ambient occlusion into vertex colours or a texture, export GLB with morph targets for blink, mouth open, smile width, brow raise and stare. Load with `GLTFLoader`, keep one material per character where possible and under 15k triangles each. Keep the same `PatientView` API. Acceptance: all seven archetypes look hand-made at 2.5 m through the glass and at close-up, no new per-frame cost.

**B2. Eyes and gaze (M).** Separate eyeballs that rotate to follow the camera, with believable saccades for humans and steady unblinking lock for the Understudy at higher stages. Eyelids as geometry or morph targets instead of texture swaps.

**B3. Hands and props (M).** Fingers, grip poses, a proper goose, cap and folder that sit in the hands. Props that react (the goose gets set on the sill, the cap is passed through the slot).

**B4. More people (L).** At least three variants per archetype so the same face does not come twice in a shift, plus new archetypes: a child's parent who is lying for a good reason, an elderly man who recognises you, a doctor in a hurry, a person who answers every question with a question. Each needs a silhouette, an odd honest detail, a line in their first five seconds, a way the Understudy would copy them, and a reason the player would regret the wrong call (see the rules at the bottom of `CHARACTERS.md`).

**B5. Understudy visual escalation (M).** Make the stages unmistakable if you look carefully: skin texture, head tilt held, a hand that is slightly wrong, shadow that arrives half a second late, reflection in the glass that does not match. Show at least one clear change at stages 2, 4 and 6.

**B6. Voices (L to XL).** Replace blip speech with real voices. Options: record or commission lines, or use a high quality speech synthesis pipeline run offline and shipped as audio, with per-character processing (radio filter for staff, thin and early for the mimic). Add breath, hesitation and the "answers one beat too early" timing as a real audio property. Keep subtitles and a subtitle size setting.

### Phase C. Mechanics (the owner says they are not fleshed out)

Goal: the desk should have many small things to do that all create decisions, without hiding the five-question core.

**C1. The desk phone (M).** The phone rings from story beats and from the director. The player may pick it up (with a key) or let it ring. Calls carry information (a staff warning, a false lead, a mimic in disguise) and a cost (time, patience, attention while a patient waits).

**C2. The ward board (M).** A visible board showing Ward A and Ward B bed counts and who you admitted. The count drifts when you admit an Understudy. Players learn what the sim already tracks.

**C3. The ledger book and notes (M).** A paper ledger the player can write in (mark a patient suspicious, circle a mismatch). Marks feed a small end-of-night review. Reuse the pencil note style.

**C4. Gate camera or intercom (M).** A second view of the hall before the patient reaches the glass, so you can watch how they walk and whether they breathe fog. Only works with power.

**C5. Inventory and tools (L).** Flashlight batteries that run down, a key cabinet with a few keys, a stamp pad that dries out, a bell to call Pell. Each tool must matter in both a calm moment and a tense one.

**C6. Hiding and the booth under pressure (M).** The duck already hides you from a stare. Add a second reason to hide (something walking past the glass, something at the booth door). Add a visible threat that tests the lamp after stage 3.

**C7. The corridor trip (M to L).** The breaker walk is the only floor gameplay. Add a short set of tasks (a fuse to find, a door to prop, a flashlight battery to swap), a stalker moment using the sound-suspicion pattern from Lethal Company research, and a safe room the player reaches. Respect the map lock: add props and triggers, not new geometry, unless the owner approves map changes.

**C8. Better consequences (M).** Make consequences visible and surprising. A patient you admitted shows up in the hall at 3 a.m. A returned human thanks you or does not. Ward B's count appears on the board. Never explain it.

**C9. Interaction polish from the movement research (S each).** Focus highlight on interactables (OnFocus and OnLoseFocus), doors that open away from the player, surface-based footsteps beyond wood and tile (grate, puddle), crouch ceiling check, optional slope handling if any ramps appear. Skip jump unless a level needs it.

**C10. Difficulty and options (S).** Easy, normal and hard tell counts, patience, stare frequency.

### Phase D. Story

**D1. Three endings (L).** See `STORY_BIBLE.md`. Build the end sequence as a scene: the officer opens the ledger, the last page is shown as a rendered handwritten document, a second hand has signed under it, and the title sheet changes on the next launch depending on the ending reached (stored in save).

**D2. More staff and calls (M).** Imogen, Pell and Kessler need personal arcs: Imogen's word, Pell's counting, Kessler's folded blankets. Add a fourth voice only if it adds something. Move consequence lines into `src/data`.

**D3. Environmental storytelling (M).** Notes on the desk, the calendar, the previous officer's pencil marks, the Entry 000 page glimpsed early. Writing goes through the humanizer rules.

**D4. Night 01 (XL).** A second shift with a new schedule, a harsher Understudy that remembers the first night, and a new location only if the owner approves map work.

**D5. Writing pass (M).** Read all dialogue aloud. Cut anything that sounds like a chatbot. Give each speaker a distinct sentence rhythm.

### Phase E. Sound

**E1. Listening pass (M).** The owner or Opus plays with headphones and fixes every level. Write a mix sheet.

**E2. Audio timeline (M).** Draft the whole night as a tension curve on paper first (the research says audio first, rising fractal tension). Mark where each scare sound belongs, where silence must hold, where music box and humming appear, and make the director honour it rather than pick at random inside pools.

**E3. Real foley and layered recordings (L).** If the owner can supply or license recordings (rain on glass, wood creaks, metal pipe, breathing, wet footsteps, door latch), layer them under the synthesised sounds. Keep file sizes small.

**E4. Music (M).** There is no score. Add sparse minor, augmented or diminished material and distorted cheerful music (a warped radio tune) for contrast, as the research recommends. Strategic silence stays more important than music.

**E5. Mix features (S).** Separate sliders for master, effects, voice, ambience. A reduced-intensity mode that removes sudden sounds. Proper pause handling for the audio context.

### Phase F. Visuals (without touching the locked map unless approved)

**F1. Character lighting (S).** A subtle rim or fill so patients read through the glass. The owner approved only character work, so do not edit the hall's light rig. Light the character object (a child light on the view group) instead.
**F2. Glass (M).** A real glass look: reflections of the booth, rain streaks on the outside, breath fog on the inside, fingerprints. Applies to the glass material, which sits at the map boundary, so ask the owner first.
**F3. Post pass polish (S).** Film grain tied to light level, a soft bloom around the lamp, optional reduced motion.
**F4. Flashlight and corridor (M).** Better cone, dust motes, a visible beam. Needs care around the map lock.
**F5. Title screen scene (M).** A slow shot of the booth in the rain behind the paper title sheet instead of the live game view.

### Phase G. UI, UX and accessibility

**G1. Settings screen (M).** Volume sliders, mouse sensitivity, field of view, subtitle size, reduce flashing and flicker, reduce motion, hold or toggle for duck and zoom, rebindable keys.
**G2. Gamepad (M).** Left stick, right stick, face buttons for the five questions and four verdicts as a radial menu.
**G3. Touch (L).** Optional later. The game is a desk game and would suit touch well.
**G4. Make the 3D paperwork readable (M).** Let the player lean down to read the physical slip and the CRT in the booth, and hide the HTML cards in that mode. The HTML cards stay as an accessibility option.
**G5. Credits, pause menu, how to play page (S).**
**G6. Localisation scaffold (S).** Move all strings into one file.

### Phase H. Technical

**H1. Build and tooling (S).** A lint step, a formatter, GitHub Actions running typecheck, tests and build (note: workflows add files the owner did not ask for, so ask first).
**H2. Save system (M).** Mid-shift resume, settings, unlocked endings, best scores per seed.
**H3. Asset pipeline (M).** If GLB characters arrive, add a loader with fallbacks to the procedural look, KTX2 textures and Draco meshes only if size demands it.
**H4. Determinism and replay (M).** Record inputs and seed, replay in tests. Useful for bug reports and for a future server.
**H5. Co-op readiness (L, only after 10,000 wishlists).** Move the sim behind an interface that can run on a server, define the command and event protocol, add rollback or authoritative state. Do not start before the gate.
**H6. Browser matrix (S).** Test Chrome, Edge, Firefox, Safari. WebAudio and pointer lock differ.

### Phase I. Release

**I1. itch.io demo page and trailer (M).** Free demo, screenshots from real gameplay, a short capture of one stare and one breaker walk.
**I2. Steam page and wishlist push (L).** Capsule art, trailer, short text. Wishlist target 10,000 before multiplayer.
**I3. Playtest cycle (L).** Five outside players, record where they get stuck or laugh. The research says clip-worthy moments matter. Make sure the goose man, the music box and the stare moment are clip-worthy.

## 15. Research notes worth reusing

Pulled from the files in `C:\GameDev\MIDNIGHT RESEARCH` (see `SOURCE_INDEX.md`).

**Horror design.** Audio first, with a rising fractal tension curve: bigger builds contain smaller builds. Add and remove ambience to create tension. For peaks use diegetic sounds such as creaking and screeching, not screamers. Silence is a tool. Distorted happy music creates unease. The unknown is scarier than the visible. Show the monster late, build lore first, then distant sightings, then confrontation. Silhouette readability, characterisation and the uncanny (the mundane twisted) matter. Mechanics must complement the monster. Safe places lower and raise tension and should erode slowly (the Silent Hill 4 apartment). Random scares in a safe room feel cheap. Isolation needs a reason. Death must not be frustrating. A jump scare is fine if rare and well built, and anticipated ones create suspense. Disgust, shock and fear are separate tools, and overuse numbs the player. Keep visual style consistent. Spatial flicker with sound feels more real than silent flicker.

**Entity AI (Lethal Company, Alien Isolation).** Entities have learnable rules (do not look at it, do not make noise, do not stay in the dark). A director controls pacing, with menace in front stage and backstage. Gaze and look-count rules (Ghost Girl). Sound suspicion meters (Eyeless Dog). Insanity and fear driving hallucinated audio. Behaviour trees with a simple phase machine. Keep AI readable so the player can learn it.

**Shift at Midnight and No, I'm Not a Human.** A tutorial character who guides then betrays or fails. A free demo. The 10,000 wishlist gate. Clip-worthy consequences. Randomised, species-locked guests.

**Movement tutorials (Unity, ideas only).** Modular first person controller with feature toggles. Sprint with a stamina bar and regeneration delay. Crouch with ceiling raycast. Head bob with different speed and amount per state (about 14 and 0.05 walking, 18 and 0.1 sprinting, 8 and 0.025 crouching in Unity units). Slope sliding. Zoom. Interaction with focus and lose-focus callbacks. Footsteps by surface and by state. Health regeneration with a wait. Doors that open away from the player using a dot product.

Implemented from these: head bob per state, crouch (no ceiling check), zoom, stamina regen delay, footsteps by surface and state (two surfaces), the fixed-step physics loop, the interaction raycast, flicker with spatial sound. Not implemented: slopes, focus highlights, door-away logic, health, jump.

## 16. How Opus should work on this

1. Read in this order: this file, `CLAUDE.md`, `docs/HANDOFF_FOR_OPUS.md`, `docs/generated/PROJECT_STATE.md`, `CHARACTERS.md`, `STORY_BIBLE.md`, `DESIGN_GAPS_AND_IMPROVEMENTS.md`.
2. Run `git status` and `git log --oneline` first. The owner's folder is the Desktop path above. Do not copy files between folders by hand and risk losing history.
3. Run the checks before and after every change: `npm run typecheck`, `npm test`, `npm run build`, `node tools/smoke.mjs .work`.
4. Add a unit test for every sim change. Keep the sim pure.
5. Look at the game after every visible change (screenshots from the smoke and inspect scripts). Do not claim a visual fix from code alone.
6. Keep UI copy, dialogue, docs and commit messages humanized. Search for em and en dashes before committing.
7. Commit in small stable steps as the owner's identity, no trailers. Push with `git pull --ff-only` first, then confirm `origin/main` equals `HEAD`.
8. Update `PROJECT_STATE.md` and the "not verified" list honestly after every session. If something was only tested headless, say so.
9. Respect the map lock. If a task needs map edits, stop and ask the owner which exact location may change.
10. When unsure whether something feels right, ask whether it moves the game toward the research's picture of a good horror game: warm then subverted, tension and release, silence after peaks, learnable rules, original characters, clip-worthy consequences.

## 17. Command reference

    cd C:\Users\hp\OneDrive\Desktop\MidnightWeb
    npm install                       # first time
    npm run dev                       # play at the printed address
    npm run typecheck
    npm test
    npm run build
    npm run preview                   # serve the production build
    node tools/smoke.mjs .work        # headless screenshots and checks (needs Chromium; set CHROMIUM=path if needed)
    node tools/inspect.mjs .work      # character close-ups
    # URL options: ?seed=7  ?autostart  ?fast=6
    # Console: window.__game  (sim, player, view, audio, hud)

## 18. Glossary

**Understudy.** The entity. Copies registry entries. Stage 0 to 7.
**Tell.** A detail that is wrong. A clue, never proof.
**Slip.** The admission paper the patient hands in.
**Ledger.** The CRT registry that holds the true record.
**Stare window.** A few seconds where a patient holds your eye.
**Quiet window.** Intentional silence after a peak or during a stare.
**Entry 000.** The first line of the ledger, in the officer's handwriting, dated 22:00 on the first night.
**Map lock.** The owner's rule: change only the system in scope.
