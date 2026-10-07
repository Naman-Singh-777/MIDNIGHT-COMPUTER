// Headless smoke test. Software GL, so frame times here say nothing about real hardware.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4173;
const out = process.argv[2] ?? '.work';
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const errors = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const base = `http://localhost:${PORT}/`;

async function open(name, w, h, query) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()} ${m.location().url}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror ${e.message}`));
  await page.goto(base + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  return page;
}
// advance the sim without waiting on slow software rendering
const advanceUntil = (page, cond, maxSteps = 4000) =>
  page.evaluate(([c, m]) => {
    const g = window.__game;
    const f = new Function('s', `return ${c}`);
    for (let i = 0; i < m; i++) { if (f(g.sim.state)) return i; g.sim.tick(0.5); }
    return -1;
  }, [cond, maxSteps]);

try {
  const t = await open('title', 1280, 720, '?seed=7');
  await t.waitForTimeout(1500);
  await t.screenshot({ path: `${out}/title.png` });
  await t.close();
  const p = await open('desk', 1280, 720, '?seed=7&autostart');
  const n = await advanceUntil(p, "s.phase==='present'");
  console.log('steps until first patient present:', n);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/desk-patient.png` });
  console.log('perf', JSON.stringify(await p.evaluate(() => ({ ...window.__game.debug, frameMs: window.__game.frameMs }))));

  // duck under the sill, then lean in
  const y0 = await p.evaluate(() => window.__game.player.camera.position.y);
  await p.keyboard.down('KeyC');
  await p.waitForTimeout(2500);
  const y1 = await p.evaluate(() => window.__game.player.camera.position.y);
  await p.screenshot({ path: `${out}/duck.png` });
  await p.keyboard.up('KeyC');
  await p.mouse.move(640, 360);
  await p.mouse.down({ button: 'right' });
  await p.waitForTimeout(2500);
  const fov = await p.evaluate(() => window.__game.player.camera.fov);
  await p.mouse.up({ button: 'right' });
  console.log('eye height seated', y0.toFixed(2), 'ducked', y1.toFixed(2), 'zoom fov', fov.toFixed(1));
  // every new sound must at least run without throwing (nobody can listen headless)
  const audioErrs = await p.evaluate(() => {
    const a = window.__game.audio;
    const bad = [];
    try { a.start(); } catch (e) { bad.push('start ' + e.message); }
    const pos = { x: 1, y: 1, z: 0 };
    const calls = {
      musicBox: () => a.musicBox(pos, 3), breathBehind: () => a.breathBehind(), scratch: () => a.scratch(pos), windowTap: () => a.windowTap(pos),
      knobRattle: () => a.knobRattle(pos), chairCreak: () => a.chairCreak(), overheadSteps: () => a.overheadSteps(), pipeKnock: () => a.pipeKnock(pos),
      childHum: () => a.childHum(pos), wheelchair: () => a.wheelchair(pos), stageUp: () => a.stageUp(0.5), riser: () => a.riser(1), stareOn: () => a.stareOn(),
      stareOff: () => a.stareOff(false), stareHit: () => a.stareHit(), clack: () => a.clack(), ding: () => a.ding(), paper: () => a.paper(), powerDown: () => a.powerDown(),
      powerUp: () => a.powerUp(), walk: () => { a.walk(2, false, false); a.walk(2, true, true); }, speak: () => a.speak('Mind the ledger, love.', 200, true),
    };
    for (const [k, f] of Object.entries(calls)) { try { f(); } catch (e) { bad.push(k + ': ' + e.message); } }
    return bad;
  });
  console.log('audio calls:', audioErrs.length ? audioErrs.join(' | ') : 'all ran without throwing');
  // real keyboard path: ask, look up, decide
  await p.keyboard.press('Digit1'); await p.keyboard.press('Digit2'); await p.keyboard.press('KeyZ');
  const before = await p.evaluate(() => window.__game.sim.state.history.length);
  await p.keyboard.press('KeyA');
  const after = await p.evaluate(() => ({ h: window.__game.sim.state.history.length, phase: window.__game.sim.state.phase, power: window.__game.sim.state.powerOn }));
  console.log('verdict via key:', before, '->', JSON.stringify(after));

  // breaker trip, walk the corridor, restore
  await advanceUntil(p, 's.breakerTripped');
  const tripped = await p.evaluate(() => ({ min: window.__game.sim.state.minute, power: window.__game.sim.state.powerOn }));
  console.log('breaker tripped', JSON.stringify(tripped));
  await p.keyboard.press('KeyQ');
  await p.evaluate(() => window.__game.player.rig.body.setTranslation({ x: 11.5, y: 0.86, z: 0.9 }, true));
  await p.evaluate(() => { window.__game.player.yaw = -Math.PI / 2; });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/corridor-dark.png` });
  await p.evaluate(() => window.__game.player.rig.body.setTranslation({ x: 13.4, y: 0.86, z: 0.9 }, true));
  await p.waitForTimeout(1500);
  const restored = await p.evaluate(() => { const g = window.__game; const ok = g.sim.restorePower(); return { ok, zone: g.sim.state.zone, power: g.sim.state.powerOn }; });
  console.log('restore', JSON.stringify(restored));
  await p.close();

  const ph = await open('phone', 390, 844, '?seed=7&autostart');
  await advanceUntil(ph, "s.phase==='present'");
  await ph.waitForTimeout(5000);
  await ph.screenshot({ path: `${out}/phone-patient.png` });
  await ph.close();
} finally {
  await browser.close();
  srv.kill();
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
