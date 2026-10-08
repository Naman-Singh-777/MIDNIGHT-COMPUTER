# MIDNIGHT (Asylum Intake: The Midnight Shift): everything done so far

One file with every round of work, what was checked, and what is left. Newest round first.

Where things are:
* Repo on GitHub: https://github.com/Naman-Singh-777/MIDNIGHT-COMPUTER (rename to MIDNIGHT pending, see section 6).
* This file in the repo: `docs/WORK_LOG_ALL_ROUNDS.md`. A copy was also saved to `C:\GameDev\MIDNIGHT_WORK_LOG.md` on your PC.
* Round 4 details: `docs/TASKS.md` in the repo.
* Your local copy at `C:\Users\hp\OneDrive\Desktop\MidnightWeb` does not have rounds 3 and 4 until you run `git pull` there. Round 3 and 4 work was done in a cloud clone and pushed to GitHub, which is why TASKS.md was not on your PC.

Commits: `3415bf3` round 1, `eb0c963` round 2, `b7d2d0e` roadmap, `91d1c9c` round 3, `31fae08` and `e9093ed` round 4, plus the commit that adds this file. All authored as Naman-Singh-777, no co-author lines.

---

## Character pass (8 Oct 2026): authored bodies for the visitors

Analysis first (`docs/generated/CHARACTER_ART_DIRECTION.md`): the sphere and lathe kit could not reach the reference, so the visitors moved to the CC0 MakeHuman body. `tools/mh-bake.mjs` bakes 20 bodies (16 named people, 4 stock) with their own age, build and face shapes into `public/characters/humans.bin`. `src/render/human.ts` turns one into a skinned body with clothes and hair grown from its surface, painted skin, real lids and expressions, fitted hats and glasses. `PatientView` uses it when loaded and keeps the old body as a fallback (`?procedural`). Gameplay, AI, dialogue, fear, story, the creature and the map are unchanged. Full report with before and after images: `docs/generated/CHARACTER_REDESIGN_REPORT.md`. Checks: typecheck, 40 tests, build, smoke, all headless.

## Round 5 (8 Oct 2026): eyes, fear director, dawn walk, memory theme

Full report: `docs/generated/MIDNIGHT_ROUND5_REPORT.md`. In short:
* Real eyeballs that track you (fakes lock on early, one eye trails, stop blinking), face bones per person, jaw underside, better nose.
* Sloped shoulders, two-jointed fingers, five cloth types, arms that clear the body at rest.
* Fear director: harmless rat and Pell's false alarm first, then echo steps, running, a figure at the far end, and the booth changing behind your back (mug, terminal, photo face down, dead-line call in your own voice, lamp out, a knock). Later, echo steps can be real.
* The creature searches, learns and waits at the door. Dawn is now a scripted walk with the creature pacing past the Ward B door.
* New cast: Hester Bloom, Abel Hollis, June Quill. Goodbye lines. Kessler explains the fakes: they are what the memory ward takes out of people, walking back.
* You answer the phone yourself and can miss calls. The photo can be picked up. The mop has to be fetched. Reporting the head count locks Ward B and costs you Pell.
* Desk: oak grain, tarnished brass, worn leather, aged plastic, bent paper, screws and drawer gaps.
* 35 tests, smoke test clean, all headless.

---

## Round 4 (8 Oct 2026): danger, human bodies, cast, desk, hosting

**Your brief:** egg heads and geometric bodies; desk looked machine-made; no threat of death or loss; no build-up; corridor not scary; confusing words (Understudy, lamp, ledger, "open the glass"); story should be heartbreaking with distinct voices; reviewing people through glass is passive; host on GitHub Pages named MIDNIGHT; read all research.

