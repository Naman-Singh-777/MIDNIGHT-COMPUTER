import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { Archetype, Patient, Verdict } from '../sim/types';
import { drawFace, fabricTexture, sculptHead, type FaceState } from './faces';

const puffTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(220,235,255,0.55)');
  gr.addColorStop(1, 'rgba(220,235,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

export const FEMALE_NAMES = new Set(['Ada', 'Edith', 'Margit', 'Hester', 'Dorothea', 'Agnes', 'Winifred', 'Odette', 'Philippa', 'Mabel', 'Imelda']);

type HairKind = 'none' | 'short' | 'slick' | 'bun' | 'long' | 'scarf' | 'habit';
type HatKind = 'none' | 'trilby' | 'flat' | 'cloche';
type PropKind = 'none' | 'umbrella' | 'goose' | 'redcap' | 'folder' | 'bag';
type PoseKind = 'rest' | 'hold' | 'hug' | 'folded' | 'bag';
type CoatKind = 'overcoat' | 'cardigan' | 'suit' | 'cape';

interface Look {
  female: boolean;
  age: number; // years, drives wrinkles
  skin: [number, number, number];
  hair: HairKind;
  hairColor: string;
  hat: HatKind;
  coat: CoatKind;
  coatColor: THREE.Color;
  eye: string;
  glasses: boolean;
  stubble: boolean;
  prop: PropKind;
  pose: PoseKind;
  shoulder: number; // width scale
}

const SKIN: [number, number, number][] = [
  [236, 204, 180],
  [224, 186, 158],
  [206, 166, 132],
  [168, 124, 94],
  [124, 90, 66],
];
const HAIR = ['#14100d', '#2b1d14', '#4a3222', '#6b6560', '#b8b4aa', '#7a3b1c', '#b39a63'];
const EYES = ['#4b3623', '#2f4a6a', '#56694a', '#6b5a3b', '#1f1a16'];

function lookFor(p: Patient): Look {
  const rng = new Rng((Math.floor(p.hue * 1e6) ^ (p.sprite * 7919) ^ Math.floor(p.height * 1e4)) >>> 0);
  const female = FEMALE_NAMES.has(p.displayName.split(' ')[0] ?? '');
  const t = rng.next();
  const skin = SKIN[t < 0.55 ? 0 : t < 0.8 ? 1 : t < 0.9 ? 2 : t < 0.96 ? 3 : 4];
  const a: Archetype = p.archetype;
  if (p.registryId === 'R209') {
    // Ada Wren. Grey bun, ward cardigan over a nightdress, nothing on her feet.
    return {
      female: true, age: 64, skin: SKIN[0], hair: 'bun', hairColor: '#b8b4aa', hat: 'none', coat: 'cardigan',
      coatColor: new THREE.Color().setHSL(0.09, 0.2, 0.42), eye: EYES[1], glasses: false, stubble: false,
      prop: 'none', pose: 'folded', shoulder: 0.84,
    };
  }
  const base: Look = {
    female,
    age: 45,
    skin,
    hair: female ? 'bun' : 'short',
    hairColor: rng.pick(HAIR),
    hat: 'none',
    coat: 'overcoat',
    coatColor: new THREE.Color().setHSL(0.08 + p.hue * 0.05, 0.3, 0.2),
    eye: rng.pick(EYES),
    glasses: false,
    stubble: false,
    prop: 'none',
    pose: 'rest',
    shoulder: female ? 0.9 : 1,
  };
  switch (a) {
    case 'plain':
      return { ...base, age: 52 + rng.int(-6, 8), hat: female ? 'cloche' : 'trilby', prop: 'umbrella', pose: 'bag', glasses: rng.chance(0.4), stubble: !female && rng.chance(0.5) };
    case 'chatty':
      return {
        ...base,
        age: 44 + rng.int(-8, 10),
        hat: female ? 'cloche' : 'flat',
        coat: 'overcoat',
        coatColor: new THREE.Color().setHSL(0.2, 0.25, 0.24),
        prop: 'goose',
        pose: 'hug',
        glasses: true,
        stubble: !female,
      };
    case 'strange_innocent':
      return {
        ...base,
        age: 24 + rng.int(-3, 6),
        hair: 'long',
        hat: 'none',
        coat: 'cardigan',
        coatColor: new THREE.Color().setHSL(0.1, 0.28, 0.5),
        pose: 'folded',
        shoulder: 0.88,
        hairColor: rng.pick(HAIR.slice(1, 5)),
      };
    case 'tragic':
      return {
        ...base,
        female: true,
        age: 41 + rng.int(-4, 8),
        hair: 'scarf',
        hairColor: '#4c4a47',
        coat: 'overcoat',
        coatColor: new THREE.Color().setHSL(0.62, 0.22, 0.14),
        prop: 'redcap',
        pose: 'hold',
        shoulder: 0.86,
      };
    case 'slipping_mimic':
      return { ...base, age: 38, hat: female ? 'cloche' : 'trilby', coatColor: new THREE.Color().setHSL(0.1, 0.1, 0.27), prop: 'none', pose: 'rest', stubble: false, glasses: false };
    case 'fluent_mimic':
      return {
        ...base,
        age: 46,
        hair: female ? 'slick' : 'slick',
        hairColor: '#1b1613',
        coat: 'suit',
        coatColor: new THREE.Color().setHSL(0.6, 0.1, 0.14),
        prop: 'folder',
        pose: 'hold',
        glasses: false,
        stubble: false,
      };
    case 'voice_mimic':
      return { ...base, female: true, age: 35, hair: 'habit', coat: 'cape', coatColor: new THREE.Color().setHSL(0.62, 0.3, 0.1), pose: 'folded', prop: 'none', shoulder: 0.9 };
  }
}

export type ViewPhase = 'none' | 'approaching' | 'present' | 'leaving';

interface ArmRig {
  sh: THREE.Group;
  el: THREE.Group;
  hand: THREE.Mesh;
  side: number;
}

const POSES: Record<PoseKind, { a: number; b: number; inward: number; elIn: number }> = {
  rest: { a: 0.04, b: 0.12, inward: 0.03, elIn: 0 },
  bag: { a: 0.1, b: 0.5, inward: 0.02, elIn: 0 },
  hold: { a: 0.45, b: 1.3, inward: 0.55, elIn: 0.65 },
  hug: { a: 0.5, b: 1.4, inward: 0.5, elIn: 0.6 },
  folded: { a: 0.5, b: 1.5, inward: 0.65, elIn: 0.85 },
};

export class PatientView {
  readonly group = new THREE.Group();
  private root = new THREE.Group();
  private head = new THREE.Group();
  private torso = new THREE.Group();
  private propGroup = new THREE.Group();
  private arms: ArmRig[] = [];
  private faceMat: THREE.MeshLambertMaterial | null = null;
  private faces: Record<FaceState, THREE.CanvasTexture> | null = null;
  private owned: { dispose: () => void }[] = [];
  private puffs: THREE.Sprite[] = [];
  private patient: Patient | null = null;
  private look: Look | null = null;
  private stage = 0;
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private verdict: Verdict | 'timeout' | null = null;
  private blinkIn = 3;
  private blinkT = 0;
  private stare = false;
  private shown: FaceState = 'open';
  speaking = 0;
  /** Read by the game so the door and lightning can follow the patient. */
  progress = 0;

  /** Character lights live outside the group so hiding the group never changes the light count. */
  readonly rig = new THREE.Group();
  private rim = new THREE.PointLight(0x9ab8d0, 0, 2.4, 1.6);
  private under = new THREE.PointLight(0xffa860, 0, 1.7, 1.8);
  private revealT = 0;
  private glimpseIn = 14;
  /** Set by the game for a few frames when the Understudy shows what it is. */
  revealing = 0;
  /** Called when the face slips on its own for a frame or two. */
  onGlimpse: (() => void) | null = null;

  constructor(private readonly spawn: THREE.Vector3, private readonly stand: THREE.Vector3) {
    this.rig.add(this.rim, this.under);
    this.group.visible = false;
    this.group.add(this.root);
    this.root.add(this.torso, this.head, this.propGroup);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      s.scale.setScalar(0.05);
      this.puffs.push(s);
      this.group.add(s);
    }
  }

  // ------------------------------------------------------------------ build helpers
  private mat(color: THREE.ColorRepresentation): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color });
    this.owned.push(m);
    return m;
  }
  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
    this.owned.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  private clear(): void {
    for (const o of this.owned) o.dispose();
    this.owned = [];
    this.torso.clear();
    this.head.clear();
    this.propGroup.clear();
    this.arms = [];
    if (this.faces) for (const k of Object.keys(this.faces) as FaceState[]) this.faces[k].dispose();
    this.faces = null;
    this.faceMat = null;
  }

  setPatient(p: Patient | null, stage = 0): void {
    this.patient = p;
    this.verdict = null;
    this.t = 0;
    this.stage = stage;
    this.stare = false;
    this.clear();
    if (!p) {
      this.look = null;
      this.group.visible = false;
      return;
    }
    const look = lookFor(p);
    this.look = look;
    this.buildTorso(look, p);
    this.buildHead(look, p);
    this.buildProp(look, p);
    this.root.scale.setScalar(p.height);
    this.group.position.copy(this.spawn);
    this.group.rotation.y = 0;
    this.group.visible = true;
    this.blinkIn = 1.5 + Math.random() * 3;
  }

  private coatRadius(y: number, look: Look): number {
    const s = look.shoulder;
    if (y < 0.55) return 0.27 + (y / 0.55) * 0.03;
    if (y < 1.05) return 0.3 - ((y - 0.55) / 0.5) * 0.06;
    return (0.24 + Math.min(0.06, (y - 1.05) * 0.2)) * (0.85 + s * 0.15);
  }

  private buildTorso(look: Look, p: Patient): void {
    const mimic = p.truth === 'understudy';
    const coat = look.coatColor.clone();
    const coatMat = this.mat(coat);
    const dark = this.mat(coat.clone().multiplyScalar(0.55));
    const light = this.mat(coat.clone().multiplyScalar(1.5));
    for (const m of [coatMat, dark, light]) m.map = fabricTexture();
    const skin = this.mat(new THREE.Color(look.skin[0] / 255, look.skin[1] / 255, look.skin[2] / 255).multiplyScalar(0.8));
    const s = look.shoulder;
    // coat body: a lathe with a wider hem, then a shoulder yoke
    const pts: THREE.Vector2[] = [];
    const hem = look.coat === 'cardigan' ? 0.22 : look.coat === 'suit' ? 0.2 : 0.3;
    for (let y = 0; y <= 1.4; y += 0.1) {
      let r = this.coatRadius(y, look);
      if (y < 0.55) r = Math.min(r, hem + (y / 0.55) * 0.06);
      pts.push(new THREE.Vector2(Math.max(0.01, r), y));
    }
    pts.push(new THREE.Vector2(0.13, 1.44), new THREE.Vector2(0.001, 1.45));
    this.mesh(new THREE.LatheGeometry(pts, 18), coatMat, this.torso);
    const yoke = this.mesh(new THREE.SphereGeometry(0.26, 14, 10), coatMat, this.torso, 0, 1.34, 0);
    yoke.scale.set(1 * s, 0.4, 0.62);
    // shirt, collar, neck
    const shirt = this.mat(look.coat === 'cardigan' ? 0xcfc6b0 : 0xe9e5da);
    const neck = this.mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.1, 10), skin, this.torso, 0, 1.46, 0);
    neck.scale.y = mimic && this.stage >= 3 ? 1.18 : 1;
    this.mesh(new THREE.TorusGeometry(0.075, 0.022, 6, 14), shirt, this.torso, 0, 1.41, 0.005).rotation.x = Math.PI / 2;
    // buttons and lapels
    const front = (y: number): number => this.coatRadius(y, look) + 0.004;
    if (look.coat === 'overcoat' || look.coat === 'suit') {
      for (const y of [1.15, 0.98, 0.82]) {
        this.mesh(new THREE.SphereGeometry(0.018, 6, 5), this.mat(0x151210), this.torso, 0, y, front(y));
      }
      for (const sd of [-1, 1]) {
        const lap = this.mesh(new THREE.BoxGeometry(0.05, 0.3, 0.012), light, this.torso, sd * 0.06, 1.22, front(1.22) + 0.002);
        lap.rotation.z = sd * 0.38;
      }
    }
    if (look.coat === 'cardigan') {
      for (const [i, y] of [1.18, 1.04, 0.9, 0.76].entries()) {
        const col = i === 2 ? 0x7a2a2a : 0x2f2a24;
        this.mesh(new THREE.SphereGeometry(0.019, 6, 5), this.mat(col), this.torso, 0, y, front(y));
      }
      // ribbed hem band
      this.mesh(new THREE.CylinderGeometry(0.255, 0.265, 0.05, 16), dark, this.torso, 0, 0.62, 0);
    }
    if (look.coat === 'suit') {
      const tie = this.mesh(new THREE.BoxGeometry(0.035, 0.22, 0.008), this.mat(0x4a1c20), this.torso, 0, 1.2, front(1.2) + 0.003);
      tie.rotation.x = 0.04;
      this.mesh(new THREE.BoxGeometry(0.1, 0.16, 0.006), shirt, this.torso, 0, 1.28, front(1.28) - 0.01);
    }
    if (look.coat === 'cape') {
      // night staff: white bib and a dark cape
      this.mesh(new THREE.BoxGeometry(0.22, 0.34, 0.012), this.mat(0xe8e6de), this.torso, 0, 1.12, front(1.12) + 0.003);
      this.mesh(new THREE.SphereGeometry(0.29, 14, 8, 0, Math.PI * 2, 0, 1.1), dark, this.torso, 0, 1.2, -0.02).scale.set(1, 0.7, 0.9);
    }
    // wet shoulders: a darker patch for humans, the Understudy comes in dry
    if (!mimic && look.coat !== 'cardigan') {
      const wet = this.mesh(new THREE.SphereGeometry(0.265, 12, 6, 0, Math.PI * 2, 0, 0.8), this.mat(coat.clone().multiplyScalar(0.62)), this.torso, 0, 1.345, 0);
      wet.scale.set(1 * s, 0.36, 0.64);
    }
    // arms: shoulder pivot, upper arm, elbow pivot, forearm, hand
    const sleeve = this.mat(coat.clone().multiplyScalar(look.coat === 'cape' ? 0.9 : 1));
    const pose = POSES[look.pose];
    const lenScale = mimic && this.stage >= 3 ? 1.06 : 1;
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.235 * s, 1.36, 0);
      const up = this.mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.3, 8), sleeve, sh, 0, -0.15, 0);
      up.castShadow = true;
      const el = new THREE.Group();
      el.position.y = -0.3;
      sh.add(el);
      const fore = this.mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.28 * lenScale, 8), sleeve, el, 0, -0.14 * lenScale, 0);
      fore.castShadow = true;
      const hand = this.mesh(new THREE.SphereGeometry(0.04, 8, 6), skin, el, 0, -0.29 * lenScale, 0);
      hand.scale.set(1.1, mimic && this.stage >= 3 ? 1.9 : 1.5, 0.7);
      this.mesh(new THREE.SphereGeometry(0.014, 5, 4), skin, el, side * 0.035, -0.27 * lenScale, 0.015);
      this.torso.add(sh);
      this.arms.push({ sh, el, hand, side });
      sh.rotation.x = -pose.a;
      sh.rotation.z = -side * pose.inward;
      el.rotation.x = -pose.b;
      el.rotation.y = -side * pose.elIn * 0.4;
      el.rotation.z = -side * pose.elIn * 0.3;
    }
  }

  private buildHead(look: Look, p: Patient): void {
    const skinCol = new THREE.Color(look.skin[0] / 255, look.skin[1] / 255, look.skin[2] / 255).multiplyScalar(0.8);
    const skin = this.mat(skinCol);
    const hair = this.mat(look.hairColor);
    this.head.position.y = 1.6;
    const sx = look.female ? 0.88 : 0.94;
    const skullGeo = new THREE.SphereGeometry(0.14, 48, 36);
    sculptHead(skullGeo, look.female);
    const skull = this.mesh(skullGeo, skin, this.head);
    skull.scale.set(sx, 1.12, 0.96);
    // the face patch, mapped over the front of the skull
    this.faces = {
      open: drawFace(look, p, this.stage, 'open'),
      blink: drawFace(look, p, this.stage, 'blink'),
      talk: drawFace(look, p, this.stage, 'talk'),
      stare: drawFace(look, p, this.stage, 'stare'),
      reveal: drawFace(look, p, Math.max(this.stage, 5), 'reveal'),
    };
    this.faceMat = new THREE.MeshLambertMaterial({ map: this.faces.open, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.owned.push(this.faceMat);
    const patchGeo = new THREE.SphereGeometry(0.1425, 48, 36, 0.57, 2.0, 0.55, 1.9);
    sculptHead(patchGeo, look.female);
    const patch = this.mesh(patchGeo, this.faceMat, this.head);
    patch.scale.set(sx, 1.12, 0.96);
    patch.castShadow = false;
    this.shown = 'open';
    // nose, ears
    const nose = this.mesh(new THREE.SphereGeometry(0.022, 8, 6), skin, this.head, 0, -0.022, 0.13 * 0.96);
    nose.scale.set(0.85, 1.5, 1.05);
    for (const sd of [-1, 1]) {
      const ear = this.mesh(new THREE.SphereGeometry(0.03, 8, 6), skin, this.head, sd * 0.136 * sx, -0.005, -0.012);
      ear.scale.set(0.45, 1.05, 0.75);
      if (p.faceMark.includes('notched right ear') && sd === 1) ear.scale.y = 0.8;
    }
    // hair
    const cap = (r: number, theta: number, tilt: number, y = 0.02): THREE.Mesh => {
      const m = this.mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, theta), hair, this.head, 0, y, 0);
      m.scale.set(sx * 1.02, 1.12, 0.98);
      m.rotation.x = tilt;
      return m;
    };
    switch (look.hair) {
      case 'short':
        cap(0.148, 1.18, -0.35);
        break;
      case 'slick':
        cap(0.147, 1.12, -0.45);
        this.mesh(new THREE.BoxGeometry(0.004, 0.01, 0.2), this.mat('#3a3027'), this.head, 0.03, 0.155, -0.02);
        break;
      case 'bun':
        cap(0.148, 1.2, -0.3);
        this.mesh(new THREE.SphereGeometry(0.06, 10, 8), hair, this.head, 0, 0.08, -0.13);
        break;
      case 'long': {
        cap(0.148, 1.25, -0.3);
        const back = this.mesh(new THREE.CylinderGeometry(0.125, 0.1, 0.34, 12, 1, true), hair, this.head, 0, -0.1, -0.06);
        (back.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
        // damp strands over the forehead
        for (const x of [-0.05, 0.0, 0.05]) this.mesh(new THREE.BoxGeometry(0.012, 0.07, 0.01), hair, this.head, x, 0.075, 0.13).rotation.z = x * 3;
        break;
      }
      case 'scarf': {
        const cloth = this.mat('#6b6f6a');
        const wrap = this.mesh(new THREE.SphereGeometry(0.158, 20, 12, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, 2.05), cloth, this.head, 0, 0.0, -0.01);
        wrap.scale.set(sx * 1.04, 1.12, 1.0);
        const top = this.mesh(new THREE.SphereGeometry(0.158, 18, 10, 0, Math.PI * 2, 0, 0.9), cloth, this.head, 0, 0.02, 0);
        top.scale.set(sx * 1.04, 1.12, 1.0);
        top.rotation.x = -0.2;
        this.mesh(new THREE.SphereGeometry(0.04, 8, 6), cloth, this.head, 0, -0.14, 0.09);
        break;
      }
      case 'habit': {
        const white = this.mat('#e8e6de');
        const black = this.mat('#0c0c10');
        const coif = this.mesh(new THREE.SphereGeometry(0.155, 18, 10, 0, Math.PI * 2, 0, 1.35), white, this.head, 0, 0.02, -0.01);
        coif.scale.set(sx * 1.04, 1.12, 1.0);
        coif.rotation.x = -0.25;
        const veil = this.mesh(new THREE.BoxGeometry(0.34, 0.5, 0.03), black, this.head, 0, -0.1, -0.14);
        veil.rotation.x = 0.06;
        this.mesh(new THREE.BoxGeometry(0.29, 0.03, 0.06), white, this.head, 0, 0.105, 0.115).rotation.x = -0.35;
        break;
      }
      default:
        break;
    }
    // hat
    const felt = this.mat(look.coatColor.clone().multiplyScalar(0.9));
    if (look.hat === 'trilby') {
      const brim = this.mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.012, 20), felt, this.head, 0, 0.105, 0);
      brim.scale.z = 1.1;
      brim.rotation.x = -0.1;
      const crown = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 14), felt, this.head, 0, 0.17, 0);
      crown.rotation.x = -0.05;
      this.mesh(new THREE.CylinderGeometry(0.133, 0.134, 0.03, 14), this.mat(0x14110e), this.head, 0, 0.13, 0).rotation.x = -0.05;
      this.mesh(new THREE.BoxGeometry(0.1, 0.02, 0.025), felt, this.head, 0, 0.235, 0.0);
    } else if (look.hat === 'flat') {
      const crown = this.mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, 1.35), felt, this.head, 0, 0.07, 0);
      crown.scale.set(1.05, 0.55, 1.18);
      const peak = this.mesh(new THREE.BoxGeometry(0.17, 0.012, 0.1), felt, this.head, 0, 0.085, 0.16);
      peak.rotation.x = 0.28;
    } else if (look.hat === 'cloche') {
      const bell = this.mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, 1.22), felt, this.head, 0, 0.045, -0.01);
      bell.scale.set(sx * 1.08, 1.0, 1.04);
      this.mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.01, 18), felt, this.head, 0, 0.075, 0.0).scale.set(sx, 1, 1.05);
      this.mesh(new THREE.SphereGeometry(0.018, 6, 5), this.mat(0xb8a06a), this.head, 0.12, 0.06, 0.06);
    }
  }

  private buildProp(look: Look, p: Patient): void {
    const g = this.propGroup;
    switch (look.prop) {
      case 'umbrella': {
        const dark = this.mat(0x15130f);
        const shaft = this.mesh(new THREE.CylinderGeometry(0.02, 0.026, 1.0, 8), dark, g, 0.28, 0.5, 0.26);
        shaft.rotation.z = 0.03;
        const wrap = this.mesh(new THREE.ConeGeometry(0.06, 0.55, 8), dark, g, 0.285, 0.45, 0.26);
        wrap.rotation.x = Math.PI;
        const hook = this.mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 10, Math.PI * 1.2), this.mat(0x4a2a18), g, 0.25, 1.0, 0.26);
        hook.rotation.z = Math.PI;
        break;
      }
      case 'goose': {
        const china = this.mat(0xe8e4d6);
        const blue = this.mat(0x35507a);
        const body = this.mesh(new THREE.SphereGeometry(0.14, 14, 10), china, g, 0, 1.08, 0.36);
        body.scale.set(0.85, 0.8, 1.2);
        const neck = this.mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8), china, g, 0, 1.24, 0.43);
        neck.rotation.x = 0.35;
        this.mesh(new THREE.SphereGeometry(0.052, 10, 8), china, g, 0, 1.36, 0.47);
        const beak = this.mesh(new THREE.ConeGeometry(0.02, 0.07, 6), this.mat(0xd4802a), g, 0, 1.355, 0.53);
        beak.rotation.x = Math.PI / 2;
        this.mesh(new THREE.TorusGeometry(0.04, 0.008, 5, 12), blue, g, 0, 1.28, 0.45).rotation.x = Math.PI / 2 - 0.35;
        for (const sd of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.008, 5, 4), this.mat(0x111111), g, sd * 0.02, 1.37, 0.5);
        // a hairline crack
        this.mesh(new THREE.BoxGeometry(0.004, 0.09, 0.004), this.mat(0x6a6256), g, 0.05, 1.1, 0.49);
        break;
      }
      case 'redcap': {
        const wool = this.mat(0xa02828);
        const c = this.mesh(new THREE.SphereGeometry(0.075, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.9), wool, g, 0, 1.12, 0.38);
        c.rotation.x = -0.4;
        this.mesh(new THREE.TorusGeometry(0.072, 0.014, 6, 12), this.mat(0x7a1c1c), g, 0, 1.115, 0.375).rotation.x = Math.PI / 2 - 0.4;
        this.mesh(new THREE.SphereGeometry(0.02, 6, 5), this.mat(0xd8d0c0), g, 0, 1.18, 0.35);
        break;
      }
      case 'folder': {
        this.mesh(new THREE.BoxGeometry(0.24, 0.015, 0.32), this.mat(0xcfc29c), g, 0.0, 1.12, 0.4).rotation.x = -0.35;
        this.mesh(new THREE.BoxGeometry(0.2, 0.004, 0.26), this.mat(0xf0ece0), g, 0.0, 1.13, 0.4).rotation.x = -0.35;
        break;
      }
      case 'bag':
      case 'none':
        break;
    }
    void p;
  }

  setStare(on: boolean): void {
    this.stare = on;
  }

  beginLeave(v: Verdict | 'timeout'): void {
    this.verdict = v;
    this.t = 0;
    this.from.copy(this.group.position);
    if (v === 'admit' || v === 'observe') this.to.set(-3.2, 0, -3.2);
    else if (v === 'refuse' || v === 'timeout') this.to.copy(this.spawn).setZ(-9.5);
    else this.to.copy(this.group.position);
  }

  private setFace(s: FaceState): void {
    if (!this.faceMat || !this.faces || s === this.shown) return;
    this.faceMat.map = this.faces[s];
    this.shown = s;
  }

  update(dt: number, phase: ViewPhase, cam: THREE.Vector3, quiet: boolean): void {
    const p = this.patient;
    const look = this.look;
    const on = !!p && !!look && this.group.visible;
    this.rig.position.copy(this.group.position);
    this.rim.position.set(0.35, 1.95, -0.55);
    this.under.position.set(0, 0.95, 0.6);
    this.rim.intensity = on ? 2.2 : 0;
    this.under.intensity = on ? (p!.truth === 'understudy' ? 1.6 : 0.9) : 0;
    if (!p || !look || !this.group.visible) return;
    this.t += dt;
    const understudy = p.truth === 'understudy';
    const g = this.group;
    const arch = p.archetype;
    const sway = understudy ? Math.sin(this.t * 0.9) * 0.006 : Math.sin(this.t * 0.9 + p.hue * 6) * 0.012 + Math.sin(this.t * 2.3) * 0.006;

    if (phase === 'approaching') {
      const k = Math.min(1, this.t / 3.5);
      this.progress = k;
      g.position.lerpVectors(this.spawn, this.stand, k);
      // humans bob as they walk. The Understudy glides a little too evenly.
      g.position.y = understudy ? Math.abs(Math.sin(this.t * 5.2)) * 0.012 : Math.abs(Math.sin(this.t * 5.2)) * 0.035 * (1 - k * 0.6);
      g.rotation.y = 0;
    } else if (phase === 'present') {
      this.progress = 1;
      g.position.copy(this.stand);
      g.position.x += sway;
      g.position.y = 0;
    } else if (phase === 'leaving') {
      const k = Math.min(1, this.t / 2.6);
      if (this.verdict === 'contain') {
        g.position.copy(this.stand);
        g.position.y = -Math.pow(k, 2) * 2.4;
      } else {
        g.position.lerpVectors(this.from, this.to, k);
        g.position.y = Math.abs(Math.sin(this.t * 5.2)) * 0.03;
        g.rotation.y = this.to.x < -1 ? -1.2 : 0;
      }
      if (k >= 1 && this.verdict !== null) g.visible = false;
    }

    // head: humans look at you with a lag; the Understudy looks at you a little too early and too still
    const dx = cam.x - g.position.x;
    const dz = cam.z - g.position.z;
    const yaw = Math.atan2(dx, dz) - g.rotation.y;
    const lag = understudy ? 14 : 4;
    const head = this.head;
    head.rotation.y += (THREE.MathUtils.clamp(yaw, -1, 1) - head.rotation.y) * Math.min(1, dt * lag);
    const tilt = understudy ? 0.06 + Math.min(this.stage, 7) * 0.012 : Math.sin(this.t * 0.7 + p.hue * 5) * 0.03;
    head.rotation.z = this.stare ? 0.16 : tilt + Math.sin(this.t * 0.3) * (understudy ? 0.004 : 0.01);
    head.rotation.x = this.speaking > 0 ? Math.sin(this.t * 11) * 0.04 : arch === 'tragic' ? 0.12 : 0;
    this.speaking = Math.max(0, this.speaking - dt);

    // faces: blink, talk, stare
    let face: FaceState = 'open';
    // the Understudy slips. A frame or two of the other face, then it is back.
    if (understudy && phase === 'present' && this.stage >= 2) {
      this.glimpseIn -= dt;
      if (this.glimpseIn <= 0) {
        this.revealT = 0.07 + Math.random() * 0.06;
        this.onGlimpse?.();
        this.glimpseIn = 10 + Math.random() * 16 - this.stage;
      }
    }
    this.revealT = Math.max(this.revealT - dt, this.revealing);
    this.revealing = Math.max(0, this.revealing - dt);
    const showing = understudy && this.revealT > 0;
    head.scale.set(showing ? 0.93 : 1, showing ? 1.2 : 1, 1);
    if (showing) {
      head.rotation.z += (Math.random() - 0.5) * 0.25;
      head.position.x = (Math.random() - 0.5) * 0.02;
    } else head.position.x = 0;
    if (showing) face = 'reveal';
    else if (this.stare) face = 'stare';
    else if (this.speaking > 0 && Math.sin(this.t * 17) > -0.2) face = 'talk';
    else {
      this.blinkIn -= dt;
      const never = understudy && this.stage >= 2;
      if (!never && this.blinkIn <= 0) {
        this.blinkT = understudy ? 0.38 : 0.12;
        this.blinkIn = understudy ? 7 + Math.random() * 4 : 1.8 + Math.random() * 3.6;
      }
      if (this.blinkT > 0) {
        this.blinkT -= dt;
        face = 'blink';
      }
    }
    this.setFace(face);

    // body language per archetype. The Understudy does very little of it.
    const torso = this.torso;
    const breathe = understudy ? 0 : Math.sin(this.t * 1.6 + p.hue * 4) * 0.006;
    torso.scale.set(1 + breathe, 1 + breathe * 1.4, 1 + breathe);
    this.root.rotation.z = 0;
    this.root.rotation.x = 0;
    if (!understudy) {
      if (arch === 'strange_innocent') {
        this.root.rotation.z = Math.sin(this.t * 1.7) * 0.035; // rocking, humming
        torso.position.x = Math.sin(this.t * 30) * 0.0025; // shivers
      } else if (arch === 'chatty') {
        this.root.rotation.z = Math.sin(this.t * 0.6) * 0.02;
      } else if (arch === 'tragic') {
        this.root.rotation.x = 0.04;
      } else if (arch === 'plain') {
        this.root.rotation.z = Math.sin(this.t * 0.45) * 0.015; // shifts weight
      }
    } else {
      this.root.rotation.x = -0.015; // stands a degree too straight
    }
    const pose = POSES[look.pose];
    for (const a of this.arms) {
      let fidget = 0;
      if (!understudy) {
        if (arch === 'tragic') fidget = Math.sin(this.t * 2.2 + a.side) * 0.08; // worrying the cap
        else if (arch === 'chatty' && this.speaking > 0) fidget = Math.sin(this.t * 7 + a.side * 2) * 0.12;
        else fidget = Math.sin(this.t * 0.8 + a.side) * 0.02;
      }
      a.sh.rotation.x = -pose.a + fidget;
      a.el.rotation.x = -pose.b - fidget * 0.6;
    }
    this.propGroup.position.y = !understudy && arch === 'chatty' ? Math.sin(this.t * 1.6) * 0.004 : 0;

    // breath fog in the cold hall. The Understudy sometimes forgets.
    const breath = !p.tells.includes('no_breath') && !quiet;
    this.puffs.forEach((s, i) => {
      const ph = ((this.t + i * 1.15) % 3.45) / 3.45;
      const mat = s.material as THREE.SpriteMaterial;
      if (!breath || phase !== 'present' || ph > 0.7) {
        mat.opacity = 0;
        return;
      }
      s.position.set(0, 1.52 + ph * 0.08, 0.18 + ph * 0.28);
      s.scale.setScalar(0.04 + ph * 0.17);
      mat.opacity = (1 - ph / 0.7) * 0.55 * Math.min(1, ph * 8);
    });
  }
}
