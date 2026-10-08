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
}

const TOP = 0.79;

function std(color: number, rough: number, metal = 0, map?: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: map ?? null });
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
  const oak = new THREE.MeshLambertMaterial({ map: mats.wood.map, bumpMap: mats.wood.map, bumpScale: 1.0, color: 0x9a6a44 });
  const oakDark = new THREE.MeshLambertMaterial({ map: mats.wood.map, bumpMap: mats.wood.map, bumpScale: 1.0, color: 0x5a3c26 });
  const brass = std(0xb08a3e, 0.35, 0.85);
  const bakelite = std(0x121110, 0.3, 0.05);
  const beige = std(0xb7ab8c, 0.6, 0.02);
  const beigeDark = std(0x8f8468, 0.65, 0.02);
  const paper = new THREE.MeshLambertMaterial({ color: 0xe6dcc0 });
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
    }
    add(rbox(0.68, 0.06, 0.82, 0.006), oakDark, px, 0.03, -0.78); // plinth
  }
  add(rbox(1.94, 0.1, 0.03, 0.008), oak, 0, TOP - 0.11, -0.38); // centre drawer
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10), brass, 0, TOP - 0.11, -0.36).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(1.98, 0.62, 0.02), oakDark, 0, 0.42, -1.16); // modesty panel

  // ---------------------------------------------------------------- blotter, papers, pens
  const leather = new THREE.MeshLambertMaterial({ color: 0x1d3a2a });
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
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.21, 0.002, 0.29), paper, -0.48 + Math.sin(i) * 0.01, TOP + 0.002 + i * 0.003, -0.45, g, false).rotation.y = 0.2 + Math.sin(i * 2) * 0.06;
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
  const mugPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) mugPts.push(new THREE.Vector2(0.038 + Math.sin(i / 8) * 0.003, (i / 8) * 0.095));
  mugPts.push(new THREE.Vector2(0.033, 0.095), new THREE.Vector2(0.033, 0.008));
  add(new THREE.LatheGeometry(mugPts, 20), std(0xd9d2c0, 0.4), -0.18, TOP, -0.56);
  add(new THREE.CircleGeometry(0.033, 18), std(0x2a170c, 0.15), -0.18, TOP + 0.07, -0.56, g, false).rotation.x = -Math.PI / 2;
  add(new THREE.TorusGeometry(0.024, 0.006, 8, 14, Math.PI * 1.2), std(0xd9d2c0, 0.4), -0.135, TOP + 0.05, -0.56).rotation.z = -Math.PI * 0.6;
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

  return { lampBulb, crt, crtScreen, slip, slipMesh, phoneLed };
}
