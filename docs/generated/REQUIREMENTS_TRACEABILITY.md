# Requirements traceability

| Requirement | Where | Status |
|---|---|---|
| Web stack: TS, Three.js, Vite, Rapier | package.json | done |
| Sim separate from presentation | src/sim, tests/sim.test.ts | done, tested |
| Core loop task, observation, suspicion, decision, consequence | src/sim/simulation.ts | done |
| Not a scan and impostor game | five questions, ledger, face, power, lever | done |
| Evolving entity | Understudy stages 0 to 7, tells | sim done, visual escalation partial |
| Pacing director with quiet windows | src/sim/director.ts | done, tested |
| Adaptive audio | src/audio/engine.ts | written, not heard |
| Safe space subverted | lamp honest early, unreliable at stage 3 and up | sim done, visual partial |
| Three layer story | Imogen, Pell, Kessler lines, final entry hook | partial |
| Voice mimic | finale R900 Sister Imogen | done in sim |
| Mid fidelity stylized look | procedural textures, one post pass | done |
| Low end hardware | adaptive scale, merged batches | not measured on real hardware |
| User is sole git author | commit identity, no trailers | see git log on the PC |
| Browser self evaluation | tools/smoke.mjs | headless only |
| Multiplayer after 10,000 wishlists | architecture only | gated |
