# Handoff for Claude Opus

You are continuing a web horror game. Read this file first, then `CLAUDE.md`, then `docs/generated/PROJECT_STATE.md`. Do not restart anything. Build on what is here.

Game: Asylum Intake: The Midnight Shift. Stack: TypeScript, Three.js, Vite, Rapier 3D, Web Audio. Repo: https://github.com/Naman-Singh-777/MIDNIGHT-COMPUTER. Local path on the owner's PC: `C:\Users\hp\OneDrive\Desktop\MidnightWeb`.

## Owner's rules (do not break these)

1. The owner is the only author on GitHub. Commit as their identity (`Naman-Singh-777 <namansinghfigo349@gmail.com>`), unsigned. No co-author trailers, no session links, no "generated with" lines, anywhere.
2. Map lock. Change only the exact system named by the task. Do not touch the booth, hall or corridor geometry and lighting (`src/render/environment.ts`) unless the task is about the map. If something nearby looks wrong, leave it and note it in `docs/generated/DESIGN_GAPS_AND_IMPROVEMENTS.md`. Adapt new work to the locked surroundings.
3. All text goes through the humanizer rules: no em or en dashes, no filler, no AI-sounding phrases. This covers docs, UI copy, dialogue and commit messages.
4. Do not build in Unity. `C:\GameDev\Midnight` is an audit finding only. `C:\GameDev\MIDNIGHT RESEARCH` is read only.
5. Be economical with tokens, but not with quality. Verify before saying something works. Say whether a check was headless or on real hardware.
6. Check Git before and after: inspect status, `git pull --ff-only` before pushing, never force push, confirm `origin/main` equals `HEAD` after any push.
7. Hardware target is an i7-1255U laptop with Iris Xe and 16 GB RAM. No heavy rendering. Do not add dependencies unless they clearly improve the game.

## The owner's latest feedback (this is what to fix next)

The owner said the game "looks too much AI generated" in all of these, and that nothing is fleshed out yet:

1. Fonts, UI and mechanics.
2. Characters and story.
3. They want the characters "very detailed".
4. They want more scary sounds at appropriate timings.
5. They want the research files checked again, especially on making horror games and player movement.

## What this round did

