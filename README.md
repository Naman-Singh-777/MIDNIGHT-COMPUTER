# Asylum Intake: The Midnight Shift

You work the night intake window at Vesper Hollow Sanatorium, October 1963. Check each admission slip against the ledger, ask five questions, then decide. Something in the queue is borrowing faces.

## Run it

    npm install
    npm run dev

Open the printed address. Click Begin.

## Controls

Desk: 1 to 5 ask, Z ledger lookup, X study the face, A admit, O hold, R refuse, L pull the lever, C duck under the sill, right mouse leans in, Q stand up.
Floor: WASD move, Shift sprint, C crouch, right mouse zoom, E interact (hold at the breaker), F flashlight, Q sit.
F3 shows the performance panel. M mutes.

URL options: `?seed=7` fixes the shift, `?autostart` skips the title, `?fast=6` speeds the clock.

## Checks

    npm run typecheck
    npm test
    npm run build
    npm run e2e

`npm run e2e` needs a Chromium. Set `CHROMIUM` to its path if it is not at `/opt/pw-browsers/chromium`.
