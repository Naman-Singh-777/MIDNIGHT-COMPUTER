import * as THREE from 'three';
import { fabricTexture, type FabricKind } from './faces';

/**
 * A jointed human body built from smooth lathe pieces. Real proportions (about seven and a half heads),
 * hips, knees, elbows, hands with fingers, and clothes that are separate shapes: sleeves, trousers, a coat
 * skirt that hangs from the waist, collars, lapels, buttons. The head is attached by the caller at headMount.
 * Same idea as a skinned character in Unity, done with a hierarchy of pivots so it costs no skinning.
 */
export type Outfit = 'overcoat' | 'raincoat' | 'suit' | 'cardigan' | 'fur' | 'cassock' | 'uniform' | 'nightgown' | 'work' | 'habit' | 'creature';

export interface BodySpec {
  height: number; // metres
  build: number; // 0.8 thin to 1.3 heavy
  female: boolean;
  hunch: number; // 0 to 1
  skin: THREE.Color;
  outfit: Outfit;
  top: THREE.Color;
  bottom: THREE.Color;
  shoes: THREE.Color;
  accent: THREE.Color; // shirt, collar, apron
  barefoot?: boolean;
  armLength?: number; // 1 normal
  skinMap?: THREE.Texture;
}

export interface Arm {
  side: number;
  sh: THREE.Group;
  el: THREE.Group;
  hand: THREE.Group;
  fingers: THREE.Group[];
  tips: THREE.Group[];
}
export interface Leg {
  side: number;
  hip: THREE.Group;
  knee: THREE.Group;
}
export interface Rig {
  root: THREE.Group;
  pelvis: THREE.Group;
  chest: THREE.Group;
  headMount: THREE.Group;
  arms: Arm[];
  legs: Leg[];
  skirt: THREE.Mesh | null;
  scaleY: number;
}

type Maker = {
  own?(m: THREE.Material): void;
  mat(c: THREE.Color, map?: THREE.Texture | null): THREE.MeshLambertMaterial;
  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x?: number, y?: number, z?: number): THREE.Mesh;
};

/** A limb that hangs down from its pivot: rounded ends, tapering from rTop to rBot. */
export function limbGeo(rTop: number, rBot: number, len: number, seg = 14): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0005, 0.02), new THREE.Vector2(rTop * 0.72, 0.013), new THREE.Vector2(rTop, 0)];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    const bulge = Math.sin(t * Math.PI) * 0.08 * (rTop + rBot);
    pts.push(new THREE.Vector2(rTop + (rBot - rTop) * t + bulge, -len * t));
  }
  pts.push(new THREE.Vector2(rBot * 0.72, -len - 0.013), new THREE.Vector2(0.0005, -len - 0.02));
  return new THREE.LatheGeometry(pts, seg);
}

const COATED: Outfit[] = ['overcoat', 'raincoat', 'fur', 'cassock', 'nightgown', 'habit', 'uniform'];

