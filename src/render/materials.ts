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

function wood(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.fillStyle = '#5a3a22';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const v = 70 + Math.sin(y * 0.35 + Math.sin(y * 0.05) * 3) * 14;
    g.fillStyle = `rgb(${v + 20},${v - 8},${v - 36})`;
    g.fillRect(0, y, 256, 2);
  }
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = 'rgba(20,10,4,0.4)';
    g.beginPath();
    g.moveTo(0, 20 + i * 44);
    g.lineTo(256, 20 + i * 44);
    g.stroke();
  }
  noise(g, 256, 18, 3);
  return tex(c, 2, 2);
}

function plaster(base: string, grime = 0.25): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 20 + Math.random() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(30,24,16,${grime * 0.18})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  noise(g, 256, 14, 5);
  return tex(c, 2, 2);
}

function tile(a: string, b: string): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * 64, y * 64, 64, 64);
    }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 64, 0);
    g.lineTo(i * 64, 256);
    g.moveTo(0, i * 64);
    g.lineTo(256, i * 64);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(20,16,10,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 40, 4 + Math.random() * 8);
  }
  noise(g, 256, 16, 9);
  return tex(c, 2, 2);
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

export function makeMaterials(): Mats {
  const w = wood();
  return {
    wood: new THREE.MeshLambertMaterial({ map: w, color: 0xd8b48a }),
    woodDark: new THREE.MeshLambertMaterial({ map: w, color: 0x7a5a40 }),
    cream: new THREE.MeshLambertMaterial({ map: plaster('#cdb98f'), color: 0xffffff }),
    paintGreen: new THREE.MeshLambertMaterial({ map: plaster('#4d6b5e', 0.5), color: 0xffffff }),
    tileHall: new THREE.MeshLambertMaterial({ map: tile('#9c9382', '#6e6759') }),
    tileCorr: new THREE.MeshLambertMaterial({ map: tile('#7d8b88', '#5d6a69') }),
    ceiling: new THREE.MeshLambertMaterial({ map: plaster('#9d977f', 0.6), color: 0xffffff }),
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
