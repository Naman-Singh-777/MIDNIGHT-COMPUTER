import * as THREE from 'three';
import type { Patient } from '../sim/types';
import { drawFace, sculptHead } from './faces';
import { buildBody, rawSkinTexture, type Rig } from './humanoid';
import { buildHuman, humansReady, loadHumans, type HumanRig, type SculptInfo } from './human';
import type { Look } from './looks';

/**
 * The tall one in the corridor.
 *
 * It was a man once. It is built on the same authored body as the visitors, then pulled out of shape: a neck
 * twice too long, a narrow ribcage you can count, arms that hang past the knees, hands half again too long,
 * fingers like roots, big flat feet. It stands about 2.7 m, so its head is up among the pipes under a 2.9 m
 * ceiling. Long wet hair hangs over most of its face; what shows through is almost a face.
 *
 * It moves in layers, all driven by seeded, filtered noise and timed events, never by per-frame randomness:
 *  - base: very slow breathing, sway, weight shifts
 *  - micro: head and shoulder tremor, fingers that twitch on their own
 *  - reaction: the head turns before the body, overshoots, corrects, then stops dead
 *  - locomotion: a long stride tied to the distance actually travelled (so feet do not slide), one leg a little
 *    shorter in its step, the knee late, the torso catching up behind the feet
 *  - horror: whole-body freezes, a sudden lunge followed by stillness, the head staying on you as it walks away
 *
 * Head states: dormant, watching, wrong, search, locked, burst, withdraw. The sim's stalker mode picks among them.
 * Built once and shown or hidden. It holds no lights. Until the authored bodies load, the old procedural figure
 * stands in.
 */
type HeadState = 'dormant' | 'watching' | 'wrong' | 'search' | 'locked' | 'burst' | 'withdraw';

