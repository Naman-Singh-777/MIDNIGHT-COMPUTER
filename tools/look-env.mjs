// Review renders of the desk, the telephone, the glass and the corridor. Headless software GL, not real hardware.
// node tools/look-env.mjs <outdir> [names]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.work';
const only = process.argv[3]?.split(',');
const port = 4186;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${port}/?seed=3&autostart`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.evaluate(() => {
  const g = window.__game;
  g.running = false;
  g.player.update = () => {};
  g.view.setPatient(null);
  for (const e of document.querySelectorAll('body *')) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
});
// [camera, look at, fov]
const shots = {
  desk: [[0, 1.35, 0.35], [0, 0.85, -0.9], 62],
  deskwide: [[0.2, 1.5, 1.2], [0, 0.9, -1.0], 70],
  phone: [[-0.22, 1.02, -0.55], [-0.3, 0.84, -0.9], 40],
  phoneside: [[0.05, 0.92, -0.85], [-0.3, 0.85, -0.92], 40],
  phonetop: [[-0.28, 1.25, -0.82], [-0.3, 0.8, -0.91], 40],
  phoneplayer: [[0, 1.28, 0.1], [-0.3, 0.85, -0.9], 40],
  glass: [[0.3, 1.4, -0.3], [0, 1.5, -1.3], 60],
  corridor: [[2.4, 1.6, 0.9], [13, 1.5, 0.95], 65],
  corridorwall: [[3.0, 1.4, 1.3], [5.5, 1.2, -0.1], 65],
  corridorfloor: [[4.0, 1.5, 0.9], [7.5, 0.0, 0.9], 65],
  corridorfar: [[6.5, 1.6, 0.9], [14, 1.5, 0.95], 50],
};
for (const [name, [cam, tgt, fov]] of Object.entries(shots)) {
  if (only && !only.includes(name)) continue;
  await page.evaluate(([cam, tgt, fov]) => {
    const c = window.__game.player.camera;
    c.position.set(...cam);
    c.fov = fov;
    c.updateProjectionMatrix();
    c.lookAt(...tgt);
  }, [cam, tgt, fov]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/env-${name}.png` });
}
await browser.close();
process.kill(-srv.pid);
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok');
