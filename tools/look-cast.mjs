// Character review renders: each named visitor from several angles, in the hall light where they stand at the glass.
// node tools/look-cast.mjs <outdir> walter,rosa,...   Software GL (SwiftShader), so this is a headless check, not real hardware.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.work';
const ids = (process.argv[3] ?? 'walter,rosa,hester,penhale,dolly,ivor').split(',');
const views = (process.argv[4] ?? 'player,front,q,side,back,face,faceq,faceside').split(',');
const port = 4179;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${port}/?seed=3&autostart${process.env.QUERY ?? ''}${process.env.HASH ?? ''}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
const ok = process.env.QUERY ? false : await page.waitForFunction(() => window.__game.view.humanReady, null, { timeout: 60000 }).then(() => true, () => false);
if (!ok) console.log('authored bodies did not load');
await page.evaluate(() => {
  const g = window.__game;
  g.running = false;
  for (const e of document.querySelectorAll('body *')) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  g.player.update = () => {};
  if (location.hash.includes('hairdbg')) globalThis.__HAIRDBG = true;
  if (location.hash.includes('mdbg')) globalThis.__MDBG = true;
  globalThis.__DBG = decodeURIComponent(location.hash);
});
// [angle around the visitor, distance, camera height, look-at height, fov]
const V = {
  front: [0, 2.6, 1.15, 0.9, 42],
  q: [0.7, 2.6, 1.2, 0.9, 42],
  side: [1.57, 2.6, 1.15, 0.9, 42],
  back: [3.14, 2.6, 1.2, 0.9, 42],
  face: [0, 0.62, 0, 0, 30],
  faceq: [0.6, 0.62, 0, 0, 30],
  faceside: [1.5, 0.62, 0, 0, 30],
  head: [0.9, 0.9, 0, 0, 36],
  hand: [0.5, 0.5, 0, 0, 40],
  chest: [0.25, 1.3, 1.25, 1.2, 32],
  legs: [0.35, 1.5, 0.6, 0.5, 40],
  legside: [1.4, 1.5, 0.6, 0.5, 40],
  headback: [2.6, 0.9, 0, 0, 36],
  player: [0, 0, 0, 0, 55], // from the chair in the booth, through the glass, as the game shows it
};
for (const id of ids) {
  for (const v of views) {
    const [ang, dist, cy, ty, fov] = V[v];
    await page.evaluate(([id, ang, dist, cy, ty, fov, close]) => {
      const g = window.__game;
      const reveal = id.startsWith('reveal:');
      const fake = id.startsWith('fake:') || reveal;
      const at0 = id.indexOf('@');
      const cid = (fake ? id.slice(id.indexOf(':') + 1) : id).split('@')[0];
      const p = { id: 'T', archetype: cid === 'sister' ? 'voice_mimic' : 'plain', truth: fake ? 'understudy' : 'human', registryId: cid === 'ada' ? 'R209' : 'C_' + cid, castId: cid, displayName: cid, docs: {}, faceMark: '', answers: {}, tells: [], quirk: '', hue: at0 > 0 ? Number(id.slice(at0 + 1)) : cid.startsWith('rand') ? (Number(cid.slice(4)) * 0.137) % 1 : 0.37, height: 1 + (cid.startsWith('rand') ? Number(cid.slice(4)) * 0.01 : 0), sprite: cid.startsWith('rand') ? Number(cid.slice(4)) : 0 };
      if (window.__lastId !== id) {
        g.view.setPatient(p, fake ? 3 : 0);
        window.__lastId = id;
        if (location.hash.includes('redhair')) g.view.human.root.traverse((o) => { if (o.material && o.material.alphaMap) { o.material.color.setRGB(1, 0, 0); if (location.hash.includes('noat')) o.material.alphaTest = 0; o.material.needsUpdate = true; } });
      }
      g.sim.state.phase = 'present';
      g.view.revealing = reveal ? 1000 : 0;
      g.view.setStare(false);
      const at = { x: 0, z: close || dist === 0 ? -2.45 : -3.9 }; // full body further back so the glass is not in the way
      g.view.stand.set(at.x, 0, at.z); // present phase holds them on this spot
      g.view.group.position.set(at.x, 0, at.z);
      g.view.update(0.016, 'present', g.player.camera.position, true);
      if (g.view.human && /open|noteeth|hide|nopuff|onlybody|nospec|nomouth/.test(location.hash)) {
        const dr = g.view.drive;
        g.view.drive = function (...a) {
          dr.apply(this, a);
          if (location.hash.includes('open')) { this.human.setExpr('mouthOpen', 0.7); this.human.jaw.rotation.x = 0.1; }
          if (location.hash.includes('nospec')) this.human.root.traverse((o) => { if (o.material && o.material.isMeshPhysicalMaterial) { o.material.specularIntensity = 0; o.material.sheen = 0; } });
          if (location.hash.includes('onlybody')) this.human.root.children.forEach((m) => { if (m.isSkinnedMesh && !m.geometry.morphAttributes.position) m.visible = false; });
          const hm = /hide=(\d+)/.exec(location.hash);
          if (hm) this.human.root.children.filter((m) => m.isSkinnedMesh)[Number(hm[1])].visible = false;
          if (location.hash.includes('nopuff')) this.puffs.forEach((p) => (p.visible = false));
          if (location.hash.includes('nomouthparts')) for (const m of this.human.mouthParts) m.visible = false;
          if (location.hash.includes('noteeth')) this.human.root.traverse((o) => { if (Array.isArray(o.material)) o.material[1].visible = false; });
        };
      }
      g.view.group.updateMatrixWorld(true);
      const c = g.player.camera;
      let y = cy, tyy = ty;
      if (close) {
        // the face: find the head bone
        const h = g.view.human;
        const v3 = h ? (close === 'hand' ? h.arms[1].hand : h.eyes[0].holder).getWorldPosition(c.position.clone()) : c.position.clone().set(0, 1.55, at.z);
        y = v3.y + 0.01;
        tyy = v3.y - 0.03;
        if (close === 'hand') {
          at.x = v3.x;
          at.z = v3.z;
          tyy = v3.y - 0.05;
        }
      }
      c.position.set(at.x + Math.sin(ang) * dist, y, at.z + Math.cos(ang) * dist);
      c.fov = fov;
      c.updateProjectionMatrix();
      c.lookAt(at.x, tyy, at.z);
      if (dist === 0) {
        c.position.set(0, 1.42, 0.35);
        c.lookAt(0, 1.25, at.z);
      }
    }, [id, ang, dist, cy, ty, fov, v.startsWith('face') || v.startsWith('head') ? 'face' : v === 'hand' ? 'hand' : '']);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${id.replace(':', '-').replace('@', '_')}-${v}.png` });
  }
}
await browser.close();
process.kill(-srv.pid);
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok');
