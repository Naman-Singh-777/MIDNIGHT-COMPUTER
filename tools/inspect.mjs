// Close-up renders of every archetype for visual review. Headless, software GL.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.work';
const only = process.argv[3];
const srv = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:4174/?seed=3&autostart', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
const kinds = [['plain','human',0],['chatty','human',0],['strange_innocent','human',0],['tragic','human',0],['slipping_mimic','understudy',4],['fluent_mimic','understudy',6],['voice_mimic','understudy',7]];
for (const [arch, truth, stage] of kinds) {
  if (only && only !== arch) continue;
  for (const variant of [0, 1]) {
    await page.evaluate(([arch, truth, stage, variant]) => {
      const g = window.__game;
      g.player.update = () => {};
      g.hud.setMode?.(false);
      const names = variant ? 'Edith Quill' : 'Walter Quill';
      const p = { id: 'T', archetype: arch, truth, registryId: 'R001', displayName: names, docs: {}, faceMark: 'a scar over the left brow', answers: {}, tells: [], quirk: '', hue: variant ? 0.62 : 0.17, height: 1, sprite: variant };
      g.view.setPatient(p, stage);
      g.view.group.position.set(0, 0, -2.45);
      g.sim.state.phase = 'present';
      const c = g.player.camera;
      c.position.set(0.05, 1.5, -1.35);
      c.rotation.set(0, 0, 0);
      c.fov = 38; c.updateProjectionMatrix();
      c.lookAt(0, 1.4, -2.45);
      document.querySelectorAll('#hud,#desk,#cards,#subtitle').forEach((e) => (e.style.display = 'none'));
    }, [arch, truth, stage, variant]);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/char-${arch}-${variant}.png` });
  }
}
await browser.close();
srv.kill();
console.log(errs.length ? 'ERRORS ' + errs.join('|') : 'ok');
