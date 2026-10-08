// Review renders of the tall one inside the real corridor: far, middle, close, under the ceiling, by a door, and its
// states (dormant, watching, wrong, search, locked, burst, walking, walking away). node tools/look-creature.mjs <outdir>
// Headless software GL, not real hardware.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.work';
const only = process.argv[3]?.split(',');
const port = 4185;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${port}/?seed=3&autostart`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game && window.__game.view.humanReady, null, { timeout: 60000 });
await page.evaluate(() => {
  const g = window.__game;
  g.running = false;
  g.player.update = () => {};
  for (const e of document.querySelectorAll('body *')) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
});
// name: [creature x, mode, frames of animation, walk speed (m/s), camera position, look at, fov]
const shots = {
  far: [13.2, 'listen', 60, 0, [2.4, 1.6, 0.9], [13, 1.6, 0.95], 60],
  mid: [8.2, 'roam', 40, 0, [2.4, 1.6, 0.9], [8, 1.7, 0.95], 60],
  close: [4.6, 'locked', 30, 0, [2.3, 1.55, 0.9], [4.6, 2.1, 0.95], 70],
  ceiling: [6.5, 'listen', 40, 0, [3.2, 1.2, 1.6], [6.5, 2.0, 0.9], 70],
  door: [5.5, 'roam', 40, 0, [2.6, 1.5, 1.5], [5.5, 1.4, 0.4], 62],
  face: [4.2, 'listen', 30, 0, [3.0, 2.45, 0.95], [4.2, 2.45, 0.95], 45],
  portrait: [4.4, 'door', 30, 0, [3.05, 2.15, 0.95], [4.4, 2.05, 0.95], 50],
  hands: [4.5, 'listen', 30, 0, [3.4, 1.0, 1.4], [4.5, 0.8, 0.95], 50],
  walking: [7.0, 'roam', 50, 0.6, [6.8, 1.4, 1.75], [7.4, 1.3, 0.9], 70],
  away: [7.0, 'roam', 50, 0.7, [2.4, 1.6, 0.9], [7.6, 1.8, 0.95], 60],
  search: [6.0, 'search', 70, 0, [2.6, 1.6, 0.9], [6, 1.8, 0.95], 60],
  hunt: [5.0, 'hunt', 40, -0.8, [2.4, 1.6, 0.9], [5, 1.6, 0.95], 65],
  wrong: [6.0, 'listen', 140, 0, [2.6, 1.6, 0.9], [6, 2.0, 0.95], 55],
};
for (const [name, [x, mode, frames, v, cam, tgt, fov]] of Object.entries(shots)) {
  if (only && !only.includes(name)) continue;
  await page.evaluate(([x, mode, frames, v, cam, tgt, fov]) => {
    const g = window.__game;
    const cr = g.creature;
    const c = g.player.camera;
    c.position.set(...cam);
    c.fov = fov;
    c.updateProjectionMatrix();
    c.lookAt(...tgt);
    const m = mode === 'locked' ? 'door' : mode;
    let px = x - v * frames * 0.033;
    cr.lastX = px;
    for (let i = 0; i < frames; i++) {
      px += v * 0.033;
      cr.update(0.033, true, px, 0.95, m, c.position);
    }
    window.__hold = [px, m];
    // keep it where it was posed while the page renders
    const up = cr.update.bind(cr);
    cr.update = (dt, on, xx, zz, mm, pl) => up(0.0001, true, window.__hold[0], 0.95, window.__hold[1], pl);
    window.__restore = () => (cr.update = up);
  }, [x, mode, frames, v, cam, tgt, fov]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/creature-${name}.png` });
  await page.evaluate(() => window.__restore());
}
await browser.close();
process.kill(-srv.pid);
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok');
