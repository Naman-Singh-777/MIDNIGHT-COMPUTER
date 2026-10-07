# Working notes for Claude

Project: Asylum Intake: The Midnight Shift. Web horror game. TypeScript, Three.js, Vite, Rapier.

Rules:
1. Build only in this folder. `C:\GameDev\Midnight` (Unity) is out of scope. `C:\GameDev\MIDNIGHT RESEARCH` is read only.
2. Map lock: change only the system in scope. Leave nearby problems alone and list them in `docs/generated/DESIGN_GAPS_AND_IMPROVEMENTS.md`.
3. The user is the only author. Commit as the user's git identity. No co-author trailers, no session links, no "generated with" lines.
4. Write all text (docs, UI copy, commit messages) in plain language. No em or en dashes, no filler.
5. Report only what was verified. Say whether a check ran headless or on real hardware.
6. Keep `src/sim` free of DOM and Three.js imports.
7. Never toggle light `visible` at runtime. Set intensity to 0.
8. Before finishing a change: `npm run typecheck`, `npm test`, `npm run build`, `node tools/smoke.mjs`.
9. Remote: https://github.com/Naman-Singh-777/MIDNIGHT-COMPUTER. Use `git pull --ff-only` before pushing and confirm origin/main equals HEAD afterward. Never force push.
10. Read `docs/HANDOFF_FOR_OPUS.md` first. It lists what is done and what is left.
11. Full status and roadmap: `docs/PROJECT_REPORT_AND_ROADMAP.md`. Read it with the handoff.
