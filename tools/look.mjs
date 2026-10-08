// Headless renders for review: named cast full body, a fake at the glass, the desk, the tall one. Software GL.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.work';
const srv = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:4177/?seed=3&autostart', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.evaluate(() => {
  const g = window.__game;
  g.running = false;
  document.querySelectorAll('#desk,#cards,#ledgerwrap,#subtitle,#clock,#bars').forEach((e) => (e.style.display = 'none'));
});
const shot = async (name, fn, arg) => {
  await page.evaluate(fn, arg);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png` });
};
for (const id of (process.argv[3] ?? 'walter,dolly,bernard,penhale,rosa,gus').split(',')) {
  await shot(`cast-${id}`, (id) => {
    const g = window.__game;
    const fake = id === 'mother';
    const p = { id: 'T', archetype: fake ? 'fluent_mimic' : 'plain', truth: fake ? 'understudy' : 'human', registryId: fake ? 'R209' : 'C_' + id, castId: fake ? undefined : id, displayName: id, docs: {}, faceMark: 'a scar over the left brow', answers: {}, tells: [], quirk: '', hue: 0.3, height: 1, sprite: 0 };
    g.view.setPatient(p, 3);
    g.view.group.position.set(0, 0, -2.45);
    g.sim.state.phase = 'present';
    const c = g.player.camera;
    c.position.set(0.15, 1.15, -1.32);
    c.fov = 72; c.updateProjectionMatrix();
    c.lookAt(0, 0.95, -2.45);
    g.player.update = () => {};
  }, id);
}
// close-ups and angles for clipping checks
for (const [id, ang, dist, y, name] of [['walter', 0, 0.5, 1.52, 'face-walter'], ['dolly', 0.5, 0.55, 1.5, 'face-dolly'], ['gus', 0, 0.5, 1.6, 'face-gus'], ['rosa', 1.57, 2.2, 0.95, 'side-rosa'], ['marsh', 2.6, 2.2, 0.95, 'back-marsh'], ['bernard', 0.8, 2.0, 0.95, 'q-bernard']]) {
  await shot(name, ([id, ang, dist, y]) => {
    const g = window.__game;
    const p = { id: 'T', archetype: 'plain', truth: 'human', registryId: 'C_' + id, castId: id, displayName: id, docs: {}, faceMark: 'a scar over the left brow', answers: {}, tells: [], quirk: '', hue: 0.3, height: 1, sprite: 0 };
    g.view.setPatient(p, 0);
    g.sim.state.phase = 'present';
    g.view.group.position.set(0, 0, -4.6);
    const c = g.player.camera;
    c.position.set(Math.sin(ang) * dist, y, -2.45 + Math.cos(ang) * dist);
    c.fov = 50; c.updateProjectionMatrix();
    c.lookAt(0, y > 1.2 ? y - 0.02 : 0.95, -2.45);
  }, [id, ang, dist, y]);
}
await shot('desk', () => {
  const g = window.__game;
  g.view.setPatient(null);
  const c = g.player.camera;
  c.position.set(0.0, 1.35, 0.35);
  c.fov = 62; c.updateProjectionMatrix();
  c.lookAt(0, 0.85, -0.9);
});
await shot('tall-one', () => {
  const g = window.__game;
  g.sim.stalker.summon(7.5);
  g.sim.stalker.mode = 'listen';
  const c = g.player.camera;
  c.position.set(3.2, 1.5, 0.9);
  c.fov = 60; c.updateProjectionMatrix();
  c.lookAt(7.5, 1.5, 0.95);
  g.flashlightOn = true;
  g.running = true;
});
await browser.close();
srv.kill();
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok');