1. Characters. `src/render/patientView.ts` was rewritten. Every patient now has a head with a front face patch (blink, talk and stare states), nose, ears, hair or hat or headscarf or veil, neck, coat with lapels and buttons, shoulders, two-segment arms with hands, and a prop (umbrella, ceramic goose, red knitted cap, folder). Looks are seeded from the patient. The Understudy gets greyer skin, bigger eyes, a wider smile, no blinking from stage 2, longer arms from stage 3. Cast notes are in `docs/generated/CHARACTERS.md`.
2. UI and fonts. `src/ui/style.css`, `src/ui/hud.ts` and the title sheet were redone as 1963 paperwork. Fonts are bundled through `@fontsource` (Special Elite, IM Fell English, Reenie Beanie, VT323). The slip is a typed form with a clip and a RECEIVED stamp. The ledger is a phosphor screen. Notes are pencil. Verdicts are rubber stamps. The 3D CRT and slip canvases use the same fonts.
3. Movement (from the research). Crouch (C or Ctrl) with slower speed and quieter steps. Head bob that depends on walk, sprint and crouch. Right mouse zoom (leans toward the glass when seated). Stamina that waits 1.6 seconds before it regenerates. Footsteps differ on wood and tile.
4. New mechanic, the stare rule. Some patients hold your eye for four to six seconds, the room goes quiet and a thin tone rises. Eye contact with an Understudy costs nerves and spikes fear. Look away, or press C to duck under the sill (the patient's patience drains slowly while you hide). The humming man stares too and is harmless, so the rule is learned safely first. Code: `runStare` in `src/sim/simulation.ts`.
5. Story. Staff beats moved to `src/data/story.ts` (twelve beats, several arrive as phone calls with a ring first). See `docs/generated/STORY_BIBLE.md`.
6. Sound. New procedural sounds in `src/audio/engine.ts` and cues in `src/sim/director.ts`: music box that runs down faster as the Understudy learns, breathing behind you, scratching in the walls, knuckle taps on the glass, door knob rattle, chair creak behind you, steps overhead, pipe knock, a child humming the music box tune, a wheelchair rolling in the dark, a low sting when the Understudy gains a stage, a tension riser into each peak, the stare drone, radio key-up squelch, relay clicks and tube strikes on power loss and return, wood ticks as the building settles, typewriter clacks, a carriage bell on ledger lookup.
7. Tests. 20 unit tests (`npm test`), including stare rule and story beats.

## Honest status

Verified headless (software GL): build, typecheck, tests, no console errors, the desk, patient, breaker and title screens render, close-ups of all seven archetypes render.

Not verified: any sound (nobody has listened), frame rate on the real laptop, pointer lock and walking feel, the finale, the end screen, the new crouch and zoom feel, how the stare rule plays over a full shift. Treat all of that as untested.

## What is left, in priority order

1. **Play it and fix what is wrong.** Run `npm run dev`, play a whole shift on the laptop, listen to every new sound, and adjust levels and timing. Write down what felt flat.
2. **Make the characters actually good.** The procedural dolls are readable but they are still dolls. Next step: model real GLB characters in Blender (the owner has a Blender MCP available on the PC), with proper faces, hands, clothing folds and hair, and load them with `GLTFLoader`. Keep the draw-call count low. Keep the face states (open, blink, talk, stare) as morph targets or swapped textures. Eye gaze that follows the camera. More variants per archetype so the same face does not come twice. Idle and talk animations that differ per person.
3. **Replace the stylised speech blips.** Characters currently speak through a synthesised blip voice. Record or generate real voices, or build a much better formant synth, with per-character tone. Keep subtitles.
4. **Flesh out the mechanics.** Today the loop is: look at slip, ask five questions, check ledger, study face, decide. It needs more to do. Ideas that fit the research: the desk phone (answer or let ring, with consequences), a ward bell, a key cabinet, a stamp pad you must reload, a ledger book you can write in, batteries for the flashlight, hiding spots beyond the desk, a way to check the gate camera, and a visible Ward B board that shows the count you have admitted. Every new tool needs a use in both safe and tense moments.
5. **Finish the story.** Write all three endings (see `STORY_BIBLE.md`), the ledger entry 000 reveal as a proper scene, more staff calls, and a reason to play Night 01. Add voiced or text-only sketches of what the Ward does with the people you admit.
6. **Visual polish without touching the locked map.** Character lighting and rim light, wet look on coats, a better glass shader, rain on the window. Do not change booth, hall or corridor geometry unless the owner asks.
7. **Audio pass.** Build a proper timeline as in the research ("audio first, rising fractal tension curve"). Layer real foley if the owner supplies it. Mix levels per zone. Add a reduced-intensity setting.
8. **Settings and accessibility.** Volume, mouse sensitivity, subtitle size, flicker and flash reduction. Required before any public demo.
9. **Performance.** Bundle is about 5 MB because Rapier's WASM is inlined. Split it behind the title screen. Measure on the real laptop. Keep the adaptive render scale.
10. **Release prep.** itch.io demo page, trailer capture, wishlist target. Multiplayer is gated at 10,000 Steam wishlists. Keep `src/sim` free of DOM and Three.js so co-op stays possible.

## How to check your work

    npm install
    npm run typecheck
    npm test
    npm run build
    node tools/smoke.mjs .work       # headless screenshots, needs Chromium
    node tools/inspect.mjs .work     # close-ups of every archetype

Set `CHROMIUM` if Chromium is not at `/opt/pw-browsers/chromium`. Headless frame times mean nothing for real hardware.

URL options: `?seed=7` fixes the shift, `?autostart` skips the title, `?fast=6` runs the clock faster. In the console, `window.__game` exposes the game for testing.

## Where things live

| Area | Files |
|---|---|
| Simulation (no DOM, no Three.js) | `src/sim/*`, `src/core/*`, `src/data/*` |
| Characters | `src/render/patientView.ts` |
| Map (locked) | `src/render/environment.ts`, `src/render/materials.ts` |
| Post processing | `src/render/post.ts` |
| Sound | `src/audio/engine.ts` |
| Player | `src/player/controller.ts` |
| UI and fonts | `src/ui/*` |
| Orchestration | `src/game.ts` |
| Research notes | `docs/generated/SOURCE_INDEX.md` |

## Research reminders worth reusing

The movement tutorials (modular toggles per feature, crouch with a ceiling check, head bob with separate speed and amount per state, slope sliding, zoom, interaction with focus and lose-focus, footsteps by surface and by state, stamina with a regeneration delay, doors that open away from the player) are all Unity, but the ideas carry over. Crouch ceiling checks, slope sliding, surface-based footsteps beyond wood and tile, and interaction focus highlights are not done yet. The horror notes say: audio first, add and remove ambience to build tension, no screamers, strategic silence, distorted happy music for contrast, safe places that erode slowly, show less than you want to, one consistent art style, mundane things twisted for the uncanny.
