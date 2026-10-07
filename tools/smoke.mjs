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
  const p = await open('desk', 1280, 720, '?seed=7&autostart');
  const n = await advanceUntil(p, "s.phase==='present'");
  console.log('steps until first patient present:', n);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/desk-patient.png` });
  console.log('perf', JSON.stringify(await p.evaluate(() => ({ ...window.__game.debug, frameMs: window.__game.frameMs }))));

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
