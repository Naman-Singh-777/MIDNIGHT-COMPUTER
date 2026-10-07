import * as THREE from 'three';

/** Every texture in the game is drawn here at load. No downloads, no licences. */
function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, seed = 1): void {
  const img = ctx.getImageData(0, 0, size, size);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 9301 + 49297) % 233280;
    const n = (s / 233280 - 0.5) * amount;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function tex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}

/** Seeded so the building looks the same every night. */
function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function smudge(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number, sy = 1): void {
  g.save();
  g.translate(x, y);
  g.scale(1, sy);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, color.replace('A', String(a)));
  gr.addColorStop(1, color.replace('A', '0'));
  g.fillStyle = gr;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
}

/** Floorboards: grain, knots, worn varnish down the middle of each board, nail heads, old scratches. */
function wood(): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = canvas(S);
  const R = rand(11);
  const boards = 6;
  const bw = S / boards;
  for (let b = 0; b < boards; b++) {
    const tone = 62 + R() * 26;
    for (let x = 0; x < bw; x++) {
      for (let y = 0; y < S; y += 2) {
        const grain = Math.sin((x + b * 13) * 0.55 + Math.sin(y * 0.018 + b) * 4 + Math.sin(y * 0.003) * 9) * 9 + Math.sin(x * 2.3 + y * 0.01) * 3;
        const v = tone + grain;
        g.fillStyle = `rgb(${v + 24 | 0},${v - 4 | 0},${v - 34 | 0})`;
        g.fillRect(b * bw + x, y, 1, 2);
      }
    }
    // worn strip where feet go
    smudge(g, b * bw + bw / 2, S / 2, bw * 0.5, 'rgba(210,180,140,A)', 0.12, 6);
    // knots
    for (let k = 0; k < 2; k++) {
      const kx = b * bw + 12 + R() * (bw - 24);
      const ky = R() * S;
      smudge(g, kx, ky, 7 + R() * 6, 'rgba(30,14,6,A)', 0.8, 1.6);
      g.strokeStyle = 'rgba(40,20,8,0.35)';
      for (let r = 9; r < 22; r += 4) {
        g.beginPath();
        g.ellipse(kx, ky, r * 0.6, r * 1.6, 0, 0, 7);
        g.stroke();
      }
    }
    // seams and nails
    g.fillStyle = 'rgba(12,6,2,0.85)';
    g.fillRect(b * bw, 0, 2, S);
    const joint = R() * S;
    g.fillRect(b * bw, joint, bw, 2);
    g.fillStyle = 'rgba(30,30,30,0.9)';
    for (const ny of [joint - 8, joint + 10]) {
      g.fillRect(b * bw + 8, ny, 3, 3);
      g.fillRect(b * bw + bw - 11, ny, 3, 3);
    }
  }
  g.strokeStyle = 'rgba(230,210,180,0.12)';
  g.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const x = R() * S, y = R() * S, l = 10 + R() * 50, a = R() * 6.28;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 10; i++) smudge(g, R() * S, R() * S, 20 + R() * 50, 'rgba(15,8,4,A)', 0.25);
  noise(g, S, 14, 3);
  return tex(c, 1, 1);
}

/**
 * Painted plaster that has had forty winters: tide-mark water stains, hairline cracks,
 * paint flaking to the coat underneath, grime where hands and trolleys touch, mould specks.
 */