/** Smooth 1D value noise, -1 to 1, deterministic per seed. */
function noise1(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n: number): number => {
    let x = Math.imul(n ^ Math.imul(seed, 0x9e3779b1), 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
  };
  const u = f * f * (3 - 2 * f);
  return (h(i) + (h(i + 1) - h(i)) * u) * 2 - 1;
}
/** Seeded generator for event timing. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const vn = (x: number, y: number, z: number): number => (noise1(x * 1.7 + y * 3.1, 11) + noise1(y * 1.3 - z * 2.3, 23) + noise1(z * 1.9 + x * 0.7, 37)) / 6 + 0.5;

const LOOK: Look = {
  female: false, age: 88, height: 2.72, build: 0.7, hunch: 0.3, skin: [110, 92, 80], hair: 'none', hairColor: '#0a0908', hat: 'none',
  outfit: 'creature', top: '#000000', bottom: '#000000', shoes: '#000000', accent: '#000000', eye: '#b8b4a0', glasses: false,
  facial: 'none', lipstick: false, prop: 'none', pose: 'rest', barefoot: true, grime: 0,
};
const HEIGHT = 2.72;

export class CreatureView {
  readonly group = new THREE.Group();
  private rig: Rig;
  private head = new THREE.Group();
  private t = 0;
  private ph = 0;
  private lastX = 0;
  readonly faceImage: HTMLCanvasElement;
  /** Height of its eyes above its feet, for the last frame of a death. */
  faceHeight = 2.2;

  private h: HumanRig | null = null;
  private owned: { dispose(): void }[] = [];
  private bone = new Map<string, THREE.Object3D>();
  private restHipY = 1;
  private legLen = 1;
  private stride = 0.95;
  private gait = 0;
  private yaw = 0;
  private headYaw = 0;
  private headYawV = 0;
  private headPitch = 0;
  private lean = 0;
  private state: HeadState = 'dormant';
  private stateT = 0;
  private wrongTarget = 0;
  private frozen = 0;
  private nextFreeze = 7;
  private burst = 0;
  private nextBurst = 2.5;
  private watchT = 0;
  private nextWatch = 5;
  private fingerT: number[] = [];
  private fingerCurl: number[] = [];
  private fingerWant: number[] = [];
  private breath = 0;
  private ribbons: THREE.Object3D[] = [];
  private r = rng(1717);
  private P: Float32Array | null = null;
  private N: Float32Array | null = null;
  private info: SculptInfo | null = null;
  private wounds: { p: THREE.Vector3; r: number }[] = [];

  constructor() {
    const skin = rawSkinTexture();
    const mats: THREE.Material[] = [];
    this.rig = buildBody(
      { height: 2.45, build: 0.62, female: false, hunch: 0.5, skin: new THREE.Color(0xb88878), outfit: 'creature', top: new THREE.Color(0), bottom: new THREE.Color(0), shoes: new THREE.Color(0), accent: new THREE.Color(0x3a2a24), barefoot: true, armLength: 1.45, skinMap: skin },
      {
        mat: (c, m) => {
          const mm = new THREE.MeshLambertMaterial({ color: c, map: m ?? null });
          mats.push(mm);
          return mm;
        },
        mesh: (geo, mat, parent, x = 0, y = 0, z = 0) => {
          const m = new THREE.Mesh(geo, mat);
          m.position.set(x, y, z);
          parent.add(m);
          return m;
        },
      },
    );
    this.group.add(this.rig.root);
    // the face the fakes wear underneath, still used by the ward slot scare
    const fake = { truth: 'understudy', hue: 0.77, faceMark: '' } as Patient;
    const tex = drawFace({ female: false, age: 70, skin: [190, 170, 160], hair: 'none', hairColor: '#000', eye: '#000', glasses: false, stubble: false }, fake, 7, 'reveal');
    this.faceImage = tex.image as HTMLCanvasElement;
    const skull = new THREE.SphereGeometry(0.14, 32, 24);
    sculptHead(skull, false);
    const bone = new THREE.Mesh(skull, new THREE.MeshLambertMaterial({ color: 0x9a7a6c, map: skin }));
    bone.scale.set(0.82, 1.5, 0.95);
    const patchGeo = new THREE.SphereGeometry(0.1425, 32, 24, 0.57, 2.0, 0.55, 1.9);
    sculptHead(patchGeo, false);
    const patch = new THREE.Mesh(patchGeo, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1 }));
    patch.scale.copy(bone.scale);
    this.head.add(bone, patch);
    this.head.position.y = 0.17;
    this.rig.headMount.add(this.head);
    this.group.visible = false;
    void loadHumans();
    for (let i = 0; i < 10; i++) {
      this.fingerT.push(this.r() * 3);
      this.fingerCurl.push(-0.15);
      this.fingerWant.push(-0.15);
    }
  }

  // ---------------------------------------------------------------- the authored body
  private build(): void {
    const own = (d: { dispose(): void }): void => {
      this.owned.push(d);
    };
    const self = this;
    const h = buildHuman(
      LOOK,
      {
        body: 'creature',
        skin: new THREE.Color(0.36, 0.3, 0.26),
        fake: true,
        stage: 0,
        armLength: 1,
        seed: 1717,
        fitHeight: HEIGHT,
        shoulderDrop: 0.2,
        armOut: 0.05,
        stretch: {
          hips: [1, 0.78],
          spine: [1.25, 0.76],
          spine1: [1.22, 0.78],
          chest: [1.12, 0.84],
          neck: [1.95, 0.68],
          head: [1.16, 0.9],
          jaw: [1.3, 0.92],
          'clav.L': [1.38, 1],
          'clav.R': [1.18, 1],
          upper: [1.5, 0.66],
          fore: [1.78, 0.58],
          hand: [1.6, 0.82],
          f2a: [1.9, 0.78], f3a: [2.05, 0.78], f4a: [1.95, 0.78], f5a: [1.7, 0.78],
          f2b: [2.2, 0.72], f3b: [2.35, 0.72], f4b: [2.2, 0.72], f5b: [1.9, 0.72],
          thumb: [1.6, 0.8],
          thigh: [1.3, 0.62],
          shin: [1.42, 0.58],
          foot: [1.42, 0.95],
        },
        sculpt: (P, N, info) => self.sculpt(P, N, info),
        paint: (info, rgb, wet) => self.paint(info, rgb, wet),
      },
      own,
    );
    this.h = h;
    h.root.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bone.set(o.name, o);
    });
    // a skin that is mostly matte and dry, with no warm living sheen
    h.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (m && (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        m.sheen = 0;
        m.roughness = 0.82;
        m.specularIntensity = 0.7;
        m.bumpScale = 0.9;
      }
    });
    // eyes: the left milky with a pinprick pupil, the right black and wet, both sunk deep
    const black = h.blackEye;
    h.eyes[1].ball.material = black;
    for (const e of h.eyes) e.ball.scale.setScalar(0.92);
    h.setExpr('mouthOpen', 0.32);
    h.setExpr('frown', 0.6);
    h.jaw.rotation.x = 0.14;
    h.jaw.rotation.z = 0.05;
    for (const m of h.mouthParts) m.visible = m.geometry.type !== 'SphereGeometry'; // no tongue
    this.hair(h);
    this.tissue(h);
    this.group.add(h.root);
    this.rig.root.visible = false;
    this.restHipY = h.pelvis.position.y;
    const knee = this.bone.get('shin.L')!.position.length();
    const ankle = this.bone.get('foot.L')!.position.length();
    this.legLen = knee + ankle;
    this.stride = this.legLen * 0.62;
    const eye = h.eyes[0].holder.getWorldPosition(new THREE.Vector3());
    this.faceHeight = eye.y - h.root.getWorldPosition(new THREE.Vector3()).y;
  }

  /** Starvation and decay, cut into the rest-pose surface. */
  private sculpt(P: Float32Array, N: Float32Array, info: SculptInfo): void {
    this.P = P;
    this.N = N;
    this.info = info;
    const k = info.k;
    const chest = info.joint('chest');
    const spine1 = info.joint('spine1');
    const spine = info.joint('spine');
    const neck = info.joint('neck');
    const r = rng(99);
    const push = (i: number, d: number): void => {
      P[i * 3] += N[i * 3] * d;
      P[i * 3 + 1] += N[i * 3 + 1] * d;
      P[i * 3 + 2] += N[i * 3 + 2] * d;
    };
    // wounds: torn pits on the torso, arms and one thigh
    const pick = (names: string[]): THREE.Vector3 => {
      for (let tries = 0; tries < 400; tries++) {
        const i = Math.floor(r() * info.nBody);
        if (info.weight(i, names) > 0.8 && N[i * 3 + 2] > -0.2) return new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      }
      return new THREE.Vector3(0, chest.y, chest.z + 0.1);
    };
    for (const [names, rad] of [[['chest'], 0.035], [['spine1'], 0.03], [['spine'], 0.045], [['upper'], 0.025], [['fore'], 0.03], [['fore'], 0.022], [['thigh'], 0.04], [['shin'], 0.025]] as [string[], number][]) {
      this.wounds.push({ p: pick(names), r: rad * k });
    }
    for (let i = 0; i < info.nBody; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const torso = info.weight(i, ['spine', 'spine1', 'chest']);
      // ribs: grooves between them, sloping down toward the front, deepest on the sides
      if (torso > 0.4 && y > spine1.y - 0.08 * k && y < chest.y + 0.16 * k) {
        const yy = y - (z - chest.z) * 0.35;
        const ph = (yy - spine1.y) / (0.034 * k);
        const groove = Math.pow(0.5 - 0.5 * Math.cos(ph * Math.PI * 2), 3);
        const side = Math.min(1, Math.abs(x) / (0.05 * k)) * (z > chest.z - 0.05 * k ? 1 : 0.4);
        push(i, -0.0075 * k * groove * side * torso);
      }
      // the belly sucked in under the ribs
      if (torso > 0.4 && y < spine1.y + 0.02 * k && y > spine.y - 0.12 * k && N[i * 3 + 2] > 0.2) push(i, -0.022 * k * N[i * 3 + 2] * torso * (1 - Math.abs(x) / (0.16 * k)));
      // collarbones and the top of the sternum stand out
      if (Math.abs(y - (neck.y - 0.03 * k)) < 0.02 * k && z > neck.z && Math.abs(x) > 0.02 * k) push(i, 0.004 * k);
      for (const w of this.wounds) {
        const d = Math.hypot(x - w.p.x, y - w.p.y, z - w.p.z);
        if (d < w.r) push(i, -0.012 * k * Math.pow(1 - d / w.r, 2));
      }
      // knuckles, knees and elbows: bone under thin skin
      const knob = info.weight(i, ['f2a', 'f3a', 'f4a', 'f5a']);
      if (knob > 0.5) push(i, 0.0015 * k);
    }
  }

  /** Layered decay: dry sallow skin, bruised rot, dried blood, fresh wet blood in drips, exposed bone, black nails. */
  private paint(info: SculptInfo, rgb: Float32Array, wet: Float32Array): void {
    const P = this.P!;
    const N = this.N!;
    const k = info.k;
    const neck = info.joint('neck');
    const head = info.joint('head');
    const c = new THREE.Color();
    // colours given in sRGB (as picked by eye) and converted to the linear values the vertex colours need
    const base = new THREE.Color('#6b5a4c');
    const rot = new THREE.Color('#3e4232');
    const dried = new THREE.Color('#2a120c');
    const fresh = new THREE.Color('#5e0a0c');
    const boneC = new THREE.Color('#b4a68a');
    const nail = new THREE.Color('#1a1512');
    for (let i = 0; i < info.nBody; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const sx = x / k, sy = y / k, sz = z / k;
      let w = 0.15 + vn(sx * 9, sy * 9, sz * 9) * 0.2; // a damp sheen everywhere, unevenly
      c.copy(base).multiplyScalar(0.75 + vn(sx * 4, sy * 4, sz * 4) * 0.45);
      c.lerp(rot, Math.min(1, Math.max(0, vn(sx * 3 + 5, sy * 2, sz * 3) - 0.38) * 2.4));
      // veins and bruising under thin skin: dark threads along the limbs
      const vein = Math.abs(noise1(sy * 40 + sx * 9, 77) + noise1(sz * 37 - sy * 5, 79) * 0.5);
      if (vein < 0.08) c.multiplyScalar(0.55 + vein * 4);
      // dried blood: brown-black crusts
      const d1 = vn(sx * 6 + 9, sy * 5, sz * 6);
      if (d1 > 0.53) {
        c.lerp(dried, Math.min(1, (d1 - 0.53) * 4));
        w = Math.min(w, 0.1);
      }
      // fresh blood runs down: from the mouth over the chin and neck, out of every wound, and down the hands
      let run = 0;
      const mouthDrip = info.weight(i, ['head', 'jaw', 'neck', 'chest']) > 0.3 && z > neck.z && y < head.y - 0.02 * k && y > neck.y - 0.35 * k ? Math.max(0, 1 - Math.abs(x) / (0.05 * k)) : 0;
      run = Math.max(run, mouthDrip * (vn(sx * 30, sy * 2.5, sz * 30) > 0.52 ? 1 : 0.25));
      for (const wd of this.wounds) {
        const dx = Math.hypot(x - wd.p.x, z - wd.p.z);
        const below = wd.p.y - y;
        if (dx < wd.r * 1.4 && below > -wd.r && below < 0.4 * k) run = Math.max(run, (1 - dx / (wd.r * 1.4)) * (vn(sx * 40, sy * 3, sz * 40) > 0.48 ? 1 : 0.2) * (1 - Math.max(0, below) / (0.4 * k)));
        const dd = Math.hypot(x - wd.p.x, y - wd.p.y, z - wd.p.z);
        if (dd < wd.r * 0.55) {
          // the wound itself: wet and dark, with bone showing at the bottom of the deeper ones
          c.copy(fresh).multiplyScalar(0.6);
          if (dd < wd.r * 0.22 && wd.r > 0.03 * k) c.copy(boneC).multiplyScalar(0.8);
          w = 1;
        }
      }
      const hand = info.weight(i, ['hand', 'f2a', 'f2b', 'f3a', 'f3b', 'f4a', 'f4b', 'f5a', 'f5b', 'thumb']);
      if (hand > 0.4) run = Math.max(run, (vn(sx * 25, sy * 6, sz * 25) > 0.45 ? 0.9 : 0.4) * hand);
      if (run > 0.05) {
        c.lerp(fresh, Math.min(1, run));
        w = Math.max(w, run);
      }
      // bone breaking through on the shins and the backs of the hands, where skin is thinnest
      const shin = info.weight(i, ['shin']);
      if (shin > 0.6 && N[i * 3 + 2] > 0.5 && vn(sx * 14, sy * 14, sz * 14) > 0.66) {
        c.copy(boneC).multiplyScalar(0.85 + vn(sx * 50, sy * 50, sz * 50) * 0.2);
        w = 0.05;
      }
      // fingertips: black, split nails
      const tip = info.weight(i, ['f2b', 'f3b', 'f4b', 'f5b']);
      if (tip > 0.7) {
        c.lerp(nail, 0.7);
        w = 0.5;
      }
      // sockets: dark around the eyes
      const nearEye = info.weight(i, ['head']) > 0.7 && y > head.y && Math.abs(x) < 0.06 * k && z > head.z + 0.04 * k ? 1 : 0;
      if (nearEye) c.multiplyScalar(0.75);
      rgb[i * 3] = c.r;
      rgb[i * 3 + 1] = c.g;
      rgb[i * 3 + 2] = c.b;
      wet[i] = w;
    }
  }

  /** Long, wet, clumped hair hanging from the scalp, most of it in front of the face. */
  private hair(h: HumanRig): void {
    const P = this.P!, N = this.N!, info = this.info!;
    const k = info.k;
    const head = info.joint('head');
    const eye = h.eyes[0].holder.getWorldPosition(new THREE.Vector3());
    const r = rng(7);
    const roots: number[] = [];
    for (let i = 0; i < info.nBody; i++) if (info.weight(i, ['head']) > 0.85 && P[i * 3 + 1] > eye.y + 0.035 * k && N[i * 3 + 1] > -0.2) roots.push(i);
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const cards = 90;
    for (let c = 0; c < cards; c++) {
      const i = roots[Math.floor(r() * roots.length)];
      const root = new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).addScaledVector(new THREE.Vector3(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]), 0.004 * k);
      const front = root.z > head.z + 0.03 * k;
      // a parting down the middle: the hair hangs either side of the face, so a strip of it shows through
      if (front && Math.abs(root.x) < 0.02 * k) continue;
      const length = (front ? 0.42 : 0.55) * k * (0.6 + r() * 0.6);
      const width = (0.012 + r() * 0.016) * k;
      const out = new THREE.Vector3(N[i * 3], 0, N[i * 3 + 2]).normalize();
      const across = new THREE.Vector3(-out.z, 0, out.x);
      const segs = 9;
      const base = pos.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        // first outward over the skull, then straight down; strands in front clear the face and hang over it
        const p = root.clone()
          .addScaledVector(out, (front ? 0.05 : 0.025) * k * Math.min(1, t * 4) + 0.008 * k * t)
          .add(new THREE.Vector3(0, -length * Math.pow(t, 1.1), 0))
          .addScaledVector(across, Math.sin(t * 5 + c) * 0.006 * k * t);
        const wdt = width * (1 - t * 0.7) * (s === 0 ? 0.6 : 1); // clumps narrow to wet points
        pos.push(p.x - across.x * wdt / 2, p.y, p.z - across.z * wdt / 2, p.x + across.x * wdt / 2, p.y, p.z + across.z * wdt / 2);
        uv.push(c % 4 / 4, t, (c % 4 + 1) / 4, t);
        if (s < segs) {
          const a = base + s * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // strand texture: dark lines with gaps, the clump edges broken
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 256;
    const gx = cv.getContext('2d')!;
    gx.clearRect(0, 0, 128, 256);
    for (let n = 0; n < 160; n++) {
      const x = r() * 128;
      gx.strokeStyle = `rgba(${20 + r() * 25},${16 + r() * 18},${14 + r() * 14},${0.6 + r() * 0.4})`;
      gx.lineWidth = 1 + r() * 2.5;
      gx.beginPath();
      gx.moveTo(x, 0);
      gx.bezierCurveTo(x + (r() - 0.5) * 10, 90, x + (r() - 0.5) * 14, 170, x + (r() - 0.5) * 6, 256 - r() * 60);
      gx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0x3a322c, roughness: 0.32, metalness: 0, alphaTest: 0.45, side: THREE.DoubleSide });
    this.owned.push(g, tex, mat);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    const hb = this.bone.get('head')!;
    hb.add(mesh);
    mesh.position.copy(hb.worldToLocal(new THREE.Vector3()));
  }

  /** Strips of torn tissue hanging from the forearms, the ribs and a thigh. They sway on their own. */
  private tissue(h: HumanRig): void {
    const P = this.P!, N = this.N!, info = this.info!;
    const k = info.k;
    const r = rng(31);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a0e0c, roughness: 0.25, metalness: 0 });
    this.owned.push(mat);
    void h;
    for (const name of ['fore.L', 'fore.R', 'fore.L', 'chest', 'spine1', 'thigh.R', 'upper.R']) {
      const bone = this.bone.get(name)!;
      let i = 0;
      for (let tries = 0; tries < 500; tries++) {
        i = Math.floor(r() * info.nBody);
        if (info.weight(i, [name]) > 0.8 && N[i * 3 + 1] < 0.3) break;
      }
      const root = new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      const out = new THREE.Vector3(N[i * 3], 0, N[i * 3 + 2]).normalize();
      const length = (0.08 + r() * 0.16) * k;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        pts.push(new THREE.Vector3(out.x * 0.01 * k * Math.sin(t * 3), -length * t, out.z * 0.01 * k * Math.sin(t * 3)));
      }
      // a flattened strip that narrows to a thread
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.006 * k, 5);
      const pa = g.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pa.count; v++) {
        const t = -pa.getY(v) / length;
        const s = 1 - Math.min(1, Math.max(0, t)) * 0.85;
        pa.setX(v, pa.getX(v) * s * 1.6);
        pa.setZ(v, pa.getZ(v) * s * 0.5);
      }
      g.computeVertexNormals();
      this.owned.push(g);
      const holder = new THREE.Group();
      bone.add(holder);
      holder.position.copy(bone.worldToLocal(root.clone()));
      const m = new THREE.Mesh(g, mat);
      m.rotation.y = Math.atan2(out.x, out.z);
      holder.add(m);
      this.ribbons.push(holder);
    }
  }

  // ---------------------------------------------------------------- behaviour
  /** mode: 'roam' | 'listen' | 'hunt' | 'search' | 'door' | 'leave', from the sim. */
  update(dt: number, on: boolean, x: number, z: number, mode: string, player: THREE.Vector3): void {
    this.group.visible = on;
    if (!on) return;
    if (!this.h && humansReady()) this.build();
    if (!this.h) {
      this.legacy(dt, x, z, mode, player);
      return;
    }
    dt = Math.min(dt, 0.1);
    const h = this.h;
    const g = this.group;
    const moved = x - this.lastX;
    this.lastX = x;
    const speed = Math.abs(moved) / Math.max(dt, 1e-3);
    g.position.set(x, 0, z);

    // ---- timed events (seeded): freezes, bursts, glances
    this.nextFreeze -= dt;
    if (this.nextFreeze <= 0 && this.frozen <= 0) {
      this.frozen = 0.35 + this.r() * 0.9;
      this.nextFreeze = 6 + this.r() * 9;
    }
    const wasFrozen = this.frozen > 0;
    this.frozen = Math.max(0, this.frozen - dt);
    // a frozen body keeps its pose; only the fingers go on moving
    const at = wasFrozen ? 0 : dt;
    this.t += at;
    const t = this.t;

    // ---- which head state
    const toPlayer = Math.atan2(player.x - x, player.z - z);
    const awayFromPlayer = moved !== 0 && Math.sign(moved) === Math.sign(x - player.x);
    let next: HeadState = 'dormant';
    if (mode === 'hunt') next = this.burst > 0 ? 'burst' : 'locked';
    else if (mode === 'door') next = 'locked';
    else if (mode === 'search') next = 'search';
    else if (mode === 'leave' || (speed > 0.05 && awayFromPlayer)) next = 'withdraw';
    else if (mode === 'listen') next = this.stateT > 2.6 && this.state !== 'wrong' && this.r() < at * 0.6 ? 'wrong' : this.state === 'wrong' && this.stateT < 3.2 ? 'wrong' : 'watching';
    else if (speed > 0.05) {
      this.nextWatch -= at;
      if (this.nextWatch <= 0) {
        this.watchT = 1.5 + this.r() * 2;
        this.nextWatch = 6 + this.r() * 8;
      }
      this.watchT -= at;
      next = this.watchT > 0 ? 'watching' : 'dormant';
    }
    if (next !== this.state) {
      if (next === 'wrong') this.wrongTarget = toPlayer + (this.r() < 0.5 ? 1 : -1) * 0.5;
      this.state = next;
      this.stateT = 0;
    }
    this.stateT += at;

    // bursts in the hunt: a sudden lurch, then stillness
    if (mode === 'hunt') {
      this.nextBurst -= at;
      if (this.nextBurst <= 0) {
        this.burst = 0.28;
        this.nextBurst = 1.8 + this.r() * 2.5;
      }
    }
    this.burst = Math.max(0, this.burst - dt);

    // ---- body facing: along its path when walking, toward you when hunting; the body lags the head
    const pathYaw = moved >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const bodyWant = mode === 'hunt' || mode === 'door' ? toPlayer : speed > 0.05 ? pathYaw : this.yaw;
    const bodyRate = this.state === 'search' ? 0.6 : mode === 'hunt' ? 5 : 1.2;
    this.yaw += wrapAngle(bodyWant - this.yaw) * Math.min(1, at * bodyRate);
    g.rotation.y = this.yaw;

    // ---- head: a spring toward the state's target; 'wrong' overshoots, corrects, then holds dead still
    let headWant = 0;
    let stiff = 6;
    let damp = 0.9;
    let pitch = -0.15;
    switch (this.state) {
      case 'dormant':
        headWant = noise1(t * 0.15, 3) * 0.15;
        stiff = 2;
        pitch = 0.25; // chin down, as if asleep on its feet
        break;
      case 'watching':
      case 'withdraw':
        headWant = wrapAngle(toPlayer - this.yaw);
        stiff = this.state === 'withdraw' ? 9 : 3;
        pitch = -0.1;
        break;
      case 'wrong':
        headWant = wrapAngle((this.stateT < 1.2 ? this.wrongTarget : toPlayer) - this.yaw);
        stiff = this.stateT < 1.2 ? 14 : 30;
        damp = this.stateT < 1.2 ? 0.18 : 1;
        if (this.stateT > 1.5) stiff = 0; // stopped dead
        pitch = -0.05;
        break;
      case 'search':
        headWant = Math.sin(this.stateT * 0.55) * 1.3 + noise1(t * 0.8, 9) * 0.2;
        stiff = 2.5;
        pitch = 0.05;
        break;
      case 'locked':
        headWant = wrapAngle(toPlayer - this.yaw);
        stiff = 60;
        damp = 1;
        pitch = -0.2;
        break;
      case 'burst':
        headWant = wrapAngle(toPlayer - this.yaw);
        stiff = 120;
        pitch = -0.35;
        break;
    }
    headWant = THREE.MathUtils.clamp(headWant, -2.2, 2.2); // a little further round than a neck should go
    if (stiff > 0 && at > 0) {
      const w = Math.sqrt(stiff);
      const acc = w * w * (headWant - this.headYaw) - 2 * damp * w * this.headYawV;
      this.headYawV += acc * at;
      this.headYaw += this.headYawV * at;
    } else this.headYawV = 0;
    this.headPitch += (pitch - this.headPitch) * Math.min(1, at * 3);

    // ---- breathing (none when locked on), sway, tremor
    const holding = this.state === 'locked' || this.state === 'burst' || wasFrozen;
    if (!holding) this.breath += at;
    const breathe = Math.sin(this.breath * (Math.PI * 2) / 6.5);
    const tremor = (noise1(t * 9, 41) * 0.6 + noise1(t * 23, 43) * 0.4) * (this.state === 'locked' ? 0.004 : 0.012);

    // ---- locomotion: the stride follows the distance actually covered, so planted feet stay planted
    if (!wasFrozen) this.gait += Math.abs(moved) / (this.stride * 2);
    const L = this.legLen;
    const legs = h.legs;
    let drop = 0;
    for (const [n, leg] of legs.entries()) {
      // one leg steps a touch shorter and later than the other
      const p = (this.gait + (n ? 0.5 + 0.04 : 0)) % 1;
      const s = this.stride * (n ? 0.9 : 1);
      const stanceEnd = 0.6;
      let off: number;
      let knee: number;
      if (p < stanceEnd) {
        off = s / 2 - (p / stanceEnd) * s;
        knee = 0.06;
      } else {
        const sw = (p - stanceEnd) / (1 - stanceEnd);
        const e = sw * sw * (3 - 2 * sw);
        off = -s / 2 + e * s;
        knee = Math.sin(Math.PI * Math.pow(sw, 1.4)) * 1.15; // the knee bends late
      }
      const walking = Math.min(1, speed * 3);
      const ang = -Math.asin(THREE.MathUtils.clamp(off / L, -0.9, 0.9)) * walking;
      leg.hip.rotation.x = ang;
      leg.knee.rotation.x = knee * walking + 0.05;
      if (p < stanceEnd) drop = Math.max(drop, L * (1 - Math.cos(ang)));
      const foot = this.bone.get(n ? 'foot.R' : 'foot.L');
      if (foot) foot.rotation.x = p < stanceEnd ? -ang * 0.9 : -ang * 0.4 - knee * 0.3 * walking; // flat on the floor in stance
    }
    h.pelvis.position.y = this.restHipY - drop - (mode === 'hunt' ? 0.12 : 0.03);
    h.pelvis.position.z = Math.sin(this.gait * Math.PI * 2) * 0.012 + noise1(t * 0.3, 5) * 0.03; // weight shifts and drift

    // ---- torso: hunched, leaning into the walk late; a lurch in a burst
    const leanWant = (mode === 'hunt' ? 0.55 : 0.18) + Math.min(0.25, speed * 0.2) + (this.burst > 0 ? 0.35 : 0);
    this.lean += (leanWant - this.lean) * Math.min(1, at * (this.burst > 0 ? 18 : 1.5));
    h.spine.rotation.x = 0.12 + this.lean * 0.4;
    h.chest.rotation.x = 0.18 + this.lean * 0.6 + (holding ? 0 : breathe * 0.015);
    h.chest.rotation.z = noise1(t * 0.4, 13) * 0.03 + tremor;
    h.chest.scale.set(1 + breathe * 0.012, 1, 1 + breathe * 0.02);
    // the neck juts forward so the head stays level under the ceiling; the head leads, the neck follows
    h.neck.rotation.x = -(h.spine.rotation.x + h.chest.rotation.x) * 0.55 + 0.2;
    h.neck.rotation.y = this.headYaw * 0.35;
    h.head.rotation.order = 'YXZ';
    h.head.rotation.y = this.headYaw * 0.65;
    h.head.rotation.x = this.headPitch + tremor * 0.6;
    h.head.rotation.z = (this.state === 'wrong' ? 0.35 : 0.08) + noise1(t * 0.5, 17) * 0.06 + tremor;

    // ---- arms: hang almost still; one stops a beat after the other; reach in the hunt
    for (const [n, arm] of h.arms.entries()) {
      const swing = speed > 0.05 ? Math.sin((this.gait + (n ? 0 : 0.5)) * Math.PI * 2 - 0.6) * 0.07 : 0;
      const reach = mode === 'hunt' ? -0.9 - (this.burst > 0 ? 0.5 : 0) : 0;
      const want = swing + reach + noise1(t * 0.35 + n * 7, 19 + n) * 0.04;
      // the right arm follows late
      arm.sh.rotation.x += (want - arm.sh.rotation.x) * Math.min(1, at * (n ? 1.1 : 2.4) * (this.burst > 0 ? 6 : 1));
      arm.sh.rotation.z = arm.side * (0.04 + (mode === 'hunt' ? 0.15 : 0)) + tremor * 0.5;
      arm.el.rotation.x = mode === 'hunt' ? -0.25 : -0.05 + noise1(t * 0.2, 29 + n) * 0.05;
    }
    // ---- fingers: each its own twitches, which carry on through a freeze
    this.fingerHands(dt, mode);

    // ---- face: the jaw works slowly, as if chewing on nothing
    h.jaw.rotation.x = 0.14 + Math.max(0, noise1(t * 0.6, 51)) * 0.12 + (this.burst > 0 ? 0.3 : 0);
    // tissue sways behind the movement
    for (const [i, rb] of this.ribbons.entries()) {
      rb.rotation.x = noise1(t * 1.3 + i, 61 + i) * 0.25 + this.lean * 0.3;
      rb.rotation.z = noise1(t * 1.1 + i * 3, 71 + i) * 0.2;
    }
  }

  private fingerHands(dt: number, mode: string): void {
    const h = this.h!;
    let n = 0;
    for (const arm of h.arms) {
      for (let f = 0; f < arm.fingers.length; f++, n++) {
        this.fingerT[n] -= dt;
        if (this.fingerT[n] <= 0) {
          // a twitch: a quick curl or spread, then it holds
          this.fingerT[n] = 0.6 + this.r() * 3.5;
          this.fingerWant[n] = mode === 'hunt' ? 0.3 - this.r() * 0.9 : -0.05 - this.r() * 0.5;
        }
        this.fingerCurl[n] += (this.fingerWant[n] - this.fingerCurl[n]) * Math.min(1, dt * 14);
        arm.fingers[f].rotation.x = this.fingerCurl[n];
        arm.tips[f].rotation.x = this.fingerCurl[n] * 0.9 - 0.1;
      }
    }
  }

  /** The old procedural figure, until the authored body has loaded. */
  private legacy(dt: number, x: number, z: number, mode: string, player: THREE.Vector3): void {
    this.t += dt;
    const g = this.group;
    const moved = x - this.lastX;
    this.lastX = x;
    g.position.set(x, 0, z);
    const hunting = mode === 'hunt';
    const listening = mode === 'listen' || mode === 'door';
    const face = hunting || listening ? Math.atan2(player.x - x, player.z - z) : moved >= 0 ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.y += (face - g.rotation.y) * Math.min(1, dt * (hunting ? 8 : 2));
    const speed = Math.abs(moved) / Math.max(dt, 1e-3);
    this.ph += dt * (speed > 0.05 ? 3 + speed * 2 : 0);
    const r = this.rig;
    for (const l of r.legs) {
      const s = Math.sin(this.ph + (l.side > 0 ? Math.PI : 0));
      l.hip.rotation.x = -s * (hunting ? 0.7 : 0.35);
      l.knee.rotation.x = Math.max(0, -s) * (hunting ? 1.1 : 0.6) + 0.15;
    }
    r.chest.rotation.x = hunting ? 0.95 : listening ? 0.7 : 0.45 + Math.sin(this.t * 0.6) * 0.04;
    for (const a of r.arms) {
      const s = Math.sin(this.ph + (a.side > 0 ? 0 : Math.PI));
      a.sh.rotation.x = hunting ? -1.2 + s * 0.2 : s * 0.15 + 0.1;
      a.sh.rotation.z = a.side * 0.12;
      a.el.rotation.x = hunting ? -0.3 : -0.15;
      for (const f of a.fingers) f.rotation.x = hunting ? -0.6 + Math.sin(this.t * 9 + a.side) * 0.3 : -0.2 + Math.sin(this.t * 3 + a.side) * 0.15;
    }
    this.head.rotation.z = listening ? Math.sin(this.t * 1.7) * 0.5 : Math.sin(this.t * 0.4) * 0.2;
    this.head.rotation.x = hunting ? -0.6 : -0.2;
    this.head.rotation.y = listening ? Math.sin(this.t * 4.3) * 0.25 : 0;
  }
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