**Done:**
1. **The tall one** (`src/sim/stalker.ts`, `src/render/creature.ts`). A blind 2.45 m skinless figure that walks the east corridor. Hunts by sound: running carries 13 m, walking 6 m, crouching is silent. Listens at suspicion 0.4, hunts the last place it heard you at 1.0, faster for every fake you admitted. Torch in its face sets it off. A closed booth door stops it (it bangs, then leaves). Contact kills.
2. **When it appears:** the power cut (between you and the fuse box), when an admitted fake escapes the ward, during the 2 a.m. head count if things have gone wrong, and the dawn walk to Ward B.
3. **Fakes break the glass.** From stage 2, a fake kept waiting about 110 s presses face and hands to the window, cracks it over 8 s, and climbs in. Survive with the trapdoor (T) while it cracks, or by being under the desk (C) while it searches. The cracks stay all night.
4. **Death wipes the night.** Stalker, glass break, or nerves at zero. Short in-world scare, a death sheet, one button: start the night again.
5. **Human bodies** (`src/render/humanoid.ts`, rewritten `src/render/patientView.ts`). Real proportions, hips, knees, elbows, hands with fingers, shoes or bare feet, clothes as separate pieces (coats open at the front, lapels, ties, collars, fur collar, apron, priest's collar). Walk cycle, breathing, weight shifts. Fakes glide, never breathe, press against the glass while staring, and stand watching in the hall corner after being turned away.
6. **Thirteen named visitors plus the finale** (`src/data/cast.ts`, `src/render/looks.ts`, `src/data/shift00.ts`), each with own look, voice pitch and speed, greeting and answers: Walter the postman, Bernard and his ceramic goose, Dolly the club singer, Tobias the hummer, a fake Walter, Ivor the miner, Mae with her dead son's cap, fake Father Penhale, Rosa the agency nurse (suspicious but real), fake Dr. Marsh, Gus the terrified boxer, the fake of your mother, Edith Marsh looking for her husband, fake Sister Imogen.
7. **Plain words:** fakes, records, admission form, let in, hold, turn away, trapdoor, fuse box. Clock fixed to run 22:00 to 06:00.
8. **Story with arcs and voices** (`src/data/story.ts`, `src/data/dialogue.ts`). Imogen (Irish, warm) checks on your mother and never calls back, then a fake wears her. Pell (nervous, counts things) holds the ward door at dawn. Kessler (exact, no contractions) tells you about her daughter, goes into Ward B, and calls back wrong. The Matron says no night officer was ever employed. Your mother has not known your name since spring; the fake knows it perfectly.
9. **Desk modelled properly** (`src/render/desk.ts`): oak pedestal desk with drawers and brass pulls, leather blotter, brass banker's lamp with green glass shade, beige terminal with curved screen and 52-key keyboard, rotary phone with coiled cord, clipboard, mug with coffee ring, stamps, ink pad, pen pot, ashtray, photo of you and your mum. Same positions, so lights and camera did not move.
10. **Corridor:** one dead tube, others stutter, lights cut out as the creature passes.
11. **GitHub Pages workflow** (`.github/workflows/pages.yml`), page title MIDNIGHT.
12. **Research read in full this round:** all Lethal Company entity breakdowns (Ghost Girl, Eyeless Dog, Bracken, Butler, Masked, Maneater, Company Monster, Fear and Insanity, 11 behaviours, graphics, Experimentation, multiplayer horror), Alien Isolation (3 files), behaviour trees, F.E.A.R. GOAP, simple enemy, NPC talk, flickering lights, swap characters, see like an artist, seamless textures, lighting essentials, horror scene setup, Shawcat, fast horror, 24 hour horror, fail at survival, fail at tutorials, changing genres, the materials guide, both MD directives. Not read word for word: movement transcripts (used in round 2), Jimmy Vegas, mobile input tutorials, mesh and terrain tutorials, ML and Monte Carlo, scriptable objects, start menu, general indie advice.

**Checked (headless, cloud Chromium, not your laptop):** typecheck, 30 tests (6 new for the creature, door, glass break, records and nerves), build, smoke test with no console errors, screenshots of the cast, desk, creature, a forced glass break and the death sheet. On GitHub the workflow installed, tested and built fine and failed only at the Pages step because Pages is switched off.

---

## Round 3 (8 Oct 2026, earlier): motive, jobs, faces, UI

1. **Motive and goal:** your mother is on Ward B, bed 9. Keep fakes off her ward until six, then see her. Four endings at the Ward B slot (clean, crowded, taken, absent), each closing on page one of the admissions book in your own handwriting.
2. **Shift at Midnight style jobs** (`src/ui/minigames.ts`): mop the stain in the corridor (it drags toward Ward B and has a handprint), file last week's forms (the last card is yours, "not yet"), the 2 a.m. head count through the Ward B door slot with a torch, and the dawn visit. Missed jobs cost nerves and a phone call.
3. **Faces** (`src/render/faces.ts`): 512 px painted faces with pores, wet eyes, brows hair by hair, sculpted skulls. Fakes get pin pupils, a smile that keeps widening, one eye higher, waxy skin, and a black-eyed open-mouthed face that flashes for a frame or two.
4. **Voices** through the system speech voices, with a drone under fakes. Emergency broadcast tones, glitch sounds, mop scrubbing.
5. **UI:** records screen in its own column so it is never cut off, short button labels on one row, Tab pushes the papers aside.
6. **Environment textures:** worn floorboards, stained and cracked plaster, dirty tiles, all with bump maps. No geometry or lights moved.

---

## Round 2 (7 Oct 2026): characters, paperwork UI, movement, sound

Patients rebuilt with heads, coats, arms and props. UI redone as 1963 paperwork with bundled fonts. Crouch, head bob per state, right mouse zoom, stamina with a regeneration delay, footsteps by surface. The stare rule (look away or duck when one holds your eye). Staff story beats with phone calls. About fifteen procedural scare sounds tied to a pacing director. 20 unit tests.

## Round 1 (7 Oct 2026): the playable first shift

Built from scratch in TypeScript, Three.js, Vite and Rapier: deterministic simulation kept free of the DOM, pacing director, booth, hall and east corridor, desk loop (form, five questions, records lookup, face check, four verdicts), delayed consequences, the breaker blackout, save, tests, headless smoke test.

---

## 6. What you need to do (two settings the cloud session is not allowed to change)

1. GitHub repo, Settings, Pages, Source: **GitHub Actions**. Then Actions tab, "Deploy MIDNIGHT to GitHub Pages", Run workflow.
2. Settings, General, rename the repo to **MIDNIGHT**. The site then lives at https://naman-singh-777.github.io/MIDNIGHT/ and old links redirect.
3. On your PC: `cd C:\Users\hp\OneDrive\Desktop\MidnightWeb` then `git pull` to get rounds 3 and 4.

## 7. What is left, in priority order

1. Play a full night on the laptop with headphones. Tune glass-break patience, the blackout walk past the creature, and the dawn walk.
2. Script the dawn walk as a set piece instead of a plain summon.
3. A real hiding spot in the corridor (needs your approval to change corridor geometry).
4. Character polish: hair cards, authored shoes and collars, a painted skin texture, one bone per finger, idle animations per person (see the character report, section 19).
5. Eyeballs that follow the camera.
6. Recorded voices per character; system voices differ between Windows and other systems.
7. A 3D Ward B behind the slot (needs map approval).
8. Night 01 with fakes that remember Night 00.
9. Settings: volume, sensitivity, subtitle size, reduced flashing, jumpscare off.
10. Performance on Iris Xe: merge desk meshes if needed, split the Rapier WASM out of the first load.
11. Old docs (`PROJECT_REPORT_AND_ROADMAP.md`, `STORY_BIBLE.md`) still use the old names in places. `docs/TASKS.md` and this file are current.

Map lock across all rounds: booth walls, hall and corridor geometry and every light position are unchanged. Changes were limited to the locations in scope: the desk and its props, task props at their spots (stain, Ward B sign and slot, cabinet hit box), corridor light behaviour, and a crack decal on the window.