export function buildBody(spec: BodySpec, m: Maker): Rig {
  const k = spec.height / 1.75;
  const b = spec.build;
  const fem = spec.female;
  const creature = spec.outfit === 'creature';
  // each outfit gets its own cloth: wool, cotton, knit, oilcloth, leather
  const kind: FabricKind =
    spec.outfit === 'cardigan' ? 'knit' : spec.outfit === 'uniform' || spec.outfit === 'nightgown' ? 'cotton' : spec.outfit === 'raincoat' ? 'oilcloth' : spec.outfit === 'work' ? 'leather' : 'wool';
  const fab = creature ? null : fabricTexture(kind);
  const cloth = (c: THREE.Color, k: FabricKind = kind): THREE.Material => {
    if (k === 'oilcloth' || k === 'leather') {
      const sm = new THREE.MeshStandardMaterial({ color: c, map: fabricTexture(k), roughness: k === 'oilcloth' ? 0.32 : 0.55, metalness: 0 });
      m.own?.(sm);
      return sm;
    }
    return m.mat(c, fabricTexture(k));
  };
  const skin = m.mat(spec.skin, spec.skinMap ?? null);
  const top = creature ? skin : cloth(spec.top);
  const topDark = creature ? skin : cloth(spec.top.clone().multiplyScalar(0.72));
  const bottom = creature ? skin : cloth(spec.bottom, 'wool');
  const accent = m.mat(spec.accent, fabricTexture('cotton'));
  const shoe = spec.barefoot || creature ? skin : m.mat(spec.shoes);
  const lower = bottom;
  void COATED;

  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.95 * k;
  root.add(pelvis);

  // hips
  const hipW = (fem ? 0.165 : 0.15) * b;
  const pel = m.mesh(new THREE.SphereGeometry(1, 18, 12), lower, pelvis, 0, -0.01 * k, 0);
  pel.scale.set(hipW, 0.115 * k, 0.11 * b);

  // torso, waist to neck, with a chest and shoulders
  const chest = new THREE.Group();
  chest.position.y = 0.04 * k;
  chest.rotation.x = spec.hunch * 0.35;
  pelvis.add(chest);
  // waist, belly, ribcage, then shoulders that slope down from the neck instead of a flat shelf
  const prof: [number, number][] = [
    [0.13 * b, 0],
    [(fem ? 0.118 : 0.128) * b, 0.12],
    [(fem ? 0.15 : 0.15) * b + (b > 1.1 ? 0.03 : 0), 0.26],
    [(fem ? 0.158 : 0.166) * b, 0.36],
    [(fem ? 0.152 : 0.168) * b, 0.42],
    [(fem ? 0.135 : 0.15) * b, 0.47],
    [0.105 * b, 0.51],
    [0.072, 0.54],
    [0.055, 0.555],
    [0.001, 0.565],
  ];
  const torsoGeo = new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r, y * k)),
    22,
  );
  const torso = m.mesh(torsoGeo, top, chest);
  torso.scale.z = 0.66;
  // trapezius: the slope from the side of the neck to the top of the arm
  for (const sd of [-1, 1]) {
    const trap = m.mesh(new THREE.SphereGeometry(0.06 * b, 14, 10), top, chest, sd * 0.09 * b, 0.505 * k, -0.01);
    trap.scale.set(1.75, 0.5, 1.05);
    trap.rotation.z = sd * -0.42;
  }
  if (fem && !creature) {
    for (const sd of [-1, 1]) {
      const bust = m.mesh(new THREE.SphereGeometry(0.062 * b, 12, 10), top, chest, sd * 0.065 * b, 0.36 * k, 0.07 * b);
      bust.scale.set(1, 0.85, 0.8);
    }
  }
  if (creature) {
    // ribs under the skin and a spine you can count
    for (let i = 0; i < 6; i++) {
      const r = m.mesh(new THREE.TorusGeometry(0.115 * b, 0.009, 5, 18, Math.PI * 1.15), skin, chest, 0, (0.24 + i * 0.035) * k, 0.005);
      r.rotation.set(Math.PI / 2, 0, -Math.PI * 0.075);
      r.scale.set(1, 0.62, 1);
    }
  }
  // neck
  const neck = m.mesh(limbGeo(0.048, 0.055, 0.1 * k, 12), skin, chest, 0, 0.6 * k, 0);
  neck.scale.z = 0.95;
  const headMount = new THREE.Group();
  headMount.position.set(0, 0.6 * k, 0.005);
  chest.add(headMount);

  // clothing details on the chest
  const front = (y: number): number => {
    let r = prof[0][0];
    for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) {
      const [r0, y0] = prof[i - 1];
      const [r1, y1] = prof[i];
      r = r0 + ((r1 - r0) * (y - y0)) / Math.max(0.001, y1 - y0);
      break;
    }
    return r * 0.66 + 0.004;
  };
  if (!creature) {
    if (spec.outfit === 'suit' || spec.outfit === 'overcoat' || spec.outfit === 'raincoat' || spec.outfit === 'work') {
      // shirt V, tie, lapels
      const v = m.mesh(new THREE.CircleGeometry(0.055, 3), accent, chest, 0, 0.47 * k, front(0.47) + 0.002);
      v.rotation.z = Math.PI;
      v.scale.set(0.9, 1.6, 1);
      if (spec.outfit === 'suit') m.mesh(new THREE.BoxGeometry(0.026, 0.2 * k, 0.006), m.mat(spec.accent.clone().multiplyScalar(0.25)), chest, 0, 0.4 * k, front(0.4) + 0.006);
      for (const sd of [-1, 1]) {
        const lap = m.mesh(new THREE.BoxGeometry(0.05, 0.2 * k, 0.012), topDark, chest, sd * 0.05, 0.42 * k, front(0.42) + 0.004);
        lap.rotation.set(-0.12, 0, sd * 0.35);
      }
    }
    if (spec.outfit === 'cassock' || spec.outfit === 'habit') {
      m.mesh(new THREE.TorusGeometry(0.058, 0.012, 6, 16), accent, chest, 0, 0.545 * k, 0).rotation.x = Math.PI / 2;
    } else if (spec.outfit !== 'nightgown') {
      // a shirt collar: a thin band and two points turned down over the lapels
      m.mesh(new THREE.TorusGeometry(0.058, 0.007, 6, 18), accent, chest, 0, 0.54 * k, 0.004).rotation.x = Math.PI / 2;
      for (const sd of [-1, 1]) {
        const pt = m.mesh(new THREE.BoxGeometry(0.034, 0.045, 0.004), accent, chest, sd * 0.022, 0.515 * k, 0.05);
        pt.rotation.set(-0.5, 0, sd * 0.5);
      }
    }
    if (spec.outfit === 'fur') {
      const fur = m.mesh(new THREE.TorusGeometry(0.12 * b, 0.05, 8, 20), m.mat(spec.accent, fab), chest, 0, 0.5 * k, 0);
      fur.rotation.x = Math.PI / 2;
      fur.scale.set(1, 0.75, 1);
    }
    if (spec.outfit === 'uniform') {
      const apron = m.mesh(new THREE.PlaneGeometry(0.2 * b, 0.36 * k), accent, chest, 0, 0.2 * k, front(0.2) + 0.006);
      apron.rotation.x = -0.05;
    }
    // buttons down the front
    for (let i = 0; i < 4; i++) {
      const y = 0.12 + i * 0.085;
      m.mesh(new THREE.SphereGeometry(0.008, 6, 4), m.mat(new THREE.Color(0x1a1612)), chest, spec.outfit === 'suit' ? 0.012 : 0, y * k, front(y) + 0.004);
    }
  }

  // skirt of a coat, cassock or gown: hangs from the waist, legs show below the hem
  let skirt: THREE.Mesh | null = null;
  const hemY = spec.outfit === 'cassock' || spec.outfit === 'nightgown' || spec.outfit === 'habit' ? 0.12 : spec.outfit === 'uniform' ? 0.48 : spec.outfit === 'fur' || spec.outfit === 'overcoat' || spec.outfit === 'raincoat' ? 0.42 : fem && spec.outfit === 'cardigan' ? 0.5 : -1;
  if (hemY > 0) {
    const len = (0.98 - hemY) * k;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2((0.15 + t * 0.09) * b + Math.sin(t * 3) * 0.006, -len * t));
    }
    const skirtMat = spec.outfit === 'nightgown' || (fem && spec.outfit === 'cardigan') || spec.outfit === 'uniform' ? (spec.outfit === 'uniform' ? accent : bottom) : top;
    const sm = skirtMat.clone();
    sm.side = THREE.DoubleSide;
    skirt = m.mesh(new THREE.LatheGeometry(pts, 22, 0, Math.PI * 2), sm, pelvis, 0, 0.03 * k, 0);
    skirt.scale.z = 0.8;
    if (spec.outfit === 'overcoat' || spec.outfit === 'raincoat' || spec.outfit === 'fur') {
      // the coat opens at the front
      skirt.geometry.dispose();
      skirt.geometry = new THREE.LatheGeometry(pts, 22, Math.PI * 0.12 + Math.PI / 2, Math.PI * 1.76);
    }
  }

  // legs
  const legs: Leg[] = [];
  const thighLen = 0.45 * k;
  const shinLen = 0.42 * k;
  for (const sd of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sd * hipW * 0.55, -0.03 * k, 0);
    pelvis.add(hip);
    m.mesh(limbGeo(0.078 * b, 0.056 * b, thighLen), lower, hip);
    const knee = new THREE.Group();
    knee.position.y = -thighLen;
    hip.add(knee);
    const legMat = spec.outfit === 'nightgown' || (fem && hemY > 0 && spec.outfit !== 'cassock' && spec.outfit !== 'habit') ? skin : lower;
    m.mesh(limbGeo(0.054 * b, 0.036 * b, shinLen), creature ? skin : legMat, knee);
    // foot
    const foot = m.mesh(new THREE.SphereGeometry(1, 12, 8), shoe, knee, 0, -shinLen - 0.045, 0.05);
    foot.scale.set(0.045 * (spec.barefoot ? 0.9 : 1.05), 0.038, spec.barefoot ? 0.11 : 0.13);
    if (!spec.barefoot && !creature) m.mesh(new THREE.BoxGeometry(0.085, 0.015, 0.25), m.mat(spec.shoes.clone().multiplyScalar(0.5)), knee, 0, -shinLen - 0.08, 0.05);
    legs.push({ side: sd, hip, knee });
  }

  // arms
  const arms: Arm[] = [];
  const al = spec.armLength ?? 1;
  const upLen = 0.3 * k * al;
  const foreLen = 0.27 * k * al;
  const shW = (fem ? 0.158 : 0.175) * b;
  for (const sd of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(sd * shW, 0.455 * k, 0);
    chest.add(sh);
    // deltoid: rounds over the top of the arm and runs a third of the way down it
    const delt = m.mesh(new THREE.SphereGeometry(0.05 * b, 14, 10), top, sh, sd * 0.004, -0.035, 0);
    delt.scale.set(1.02, 1.45, 0.92);
    const up = m.mesh(limbGeo(0.052 * b, 0.042 * b, upLen), top, sh);
    up.scale.z = 0.92;
    const el = new THREE.Group();
    el.position.y = -upLen;
    sh.add(el);
    m.mesh(limbGeo(0.042 * b, 0.034 * b, foreLen), top, el);
    if (!creature) m.mesh(new THREE.TorusGeometry(0.036 * b, 0.008, 5, 12), spec.outfit === 'suit' ? accent : topDark, el, 0, -foreLen + 0.01, 0).rotation.x = Math.PI / 2;
    const hand = new THREE.Group();
    hand.position.y = -foreLen - 0.015;
    el.add(hand);
    // wrist, palm with a heel and knuckles, two-jointed fingers of different lengths, a thumb that sits across
    m.mesh(limbGeo(0.026, 0.028, 0.03, 10), skin, hand, 0, 0.005, 0).scale.z = 0.7;
    const palm = m.mesh(new THREE.SphereGeometry(1, 14, 10), skin, hand, 0, -0.05, 0.002);
    palm.scale.set(0.037, 0.048, 0.017);
    const knuck = m.mesh(new THREE.SphereGeometry(1, 12, 6), skin, hand, 0, -0.084, 0.001);
    knuck.scale.set(0.036, 0.014, 0.016);
    const fingers: THREE.Group[] = [];
    const tips: THREE.Group[] = [];
    const lens = creature ? [0.11, 0.12, 0.12, 0.1] : [0.044, 0.052, 0.049, 0.038];
    for (let f = 0; f < 4; f++) {
      const fg = new THREE.Group();
      fg.position.set(sd * (-0.024 + f * 0.0158), -0.09, 0);
      fg.rotation.z = sd * (f - 1.5) * 0.06;
      hand.add(fg);
      const l = lens[f];
      const r = creature ? 0.006 : 0.0082 - f * 0.0005;
      m.mesh(limbGeo(r, r * 0.92, l * 0.55, 7), skin, fg);
      const tip = new THREE.Group();
      tip.position.y = -l * 0.55;
      fg.add(tip);
      m.mesh(limbGeo(r * 0.9, r * 0.75, l * 0.45, 7), skin, tip);
      fingers.push(fg);
      tips.push(tip);
    }
    const th = new THREE.Group();
    th.position.set(sd * -0.034, -0.035, 0.012);
    th.rotation.set(-0.5, 0, sd * 0.75);
    hand.add(th);
    m.mesh(limbGeo(0.011, 0.009, 0.03, 7), skin, th);
    const thTip = new THREE.Group();
    thTip.position.y = -0.03;
    thTip.rotation.x = -0.3;
    th.add(thTip);
    m.mesh(limbGeo(0.009, 0.0075, 0.026, 7), skin, thTip);
    arms.push({ side: sd, sh, el, hand, fingers, tips });
  }
  return { root, pelvis, chest, headMount, arms, legs, skirt, scaleY: k };
}

/** Raw, skinless hide for the tall one. Tendon lines, wet darker joints. */
export function rawSkinTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a2c22';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 80},${40 + Math.random() * 30},${30 + Math.random() * 20},${Math.random() * 0.3})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3);
  }
  g.strokeStyle = 'rgba(210,170,140,0.35)';
  for (let i = 0; i < 40; i++) {
    g.lineWidth = 0.5 + Math.random() * 1.5;
    g.beginPath();
    const x = Math.random() * 256;
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 20 - Math.random() * 40, 80, x + 20 - Math.random() * 40, 170, x + 10 - Math.random() * 20, 256);
    g.stroke();
  }
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 20;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(25,6,6,0.6)');
    gr.addColorStop(1, 'rgba(25,6,6,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}
