import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Physics } from '../physics/world';
import { DrawSurface, type Mats } from './materials';

/**
 * The intake desk and everything on it, modelled properly: an oak pedestal desk with drawers and brass pulls,
 * a leather blotter, a brass banker's lamp with a green glass shade, a beige records terminal with a curved
 * screen and a keyboard, a rotary phone with a coiled cord, a clipboard, a mug with a coffee ring, rubber
 * stamps, an ink pad, a pen pot, an ashtray and a framed photograph. Positions match the old desk so the
 * locked lights and camera still line up.
 */
export interface Desk {
  lampBulb: THREE.Mesh;
  crt: DrawSurface;
  crtScreen: THREE.Mesh;
  slip: DrawSurface;
  slipMesh: THREE.Mesh;
  phoneLed: THREE.Mesh;
  photo: THREE.Group;
  mug: THREE.Group;
  hits: THREE.Mesh[];
}

const TOP = 0.79;

function std(color: number, rough: number, metal = 0, map?: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: map ?? null });
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

/** Quarter-sawn oak: long directional grain, ray flecks, darker wear where hands and sleeves rub. */
function oakTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 256, (g) => {
    g.fillStyle = '#8a5e3a';
    g.fillRect(0, 0, 1024, 256);
    for (let y = 0; y < 256; y++) {
      const v = Math.sin(y * 0.21 + Math.sin(y * 0.031) * 6) * 16 + Math.sin(y * 1.7) * 4;
      g.fillStyle = `rgba(${v > 0 ? '60,34,18' : '170,120,80'},${Math.min(0.5, Math.abs(v) / 40)})`;
      g.fillRect(0, y, 1024, 1);
    }
    for (let i = 0; i < 260; i++) {
      // ray flecks across the grain
      g.fillStyle = `rgba(200,160,110,${0.08 + Math.random() * 0.12})`;
      g.fillRect(Math.random() * 1024, Math.random() * 256, 6 + Math.random() * 18, 1.5);
    }
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(240,220,190,${0.05 + Math.random() * 0.08})`;
      g.lineWidth = 0.7;
      const x = Math.random() * 1024, y = Math.random() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + Math.random() * 80, y + (Math.random() - 0.5) * 8);
      g.stroke();
    }
    // a band of wear where forearms rest, and a few dark rings from old cups
    const wear = g.createLinearGradient(0, 160, 0, 256);
    wear.addColorStop(0, 'rgba(30,16,8,0)');
    wear.addColorStop(1, 'rgba(30,16,8,0.25)');
    g.fillStyle = wear;
    g.fillRect(0, 160, 1024, 96);
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = 'rgba(40,20,10,0.25)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(200 + Math.random() * 600, 80 + Math.random() * 120, 16 + Math.random() * 4, 0, 7);
      g.stroke();
    }
  });
}

/** Brass that has been handled for thirty years: bright where fingers go, brown and green in the corners. */
function brassTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#c8a050';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, Math.random() < 0.3 ? 'rgba(70,110,80,0.35)' : 'rgba(80,50,20,0.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 120; i++) {
      g.strokeStyle = `rgba(255,240,200,${Math.random() * 0.2})`;
      g.lineWidth = 0.5;
      const x = Math.random() * 256, y = Math.random() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.random() * 20, y + Math.random() * 3);
      g.stroke();
    }
  });
}

/** Green desk leather: pebbled grain, a lighter worn patch in the middle where the forms go, scuffed edges. */
function leatherTexture(): THREE.CanvasTexture {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = '#1f3d2c';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '120,160,130'},${Math.random() * 0.12})`;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 1.5, 0, 7);
      g.fill();
    }
    const worn = g.createRadialGradient(256, 280, 20, 256, 280, 220);
    worn.addColorStop(0, 'rgba(150,170,140,0.25)');
    worn.addColorStop(1, 'rgba(150,170,140,0)');
    g.fillStyle = worn;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(10,20,14,0.5)';
    for (let i = 0; i < 25; i++) {
      g.lineWidth = 0.6;
      const x = Math.random() * 512, y = Math.random() * 512;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 20);
      g.stroke();
    }
    g.strokeStyle = 'rgba(160,140,90,0.35)';
    g.setLineDash([4, 3]);
    g.strokeRect(10, 10, 492, 492); // stitching
  });
}

