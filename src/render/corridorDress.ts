import * as THREE from 'three';
import type { Mats } from './materials';

/**
 * Wear and damp for the east corridor only. Nothing here moves a wall, a door or a light: it repaints copies of
 * the corridor's own surfaces and lays a few flat decals on them.
 *  - plaster: rust-brown water streaks running down from the ceiling pipes, mould blooming in the top corners,
 *    a grey band of grime at hand and shoulder height where people brush along it
 *  - green dado: paint lifting in flakes with dark edges, scuffs from trolleys, dirt along the skirting
 *  - ceiling: tide-mark rings of old leaks round the pipe runs
 *  - floor: grout gone black, a wet film in patches that throws back the tube lights, a dark drag mark
 * Copies are made from the existing textures so the corridor still matches the rest of the building.
 */
export interface CorridorMats {
  wall: THREE.MeshLambertMaterial;
  dado: THREE.MeshLambertMaterial;
  ceiling: THREE.MeshLambertMaterial;
  floor: THREE.MeshStandardMaterial;
}

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A copy of a material's texture canvas, drawn over, as a new texture with the same tiling. */
function repaint(src: THREE.Texture, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, scale = 1): THREE.CanvasTexture {
  const img = src.image as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = img.width * scale;
  c.height = img.height * scale;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, c.width, c.height);
  draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.copy(src.repeat);
  t.anisotropy = 4;
  return t;
}

