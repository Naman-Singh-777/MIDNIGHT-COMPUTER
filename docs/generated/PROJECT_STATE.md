# Project state

Game: Asylum Intake: The Midnight Shift. Web build with TypeScript, Three.js, Vite and Rapier 3D. No React Three Fiber, because the game has one scene and one camera and a scene graph wrapper adds nothing.

## What works (verified)

Checked by `npm run typecheck`, `npm test`, `npm run build` and `node tools/smoke.mjs` (headless Chromium, software GL):

1. Typecheck is clean and 20 simulation tests pass.
2. The production build succeeds. The JS bundle is about 4.9 MB (1.8 MB gzip), mostly the inlined Rapier WASM. Code splitting is a later task.
3. The page loads with no console errors in desktop and phone viewports.
4. A patient reaches the window, the slip card fills in, and keyboard input (1, 2, Z, A) asks, looks up and decides.
5. The breaker trips at 23:45 game time (minute 105). The corridor lights go red. The breaker prompt appears. Restoring power works.

## Added in the second round

Detailed patient models, period fonts and paperwork UI, crouch and zoom and head bob, the stare rule, twelve story beats with phone calls, and about fifteen new procedural sounds. See `docs/HANDOFF_FOR_OPUS.md` for the full list and what is next.

## What is not verified

1. Frame rate on real hardware. Headless software GL runs at about 55 ms per frame, which says nothing about an Iris Xe.
2. Audio. WebAudio needs a user gesture and real output, so nothing was listened to, including every sound added in round two.
3. Pointer lock, walking feel, sprint and stamina by hand.
4. The finale at minute 268 and the end screen were not played through in the browser. The simulation tests cover shift end only.
5. The patient face texture orientation looks right in one screenshot. Other face marks have not been inspected.

## Architecture

1. `src/sim` is pure TypeScript with a seeded RNG, an event bus and a fixed clock. It has no DOM or Three.js imports. This keeps co-op possible later.
2. `src/render`, `src/audio`, `src/ui` and `src/player` read sim state and react to sim events. Hallucinations use a separate presentation RNG, so they never change what is true.
3. `src/physics` wraps Rapier: static boxes, dynamic props and a kinematic character controller.
4. All textures and sounds are generated at runtime. There are no asset files.

## Next highest value

1. Play the whole shift in a real browser on the target laptop and tune pacing.
2. Add the Understudy's visible escalation in the booth (stage 3 and up) so the lamp betrayal is felt.
3. Split the bundle so the title screen loads before the WASM.
4. Itch.io demo build and a store page draft, then the 10,000 wishlist gate for multiplayer.