/** Moulded beige plastic, slightly yellowed, with a fine texture and grime in the corners. */
function plasticTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#c4b896';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,230' : '80,70,50'},${Math.random() * 0.06})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    const yel = g.createLinearGradient(0, 0, 0, 256);
    yel.addColorStop(0, 'rgba(140,110,40,0.15)');
    yel.addColorStop(1, 'rgba(140,110,40,0)');
    g.fillStyle = yel;
    g.fillRect(0, 0, 256, 256);
  });
}

function photoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 240;
  const g = c.getContext('2d')!;
  // a faded seaside snapshot: a woman holding a small child's hand, 1949
  const sky = g.createLinearGradient(0, 0, 0, 240);
  sky.addColorStop(0, '#c9c0a8');
  sky.addColorStop(0.55, '#a9a28c');
  sky.addColorStop(0.56, '#7d7766');
  sky.addColorStop(1, '#5e594c');
  g.fillStyle = sky;
  g.fillRect(0, 0, 192, 240);
  g.fillStyle = '#3e3a32';
  g.beginPath();
  g.ellipse(80, 82, 13, 16, 0, 0, 7); // head
  g.fill();
  g.fillRect(64, 96, 32, 70); // coat
  g.beginPath();
  g.moveTo(60, 166);
  g.lineTo(100, 166);
  g.lineTo(106, 210);
  g.lineTo(54, 210);
  g.fill();
  g.beginPath();
  g.ellipse(124, 140, 9, 10, 0, 0, 7); // child
  g.fill();
  g.fillRect(116, 150, 16, 40);
  g.strokeStyle = '#3e3a32';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(94, 130);
  g.lineTo(118, 158);
  g.stroke();
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,250,230' : '30,26,20'},${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 192, Math.random() * 240, 1.5, 1.5);
  }
  g.fillStyle = '#efe8d4';
  g.fillRect(0, 214, 192, 26);
  g.fillStyle = '#4a3a2a';
  g.font = 'italic 15px "Reenie Beanie", cursive';
  g.fillText('Mum and me, Margate 1949', 12, 232);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildDesk(scene: THREE.Scene, physics: Physics, mats: Mats): Desk {
  const g = new THREE.Group();
  scene.add(g);
  void mats;
  const oakMap = oakTexture();
  const oak = new THREE.MeshStandardMaterial({ map: oakMap, bumpMap: oakMap, bumpScale: 0.6, roughness: 0.58, color: 0xd8b090 });
  const oakDark = new THREE.MeshStandardMaterial({ map: oakMap, bumpMap: oakMap, bumpScale: 0.6, roughness: 0.7, color: 0x8a6a50 });
  const brass = new THREE.MeshStandardMaterial({ map: brassTexture(), roughness: 0.42, metalness: 0.85, color: 0xffffff });
  const bakelite = std(0x121110, 0.3, 0.05);
  const plastic = plasticTexture();
  const beige = new THREE.MeshStandardMaterial({ map: plastic, bumpMap: plastic, bumpScale: 0.2, roughness: 0.62, color: 0xe8e0c8 });
  const beigeDark = new THREE.MeshStandardMaterial({ map: plastic, roughness: 0.7, color: 0xb0a488 });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g, shadow = true): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const rbox = (w: number, h: number, d: number, r = 0.012): RoundedBoxGeometry => new RoundedBoxGeometry(w, h, d, 3, r);

  // ---------------------------------------------------------------- the desk
  physics.addStaticBox(0, 0.395, -0.78, 1.72, 0.395, 0.45);
  add(rbox(3.42, 0.045, 0.9, 0.018), oak, 0, TOP - 0.022, -0.78);
  add(rbox(3.36, 0.03, 0.84, 0.01), oakDark, 0, TOP - 0.06, -0.78);
  for (const sx of [-1, 1]) {
    const px = sx * 1.32;
    add(rbox(0.66, 0.7, 0.8, 0.01), oakDark, px, 0.38, -0.78);
    for (let i = 0; i < 3; i++) {
      const y = 0.16 + i * 0.205;
      add(rbox(0.6, 0.18, 0.03, 0.008), oak, px, y, -0.37);
      const pull = add(new THREE.TorusGeometry(0.035, 0.006, 6, 14, Math.PI), brass, px, y + 0.02, -0.35);
      pull.rotation.z = Math.PI;
      add(new THREE.BoxGeometry(0.1, 0.03, 0.006), brass, px, y + 0.05, -0.352); // card holder
      for (const sx2 of [-1, 1]) add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 8), std(0x7a6a40, 0.5, 0.8), px + sx2 * 0.035, y + 0.02, -0.349).rotation.x = Math.PI / 2; // pull screws
      add(new THREE.BoxGeometry(0.62, 0.004, 0.002), std(0x0a0806, 0.9), px, y + 0.095, -0.369); // the gap above each drawer
    }
    add(rbox(0.68, 0.06, 0.82, 0.006), oakDark, px, 0.03, -0.78); // plinth
  }
  add(rbox(1.94, 0.1, 0.03, 0.008), oak, 0, TOP - 0.11, -0.38); // centre drawer
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10), brass, 0, TOP - 0.11, -0.36).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(1.98, 0.62, 0.02), oakDark, 0, 0.42, -1.16); // modesty panel

  // ---------------------------------------------------------------- blotter, papers, pens
  const leatherMap = leatherTexture();
  const leather = new THREE.MeshStandardMaterial({ map: leatherMap, bumpMap: leatherMap, bumpScale: 0.5, roughness: 0.75, color: 0xffffff });
  add(rbox(0.74, 0.008, 0.5, 0.003), leather, 0.05, TOP + 0.004, -0.62, g, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.07, 0.01, 0.07), std(0x2a1a12, 0.5), 0.05 + sx * 0.34, TOP + 0.006, -0.62 + sz * 0.22, g, false).rotation.y = Math.PI / 4;
  // the form, on a clipboard
  const board = add(rbox(0.25, 0.008, 0.36, 0.004), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), 0.05, TOP + 0.012, -0.52);
  board.rotation.y = 0.08;
  add(rbox(0.11, 0.014, 0.04, 0.004), std(0x9aa0a6, 0.3, 0.9), 0.05, TOP + 0.022, -0.69).rotation.y = 0.08;
  const slip = new DrawSurface(256, 320);
  const slipMesh = add(new THREE.PlaneGeometry(0.23, 0.31), new THREE.MeshLambertMaterial({ map: slip.texture }), 0.05, TOP + 0.0175, -0.51, g, false);
  slipMesh.rotation.set(-Math.PI / 2, 0, 0.08);
  // loose forms
  // loose forms: each sheet a little bent, a little different in tone, the top one dog-eared
  for (let i = 0; i < 6; i++) {
    const sheet = new THREE.PlaneGeometry(0.21, 0.29, 6, 8);
    const sp = sheet.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < sp.count; v++) {
      const x = sp.getX(v), y = sp.getY(v);
      let z = Math.sin((x + 0.105) * 9 + i) * 0.002 + Math.max(0, x - 0.06) * 0.03 * (i === 5 ? 1 : 0.2);
      if (i === 5 && x > 0.07 && y > 0.11) z += (x - 0.07 + y - 0.11) * 0.25; // dog-ear
      sp.setZ(v, z);
    }
    sheet.computeVertexNormals();
    const tone = [0xe6dcc0, 0xebe3cc, 0xdcd2b4, 0xe9e0c6, 0xe2d8bc, 0xefe8d4][i];
    const m = add(sheet, new THREE.MeshLambertMaterial({ color: tone, side: THREE.DoubleSide }), -0.48 + Math.sin(i) * 0.012, TOP + 0.003 + i * 0.0025, -0.45, g, false);
    m.rotation.set(-Math.PI / 2, 0, 0.2 + Math.sin(i * 2) * 0.07);
  }
  // pen pot with pens and pencils
  const pot = add(new THREE.CylinderGeometry(0.035, 0.032, 0.1, 16, 1, true), std(0x3a2a20, 0.6), 0.55, TOP + 0.05, -0.92);
  (pot.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  for (let i = 0; i < 4; i++) {
    const pen = add(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6), i % 2 ? bakelite : std(0xc8a040, 0.5), 0.55 + Math.sin(i * 2) * 0.012, TOP + 0.1, -0.92 + Math.cos(i * 2) * 0.012);
    pen.rotation.set(Math.sin(i) * 0.2, 0, Math.cos(i * 3) * 0.2);
  }
  // rubber stamps and ink pad
  for (let i = 0; i < 3; i++) {
    const sx = 0.58 + i * 0.07;
    add(new THREE.BoxGeometry(0.05, 0.022, 0.035), oakDark, sx, TOP + 0.011, -0.62);
    add(new THREE.CylinderGeometry(0.008, 0.01, 0.06, 10), oak, sx, TOP + 0.05, -0.62);
    add(new THREE.SphereGeometry(0.016, 12, 8), oak, sx, TOP + 0.085, -0.62);
  }
  add(rbox(0.12, 0.016, 0.08, 0.004), std(0x5a1414, 0.5, 0.4), 0.66, TOP + 0.008, -0.5);
  // mug with a coffee ring
  const mug = new THREE.Group();
  g.add(mug);
  const mugPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) mugPts.push(new THREE.Vector2(0.038 + Math.sin(i / 8) * 0.003, (i / 8) * 0.095));
  mugPts.push(new THREE.Vector2(0.033, 0.095), new THREE.Vector2(0.033, 0.008));
  add(new THREE.LatheGeometry(mugPts, 20), std(0xd9d2c0, 0.4), -0.18, TOP, -0.56, mug);
  add(new THREE.CircleGeometry(0.033, 18), std(0x2a170c, 0.15), -0.18, TOP + 0.07, -0.56, mug, false).rotation.x = -Math.PI / 2;
  add(new THREE.TorusGeometry(0.024, 0.006, 8, 14, Math.PI * 1.2), std(0xd9d2c0, 0.4), -0.135, TOP + 0.05, -0.56, mug).rotation.z = -Math.PI * 0.6;
  add(new THREE.RingGeometry(0.03, 0.04, 20), new THREE.MeshBasicMaterial({ color: 0x3a2412, transparent: true, opacity: 0.35 }), -0.27, TOP + 0.001, -0.5, g, false).rotation.x = -Math.PI / 2;
  // ashtray with two stubbed cigarettes
  add(new THREE.CylinderGeometry(0.06, 0.05, 0.02, 18), std(0x2c3a3c, 0.2, 0.3), 0.85, TOP + 0.01, -0.45);
  for (let i = 0; i < 2; i++) add(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), std(0xe8e2d0, 0.6), 0.85 + i * 0.02, TOP + 0.022, -0.45 + i * 0.01).rotation.z = Math.PI / 2 - 0.2;
  // framed photograph of her, facing your chair
  const frame = new THREE.Group();
  frame.position.set(-0.55, TOP, -0.98);
  frame.rotation.set(-0.15, 0.25, 0);
  g.add(frame);
  add(rbox(0.13, 0.165, 0.012, 0.004), brass, 0, 0.085, 0, frame);
  add(new THREE.PlaneGeometry(0.105, 0.135), new THREE.MeshLambertMaterial({ map: photoTexture() }), 0, 0.085, 0.0065, frame, false);
  add(new THREE.BoxGeometry(0.01, 0.13, 0.06), brass, 0, 0.06, -0.03, frame).rotation.x = 0.4;

  // ---------------------------------------------------------------- banker's lamp (light stays where it was)
  const lamp = new THREE.Group();
  lamp.position.set(1.1, TOP, -0.9);
  g.add(lamp);
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 28), brass, 0, 0.015, 0, lamp);
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.02, 24), brass, 0, 0.04, 0, lamp);
  add(new THREE.CylinderGeometry(0.011, 0.013, 0.5, 12), brass, 0, 0.3, 0, lamp);
  add(new THREE.SphereGeometry(0.018, 12, 10), brass, 0, 0.55, 0, lamp);
  const armCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(-0.02, 0.66, 0.02), new THREE.Vector3(-0.08, 0.64, 0.12));
  add(new THREE.TubeGeometry(armCurve, 16, 0.009, 8), brass, 0, 0, 0, lamp);
  const shadePts = [new THREE.Vector2(0.03, 0.07), new THREE.Vector2(0.06, 0.06), new THREE.Vector2(0.12, 0.02), new THREE.Vector2(0.15, -0.03), new THREE.Vector2(0.155, -0.045)];
  const shadeMat = new THREE.MeshPhongMaterial({ color: 0x0f5a3a, emissive: 0x062a1a, shininess: 90, side: THREE.DoubleSide });
  const shade = add(new THREE.LatheGeometry(shadePts, 28), shadeMat, -0.08, 0.62, 0.12, lamp);
  shade.scale.set(1, 1, 0.75);
  shade.rotation.x = 0.35;
  add(new THREE.TorusGeometry(0.155, 0.005, 6, 28), brass, -0.08, 0.578, 0.135, lamp).rotation.x = Math.PI / 2 + 0.35;
  const lampBulb = add(new THREE.SphereGeometry(0.035, 14, 10), mats.emissiveWarm, -0.08, 0.6, 0.13, lamp, false);
  const chain = add(new THREE.CylinderGeometry(0.002, 0.002, 0.12, 4), brass, 0.02, 0.52, 0.18, lamp);
  chain.rotation.x = 0.1;
  add(new THREE.SphereGeometry(0.008, 8, 6), brass, 0.02, 0.46, 0.185, lamp);

  // ---------------------------------------------------------------- records terminal (same spot as before)
  const crtGroup = new THREE.Group();
  crtGroup.position.set(-0.95, TOP, -0.85);
  crtGroup.rotation.y = 0.3;
  g.add(crtGroup);
  add(rbox(0.6, 0.44, 0.46, 0.04), beige, 0, 0.27, 0, crtGroup);
  const back = add(new THREE.CylinderGeometry(0.17, 0.24, 0.3, 4, 1), beigeDark, 0, 0.27, -0.34, crtGroup);
  back.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  add(rbox(0.5, 0.36, 0.03, 0.02), std(0x2a2620, 0.7), 0, 0.28, 0.225, crtGroup); // bezel
  add(new THREE.BoxGeometry(0.605, 0.445, 0.004), std(0x5a5240, 0.8), 0, 0.27, -0.06, crtGroup); // moulding seam where the two halves meet
  for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8), std(0x777060, 0.4, 0.8), sx * 0.27, 0.06, 0.232, crtGroup).rotation.x = Math.PI / 2;
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.004, 0.02, 0.18), beigeDark, -0.2 + i * 0.06, 0.495, -0.05, crtGroup); // vents
  add(rbox(0.5, 0.04, 0.36, 0.01), beige, 0, 0.02, 0, crtGroup); // plinth
  const crt = new DrawSurface(512, 384);
  // a slightly bulged glass face, like a real tube
  const screenGeo = new THREE.PlaneGeometry(0.44, 0.33, 12, 9);
  const sp = screenGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) / 0.22;
    const y = sp.getY(i) / 0.165;
    sp.setZ(i, 0.018 * (1 - x * x * 0.6) * (1 - y * y * 0.6));
  }
  screenGeo.computeVertexNormals();
  const crtScreen = add(screenGeo, new THREE.MeshBasicMaterial({ map: crt.texture, toneMapped: false }), 0, 0.28, 0.238, crtGroup, false);
  add(new THREE.CircleGeometry(0.012, 10), new THREE.MeshBasicMaterial({ color: 0x40ff80 }), 0.2, 0.1, 0.242, crtGroup, false);
  // keyboard with real keys
  const kb = new THREE.Group();
  kb.position.set(-0.78, TOP, -0.52);
  kb.rotation.y = 0.25;
  g.add(kb);
  add(rbox(0.46, 0.035, 0.17, 0.01), beige, 0, 0.018, 0, kb);
  const keyGeo = new RoundedBoxGeometry(0.03, 0.02, 0.03, 2, 0.005);
  const keys = new THREE.InstancedMesh(keyGeo, beigeDark, 52);
  const mtx = new THREE.Matrix4();
  let n = 0;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 13 && n < 52; c++) {
      mtx.makeRotationX(-0.1);
      mtx.setPosition(-0.2 + c * 0.034 + r * 0.008, 0.045 + r * 0.004, 0.055 - r * 0.036);
      keys.setMatrixAt(n++, mtx);
    }
  keys.castShadow = true;
  kb.add(keys);

  // ---------------------------------------------------------------- rotary phone (same spot)
  const phone = new THREE.Group();
  phone.position.set(-0.3, TOP, -0.9);
  phone.rotation.y = 0.2;
  g.add(phone);
  const bodyPts = [new THREE.Vector2(0.001, 0.1), new THREE.Vector2(0.06, 0.098), new THREE.Vector2(0.1, 0.07), new THREE.Vector2(0.115, 0.02), new THREE.Vector2(0.12, 0)];
  const pb = add(new THREE.LatheGeometry(bodyPts, 24), bakelite, 0, 0, 0, phone);
  pb.scale.set(1, 1, 0.9);
  add(new THREE.CylinderGeometry(0.06, 0.062, 0.012, 24), std(0xe8e2d0, 0.4), 0, 0.075, 0.07, phone).rotation.x = 0.55;
  const dial = add(new THREE.TorusGeometry(0.05, 0.008, 6, 24), std(0x1a1a1a, 0.25, 0.1), 0, 0.083, 0.072, phone);
  dial.rotation.x = Math.PI / 2 + 0.55;
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.03, 0.03), bakelite, sx * 0.085, 0.105, -0.01, phone); // cradle prongs
  const handset = new THREE.Group();
  handset.position.set(0, 0.125, -0.01);
  phone.add(handset);
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 12), bakelite, 0, 0, 0, handset).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    const cup = add(new THREE.CylinderGeometry(0.033, 0.024, 0.04, 16), bakelite, sx * 0.105, -0.012, 0, handset);
    cup.rotation.x = 0;
  }
  const coil: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    coil.push(new THREE.Vector3(-0.1 - t * 0.25 + Math.cos(t * 80) * 0.012, 0.03 - t * 0.02 + Math.sin(t * 80) * 0.012, Math.sin(t * 3) * 0.06));
  }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 240, 0.003, 5), bakelite, 0, 0, 0, phone);
  const phoneLed = add(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: 0x331100 }), 0.09, 0.03, 0.08, phone, false);

  // invisible handles for the things you can pick up or use from the chair
  const hit = (id: string, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z);
    m.userData.interact = { id, prompt: id, range: 3 };
    scene.add(m);
    return m;
  };
  const hits = [hit('phone', 0.3, 0.2, 0.3, -0.3, TOP + 0.08, -0.9), hit('photo', 0.16, 0.2, 0.12, -0.55, TOP + 0.09, -0.98)];
  return { lampBulb, crt, crtScreen, slip, slipMesh, phoneLed, photo: frame, mug, hits };
}