function plaster(base: string, grime = 0.25, seed = 5): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = canvas(S);
  const R = rand(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) smudge(g, R() * S, R() * S, 20 + R() * 90, 'rgba(30,24,16,A)', grime * 0.16);
  for (let i = 0; i < 40; i++) smudge(g, R() * S, R() * S, 10 + R() * 40, 'rgba(255,250,235,A)', 0.05);
  // water stains: a pale centre and a brown tide line
  for (let i = 0; i < 4; i++) {
    const x = R() * S, y = R() * S * 0.6, r = 30 + R() * 60;
    smudge(g, x, y + r * 0.6, r, 'rgba(120,90,40,A)', 0.14 * (0.5 + grime), 1.8);
    g.strokeStyle = `rgba(90,62,26,${0.25 + grime * 0.3})`;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let a = 0; a <= 6.3; a += 0.25) {
      const rr = r * (0.85 + R() * 0.25);
      const px = x + Math.cos(a) * rr, py = y + r * 0.6 + Math.sin(a) * rr * 1.8;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    // drips running down from it
    for (let k = 0; k < 4; k++) {
      const dx = x + (R() - 0.5) * r;
      const gr = g.createLinearGradient(0, y + r, 0, y + r + 60 + R() * 120);
      gr.addColorStop(0, 'rgba(90,62,26,0.3)');
      gr.addColorStop(1, 'rgba(90,62,26,0)');
      g.fillStyle = gr;
      g.fillRect(dx, y + r, 2 + R() * 2, 180);
    }
  }
  // flaking paint patches show the darker coat underneath
  for (let i = 0; i < 9; i++) {
    const x = R() * S, y = R() * S;
    g.fillStyle = 'rgba(70,62,50,0.35)';
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 9; k++) g.lineTo(x + (R() - 0.5) * 34, y + (R() - 0.5) * 26);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,250,235,0.35)';
    g.lineWidth = 1;
    g.stroke();
  }
  // cracks
  g.strokeStyle = 'rgba(25,18,12,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = R() * S, y = R() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 12; k++) {
      x += (R() - 0.5) * 22;
      y += 6 + R() * 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // mould specks clustered in one corner
  for (let i = 0; i < 260 * grime; i++) {
    const a = R() * 6.28, r = Math.pow(R(), 2) * 90;
    g.fillStyle = `rgba(30,36,22,${0.2 + R() * 0.4})`;
    g.fillRect(S * 0.85 + Math.cos(a) * r, S * 0.1 + Math.sin(a) * r, 1.5, 1.5);
  }
  noise(g, S, 12, seed);
  return tex(c, 1, 1);
}