export function corridorMaterials(m: Mats): CorridorMats {
  const r = rand(4711);
  // ---- plaster above the dado. Canvas top is the ceiling end of the wall.
  const wallTex = repaint(m.cream.map!, (g, w, h) => {
    // water: streaks from the top, brown at the source and fading as they run, some forked
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const len = h * (0.25 + r() * 0.6);
      const wd = 3 + r() * 14;
      const gr = g.createLinearGradient(0, h * 0.1, 0, h * 0.1 + len);
      gr.addColorStop(0, `rgba(96,64,30,${0.35 + r() * 0.25})`);
      gr.addColorStop(0.5, 'rgba(110,82,46,0.16)');
      gr.addColorStop(1, 'rgba(110,82,46,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - wd / 2, h * 0.1);
      for (let s = 1; s <= 8; s++) g.lineTo(x - wd / 2 + Math.sin(s + i) * 3, h * 0.1 + (len * s) / 8);
      for (let s = 8; s >= 0; s--) g.lineTo(x + wd / 2 + Math.sin(s + i) * 3 - (wd * s) / 16, h * 0.1 + (len * s) / 8);
      g.fill();
      // a hard tide line where the water stopped
      g.strokeStyle = 'rgba(80,52,24,0.25)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, h * 0.1 + len * 0.55, wd * 0.9, 6, 0, 0, Math.PI);
      g.stroke();
    }
    // mould along the top edge, black-green, in blooms
    for (let i = 0; i < 90; i++) {
      const x = r() * w, y = h * 0.1 + r() * h * 0.12, rad = 6 + r() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(26,34,22,${0.25 + r() * 0.3})`);
      gr.addColorStop(1, 'rgba(26,34,22,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // grime where shoulders brush the wall
    const band = g.createLinearGradient(0, h * 0.55, 0, h * 0.95);
    band.addColorStop(0, 'rgba(40,36,30,0)');
    band.addColorStop(0.6, 'rgba(40,36,30,0.18)');
    band.addColorStop(1, 'rgba(40,36,30,0.05)');
    g.fillStyle = band;
    g.fillRect(0, h * 0.55, w, h * 0.45);
    // handprints, old, smeared, at the height of someone feeling their way in the dark
    for (let i = 0; i < 2; i++) {
      const x = r() * w, y = h * (0.62 + r() * 0.12);
      g.fillStyle = 'rgba(50,40,32,0.06)';
      g.beginPath();
      g.ellipse(x, y, 14, 18, r(), 0, Math.PI * 2);
      g.fill();
      for (let f = 0; f < 4; f++) {
        g.beginPath();
        g.ellipse(x - 12 + f * 8, y - 26 - Math.abs(f - 1.5) * 3, 3.5, 10, (f - 1.5) * 0.15, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  // ---- green dado. Canvas bottom is the floor.
  const dadoTex = repaint(m.paintGreen.map!, (g, w, h) => {
    // paint lifting: pale flakes of the cream undercoat with a dark curled edge
    // a few clusters where damp got behind the paint, not an even sprinkle
    const clusters = [0.15, 0.5, 0.8].map((cx) => [cx * w, h * (0.55 + r() * 0.3)]);
    for (let i = 0; i < 26; i++) {
      const [cx, cy] = clusters[i % 3];
      const x = cx + (r() - 0.5) * w * 0.18, y = cy + (r() - 0.5) * h * 0.25;
      const s = 3 + r() * 12;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        g.lineTo(x + Math.cos(a) * s * (0.5 + r() * 0.6), y + Math.sin(a) * s * (0.4 + r() * 0.5));
      }
      g.closePath();
      g.fillStyle = `rgba(${130 + r() * 30},${128 + r() * 25},${100 + r() * 20},0.5)`;
      g.fill();
      g.strokeStyle = 'rgba(18,24,20,0.6)';
      g.lineWidth = 1.2;
      g.stroke();
    }
    // trolley and boot scuffs low down
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(20,22,20,${0.15 + r() * 0.25})`;
      g.lineWidth = 1 + r() * 3;
      const x = r() * w, y = h * (0.82 + r() * 0.15);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + r() * 80, y + (r() - 0.5) * 6);
      g.stroke();
    }
    const skirting = g.createLinearGradient(0, h * 0.8, 0, h);
    skirting.addColorStop(0, 'rgba(14,16,12,0)');
    skirting.addColorStop(1, 'rgba(14,16,12,0.55)');
    g.fillStyle = skirting;
    g.fillRect(0, h * 0.8, w, h * 0.2);
  });
  // ---- ceiling: brown tide rings from leaks
  const ceilTex = repaint(m.ceiling.map!, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 120;
      for (let ring = 0; ring < 3; ring++) {
        g.strokeStyle = `rgba(90,62,30,${0.12 + r() * 0.12})`;
        g.lineWidth = 2 + r() * 4;
        g.beginPath();
        g.ellipse(x, y, rad * (1 - ring * 0.22), rad * (0.6 - ring * 0.12), r(), 0, Math.PI * 2);
        g.stroke();
      }
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(70,50,24,0.18)');
      gr.addColorStop(1, 'rgba(70,50,24,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  // ---- floor tiles: black grout, dirt, and the roughness map for the wet film
  const floorTex = repaint(m.tileCorr.map!, (g, w, h) => {
    const img = g.getImageData(0, 0, w, h);
    // grout lines are the darkest pixels of the tile texture: push them darker still
    for (let i = 0; i < img.data.length; i += 4) {
      const l = img.data[i] + img.data[i + 1] + img.data[i + 2];
      if (l < 260) for (let c = 0; c < 3; c++) img.data[i + c] *= 0.55;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 80;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(30,28,22,${0.12 + r() * 0.15})`);
      gr.addColorStop(1, 'rgba(30,28,22,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  const rough = document.createElement('canvas');
  rough.width = rough.height = 512;
  {
    const g = rough.getContext('2d')!;
    g.fillStyle = 'rgb(215,215,215)';
    g.fillRect(0, 0, 512, 512);
    // wet film: glossy pools with soft edges
    for (let i = 0; i < 9; i++) {
      const x = r() * 512, y = r() * 512, rad = 30 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(25,25,25,0.95)');
      gr.addColorStop(0.7, 'rgba(25,25,25,0.6)');
      gr.addColorStop(1, 'rgba(25,25,25,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, rad, rad * (0.4 + r() * 0.5), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const roughTex = new THREE.CanvasTexture(rough);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.copy(m.tileCorr.map!.repeat).multiplyScalar(0.5);
  return {
    wall: new THREE.MeshLambertMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.8, color: 0xe6e0d6 }),
    dado: new THREE.MeshLambertMaterial({ map: dadoTex, bumpMap: dadoTex, bumpScale: 1.0, color: 0xd8dcd6 }),
    ceiling: new THREE.MeshLambertMaterial({ map: ceilTex, bumpMap: ceilTex, bumpScale: 0.8, color: 0xd0ccc4 }),
    floor: new THREE.MeshStandardMaterial({ map: floorTex, bumpMap: floorTex, bumpScale: 0.6, roughnessMap: roughTex, roughness: 1, metalness: 0, color: 0xcfd2cc }),
  };
}

/**
 * Flat decals that sit on the corridor's existing surfaces: one dark drag mark along the floor toward the alcove,
 * a couple of standing puddles under the pipe runs that mirror the tubes, and soot above the far door.
 */
export function corridorDecals(scene: THREE.Scene): void {
  const r = rand(99);
  const decal = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, mat: (t: THREE.CanvasTexture) => THREE.Material): THREE.Mesh => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(t));
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // the drag mark: a long smear, darkest where it starts, broken where whatever was dragged lifted
  const drag = decal(3.2, 0.5, (g) => {
    for (let i = 0; i < 60; i++) {
      const x = (i / 60) * 256;
      const a = 0.5 * (1 - i / 70) * (0.5 + r() * 0.5) * (Math.sin(i * 0.7) > -0.7 ? 1 : 0.2);
      g.fillStyle = `rgba(30,10,8,${a})`;
      g.fillRect(x, 100 + Math.sin(i * 0.3) * 8 + r() * 6, 6, 40 + r() * 20);
    }
  }, (t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  drag.rotation.x = -Math.PI / 2;
  drag.position.set(10.0, 0.003, 1.1);
  drag.rotation.z = 0.08;
  // puddles: glassy dark water, reflecting the corridor tubes as highlights
  for (const [x, z, s] of [[4.6, 0.6, 0.9], [8.9, 1.25, 1.2], [12.6, 0.8, 0.8]]) {
    const p = decal(s, s * 0.6, (g) => {
      const gr = g.createRadialGradient(128, 128, 10, 128, 128, 126);
      gr.addColorStop(0, 'rgba(20,24,24,0.75)');
      gr.addColorStop(0.75, 'rgba(20,24,24,0.55)');
      gr.addColorStop(1, 'rgba(20,24,24,0)');
      g.fillStyle = gr;
      g.beginPath();
      for (let a = 0; a <= 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const rr = 100 + Math.sin(ang * 3 + x) * 18 + r() * 8;
        if (a === 0) g.moveTo(128 + Math.cos(ang) * rr, 128 + Math.sin(ang) * rr);
        else g.lineTo(128 + Math.cos(ang) * rr, 128 + Math.sin(ang) * rr);
      }
      g.fill();
    }, (t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.03, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.002, z);
  }
  // soot and damp above the far door, so the end of the corridor reads darker than the light allows
  const soot = decal(1.85, 1.6, (g) => {
    const gr = g.createRadialGradient(128, 60, 10, 128, 110, 150);
    gr.addColorStop(0, 'rgba(8,10,8,0.6)');
    gr.addColorStop(1, 'rgba(8,10,8,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }, (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  soot.position.set(14.2 - 0.002, 2.1, 0.9);
  soot.rotation.y = -Math.PI / 2;
}