/** Terrazzo-style tiles with dirty grout, chips, cracks, scuffs and a drying stain. */
function tile(a: string, b: string, seed = 9): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = canvas(S);
  const R = rand(seed);
  const n = 4;
  const ts = S / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * ts, y * ts, ts, ts);
      smudge(g, x * ts + ts / 2, y * ts + ts / 2, ts * 0.7, R() > 0.5 ? 'rgba(255,255,255,A)' : 'rgba(0,0,0,A)', 0.06 + R() * 0.06);
      for (let k = 0; k < 140; k++) {
        g.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '20,20,20'},${0.08 + R() * 0.12})`;
        g.fillRect(x * ts + R() * ts, y * ts + R() * ts, 1 + R() * 2, 1 + R() * 2);
      }
      if (R() < 0.18) {
        // a cracked tile
        g.strokeStyle = 'rgba(15,12,10,0.6)';
        g.beginPath();
        g.moveTo(x * ts + R() * ts, y * ts);
        g.lineTo(x * ts + R() * ts, y * ts + ts * 0.5);
        g.lineTo(x * ts + R() * ts, y * ts + ts);
        g.stroke();
      }
      if (R() < 0.25) {
        g.fillStyle = 'rgba(40,34,28,0.7)';
        g.beginPath();
        g.arc(x * ts + (R() > 0.5 ? 2 : ts - 2), y * ts + (R() > 0.5 ? 2 : ts - 2), 4 + R() * 6, 0, 7);
        g.fill();
      }
    }
  g.strokeStyle = 'rgba(28,24,18,0.85)';
  g.lineWidth = 4;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * ts, 0);
    g.lineTo(i * ts, S);
    g.moveTo(0, i * ts);
    g.lineTo(S, i * ts);
    g.stroke();
  }
  // scuffs from shoes and wheels
  g.strokeStyle = 'rgba(15,12,10,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = R() * S, y = R() * S;
    g.beginPath();
    g.arc(x, y, 20 + R() * 60, R() * 6, R() * 6 + 0.6);
    g.stroke();
  }
  smudge(g, S * 0.3, S * 0.7, 90, 'rgba(30,24,14,A)', 0.22, 0.6);
  for (let i = 0; i < 14; i++) smudge(g, R() * S, R() * S, 30 + R() * 70, 'rgba(20,16,10,A)', 0.14);
  noise(g, S, 12, seed);
  return tex(c, 1, 1);
}

export interface Mats {
  wood: THREE.MeshLambertMaterial;
  woodDark: THREE.MeshLambertMaterial;
  cream: THREE.MeshLambertMaterial;
  paintGreen: THREE.MeshLambertMaterial;
  tileHall: THREE.MeshLambertMaterial;
  tileCorr: THREE.MeshLambertMaterial;
  ceiling: THREE.MeshLambertMaterial;
  brass: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  rust: THREE.MeshLambertMaterial;
  paper: THREE.MeshLambertMaterial;
  glass: THREE.MeshPhongMaterial;
  black: THREE.MeshLambertMaterial;
  cloth: THREE.MeshLambertMaterial;
  skin: THREE.MeshLambertMaterial;
  emissiveWarm: THREE.MeshBasicMaterial;
}

const lam = (t: THREE.CanvasTexture): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ map: t, bumpMap: t, bumpScale: 0.8, color: 0xffffff });

export function makeMaterials(): Mats {
  const w = wood();
  return {
    wood: new THREE.MeshLambertMaterial({ map: w, bumpMap: w, bumpScale: 1.2, color: 0xd8b48a }),
    woodDark: new THREE.MeshLambertMaterial({ map: w, bumpMap: w, bumpScale: 1.2, color: 0x7a5a40 }),
    cream: lam(plaster('#cdb98f', 0.3, 5)),
    paintGreen: lam(plaster('#4d6b5e', 0.55, 6)),
    tileHall: lam(tile('#9c9382', '#6e6759', 9)),
    tileCorr: lam(tile('#7d8b88', '#5d6a69', 10)),
    ceiling: lam(plaster('#9d977f', 0.7, 7)),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.85, roughness: 0.38 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x7c8588, metalness: 0.7, roughness: 0.5 }),
    rust: new THREE.MeshLambertMaterial({ color: 0x6b3f2c }),
    paper: new THREE.MeshLambertMaterial({ color: 0xe6dcc0 }),
    glass: new THREE.MeshPhongMaterial({ color: 0xa8c8c4, transparent: true, opacity: 0.16, shininess: 120, depthWrite: false }),
    black: new THREE.MeshLambertMaterial({ color: 0x111314 }),
    cloth: new THREE.MeshLambertMaterial({ color: 0x555555 }),
    skin: new THREE.MeshLambertMaterial({ color: 0xc9a58a }),
    emissiveWarm: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  };
}

/** Canvas surface that can be redrawn: the CRT and the paper slip. */
export class DrawSurface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  constructor(w: number, h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }
  touch(): void {
    this.texture.needsUpdate = true;
  }
}

/** Collects static boxes per material and merges them so the world is a handful of draw calls. */
export class StaticBatch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, uvScale = 1): void {
    const g = new THREE.BoxGeometry(w, h, d);
    // world-scaled UVs so textures keep their texel size on every wall
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(nrm.getX(i));
      const ny = Math.abs(nrm.getY(i));
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (nx > 0.5) uv.setXY(i, u * d * uvScale, v * h * uvScale);
      else if (ny > 0.5) uv.setXY(i, u * w * uvScale, v * d * uvScale);
      else uv.setXY(i, u * w * uvScale, v * h * uvScale);
    }
    g.translate(x, y, z);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }
  build(mergeFn: (g: THREE.BufferGeometry[]) => THREE.BufferGeometry): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeFn(geos), mat);
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      group.add(mesh);
    }
    return group;
  }
}
