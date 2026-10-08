import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { eyeTexture, fabricTexture, type FabricKind } from './faces';
import type { Arm, Leg, Rig } from './humanoid';
import type { Look } from './looks';

/**
 * Visitors built on an authored human body instead of primitives.
 *
 * The mesh, skeleton, skin weights and shape targets are the MakeHuman 1.x system assets (CC0). tools/mh-bake.mjs
 * turns them into public/characters/humans.bin: one body shape per named person, sculpted from MakeHuman's
 * age, weight, muscle and face shapes. Here that body becomes a THREE.SkinnedMesh with 27 bones. Clothes and
 * hair are shells grown from the body's own surface, so they share its skinning and never come apart from it.
 * Skin colour is painted per vertex: lips, flushed cheeks and ears, dark under the eyes, brows, stubble, and
 * darker creases. The rig it returns looks like the old procedural Rig, so PatientView animates it the same way.
 */

type Range = { at: number; n: number };
interface CastEntry {
  pos: Range;
  joints: Record<string, number[]>;
  eyes: { c: number[]; r: number }[];
  height: number;
  female: boolean;
  age: number;
}
interface Json {
  scale: number;
  nOrig: number;
  nSplit: number;
  bones: { name: string; parent: string | null }[];
  masks: string[];
  layout: Record<string, Range>;
  cast: Record<string, CastEntry>;
  expr: Record<string, { idx: Range; d: Range }>;
}
interface Shared {
  json: Json;
  buf: ArrayBuffer;
  splitOrig: Uint16Array;
  uv: Float32Array;
  body: Uint16Array;
  teeth: Uint16Array;
  skinIdx: Uint8Array;
  skinW: Uint8Array;
  masks: Uint8Array;
  nbrStart: Int32Array;
  nbr: Int32Array;
  bone: Map<string, number>;
  nBody: number; // body vertices in the original numbering (the teeth follow)
}

let shared: Shared | null = null;
let loading: Promise<boolean> | null = null;

/** Starts loading the baked bodies once. Resolves false if the file is missing; the old bodies are used then. */
export function loadHumans(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    // ?procedural keeps the old primitive bodies, for comparison and for very weak machines
    if (typeof location !== 'undefined' && location.search.includes('procedural')) return false;
    try {
      const [jr, br] = await Promise.all([fetch('characters/humans.json'), fetch('characters/humans.bin')]);
      if (!jr.ok || !br.ok) return false;
      const json = (await jr.json()) as Json;
      const buf = await br.arrayBuffer();
      const L = json.layout;
      const u16 = (r: Range): Uint16Array => new Uint16Array(buf, r.at, r.n);
      const u8 = (r: Range): Uint8Array => new Uint8Array(buf, r.at, r.n);
      const uvq = u16(L.uv);
      const uv = new Float32Array(uvq.length);
      for (let i = 0; i < uvq.length; i++) uv[i] = uvq[i] / 65535;
      const splitOrig = u16(L.splitOrig);
      const body = u16(L.body);
      // neighbours on the welded surface, for normals, smoothing and crease shading
      const sets: Set<number>[] = Array.from({ length: json.nOrig }, () => new Set<number>());
      for (let i = 0; i < body.length; i += 3) {
        const a = splitOrig[body[i]], b = splitOrig[body[i + 1]], c = splitOrig[body[i + 2]];
        sets[a].add(b).add(c);
        sets[b].add(a).add(c);
        sets[c].add(a).add(b);
      }
      const nbrStart = new Int32Array(json.nOrig + 1);
      for (let i = 0; i < json.nOrig; i++) nbrStart[i + 1] = nbrStart[i] + sets[i].size;
      const nbr = new Int32Array(nbrStart[json.nOrig]);
      for (let i = 0; i < json.nOrig; i++) nbr.set([...sets[i]], nbrStart[i]);
      let nBody = 0;
      for (let i = 0; i < body.length; i++) nBody = Math.max(nBody, splitOrig[body[i]] + 1);
      shared = {
        json,
        buf,
        splitOrig,
        uv,
        body,
        teeth: u16(L.teeth),
        skinIdx: u8(L.skinIdx),
        skinW: u8(L.skinW),
        masks: u8(L.masks),
        nbrStart,
        nbr,
        bone: new Map(json.bones.map((b, i) => [b.name, i])),
        nBody,
      };
      return true;
    } catch {
      return false;
    }
  })();
  return loading;
}
export const humansReady = (): boolean => !!shared;
export const humanBodies = (): string[] => (shared ? Object.keys(shared.json.cast) : []);

// ------------------------------------------------------------------ small helpers
const hash = (x: number, y: number, z: number): number => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
/** Smooth value noise, 0 to 1. */
function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t: number): number => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number): number => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let poreTex: THREE.CanvasTexture | null = null;
/** Fine skin grain for the bump map: pores, small lines. */
function pores(): THREE.CanvasTexture {
  if (poreTex) return poreTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) {
    const v = 100 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  g.strokeStyle = 'rgba(70,70,70,0.25)';
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  poreTex = new THREE.CanvasTexture(c);
  poreTex.wrapS = poreTex.wrapT = THREE.RepeatWrapping;
  poreTex.repeat.set(10, 10);
  return poreTex;
}

let strandTex: THREE.CanvasTexture | null = null;
/** Hair: strands running along v, with gaps so the edges break up into wisps. Used as colour and alpha. */
function strands(): THREE.CanvasTexture {
  if (strandTex) return strandTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(200,200,200)';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 256;
    const v = Math.random();
    g.strokeStyle = v < 0.3 ? `rgba(40,40,40,${0.3 + Math.random() * 0.5})` : `rgba(255,255,255,${0.2 + Math.random() * 0.5})`;
    g.lineWidth = 0.5 + Math.random() * 1.4;
    g.beginPath();
    const y = Math.random() * 256;
    g.moveTo(x, y - 60);
    g.bezierCurveTo(x + (Math.random() - 0.5) * 6, y - 20, x + (Math.random() - 0.5) * 6, y + 20, x + (Math.random() - 0.5) * 8, y + 60);
    g.stroke();
  }
  strandTex = new THREE.CanvasTexture(c);
  strandTex.colorSpace = THREE.SRGBColorSpace;
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.repeat.set(5, 2);
  return strandTex;
}

let wispAlpha: THREE.CanvasTexture | null = null;
/** Alpha for hair: mostly solid, with thin gaps along the strands. Read from green. */
function wisps(): THREE.CanvasTexture {
  if (wispAlpha) return wispAlpha;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(235,235,235)';
  g.fillRect(0, 0, 256, 256);
  // about one pixel in eight is a gap, so the coat of hair stays solid but its edges break into strands
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256;
    const v = Math.floor(Math.random() * 120);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 0.6 + Math.random() * 1.2;
    g.beginPath();
    const y = Math.random() * 256;
    g.moveTo(x, y - 50);
    g.lineTo(x + (Math.random() - 0.5) * 8, y + 50);
    g.stroke();
  }
  wispAlpha = new THREE.CanvasTexture(c);
  wispAlpha.wrapS = wispAlpha.wrapT = THREE.RepeatWrapping;
  wispAlpha.repeat.set(5, 2);
  return wispAlpha;
}

export type ExprName = 'blinkL' | 'blinkR' | 'wideL' | 'wideR' | 'mouthOpen' | 'smile' | 'frown' | 'sad' | 'browDown' | 'pucker';

export interface HumanRig extends Rig {
  human: true;
  head: THREE.Bone;
  neck: THREE.Bone;
  jaw: THREE.Bone;
  spine: THREE.Bone;
  eyes: { holder: THREE.Object3D; ball: THREE.Mesh }[];
  blackEye: THREE.Material;
  ballMat: THREE.Material;
  mouthY: number;
  mouthZ: number;
  setExpr(name: ExprName, v: number): void;
  setPale(k: number): void;
  /** Teeth, gums and tongue. */
  mouthParts: THREE.Mesh[];
}

export interface HumanOpts {
  body: string;
  blend?: { other: string; t: number };
  skin: THREE.Color;
  fake: boolean;
  stage: number;
  armLength: number;
  seed: number;
  /** Per bone [length, thickness] multipliers. A name without .L/.R means both sides. */
  stretch?: Record<string, [number, number]>;
  /** Make the finished body exactly this tall (after any stretch). */
  fitHeight?: number;
  shoulderDrop?: number;
  armOut?: number;
  /** Called with the rest-pose positions and normals before anything is built, to reshape the surface. */
  sculpt?: (P: Float32Array, N: Float32Array, info: SculptInfo) => void;
  /** Replaces the skin colour pass. RGB per original vertex, plus a wetness 0 to 1 used for shine. */
  paint?: (info: SculptInfo, rgb: Float32Array, wet: Float32Array) => void;
}

export interface SculptInfo {
  nBody: number;
  k: number;
  joint: (name: string) => THREE.Vector3;
  weight: (i: number, names: string[]) => number;
  nbr: (i: number) => Int32Array;
}

/** Which baked body a visitor wears. Named people have their own; anyone else is a blend of two stock bodies. */
export function bodyFor(castId: string | undefined, registryId: string, archetype: string, female: boolean, age: number, hue: number): Pick<HumanOpts, 'body' | 'blend'> {
  const cast = shared?.json.cast ?? {};
  if (registryId === 'R209') return { body: 'ada' };
  if (archetype === 'voice_mimic') return { body: 'sister' };
  if (castId && cast[castId]) return { body: castId };
  // a stock body for their age, mixed a third of the way toward one of the named people of the same sex,
  // so strangers get a face of their own without another file to load
  const stock = female ? (age < 46 ? 'f_young' : 'f_old') : age < 46 ? 'm_young' : 'm_old';
  const pool = Object.entries(cast).filter(([id, c]) => c.female === female && !id.includes('_') && id !== 'ada' && id !== 'sister').map(([id]) => id);
  const other = pool.length ? pool[Math.floor(hue * 977) % pool.length] : stock;
  return { body: stock, blend: { other, t: 0.25 + (hue * 7.3 % 1) * 0.2 } };
}

// ------------------------------------------------------------------ build
export function buildHuman(look: Look, o: HumanOpts, own: (d: { dispose(): void }) => void): HumanRig {
  const S = shared!;
  const J = S.json;
  const nO = J.nOrig;
  const nS = J.nSplit;
  const nB = J.bones.length;
  const bi = (n: string): number => S.bone.get(n)!;
  const A = J.cast[o.body];
  const Bc = o.blend ? J.cast[o.blend.other] : null;
  const bt = o.blend?.t ?? 0;
  const baseH = A.height + (Bc ? (Bc.height - A.height) * bt : 0);
  let k = look.height / baseH; // uniform scale to the visitor's height
  const q = 1 / J.scale;

  // positions, joints and eyes for this person
  const P = new Float32Array(nO * 3);
  {
    const a = new Int16Array(S.buf, A.pos.at, A.pos.n);
    const b = Bc ? new Int16Array(S.buf, Bc.pos.at, Bc.pos.n) : null;
    for (let i = 0; i < nO * 3; i++) P[i] = (b ? a[i] + (b[i] - a[i]) * bt : a[i]) * q * k;
  }
  const joint = (name: string): THREE.Vector3 => {
    const ja = A.joints[name];
    const jb = Bc?.joints[name];
    const v = new THREE.Vector3(ja[0], ja[1], ja[2]);
    if (jb) v.lerp(new THREE.Vector3(jb[0], jb[1], jb[2]), bt);
    return v.multiplyScalar(k);
  };
  const Jw = J.bones.map((b) => joint(b.name));
  const eyesBind = [0, 1].map((e) => {
    const c = new THREE.Vector3(...(A.eyes[e].c as [number, number, number]));
    let r = A.eyes[e].r;
    if (Bc) {
      c.lerp(new THREE.Vector3(...(Bc.eyes[e].c as [number, number, number])), bt);
      r += (Bc.eyes[e].r - r) * bt;
    }
    return { c: c.multiplyScalar(k), r: r * k };
  });

  // ---------------------------------------------------------------- settle the pose
  // MakeHuman stands in an A pose. Bring the arms down to the sides, drop the shoulders with age, and apply
  // the few proportion changes (a fake's arms grow at stage 3). This is baked into the rest shape so the
  // game's joint angles mean the same thing they did on the old rig.
  const Rq = Array.from({ length: nB }, () => new THREE.Quaternion());
  // stretch per bone: [length along the bone, thickness across it]. Scaling along the bone's own axis (not the
  // world axes) means a diagonal limb never shears, and a bone's stretch moves its children without fattening them.
  const len = new Float32Array(nB).fill(1);
  const thick = new Float32Array(nB).fill(1);
  const Rz = (a: number): THREE.Quaternion => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
  const drop = o.shoulderDrop ?? 0.04 + Math.max(0, look.age - 40) * 0.0025 + look.hunch * 0.08;
  for (const s of ['.L', '.R']) {
    const side = Math.sign(Jw[bi('upper' + s)].x);
    const clav = bi('clav' + s), up = bi('upper' + s), fo = bi('fore' + s), ha = bi('hand' + s);
    Rq[clav] = Rz(-side * drop);
    const d = Jw[fo].clone().sub(Jw[up]).applyQuaternion(Rq[clav]);
    const phi = Math.atan2(d.x, -d.y);
    Rq[up] = Rz(side * (o.armOut ?? 0.07) - phi);
    const d2 = Jw[ha].clone().sub(Jw[fo]).applyQuaternion(Rq[clav]).applyQuaternion(Rq[up]);
    Rq[fo] = Rz(side * 0.03 - Math.atan2(d2.x, -d2.y));
    for (const b of [up, fo, ha]) len[b] = o.armLength;
  }
  for (const [name, [l, t]] of Object.entries(o.stretch ?? {})) {
    for (const b of S.bone.has(name) ? [name] : [name + '.L', name + '.R']) {
      if (!S.bone.has(b)) continue;
      len[bi(b)] *= l;
      thick[bi(b)] *= t;
    }
  }
  // each bone's axis: toward its main child joint
  const axisOf = (i: number): THREE.Vector3 => {
    const n = J.bones[i].name;
    const sd = n.endsWith('.L') ? '.L' : n.endsWith('.R') ? '.R' : '';
    const base = sd ? n.slice(0, -2) : n;
    const to = (m: string): THREE.Vector3 => Jw[bi(m)].clone().sub(Jw[i]).normalize();
    const next: Record<string, string> = { hips: 'spine', spine: 'spine1', spine1: 'chest', chest: 'neck', neck: 'head', clav: 'upper' + sd, upper: 'fore' + sd, fore: 'hand' + sd, thigh: 'shin' + sd, shin: 'foot' + sd };
    if (next[base]) return to(next[base]);
    if (base === 'head') return new THREE.Vector3(0, 1, 0);
    if (base === 'jaw') return new THREE.Vector3(0, -0.6, 0.8).normalize();
    if (base === 'hand') return Jw[bi('f3a' + sd)].clone().add(Jw[bi('f4a' + sd)]).multiplyScalar(0.5).sub(Jw[i]).normalize();
    if (base === 'foot') return new THREE.Vector3(0, -0.35, 1).normalize();
    const fm = /^f(\d)([ab])$/.exec(base);
    if (fm) return Jw[bi('f' + fm[1] + 'b' + sd)].clone().sub(Jw[bi('f' + fm[1] + 'a' + sd)]).normalize();
    if (base === 'thumb') return Jw[i].clone().sub(Jw[bi('hand' + sd)]).normalize();
    return new THREE.Vector3(0, 1, 0);
  };
  const L3 = (i: number): THREE.Matrix4 => {
    const d = axisOf(i);
    const a = len[i], t = thick[i];
    // I*t + (a - t) d d^T
    const m = new THREE.Matrix4().set(
      t + (a - t) * d.x * d.x, (a - t) * d.x * d.y, (a - t) * d.x * d.z, 0,
      (a - t) * d.y * d.x, t + (a - t) * d.y * d.y, (a - t) * d.y * d.z, 0,
      (a - t) * d.z * d.x, (a - t) * d.z * d.y, t + (a - t) * d.z * d.z, 0,
      0, 0, 0, 1,
    );
    return m;
  };
  const Lm = J.bones.map((_b, i) => L3(i));
  const Rc: THREE.Quaternion[] = [];
  const NJ: THREE.Vector3[] = [];
  const K: THREE.Matrix4[] = [];
  J.bones.forEach((b, i) => {
    const p = b.parent ? S.bone.get(b.parent)! : -1;
    Rc[i] = p >= 0 ? Rc[p].clone().multiply(Rq[i]) : Rq[i].clone();
    NJ[i] = p >= 0 ? Jw[i].clone().sub(Jw[p]).applyMatrix4(Lm[p]).applyQuaternion(Rc[p]).add(NJ[p]) : Jw[i].clone();
    K[i] = new THREE.Matrix4().makeTranslation(NJ[i].x, NJ[i].y, NJ[i].z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(Rc[i])).multiply(Lm[i]).multiply(new THREE.Matrix4().makeTranslation(-Jw[i].x, -Jw[i].y, -Jw[i].z));
  });
  {
    const v = new THREE.Vector3();
    const acc = new THREE.Vector3();
    for (let i = 0; i < nO; i++) {
      acc.set(0, 0, 0);
      for (let j = 0; j < 4; j++) {
        const w = S.skinW[i * 4 + j] / 255;
        if (!w) continue;
        v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(K[S.skinIdx[i * 4 + j]]);
        acc.addScaledVector(v, w);
      }
      P[i * 3] = acc.x;
      P[i * 3 + 1] = acc.y;
      P[i * 3 + 2] = acc.z;
    }
  }
  const Jp = NJ;
  for (const e of eyesBind) {
    e.c.applyMatrix4(K[bi('head')]);
    e.r *= thick[bi('head')];
  }
  // stand on the floor again, and reach the asked height exactly when the stretch changed it
  {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < S.nBody; i++) {
      minY = Math.min(minY, P[i * 3 + 1]);
      maxY = Math.max(maxY, P[i * 3 + 1]);
    }
    const f = o.fitHeight ? o.fitHeight / (maxY - minY) : 1;
    if (Math.abs(minY) > 1e-4 || f !== 1) {
      for (let i = 0; i < nO; i++) {
        P[i * 3] *= f;
        P[i * 3 + 1] = (P[i * 3 + 1] - minY) * f;
        P[i * 3 + 2] *= f;
      }
      for (const j of Jp) j.set(j.x * f, (j.y - minY) * f, j.z * f);
      for (const e of eyesBind) {
        e.c.set(e.c.x * f, (e.c.y - minY) * f, e.c.z * f);
        e.r *= f;
      }
      k *= f;
    }
  }

  // ---------------------------------------------------------------- normals on the welded surface
  const N = new Float32Array(nO * 3);
  const computeNormals = (pos: Float32Array, out: Float32Array, tris: Uint16Array): void => {
    out.fill(0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < tris.length; t += 3) {
      const i0 = S.splitOrig[tris[t]], i1 = S.splitOrig[tris[t + 1]], i2 = S.splitOrig[tris[t + 2]];
      a.fromArray(pos, i0 * 3);
      b.fromArray(pos, i1 * 3).sub(a);
      c.fromArray(pos, i2 * 3).sub(a);
      b.cross(c);
      for (const i of [i0, i1, i2]) {
        out[i * 3] += b.x;
        out[i * 3 + 1] += b.y;
        out[i * 3 + 2] += b.z;
      }
    }
    for (let i = 0; i < out.length; i += 3) {
      const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
      out[i] /= l;
      out[i + 1] /= l;
      out[i + 2] /= l;
    }
  };
  computeNormals(P, N, S.body);
  const sculptInfo = (): SculptInfo => ({
    nBody: S.nBody,
    k,
    joint: (name) => Jp[bi(name)].clone(),
    weight: (i, names) => {
      let s2 = 0;
      for (let j = 0; j < 4; j++) {
        const n = J.bones[S.skinIdx[i * 4 + j]].name;
        if (names.some((x) => n === x || n.startsWith(x + '.'))) s2 += S.skinW[i * 4 + j] / 255;
      }
      return s2;
    },
    nbr: (i) => S.nbr.subarray(S.nbrStart[i], S.nbrStart[i + 1]),
  });
  if (o.sculpt) {
    o.sculpt(P, N, sculptInfo());
    computeNormals(P, N, S.body);
  }

  // ---------------------------------------------------------------- regions, by skin weight and height
  const W = (i: number, names: string[]): number => {
    let s = 0;
    for (let j = 0; j < 4; j++) {
      const n = J.bones[S.skinIdx[i * 4 + j]].name;
      if (names.some((x) => n === x || n.startsWith(x + '.'))) s += S.skinW[i * 4 + j] / 255;
    }
    return s;
  };
  const Y = (i: number): number => P[i * 3 + 1];
  // colour masks: how far each region shape moves a vertex (0 to 1), eased so the region fills out
  const EASE: Record<string, [number, number]> = { lips: [0.12, 0.45], cheeks: [0.05, 0.5], bags: [0.04, 0.4], brows: [0.1, 0.6], ears: [0.08, 0.35], nose: [0.04, 0.4], lids: [0.04, 0.35] };
  const mask = (i: number, name: string): number => {
    const e = EASE[name];
    return smooth(e[0], e[1], S.masks[i * J.masks.length + J.masks.indexOf(name)] / 255);
  };
  const hipsY = Jp[bi('hips')].y;
  const neckY = Jp[bi('neck')].y;
  const ankleY = Math.min(Jp[bi('foot.L')].y, Jp[bi('foot.R')].y);
  const waistY = hipsY + 0.13 * k;
  const chestJ = Jp[bi('chest')];
  const wHead = new Float32Array(nO), wNeck = new Float32Array(nO), wTorso = new Float32Array(nO), wArm = new Float32Array(nO), wHand = new Float32Array(nO), wLeg = new Float32Array(nO), wFoot = new Float32Array(nO), wHips = new Float32Array(nO);
  for (let i = 0; i < nO; i++) {
    wHead[i] = W(i, ['head', 'jaw']);
    wNeck[i] = W(i, ['neck']);
    wTorso[i] = W(i, ['spine', 'spine1', 'chest', 'clav']);
    wArm[i] = W(i, ['upper', 'fore']);
    wHand[i] = W(i, ['hand', 'f2a', 'f2b', 'f3a', 'f3b', 'f4a', 'f4b', 'f5a', 'f5b', 'thumb']);
    wLeg[i] = W(i, ['thigh', 'shin']);
    wFoot[i] = W(i, ['foot']);
    wHips[i] = W(i, ['hips']);
  }
  const isBody = (i: number): boolean => i < S.nBody;

  // head measurements, in the rest pose
  const eyeY = (eyesBind[0].c.y + eyesBind[1].c.y) / 2;
  const eyeZ = (eyesBind[0].c.z + eyesBind[1].c.z) / 2;
  let topY = -1, backZ = 9, frontZ = -9, halfW = 0, chinY = 9;
  for (let i = 0; i < S.nBody; i++) {
    if (wHead[i] < 0.6) continue;
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    topY = Math.max(topY, y);
    if (y > eyeY - 0.03 * k) backZ = Math.min(backZ, z);
    if (y > eyeY + 0.025 * k) frontZ = Math.max(frontZ, z);
    if (Math.abs(y - eyeY - 0.03 * k) < 0.02 * k && mask(i, 'ears') < 0.15) halfW = Math.max(halfW, Math.abs(x));
    chinY = Math.min(chinY, y);
  }
  // mouth and nose from the colour masks
  let mw = 0, my = 0, mz = 0, mouthHalf = 0, noseBase = 9;
  for (let i = 0; i < S.nBody; i++) {
    const l = mask(i, 'lips');
    if (l > 0.5) {
      mw += l;
      my += Y(i) * l;
      mz += P[i * 3 + 2] * l;
      mouthHalf = Math.max(mouthHalf, Math.abs(P[i * 3]));
    }
  }
  my /= mw || 1;
  mz /= mw || 1;
  let lipFront = mz;
  for (let i = 0; i < S.nBody; i++) if (mask(i, 'lips') > 0.5) lipFront = Math.max(lipFront, P[i * 3 + 2]);
  // the nose: its tip is the most forward point on the midline between mouth and eyes; the base of the nose
  // (where it meets the lip) is the deepest midline point between the tip and the mouth
  let tipY = eyeY, tipZ = -9;
  for (let i = 0; i < S.nBody; i++) if (wHead[i] > 0.5 && Math.abs(P[i * 3]) < 0.004 * k && Y(i) < eyeY && Y(i) > my && P[i * 3 + 2] > tipZ) {
    tipZ = P[i * 3 + 2];
    tipY = Y(i);
  }
  let baseZ = 9;
  for (let i = 0; i < S.nBody; i++) if (wHead[i] > 0.5 && Math.abs(P[i * 3]) < 0.004 * k && Y(i) < tipY && Y(i) > my + 0.004 * k && P[i * 3 + 2] < baseZ) {
    baseZ = P[i * 3 + 2];
    noseBase = Y(i);
  }

  // ---------------------------------------------------------------- the skeleton
  const root = new THREE.Group();
  const bones: THREE.Bone[] = J.bones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    return bone;
  });
  J.bones.forEach((b, i) => {
    if (b.parent) bones[S.bone.get(b.parent)!].add(bones[i]);
    else root.add(bones[i]);
  });
  // fingers curl toward the palm. Each finger bone gets a rest frame whose x axis runs across the knuckles, with
  // the back of the hand along +z, so the game's negative x rotation folds that finger into the palm.
  for (const s of ['.L', '.R']) {
    const side = Math.sign(Jp[bi('hand' + s)].x);
    const knuckles = Jp[bi('f3a' + s)].clone().add(Jp[bi('f4a' + s)]).multiplyScalar(0.5);
    const d = knuckles.clone().sub(Jp[bi('hand' + s)]).normalize();
    const t = Jp[bi('thumb' + s)].clone().sub(Jp[bi('hand' + s)]);
    t.addScaledVector(d, -t.dot(d));
    const back = new THREE.Vector3().crossVectors(d, t).multiplyScalar(-side).normalize();
    for (let f = 2; f <= 5; f++) {
      const fd = Jp[bi('f' + f + 'b' + s)].clone().sub(Jp[bi('f' + f + 'a' + s)]).normalize();
      const axis = new THREE.Vector3().crossVectors(fd, back).normalize();
      const bn = bones[bi('f' + f + 'a' + s)];
      bn.rotation.order = 'ZYX';
      bn.rotation.set(0, -Math.asin(THREE.MathUtils.clamp(axis.z, -1, 1)), Math.atan2(axis.y, axis.x));
      bones[bi('f' + f + 'b' + s)].rotation.order = 'ZYX';
    }
  }
  J.bones.forEach((_b, i) => {
    const parent = bones[i].parent!;
    parent.updateMatrixWorld(true);
    bones[i].position.copy(parent.worldToLocal(Jp[i].clone()));
    bones[i].updateMatrixWorld(true);
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  // ---------------------------------------------------------------- shared attributes
  const uvAttr = new THREE.BufferAttribute(S.uv, 2);
  const skinIndex = new Uint16Array(nS * 4);
  const skinWeight = new Float32Array(nS * 4);
  for (let s = 0; s < nS; s++) {
    const i = S.splitOrig[s];
    for (let j = 0; j < 4; j++) {
      skinIndex[s * 4 + j] = S.skinIdx[i * 4 + j];
      skinWeight[s * 4 + j] = S.skinW[i * 4 + j] / 255;
    }
  }
  const siAttr = new THREE.BufferAttribute(skinIndex, 4);
  const swAttr = new THREE.BufferAttribute(skinWeight, 4);
  const toSplit = (orig: Float32Array, size = 3): Float32Array => {
    const out = new Float32Array(nS * size);
    for (let s = 0; s < nS; s++) for (let c = 0; c < size; c++) out[s * size + c] = orig[S.splitOrig[s] * size + c];
    return out;
  };
  // expression shapes, scaled to this person
  const exprNames = Object.keys(J.expr) as ExprName[];
  const morphs = exprNames.map((name) => {
    const e = J.expr[name];
    const idx = new Uint16Array(S.buf, e.idx.at, e.idx.n);
    const d = new Int16Array(S.buf, e.d.at, e.d.n);
    const orig = new Float32Array(nO * 3);
    for (let j = 0; j < idx.length; j++) for (let c = 0; c < 3; c++) orig[idx[j] * 3 + c] = d[j * 3 + c] * q * k;
    const attr = new THREE.BufferAttribute(toSplit(orig), 3);
    attr.name = name;
    return attr;
  });

  const meshes: THREE.SkinnedMesh[] = [];
  const makeGeo = (pos: Float32Array, nrm: Float32Array, index: number[] | Uint16Array, color?: Float32Array, colorSize = 3, uv?: Float32Array, withMorphs = false): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(toSplit(pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(toSplit(nrm), 3));
    g.setAttribute('uv', uv ? new THREE.BufferAttribute(uv, 2) : uvAttr);
    g.setAttribute('skinIndex', siAttr);
    g.setAttribute('skinWeight', swAttr);
    if (color) g.setAttribute('color', new THREE.BufferAttribute(toSplit(color, colorSize), colorSize));
    g.setIndex(Array.isArray(index) ? index : Array.from(index));
    if (withMorphs) {
      g.morphAttributes.position = morphs;
      g.morphTargetsRelative = true;
    }
    own(g);
    return g;
  };
  let bindMatrix: THREE.Matrix4 | null = null;
  const addMesh = (g: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], shadow = true): THREE.SkinnedMesh => {
    const m = new THREE.SkinnedMesh(g, mat);
    m.frustumCulled = false;
    m.castShadow = shadow;
    m.receiveShadow = false;
    root.add(m);
    if (bindMatrix) m.bind(skeleton, bindMatrix);
    else {
      m.bind(skeleton);
      bindMatrix = m.bindMatrix;
    }
    meshes.push(m);
    return m;
  };

  // ---------------------------------------------------------------- outfit plan
  const out = look.outfit;
  const coat = out === 'overcoat' || out === 'raincoat' || out === 'fur';
  const longSkirt = out === 'cassock' || out === 'nightgown' || out === 'habit';
  const fem = look.female;
  const hemY = (longSkirt ? 0.12 : out === 'uniform' ? 0.45 : coat ? 0.4 : fem && out === 'cardigan' ? 0.42 : -1) * (look.height / 1.75);
  const trousers = !fem && !longSkirt;
  const stockings = fem && !look.barefoot && !longSkirt;
  const shoes = !look.barefoot;
  const fabricKind: FabricKind = out === 'cardigan' ? 'knit' : out === 'uniform' || out === 'nightgown' ? 'cotton' : out === 'raincoat' ? 'oilcloth' : out === 'work' ? 'leather' : 'wool';
  const lin = (c: string | THREE.Color): THREE.Color => (typeof c === 'string' ? new THREE.Color(c) : c.clone());
  const topC = lin(look.top);
  const bottomC = lin(look.bottom);
  const accentC = lin(look.accent);
  const shoeC = lin(look.shoes);

  // shirt front, tie, apron, stole: colour on the garment, by position on the body
  const frontVWide = (i: number): boolean => {
    const x = Math.abs(P[i * 3]), y = P[i * 3 + 1], z = P[i * 3 + 2];
    const bottom = chestJ.y + 0.06 * k;
    return z > chestJ.z - 0.01 * k && y > bottom - 0.05 * k && y < collarTop + 0.01 * k && x < (Math.max(0, y - bottom)) * (out === 'work' ? 0.3 : 0.22) + 0.03 * k;
  };
  const frontV = (i: number): number => {
    const x = Math.abs(P[i * 3]), y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (z < chestJ.z) return 0;
    const bottom = chestJ.y + 0.06 * k;
    if (y < bottom - 0.01 * k || y > collarTop) return 0;
    const edge = (y - bottom) * (out === 'work' ? 0.3 : 0.22) + 0.005 * k;
    return 1 - smooth(edge - 0.006 * k, edge + 0.004 * k, x);
  };
  // regions (0 or 1 per original vertex)
  const topR = new Uint8Array(nO);
  const legR = new Uint8Array(nO);
  const footR = new Uint8Array(nO);
  const collarR = new Uint8Array(nO);
  const shirtR = new Uint8Array(nO);
  // coats, suits and work jackets open in a V at the neck; a shirt underneath shows through it
  const shirtFront = out === 'suit' || out === 'overcoat' || out === 'raincoat' || out === 'work';
  const collarTop = neckY + (coat ? 0.05 : out === 'cassock' || out === 'habit' ? 0.045 : 0.03) * k;
  for (let i = 0; i < S.nBody; i++) {
    const y = Y(i);
    // the trunk is split at the waist by height alone, so nothing between shirt and trousers is left bare
    const trunk = 1 - (wArm[i] + wHand[i] + wHead[i] + wNeck[i] + wFoot[i]) > 0.5;
    const sleeve = wArm[i] > 0.5 && wHand[i] < 0.3;
    // the neck stays bare, but the slope of the shoulders beside it is cloth
    const nj = Jp[bi('neck')];
    const neckR = Math.hypot(P[i * 3] - nj.x, (P[i * 3 + 2] - nj.z) * 0.9);
    const nearNeck = neckR < 0.088 * k; // reaches over the coat's neckline so its stepped edge is hidden
    // the neck column stays bare above the collar; everything off it (the trapezius, the top of the back) is cloth
    const shoulder = wNeck[i] > 0.2 && wHead[i] < 0.05 && (y < neckY + 0.012 * k || neckR > 0.056 * k);
    // summed, not either-or: a vertex on top of the shoulder is half torso and half arm and must still be covered
    const upperCloth = wTorso[i] + wArm[i] + (y > waistY - 0.07 * k ? wHips[i] : 0) + (shoulder ? wNeck[i] : 0);
    if ((upperCloth > 0.5 || (trunk && y > waistY - 0.07 * k) || sleeve || shoulder) && wHand[i] < 0.3 && wHead[i] < 0.05) topR[i] = 1;
    // the shirt exists only where it can be seen: the V and a margin under the lapels. Anywhere else it could only
    // poke through the coat at the shoulders when the arms move.
    if (shirtFront && wHand[i] < 0.3 && wHead[i] < 0.05 && wArm[i] < 0.3 && frontVWide(i)) shirtR[i] = 1;
    if (wNeck[i] + wTorso[i] > 0.5 && y >= neckY - 0.035 * k && y < collarTop && wHead[i] < 0.05 && nearNeck && !(shirtFront && frontV(i) > 0.5 && y < neckY)) collarR[i] = 1;
    if (trunk && y < waistY + 0.03 * k && y > ankleY + 0.02 * k && wFoot[i] < 0.35) legR[i] = 1;
    if (wFoot[i] > 0.25 || ((wLeg[i] > 0.2) && y < ankleY + (out === 'work' ? 0.09 : 0.035) * k)) footR[i] = 1;
  }

  /** A garment grown from the body: offset along the normals, smoothed so it hides anatomy, never inside the skin. */
  const shell = (region: Uint8Array, opt: { off: number; smoothIt: number; fold?: (i: number, p: THREE.Vector3) => number; extra?: (i: number) => number; flatSole?: boolean; any?: boolean; minK?: number; taubin?: boolean; fill?: number }): { pos: Float32Array; nrm: Float32Array; tris: number[]; used: Uint8Array } => {
    const tris: number[] = [];
    const used = new Uint8Array(nO);
    for (let t = 0; t < S.body.length; t += 3) {
      const a = S.splitOrig[S.body[t]], b = S.splitOrig[S.body[t + 1]], c = S.splitOrig[S.body[t + 2]];
      if (opt.any ? region[a] || region[b] || region[c] : region[a] && region[b] && region[c]) {
        tris.push(S.body[t], S.body[t + 1], S.body[t + 2]);
        used[a] = used[b] = used[c] = 1;
      }
    }
    const pos = new Float32Array(P);
    const p = new THREE.Vector3();
    for (let i = 0; i < nO; i++) {
      if (!used[i]) continue;
      const off = opt.off + (opt.extra?.(i) ?? 0);
      for (let c = 0; c < 3; c++) pos[i * 3 + c] = P[i * 3 + c] + N[i * 3 + c] * off;
    }
    const tmpP = new Float32Array(pos);
    const edge = new Uint8Array(nO);
    for (let i = 0; i < nO; i++) {
      if (!used[i]) continue;
      for (let j = S.nbrStart[i]; j < S.nbrStart[i + 1]; j++) if (!used[S.nbr[j]]) edge[i] = 1;
    }
    for (let it = 0; it < opt.smoothIt; it++) {
      for (let i = 0; i < nO; i++) {
        if (!used[i] || edge[i]) continue; // open edges stay put, so hems and cuffs do not creep
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let j = S.nbrStart[i]; j < S.nbrStart[i + 1]; j++) {
          const v = S.nbr[j];
          if (!used[v]) continue;
          sx += pos[v * 3];
          sy += pos[v * 3 + 1];
          sz += pos[v * 3 + 2];
          n++;
        }
        if (!n) continue;
        // Taubin smoothing alternates a shrinking and an inflating step, so small bumps (toes) go but the volume stays
        const w = opt.taubin && it % 2 ? -0.63 : 0.6;
        tmpP[i * 3] = pos[i * 3] + (sx / n - pos[i * 3]) * w;
        tmpP[i * 3 + 1] = pos[i * 3 + 1] + (sy / n - pos[i * 3 + 1]) * w;
        tmpP[i * 3 + 2] = pos[i * 3 + 2] + (sz / n - pos[i * 3 + 2]) * w;
      }
      pos.set(tmpP);
      if (opt.minK === 0) continue;
      // never sink into the body
      for (let i = 0; i < nO; i++) {
        if (!used[i]) continue;
        const min = (opt.off + (opt.extra?.(i) ?? 0)) * (opt.minK ?? 0.6);
        const d = (pos[i * 3] - P[i * 3]) * N[i * 3] + (pos[i * 3 + 1] - P[i * 3 + 1]) * N[i * 3 + 1] + (pos[i * 3 + 2] - P[i * 3 + 2]) * N[i * 3 + 2];
        if (d < min) for (let c = 0; c < 3; c++) pos[i * 3 + c] += N[i * 3 + c] * (min - d);
      }
    }
    if (opt.fill) {
      // a shoe: blur the foot until the toes melt into one shape, then grow it back out to where the skin was,
      // so it encloses the foot (a toe tip pulled inward is pushed back out) while the gaps stay filled
      const b = new Float32Array(P);
      const t2 = new Float32Array(P);
      for (let it = 0; it < opt.fill; it++) {
        for (let i = 0; i < nO; i++) {
          if (!used[i] || edge[i]) continue;
          let sx = 0, sy = 0, sz = 0, n = 0;
          for (let j = S.nbrStart[i]; j < S.nbrStart[i + 1]; j++) {
            const v = S.nbr[j];
            if (!used[v]) continue;
            sx += b[v * 3];
            sy += b[v * 3 + 1];
            sz += b[v * 3 + 2];
            n++;
          }
          if (n) for (let c = 0; c < 3; c++) t2[i * 3 + c] = b[i * 3 + c] + ((c === 0 ? sx : c === 1 ? sy : sz) / n - b[i * 3 + c]) * 0.6;
        }
        b.set(t2);
      }
      const bn = new Float32Array(nO * 3);
      computeNormals(b, bn, Uint16Array.from(tris));
      for (let i = 0; i < nO; i++) {
        if (!used[i]) continue;
        const back = (P[i * 3] - b[i * 3]) * bn[i * 3] + (P[i * 3 + 1] - b[i * 3 + 1]) * bn[i * 3 + 1] + (P[i * 3 + 2] - b[i * 3 + 2]) * bn[i * 3 + 2];
        const d = opt.off + Math.max(0, back) * 0.35;
        for (let c = 0; c < 3; c++) pos[i * 3 + c] = b[i * 3 + c] + bn[i * 3 + c] * d;
      }
    }
    if (opt.fold) {
      for (let i = 0; i < nO; i++) {
        if (!used[i]) continue;
        p.fromArray(P, i * 3);
        const f = opt.fold(i, p);
        for (let c = 0; c < 3; c++) pos[i * 3 + c] += N[i * 3 + c] * f;
      }
    }
    if (opt.flatSole) for (let i = 0; i < nO; i++) if (used[i] && pos[i * 3 + 1] < 0.012 * k) pos[i * 3 + 1] = Math.max(0, pos[i * 3 + 1] * 0.3);
    const nrm = new Float32Array(nO * 3);
    computeNormals(pos, nrm, Uint16Array.from(tris));
    return { pos, nrm, tris, used };
  };

  // which body skin is hidden under clothes (one ring in from each garment edge, so no gaps show)
  const covered = new Uint8Array(nO);
  // keep: which garment edges keep a ring of skin under them. A cuff does (the hand starts right there); a neckline
  // or shoulder edge does not, because the collar covers it and a leftover ring shows through as bare slivers.
  const cover = (used: Uint8Array, all = false, keep: (i: number) => boolean = () => true): void => {
    for (let i = 0; i < nO; i++) {
      if (!used[i]) continue;
      if (all) {
        covered[i] = 1;
        continue;
      }
      let inner = true;
      for (let j = S.nbrStart[i]; j < S.nbrStart[i + 1]; j++) if (!used[S.nbr[j]] && keep(S.nbr[j])) inner = false;
      if (inner) covered[i] = 1;
    }
  };

  const cloth = (kind: FabricKind, rough = 0.92, repeat = 7): THREE.MeshStandardMaterial => {
    const t = fabricTexture(kind).clone();
    t.needsUpdate = true;
    t.repeat.set(repeat, repeat);
    own(t);
    const m = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: kind === 'oilcloth' ? 0.35 : kind === 'leather' ? 0.6 : rough, metalness: 0, side: THREE.DoubleSide });
    own(m);
    return m;
  };
  const colorArr = (fn: (i: number, out: THREE.Color) => void, alpha?: (i: number) => number): Float32Array => {
    const size = alpha ? 4 : 3;
    const a = new Float32Array(nO * size);
    const c = new THREE.Color();
    for (let i = 0; i < nO; i++) {
      fn(i, c);
      a[i * size] = c.r;
      a[i * size + 1] = c.g;
      a[i * size + 2] = c.b;
      if (alpha) a[i * size + 3] = alpha(i);
    }
    return a;
  };
  // wear: hems and elbows go darker and dirtier
  const wear = (i: number, c: THREE.Color, base: THREE.Color): void => {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const n = vnoise(x * 18, y * 18, z * 18);
    let d = 0.88 + n * 0.2;
    d *= 1 - look.grime * 0.35 * vnoise(x * 6 + 3, y * 6, z * 6);
    c.copy(base).multiplyScalar(d);
  };
  // vertical folds hanging from the shoulders, rings at the elbows
  const coatFold = (amp: number) => (i: number, p: THREE.Vector3): number => {
    const ang = Math.atan2(p.x, p.z - chestJ.z);
    const below = smooth(chestJ.y + 0.05 * k, hipsY - 0.1 * k, p.y);
    const vert = (vnoise(ang * 3 + o.seed, p.y * 1.6, 0.5) - 0.5) * amp * (0.25 + below);
    const elbow = wArm[i] * (vnoise(p.x * 3, p.y * 22, p.z * 3) - 0.5) * amp * 0.45;
    return vert * (1 - wArm[i]) + elbow;
  };

  const topLayer = (): void => {
    const off = coat ? 0.016 + (out === 'fur' ? 0.012 : 0) : out === 'work' ? 0.01 : out === 'nightgown' ? 0.004 : 0.007;
    const furAmp = out === 'fur' ? 0.03 : 0;
    const sh = shell(topR, {
      off,
      smoothIt: coat || out === 'work' ? 8 : 5,
      extra: (i) => (out === 'fur' ? (vnoise(P[i * 3] * 40, P[i * 3 + 1] * 40, P[i * 3 + 2] * 40) - 0.3) * 0.012 : 0) + wArm[i] * (coat ? 0.004 : 0.002),
      fold: (i, p) => coatFold(coat ? 0.026 : 0.012)(i, p) + (furAmp ? (vnoise(p.x * 22, p.y * 22, p.z * 22) - 0.5) * furAmp : 0),
    });
    cover(sh.used, false, (n) => wHand[n] > 0.2 || wHead[n] > 0.3);
    const stole = new THREE.Color(0x4a1e46);
    const col = colorArr((i, c) => {
      wear(i, c, topC);
      const x = Math.abs(P[i * 3]), y = P[i * 3 + 1], z = P[i * 3 + 2];
      // the lapel: the cloth folded back along the edge of the V is a shade darker
      const v = shirtFront ? frontV(i) : 0;
      if (v > 0.05) c.multiplyScalar(0.72);
      if (out === 'uniform' && z > chestJ.z && x < 0.1 * k && y < chestJ.y + 0.06 * k) c.copy(accentC);
      if (out === 'cassock' && z > chestJ.z - 0.02 * k && x > 0.03 * k && x < 0.07 * k && y > chestJ.y - 0.3 * k) c.copy(stole);
      if (out === 'fur') c.multiplyScalar(0.8 + vnoise(P[i * 3] * 60, y * 60, z * 60) * 0.4);
    }, shirtFront ? (i) => 1 - frontV(i) : undefined);
    const topMat = cloth(fabricKind);
    if (shirtFront) topMat.alphaTest = 0.5; // the V is cut out by alpha, so its edge runs straight across the triangles
    addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, col, shirtFront ? 4 : 3), topMat);
    // buttons down the front of coats, suits and cassocks
    if (out !== 'fur' && out !== 'nightgown' && out !== 'cardigan' && out !== 'habit') {
      const btn = new THREE.MeshStandardMaterial({ color: out === 'uniform' ? 0xe8e4da : 0x16120e, roughness: 0.35 });
      own(btn);
      const geo = new THREE.SphereGeometry(0.0075 * k, 8, 6);
      own(geo);
      const n = out === 'cassock' ? 9 : 4;
      for (let b = 0; b < n; b++) {
        const y = chestJ.y - (out === 'cassock' ? -0.12 + b * 0.06 : 0.02 + b * 0.09) * k;
        // the front of the garment at this height
        let best = -1, bz = -9;
        for (let i = 0; i < nO; i++) if (sh.used[i] && Math.abs(sh.pos[i * 3]) < 0.02 * k && Math.abs(sh.pos[i * 3 + 1] - y) < 0.015 * k && sh.pos[i * 3 + 2] > bz) {
          bz = sh.pos[i * 3 + 2];
          best = i;
        }
        if (best < 0) continue;
        const m = new THREE.Mesh(geo, btn);
        const bone = bones[S.skinIdx[best * 4]];
        bone.add(m);
        m.position.copy(bone.worldToLocal(new THREE.Vector3(out === 'suit' ? 0.012 : 0, sh.pos[best * 3 + 1], bz + 0.002)));
        m.scale.z = 0.5;
      }
    }
  };
  const shirtLayer = (): void => {
    const sh = shell(shirtR, { off: 0.004 * k, smoothIt: 4 });
    cover(sh.used);
    const tie = out === 'suit' || (out === 'overcoat' && o.seed % 3 === 0);
    const tieC = new THREE.Color(o.seed % 2 ? 0x2a1416 : 0x18202c);
    const col = colorArr((i, c) => {
      const x = Math.abs(P[i * 3]), y = P[i * 3 + 1];
      // plain shirting, a little grubby, with a placket down the middle
      c.copy(accentC).multiplyScalar(0.92 + vnoise(x * 80, y * 80, 2) * 0.08 - look.grime * 0.25);
      if (x < 0.006 * k) c.multiplyScalar(0.86);
      if (tie && x < 0.011 * k && y < collarTop - 0.012 * k) c.copy(tieC).multiplyScalar(0.9 + vnoise(x * 300, y * 300, 1) * 0.2);
    });
    const shirtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    own(shirtMat);
    addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, col), shirtMat);
  };
  const collarLayer = (): void => {
    const white = out === 'cassock' || out === 'habit' || out === 'uniform' ? accentC : coat ? topC.clone().multiplyScalar(0.85) : accentC;
    const sh = shell(collarR, {
      off: coat ? 0.02 : 0.006,
      smoothIt: 3,
      extra: (i) => (coat ? smooth(neckY - 0.01 * k, collarTop, Y(i)) * 0.02 : 0),
    });
    cover(sh.used);
    addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, colorArr((i, c) => wear(i, c, white))), cloth(coat ? fabricKind : 'cotton'));
  };
  const legLayer = (): void => {
    const sh = shell(legR, {
      off: trousers ? 0.009 : 0.0012,
      smoothIt: trousers ? 12 : 1,
      // loose over the seat and the knees, a little wider at the hem
      extra: (i) => (trousers ? smooth(ankleY + 0.25 * k, ankleY + 0.02 * k, Y(i)) * 0.012 + smooth(hipsY - 0.2 * k, hipsY, Y(i)) * 0.008 : 0),
      fold: trousers ? (_i, p) => (vnoise(p.x * 6, p.y * 26, p.z * 6) - 0.5) * 0.008 * (0.4 + smooth(hipsY - 0.2 * k, ankleY, p.y)) : undefined,
    });
    if (trousers) cover(sh.used);
    const sock = new THREE.Color(0x3b342e).lerp(o.skin, 0.25);
    const mat = trousers ? cloth('wool') : (() => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
      own(m);
      return m;
    })();
    addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, colorArr((i, c) => (trousers ? wear(i, c, bottomC) : c.copy(sock)))), mat);
    if (!trousers) cover(sh.used);
  };
  const footLayer = (): void => {
    const sh = shell(footR, { off: 0.01 * k, smoothIt: 0, fill: 120, flatSole: true, extra: (i) => (P[i * 3 + 2] > Jp[bi('foot.L')].z + 0.05 * k ? 0.006 : 0) });
    cover(sh.used, true); // the foot inside the shoe is removed entirely, so no toe can push through
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0 });
    own(m);
    addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, colorArr((i, c) => c.copy(shoeC).multiplyScalar(Y(i) < 0.012 * k ? 0.35 : 0.9 + vnoise(P[i * 3] * 50, Y(i) * 50, P[i * 3 + 2] * 50) * 0.2))), m);
  };

  if (!look.outfit.startsWith('creature')) {
    topLayer();
    if (shirtFront) shirtLayer();
    collarLayer();
    if (trousers || stockings) legLayer();
    if (shoes) footLayer();
  }

  // a coat tail, dress or cassock: hangs from the hips and swings, legs move inside it
  let skirt: THREE.Mesh | null = null;
  if (hemY > 0) {
    const topAt = waistY + 0.01 * k;
    let rx = 0, zMin = 9, zMax = -9;
    for (let i = 0; i < S.nBody; i++) {
      if (Math.abs(Y(i) - topAt) > 0.03 * k || wArm[i] > 0.2 || wHand[i] > 0.1) continue;
      rx = Math.max(rx, Math.abs(P[i * 3]));
      zMin = Math.min(zMin, P[i * 3 + 2]);
      zMax = Math.max(zMax, P[i * 3 + 2]);
    }
    const cz = (zMin + zMax) / 2;
    const rz = (zMax - zMin) / 2;
    const pad = coat ? 0.026 : 0.012;
    const len = topAt - hemY;
    const rings = 14, seg = 48;
    const open = coat && !fem ? 0.16 : 0; // men's coats part at the front; women's are buttoned over a dress
    const flare = (coat ? 0.1 : out === 'uniform' ? 0.16 : 0.12) * k;
    const pos: number[] = [], uvs: number[] = [], col: number[] = [], idx: number[] = [];
    const skirtCol = out === 'uniform' ? topC : coat ? topC : out === 'cardigan' ? bottomC : topC;
    const c = new THREE.Color();
    // how far out the body reaches at each height and angle (hips, seat, thighs), so the cloth hangs over it
    const need = Array.from({ length: rings + 1 }, () => new Float32Array(seg + 1));
    const angOf = (u: number): number => open + u * (Math.PI * 2 - open * 2);
    for (let i = 0; i < S.nBody; i++) {
      const y = Y(i);
      if (y > topAt + 0.02 * k || y < hemY || wArm[i] + wHand[i] > 0.2) continue;
      const rf = ((topAt - y) / len) * rings;
      const dx = P[i * 3], dz = P[i * 3 + 2] - cz;
      let a = Math.atan2(dx, dz);
      if (a < 0) a += Math.PI * 2;
      const uf = ((a - open) / (Math.PI * 2 - open * 2)) * seg;
      const d = Math.hypot(dx, dz);
      for (const rr of [Math.floor(rf), Math.ceil(rf)]) for (let ds = -2; ds <= 2; ds++) {
        const r = Math.min(rings, Math.max(0, rr));
        const ss = Math.round(uf) + ds;
        if (ss < 0 || ss > seg) continue;
        need[r][ss] = Math.max(need[r][ss], d);
      }
    }
    for (let r = 1; r <= rings; r++) for (let ss = 0; ss <= seg; ss++) need[r][ss] = Math.max(need[r][ss], need[r - 1][ss] * 0.995);
    for (let r = 0; r <= rings; r++)
      for (let it = 0; it < 2; it++) {
        const row = need[r].slice();
        for (let ss = 1; ss < seg; ss++) need[r][ss] = Math.max(row[ss], (row[ss - 1] + row[ss] + row[ss + 1]) / 3);
      }
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      for (let s = 0; s <= seg; s++) {
        const u = s / seg;
        const ang = angOf(u); // 0 is the front
        const fold = 1 + Math.sin(ang * 9 + o.seed) * 0.03 * t + (vnoise(ang * 3, t * 2, o.seed) - 0.5) * 0.12 * t;
        const ex = (rx + pad + flare * t * t) * fold;
        const ez = (rz + pad + flare * 0.8 * t * t) * fold;
        let x = Math.sin(ang) * ex;
        let z = cz + Math.cos(ang) * ez;
        const d0 = Math.hypot(x, z - cz);
        const want = (need[r][s] + pad + flare * 0.5 * t * t) * fold;
        if (d0 < want) {
          x *= want / d0;
          z = cz + (z - cz) * (want / d0);
        }
        const y = topAt - len * t;
        pos.push(x - Jp[bi('hips')].x, y - hipsY, (z - Jp[bi('hips')].z) / 0.8);
        uvs.push(u * 6, t * 3);
        c.copy(skirtCol).multiplyScalar(0.85 + vnoise(ang * 9, t * 8, 1) * 0.2 - (t > 0.92 ? 0.15 : 0) - look.grime * 0.2 * t);
        if (out === 'uniform' && Math.abs(Math.sin(ang)) < 0.4 && Math.cos(ang) > 0) c.copy(accentC);
        if (out === 'cassock' && Math.cos(ang) > 0.85 && Math.abs(Math.sin(ang)) > 0.12 && Math.abs(Math.sin(ang)) < 0.3 && t < 0.75) c.setHex(0x4a1e46);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let r = 0; r < rings; r++)
      for (let s = 0; s < seg; s++) {
        const a = r * (seg + 1) + s, b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    own(g);
    skirt = new THREE.Mesh(g, cloth(out === 'cardigan' ? 'wool' : fabricKind, 0.92, 3));
    skirt.castShadow = true;
    skirt.scale.z = 0.8;
    bones[bi('hips')].add(skirt);
  }

  // ---------------------------------------------------------------- hair, scarf, veil
  const hairMask = new Float32Array(nO);
  const style = look.hair;
  const hairline = (f: number, side: number): number => {
    // the edge of the hair, as height above the eyes (0) to the crown (1), by how far forward on the head (f)
    const pts: [number, number][] = [
      [0, -0.95], // the nape
      [0.25, -0.7],
      [0.42, -0.1], // behind the ear
      [0.55, 0.16], // above the ear
      [0.63, fem ? 0.28 : -0.25], // sideburn
      [0.7, 0.45], // temple
      [0.8, 0.62], // forehead
      [1.01, 0.62],
    ];
    let v = pts[0][1];
    for (let j = 1; j < pts.length; j++) if (f <= pts[j][0]) {
      const [f0, v0] = pts[j - 1], [f1, v1] = pts[j];
      v = v0 + ((v1 - v0) * (f - f0)) / (f1 - f0);
      break;
    }
    // men's temples recede with age; women keep a softer line
    if (!fem && f > 0.68) v += Math.max(0, look.age - 35) * 0.0025 * side;
    return v;
  };
  for (let i = 0; i < S.nBody; i++) {
    if (wHead[i] + wNeck[i] < 0.3) continue;
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const u = (y - eyeY) / (topY - eyeY);
    const f = Math.min(1, (z - backZ) / (frontZ - backZ));
    const side = smooth(0.1, 0.6, Math.abs(x) / halfW);
    const jitter = (vnoise(x * 90, y * 90, z * 90) - 0.5) * 0.12;
    let m = smooth(-0.05, 0.05, u - hairline(f, side) + jitter);
    if (S.masks[i * J.masks.length + J.masks.indexOf('ears')] > 150) m = 0;
    if (style === 'bald') m *= 1 - smooth(0.3, 0.5, u) * smooth(0.25, 0.45, f); // a fringe round the back and sides
    hairMask[i] = m;
  }
  const hairC = lin(look.hairColor);
  const hairMat = (color: THREE.Color, rough: number, vc = true): THREE.Material => {
    // matte, except slicked hair which keeps a sheen; broad specular made dark hair read as grey under the hall light
    const m: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial =
      rough < 0.45
        ? new THREE.MeshStandardMaterial({ color, map: strands(), alphaMap: wisps(), vertexColors: vc, alphaTest: 0.5, roughness: rough, metalness: 0, side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ color, map: strands(), alphaMap: wisps(), vertexColors: vc, alphaTest: 0.5, side: THREE.DoubleSide });
    own(m);
    return m;
  };
  const sphereUV = (pos: Float32Array): Float32Array => {
    const uv = new Float32Array(nS * 2);
    for (let s = 0; s < nS; s++) {
      const i = S.splitOrig[s];
      uv[s * 2] = Math.atan2(pos[i * 3], pos[i * 3 + 2] - (frontZ + backZ) / 2) / (Math.PI * 2) + 0.5;
      uv[s * 2 + 1] = (pos[i * 3 + 1] - chinY) / (topY - chinY + 0.01);
    }
    return uv;
  };
  // the outer surface of the hair, so hats and glasses can be fitted over it
  const hairPts: number[] = [];
  const scalpShell = (m: Float32Array, thick: number, lumps: number, color: THREE.Color, rough: number, alpha: (i: number) => number, tint?: (i: number, c: THREE.Color) => void): void => {
    const reg = new Uint8Array(nO);
    for (let i = 0; i < nO; i++) reg[i] = m[i] > 0.02 ? 1 : 0;
    const up = (i: number): number => smooth(-0.7, 0.9, (Y(i) - eyeY) / (topY - eyeY));
    const sh = shell(reg, {
      off: thick,
      smoothIt: 2,
      any: true, // keep the edge triangles: the alpha fades across them, so the hairline falls between vertices
      // fuller on the crown, thin at the hairline
      extra: (i) => thick * (m[i] - 1) * 0.95 + thick * up(i) * 0.6 * m[i] + (lumps ? (vnoise(P[i * 3] * 28, P[i * 3 + 1] * 28, P[i * 3 + 2] * 28) - 0.35) * lumps * m[i] : 0),
    });
    const colr = colorArr(
      (i, c) => {
        // roots and the underside are darker, the crown catches the light
        c.copy(color).multiplyScalar((0.55 + up(i) * 0.5) * (0.8 + vnoise(P[i * 3] * 40, P[i * 3 + 1] * 10, P[i * 3 + 2] * 40) * 0.35) * (0.7 + m[i] * 0.3));
        tint?.(i, c);
      },
      alpha,
    );
    for (let i = 0; i < nO; i++) if (sh.used[i] && alpha(i) > 0.5) hairPts.push(sh.pos[i * 3], sh.pos[i * 3 + 1], sh.pos[i * 3 + 2]);
    const mesh = addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, colr, 4, sphereUV(sh.pos), true), hairMat(new THREE.Color(1, 1, 1), rough), false);
    mesh.renderOrder = 1;
  };
  const headBone = bones[bi('head')];
  const atHead = (o3: THREE.Object3D, world: THREE.Vector3): void => {
    headBone.add(o3);
    o3.position.copy(headBone.worldToLocal(world.clone()));
  };
  if (style !== 'none' && style !== 'scarf' && style !== 'habit') {
    const thick = (style === 'curls' ? 0.02 : style === 'slick' ? 0.005 : style === 'long' ? 0.012 : style === 'bun' ? 0.009 : style === 'bald' ? 0.004 : 0.01) * k;
    const lumps = (style === 'curls' ? 0.035 : style === 'short' ? 0.006 : 0.002) * k;
    scalpShell(hairMask, thick, lumps, hairC, style === 'slick' ? 0.32 : 0.58, (i) => Math.min(1, hairMask[i] * 1.6) * (style === 'bald' ? 0.95 : 1));
    if (style === 'bun') {
      const g = new THREE.SphereGeometry(0.045 * k, 16, 12);
      own(g);
      const bun = new THREE.Mesh(g, hairMat(hairC, 0.6, false));
      bun.scale.set(1.1, 0.9, 0.85);
      atHead(bun, new THREE.Vector3(0, eyeY + (topY - eyeY) * 0.55, backZ - 0.015 * k));
    }
    if (style === 'long') {
      // hair falling to the shoulders behind, open at the face
      const g = new THREE.CylinderGeometry(halfW * 1.05, halfW * 1.25, (topY - neckY) * 0.95, 20, 6, true, Math.PI * 0.62, Math.PI * 1.36);
      g.translate(0, -(topY - neckY) * 0.2, 0);
      own(g);
      const curtain = new THREE.Mesh(g, hairMat(hairC, 0.6, false));
      atHead(curtain, new THREE.Vector3(0, eyeY, (frontZ + backZ) / 2 - 0.012 * k));
    }
  }
  if (style === 'scarf' || style === 'habit') {
    const wrap = new Float32Array(nO);
    for (let i = 0; i < S.nBody; i++) {
      if (wHead[i] + wNeck[i] < 0.3) continue;
      const y = P[i * 3 + 1], z = P[i * 3 + 2];
      const u = (y - eyeY) / (topY - eyeY);
      const f = (z - backZ) / (frontZ - backZ);
      // covers everything but the face: forehead line high, round the cheeks, under the chin for a scarf
      const faceOpen = f > 0.62 && u < 0.55 && u > (style === 'habit' ? -1.2 : -0.85);
      wrap[i] = faceOpen || Y(i) < neckY - 0.01 * k ? 0 : 1;
    }
    const clothC = style === 'habit' ? new THREE.Color(0x0c0c10) : new THREE.Color(0x5d615c);
    const reg = new Uint8Array(nO);
    for (let i = 0; i < nO; i++) reg[i] = wrap[i] > 0.5 ? 1 : 0;
    const sh = shell(reg, { off: (style === 'habit' ? 0.014 : 0.009) * k, smoothIt: 6 });
    const col = colorArr((i, c) => {
      wear(i, c, clothC);
      const f = (P[i * 3 + 2] - backZ) / (frontZ - backZ);
      if (style === 'habit' && f > 0.55 && Y(i) > chinY) c.setRGB(0.8, 0.79, 0.75); // the coif: white round the face
    });
    addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, col), cloth('wool', 0.95, 5));
    if (style === 'habit') {
      const g = new THREE.PlaneGeometry(halfW * 2.6, (topY - chestJ.y) * 1.05, 6, 6);
      g.translate(0, -(topY - chestJ.y) * 0.5, 0);
      own(g);
      const vm = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.95, side: THREE.DoubleSide });
      own(vm);
      const veil = new THREE.Mesh(g, vm);
      atHead(veil, new THREE.Vector3(0, topY, backZ - 0.02 * k));
      veil.rotation.x = 0.12;
    } else {
      const g = new THREE.SphereGeometry(0.022 * k, 10, 8);
      own(g);
      const sm = new THREE.MeshStandardMaterial({ color: 0x5d615c, roughness: 0.9 });
      own(sm);
      atHead(new THREE.Mesh(g, sm), new THREE.Vector3(0.01 * k, chinY - 0.02 * k, eyeZ - 0.02 * k));
    }
  }

  // moustache: a short thick shell over the upper lip
  let moustache: Float32Array | null = null;
  if (look.facial === 'moustache' || look.facial === 'beard') {
    const mm = new Float32Array(nO);
    for (let i = 0; i < S.nBody; i++) {
      if (wHead[i] < 0.5) continue;
      const x = Math.abs(P[i * 3]), y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (z < mz - 0.012 * k) continue;
      // under the nose, following the nostril wings down at the sides, drooping past the corners of the mouth
      const xr = Math.min(1.3, x / mouthHalf);
      const top = noseBase + 0.001 * k - xr * xr * 0.007 * k;
      const bot = my + 0.0035 * k - xr * xr * 0.009 * k;
      if (y > bot && y < top && xr < 1.2) mm[i] = (1 - smooth(0.9, 1.2, xr)) * smooth(bot, bot + 0.003 * k, y);
    }
    moustache = mm;
  }
  if (moustache) {
    const mm = moustache;
    const reg = new Uint8Array(nO);
    for (let i = 0; i < nO; i++) reg[i] = mm[i] > 0.05 ? 1 : 0;
    const sh = shell(reg, {
      off: 0.0035 * k,
      smoothIt: 3,
      any: true,
      extra: (i) => 0.0035 * k * (mm[i] - 1) + (vnoise(P[i * 3] * 300, P[i * 3 + 1] * 300, P[i * 3 + 2] * 300) - 0.3) * 0.0025 * k * mm[i],
    });
    const col = colorArr((i, c) => c.copy(hairC).multiplyScalar(0.6 + vnoise(P[i * 3] * 500, P[i * 3 + 1] * 120, 0) * 0.4), (i) => Math.min(1, mm[i] * 2) * (0.45 + vnoise(P[i * 3] * 700, P[i * 3 + 1] * 200, 3) * 0.75));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
    own(mat);
    addMesh(makeGeo(sh.pos, sh.nrm, sh.tris, col, 4, undefined, true), mat, false);
  }

  // ---------------------------------------------------------------- skin colour
  const skinCol = new Float32Array(nO * 3);
  const wetness = new Float32Array(nO).fill(0);
  const innerOf = (i: number): number => {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (i >= S.nBody || wHead[i] < 0.5 || Math.abs(x) > mouthHalf * 1.05 || Math.abs(y - my) > 0.022 * k || z > mz + 0.004 * k) return 0;
    const nz = N[i * 3 + 2], ny = N[i * 3 + 1];
    // only the lip tissue itself, or anything already behind the lips, can face into the mouth; the fold under
    // the lower lip also faces down and must stay skin
    const rawLip = S.masks[i * J.masks.length + J.masks.indexOf('lips')] / 255;
    const facingBack = rawLip > 0.1 || z < mz - 0.004 * k ? smooth(0.1, -0.2, nz) : 0;
    const floorOrRoof = z < mz - 0.004 * k && ((y < my && ny > 0.25) || (y > my && ny < -0.25)) ? 1 : 0;
    return Math.max(facingBack, floorOrRoof);
  };
  {
    const base = o.skin.clone();
    const innerMouth = new THREE.Color(0.11, 0.025, 0.03);
    const lip = fem && look.lipstick ? new THREE.Color(0x6a0c14) : base.clone().multiply(new THREE.Color(0.78, 0.5, 0.5));
    const flush = new THREE.Color(1.06, 0.82, 0.8);
    const bruise = new THREE.Color(0.72, 0.6, 0.66);
    const brow = hairC.clone().lerp(new THREE.Color(0x2a2018), look.age > 60 ? 0.2 : 0.5);
    const stub = new THREE.Color(0.55, 0.55, 0.6);
    const old = smooth(45, 85, look.age);
    const c = new THREE.Color();
    for (let i = 0; i < nO; i++) {
      if (!isBody(i)) {
        skinCol.set([0.82, 0.78, 0.66], i * 3);
        continue;
      }
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      c.copy(base);
      // blood under the skin: cheeks, nose, ears, knuckles, older faces more
      const red = mask(i, 'cheeks') * (0.35 + old * 0.25) + mask(i, 'nose') * (0.4 + old * 0.4) + mask(i, 'ears') * 0.5 + wHand[i] * 0.15;
      c.lerp(base.clone().multiply(flush), Math.min(1, red) * (o.fake ? 0.3 : 1));
      // dark under the eyes and on the lids
      c.lerp(base.clone().multiply(bruise), Math.min(1, mask(i, 'bags') * (0.35 + old * 0.5) + mask(i, 'lids') * 0.25));
      c.lerp(lip, mask(i, 'lips') * (look.lipstick ? 0.9 : 0.55));
      // brows: a band above each eye, thicker at the inner end
      for (const e of eyesBind) {
        const dx = (x - e.c.x) * Math.sign(e.c.x);
        const dy = y - e.c.y;
        const r = e.r;
        if (z < e.c.z - r * 0.5 || dx < -r * 1.25 || dx > r * 1.9) continue;
        const arch = r * (1.35 + 0.3 * Math.sin(((dx + r * 1.25) / (r * 3.15)) * Math.PI));
        const thick = r * (0.42 - ((dx + r * 1.25) / (r * 3.15)) * 0.22) * (look.age > 70 ? 0.8 : 1);
        const b = (1 - smooth(thick * 0.6, thick, Math.abs(dy - arch))) * (0.55 + vnoise(x * 400, y * 400, z * 400) * 0.45);
        c.lerp(brow, b * (fem ? 0.75 : 0.9));
      }
      // stubble, the lower face of men who have not shaved
      if (look.facial === 'stubble' || look.facial === 'beard') {
        const below = smooth(noseBase, noseBase - 0.02 * k, y) * (1 - mask(i, 'lips')) * (wHead[i] + wNeck[i] * 0.6);
        const front = smooth(backZ + (frontZ - backZ) * 0.45, backZ + (frontZ - backZ) * 0.6, z) * (y > chinY - 0.04 * k ? 1 : 0);
        c.lerp(c.clone().multiply(stub), below * front * (look.facial === 'beard' ? 0.9 : 0.55));
      }
      // the scalp under the hair takes its colour
      c.lerp(hairC.clone().multiplyScalar(0.55), hairMask[i] * (style === 'bald' ? 0.5 : 0.85));
      // age: blotches and spots
      if (old > 0) c.multiplyScalar(1 - old * 0.12 * smooth(0.55, 0.8, vnoise(x * 30, y * 30, z * 30)));
      // coal dust and grime
      if (look.grime > 0) c.multiplyScalar(1 - look.grime * 0.5 * smooth(0.4, 0.8, vnoise(x * 14 + 9, y * 14, z * 14)));
      if (look.barefoot && y < 0.02 * k) c.multiplyScalar(0.55);
      // inside the mouth. The fold under the lower lip faces forward and down, so it keeps its skin; the inside of
      // the lips faces back into the head, the floor of the mouth faces up, the roof faces down and back.
      if (innerOf(i) > 0) c.lerp(innerMouth, innerOf(i));

      skinCol[i * 3] = c.r;
      skinCol[i * 3 + 1] = c.g;
      skinCol[i * 3 + 2] = c.b;
    }
    if (o.paint) o.paint(sculptInfo(), skinCol, wetness);
    // creases: concave places (the fold beside the nose, eye corners, between the lips, ears) are darker
    for (let i = 0; i < S.nBody; i++) {
      let s = 0, n = 0;
      for (let j = S.nbrStart[i]; j < S.nbrStart[i + 1]; j++) {
        const v = S.nbr[j];
        s += (P[v * 3] - P[i * 3]) * N[i * 3] + (P[v * 3 + 1] - P[i * 3 + 1]) * N[i * 3 + 1] + (P[v * 3 + 2] - P[i * 3 + 2]) * N[i * 3 + 2];
        n++;
      }
      const cav = Math.max(0, s / (n || 1)) / (0.002 * k);
      const dark = 1 - Math.min(0.45, cav * 0.3);
      skinCol[i * 3] *= dark;
      skinCol[i * 3 + 1] *= dark * 0.98;
      skinCol[i * 3 + 2] *= dark * 0.98;
    }
  }
  const skinColBase = new Float32Array(skinCol);

  // ---------------------------------------------------------------- the body mesh
  const bodyIdx: number[] = [];
  for (let t = 0; t < S.body.length; t += 3) {
    const a = S.splitOrig[S.body[t]], b = S.splitOrig[S.body[t + 1]], c = S.splitOrig[S.body[t + 2]];
    if (covered[a] && covered[b] && covered[c]) continue;
    bodyIdx.push(S.body[t], S.body[t + 1], S.body[t + 2]);
  }
  const nBodyIdx = bodyIdx.length;
  const bodyGeo = makeGeo(P, N, bodyIdx, skinCol, 3, undefined, true);
  void nBodyIdx;
  // no shine inside the mouth: the inside triangles are painted black in a specular mask in the body's UV layout
  const specCanvas = document.createElement('canvas');
  specCanvas.width = specCanvas.height = 512;
  {
    const gx = specCanvas.getContext('2d')!;
    gx.fillStyle = '#fff';
    gx.fillRect(0, 0, 512, 512);
    // specularIntensityMap reads alpha, sheenColorMap reads colour: cutting the triangles out clears both
    gx.globalCompositeOperation = 'destination-out';
    gx.fillStyle = '#000';
    gx.strokeStyle = '#000';
    gx.lineWidth = 2;
    for (let t = 0; t < S.body.length; t += 3) {
      const ids = [S.body[t], S.body[t + 1], S.body[t + 2]];
      if (!ids.some((s2) => innerOf(S.splitOrig[s2]) > 0.4)) continue;
      gx.beginPath();
      ids.forEach((s2, j) => (j ? gx.lineTo : gx.moveTo).call(gx, S.uv[s2 * 2] * 512, (1 - S.uv[s2 * 2 + 1]) * 512));
      gx.closePath();
      gx.fill();
      gx.stroke();
    }
  }
  const specMap = new THREE.CanvasTexture(specCanvas);
  specMap.flipY = true;
  own(specMap);
  // skin: a softer highlight than plain plastic, and a warm sheen at the edges where light passes through
  const skinMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, specularIntensity: 0.45, specularIntensityMap: specMap, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.55, 0.22, 0.16), sheenColorMap: specMap, bumpMap: pores(), bumpScale: 0.35 });
  own(skinMat);
  // the inside of the mouth gets no light from the hall: the head would shadow it, and point lights cast no
  // shadows here, so the shader is told how deep inside the mouth each vertex is
  const cav = new Float32Array(nO);
  for (let i = 0; i < nO; i++) cav[i] = innerOf(i);
  bodyGeo.setAttribute('cavity', new THREE.BufferAttribute(toSplit(cav, 1), 1));
  // wetness: wet skin and fresh blood are glossy, dry skin is matte (only the tall one uses it)
  bodyGeo.setAttribute('wet', new THREE.BufferAttribute(toSplit(wetness, 1), 1));
  skinMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float cavity;\nattribute float wet;\nvarying float vCav;\nvarying float vWet;\nvoid main() {\n  vCav = cavity;\n  vWet = wet;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying float vCav;\nvarying float vWet;\nvoid main() {')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.16, vWet);')
      .replace('#include <opaque_fragment>', 'outgoingLight *= 1.0 - 0.9 * vCav;\n#include <opaque_fragment>');
  };
  skinMat.customProgramCacheKey = () => 'human-skin-cavity-wet';
  const body = addMesh(bodyGeo, skinMat);

  // ---------------------------------------------------------------- teeth, gums and tongue
  // MakeHuman's helper teeth are two 68 vertex strips. They only give the size and place of each arch; the arch
  // itself is built here: incisors, canines, premolars and molars along a curve, set into a gum line, a little
  // uneven, upper on the skull and lower on the jaw.
  const teethMat = new THREE.MeshStandardMaterial({ color: o.fake ? 0xd2d0c6 : look.age > 60 ? 0xa89c80 : 0xc8bea4, roughness: 0.42, metalness: 0, vertexColors: true });
  own(teethMat);
  const gumMat = new THREE.MeshStandardMaterial({ color: o.fake ? 0x5a4a4c : 0x6a2a2c, roughness: 0.5, metalness: 0 });
  own(gumMat);
  const mouthParts: THREE.Mesh[] = [];
  for (const upper of [true, false]) {
    let x1 = 0, zF = -9, zB = 9, yLo = 9, yHi = -9;
    for (let i = S.nBody; i < nO; i++) {
      const isJaw = J.bones[S.skinIdx[i * 4]].name === 'jaw';
      if (isJaw === upper) continue;
      x1 = Math.max(x1, Math.abs(P[i * 3]));
      zF = Math.max(zF, P[i * 3 + 2]);
      zB = Math.min(zB, P[i * 3 + 2]);
      yLo = Math.min(yLo, Y(i));
      yHi = Math.max(yHi, Y(i));
    }
    const sz = x1 / 0.026; // MakeHuman's arch is about 26 mm to the side
    const widths = [8.5, 6.5, 7.5, 7, 6.8, 10, 9.5].map((w) => w * 0.001 * sz * (upper ? 1 : 0.92));
    const parts: THREE.BufferGeometry[] = [];
    const gumPts: THREE.Vector3[] = [];
    const depth = zF - zB;
    // arch: front at zF, curving back to zB at the last molar
    const archAt = (s1: number): THREE.Vector3 => {
      const t = Math.min(1, s1 / (x1 * 1.9));
      return new THREE.Vector3(Math.sin(t * 1.25) / Math.sin(1.25) * x1 * 0.98, 0, zF - depth * Math.pow(t, 1.6));
    };
    // crowns hang from the gum: the upper ones down from the top of the helper strip, the lower ones up from its bottom
    const gumY = upper ? yHi : yLo;
    const toothH = 0.0105 * sz * (upper ? 1 : 0.9);
    for (const sd of [-1, 1]) {
      let along = 0;
      widths.forEach((w, n) => {
        const a = archAt(along + w / 2);
        const b = archAt(along + w / 2 + 0.001);
        along += w;
        // turn the tooth so its width runs along the arch (a rotation about y maps x to (cos, 0, -sin))
        const tang = Math.atan2(-(b.z - a.z), sd * (b.x - a.x));
        const h = toothH * [1, 0.92, 1.08, 0.86, 0.84, 0.78, 0.74][n];
        const dz = [2.2, 2.0, 3.5, 6.5, 6.5, 9, 8.5][n] * 0.001 * sz;
        const g = new RoundedBoxGeometry(w * 1.02, h, dz, 1, Math.min(w, dz) * 0.18);
        // incisors are blades, narrowing to the edge
        const pa = g.attributes.position as THREE.BufferAttribute;
        for (let v = 0; v < pa.count; v++) {
          const edge = upper ? -pa.getY(v) / h + 0.5 : pa.getY(v) / h + 0.5;
          pa.setZ(v, pa.getZ(v) * (1 - (n < 2 ? 0.45 : 0.15) * edge));
        }
        const jitter = (hash(o.seed, n * 2 + (sd > 0 ? 1 : 0), upper ? 3 : 4) - 0.5) * (look.age > 55 ? 0.12 : 0.05);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(sd * a.x, gumY + (upper ? -1 : 1) * (h * 0.5 - 0.001 * sz) + jitter * h * 0.2, a.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(jitter * 0.4, tang + jitter * 0.5, jitter * 0.5)),
          new THREE.Vector3(1, 1, 1),
        );
        g.applyMatrix4(m);
        // further back is darker: less light reaches the molars
        const shade = (1 - n * 0.11) * (0.92 + jitter);
        const col = new Float32Array((g.attributes.position as THREE.BufferAttribute).count * 3).fill(shade);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        parts.push(g);
      });
    }
    for (let j = -12; j <= 12; j++) {
      const a = archAt((Math.abs(j) / 12) * x1 * 1.9);
      gumPts.push(new THREE.Vector3(Math.sign(j) * a.x, gumY, a.z - 0.0015 * sz));
    }
    const geo = mergeGeometries(parts.map((g) => g.toNonIndexed()), false)!;
    geo.computeVertexNormals();
    own(geo);
    for (const g of parts) g.dispose();
    const gumGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gumPts), 40, 0.0028 * sz, 6);
    own(gumGeo);
    const bone = bones[bi(upper ? 'head' : 'jaw')];
    for (const [g, m] of [[geo, teethMat], [gumGeo, gumMat]] as const) {
      const mesh = new THREE.Mesh(g, m);
      bone.add(mesh);
      mesh.position.copy(bone.worldToLocal(new THREE.Vector3()));
      mouthParts.push(mesh);
    }
    if (!upper) {
      // the tongue lies in the floor of the mouth, behind the lower teeth
      const tg = new THREE.SphereGeometry(1, 14, 10);
      own(tg);
      const tongue = new THREE.Mesh(tg, gumMat);
      bone.add(tongue);
      tongue.position.copy(bone.worldToLocal(new THREE.Vector3(0, yLo + toothH * 0.35, zB + depth * 0.25)));
      tongue.scale.set(x1 * 0.75, toothH * 0.45, depth * 0.75);
      mouthParts.push(tongue);
    }
  }
  void skinColBase;

  // the mouth cavity. MakeHuman's head has no inside behind the lips, so an open mouth would show the room through
  // the head. Two dark half-shells close it: the roof rides the skull, the floor rides the jaw, and they overlap so
  // no gap opens however far the jaw drops. They sit inside the lips and chin, so they are only seen through the mouth.
  const cavityParts: THREE.Mesh[] = [];
  {
    const cm = new THREE.MeshBasicMaterial({ color: 0x0c0304, side: THREE.DoubleSide });
    own(cm);
    for (const upper of [true, false]) {
      const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, upper ? 0 : Math.PI * 0.4, Math.PI * 0.6);
      own(g);
      const m = new THREE.Mesh(g, cm);
      m.scale.set(mouthHalf * 1.1, (upper ? 0.026 : 0.032) * k, 0.028 * k);
      const bone = bones[bi(upper ? 'head' : 'jaw')];
      bone.add(m);
      m.position.copy(bone.worldToLocal(new THREE.Vector3(0, my + (upper ? -0.006 : 0.002) * k, lipFront - 0.046 * k)));
      cavityParts.push(m);
    }
  }

  // ---------------------------------------------------------------- eyes
  const ballMat = new THREE.MeshStandardMaterial({ map: eyeTexture(look.eye, o.fake), roughness: 0.08, metalness: 0 });
  own(ballMat);
  const blackEye = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.04, metalness: 0.2 });
  own(blackEye);
  const eyes = eyesBind.map((e) => {
    const holder = new THREE.Group();
    atHead(holder, e.c);
    const g = new THREE.SphereGeometry(e.r * 0.98, 24, 16);
    own(g);
    const ball = new THREE.Mesh(g, ballMat);
    holder.add(ball);
    return { holder, ball, x: e.c.x };
  });
  eyes.sort((a, b) => a.x - b.x); // index 0 is the visitor's right eye (x < 0), like the old rig

  // ---------------------------------------------------------------- hats and glasses, fitted to the skull
  // Everything is measured from the actual head and hair surface of this person: a hat band is the cross-section of
  // the head (with its hair) at the band height, the glasses sit just clear of brow, cheek and nose, and the arms
  // follow the side of the head to the top of each ear. Each piece is one group on the head bone, so it turns,
  // tilts and walks with the head.
  const isHeadSkin = (i: number): boolean => i < S.nBody && wHead[i] + wNeck[i] * 0.5 > 0.5;
  const earMask = (i: number): number => S.masks[i * J.masks.length + J.masks.indexOf('ears')] / 255;
  /** Cross-section of skin and hair at height y: half width, front and back. */
  const section = (y: number, tol = 0.005 * k): { rx: number; zMin: number; zMax: number } => {
    let rx = 0, zMin = 9, zMax = -9;
    const take = (x: number, yy: number, z: number): void => {
      if (Math.abs(yy - y) > tol) return;
      rx = Math.max(rx, Math.abs(x));
      zMin = Math.min(zMin, z);
      zMax = Math.max(zMax, z);
    };
    for (let i = 0; i < S.nBody; i++) if (isHeadSkin(i) && earMask(i) < 0.2) take(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    for (let j = 0; j < hairPts.length; j += 3) take(hairPts[j], hairPts[j + 1], hairPts[j + 2]);
    return { rx, zMin, zMax };
  };
  let crownY = topY;
  for (let j = 1; j < hairPts.length; j += 3) crownY = Math.max(crownY, hairPts[j]);
  const assembly = (): THREE.Group => {
    const grp = new THREE.Group();
    atHead(grp, new THREE.Vector3()); // the group's own coordinates are the rest-pose world coordinates
    return grp;
  };
  const piece = (grp: THREE.Group, g: THREE.BufferGeometry, m: THREE.Material, shadow = true): THREE.Mesh => {
    own(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = shadow;
    grp.add(mesh);
    return mesh;
  };
  /** A ring of the head's own shape at height y (ellipse from the measured section), grown by `grow`. */
  const ringAt = (y: number, grow: number): { cz: number; rx: number; rz: number } => {
    const sec = section(y);
    return { cz: (sec.zMin + sec.zMax) / 2, rx: sec.rx + grow, rz: (sec.zMax - sec.zMin) / 2 + grow };
  };
  /** A hat body from a profile: [height above the band, scale of the band ellipse], swept round the head. */
  const hatBody = (y0: number, ring: { cz: number; rx: number; rz: number }, prof: [number, number][], seg = 40, dent = 0): THREE.BufferGeometry => {
    const pos: number[] = [], idx: number[] = [];
    prof.forEach(([h, sc], r) => {
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        // a pinch at the front of the crown, and a centre dent along the top
        const top = r === prof.length - 1 ? 1 : 0;
        const pinch = dent * top * Math.max(0, Math.cos(a)) * 0.25;
        pos.push(Math.sin(a) * ring.rx * sc * (1 - pinch), y0 + h - dent * top * 0.012 * k * Math.abs(Math.cos(a * 0.5)), ring.cz + Math.cos(a) * ring.rz * sc);
      }
    });
    for (let r = 0; r < prof.length - 1; r++)
      for (let i = 0; i < seg; i++) {
        const a = r * (seg + 1) + i, b = a + seg + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    // close the top
    const c = pos.length / 3;
    const last = prof[prof.length - 1];
    pos.push(0, y0 + last[0] - dent * 0.014 * k, ring.cz);
    for (let i = 0; i < seg; i++) idx.push((prof.length - 1) * (seg + 1) + i, (prof.length - 1) * (seg + 1) + i + 1, c);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  /** A flat ring (brim) between two scales of the band ellipse, with a curl: up at the sides, down front and back. */
  const brim = (y0: number, ring: { cz: number; rx: number; rz: number }, s0: number, s1: number, curl: number, front = 1, seg = 48): THREE.BufferGeometry => {
    const pos: number[] = [], idx: number[] = [];
    for (let r = 0; r <= 3; r++) {
      const t = r / 3;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const sc = s0 + (s1 - s0) * t * (Math.cos(a) > 0 ? front : 1);
        pos.push(Math.sin(a) * ring.rx * sc, y0 + curl * t * t * (Math.sin(a) ** 2 - 0.6 * Math.cos(a) ** 2), ring.cz + Math.cos(a) * ring.rz * sc);
      }
    }
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < seg; i++) {
        const a = r * (seg + 1) + i, b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const feltTex = fabricTexture('wool').clone();
  feltTex.needsUpdate = true;
  feltTex.repeat.set(4, 2);
  own(feltTex);
  const felt = new THREE.MeshStandardMaterial({ color: topC.clone().multiplyScalar(0.85), map: feltTex, roughness: 0.92, side: THREE.DoubleSide });
  own(felt);
  const hatGap = 0.002 * k; // felt resting on hair, not sunk into it
  if (look.hat === 'trilby') {
    const grp = assembly();
    const y0 = eyeY + 0.05 * k;
    const ring = ringAt(y0, hatGap);
    const crownH = Math.max(crownY - y0 + 0.03 * k, 0.1 * k);
    piece(grp, hatBody(y0, ring, [[0, 1], [crownH * 0.5, 0.97], [crownH * 0.9, 0.9], [crownH, 0.84]], 40, 1), felt);
    piece(grp, brim(y0 + 0.001 * k, ring, 1.0, 1.55, 0.012 * k, 1.12), felt);
    const ribbon = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.55, side: THREE.DoubleSide });
    own(ribbon);
    piece(grp, hatBody(y0 + 0.002 * k, { cz: ring.cz, rx: ring.rx + 0.0015 * k, rz: ring.rz + 0.0015 * k }, [[0, 1], [0.016 * k, 0.99]]), ribbon, false);
  } else if (look.hat === 'flat') {
    // a flat cap: the band sits low on the forehead, the crown is full and pulled forward over a stiff peak
    const grp = assembly();
    const y0 = eyeY + 0.045 * k;
    const ring = ringAt(y0, hatGap);
    const h = crownY - y0 + 0.012 * k;
    const g = hatBody(y0, ring, [[0, 1], [h * 0.45, 1.05], [h * 0.8, 0.95], [h, 0.6]]);
    const pa = g.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < pa.count; v++) {
      const up = (pa.getY(v) - y0) / h;
      pa.setZ(v, pa.getZ(v) + Math.max(0, up) * 0.018 * k); // fullness slides forward toward the peak
    }
    g.computeVertexNormals();
    piece(grp, g, felt);
    // the peak: a half ellipse out of the front of the band, angled down
    const pk = new THREE.CircleGeometry(1, 24, -Math.PI / 2 + 0.25, Math.PI - 0.5);
    pk.rotateX(-Math.PI / 2);
    pk.scale(ring.rx * 0.95, 1, 0.06 * k);
    pk.rotateX(0.22);
    pk.translate(0, y0 + 0.002 * k, ring.cz + ring.rz * 0.92);
    piece(grp, pk, felt);
  } else if (look.hat === 'cloche') {
    // a cloche comes down to the brows and hugs the skull, with a narrow turned brim
    const grp = assembly();
    const y0 = eyeY + 0.028 * k;
    const ring = ringAt(y0 + 0.01 * k, hatGap + 0.004 * k);
    const h = crownY - y0 + 0.01 * k;
    const prof: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const yy = y0 + h * t;
      const sec = section(Math.min(yy, crownY - 0.004 * k));
      const sc = Math.min(1.02, Math.max(0.15, (sec.rx + hatGap + 0.004 * k) / ring.rx));
      prof.push([h * t, t < 1 ? sc : 0.12]);
    }
    piece(grp, hatBody(y0, ring, prof, 40), felt);
    piece(grp, brim(y0, ring, 1.0, 1.18, -0.01 * k, 1.05), felt);
  } else if (look.hat === 'nurse') {
    // a starched cap pinned on the crown, behind the hairline
    const grp = assembly();
    const white = new THREE.MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.7, side: THREE.DoubleSide });
    own(white);
    const y0 = crownY - 0.035 * k;
    const ring = ringAt(y0, hatGap);
    piece(grp, hatBody(y0, { cz: ring.cz - 0.01 * k, rx: ring.rx * 0.9, rz: ring.rz * 0.8 }, [[0, 1], [0.03 * k, 0.95], [0.045 * k, 0.7]]), white);
    const fold = piece(grp, new THREE.PlaneGeometry(ring.rx * 1.6, 0.03 * k), white);
    fold.position.set(0, y0 + 0.045 * k, ring.cz + ring.rz * 0.35);
    fold.rotation.x = -0.5;
  }
  if (look.glasses) {
    const grp = assembly();
    const frame = new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 0.35, metalness: 0.35 });
    own(frame);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, clearcoat: 1 });
    own(glass);
    const wire = 0.0013 * k;
    const lensR = eyesBind[0].r * 1.5;
    // the lens plane: clear of the brow, the cheek and the eyeball in front of each eye
    let lensZ = -9;
    for (const e of eyesBind) {
      lensZ = Math.max(lensZ, e.c.z + e.r + 0.008 * k);
      for (let i = 0; i < S.nBody; i++) {
        if (!isHeadSkin(i)) continue;
        const dx = P[i * 3] - e.c.x, dy = P[i * 3 + 1] - e.c.y;
        if (dx * dx + dy * dy < (lensR + 0.003 * k) ** 2) lensZ = Math.max(lensZ, P[i * 3 + 2] + 0.003 * k);
      }
    }
    const lensC = eyesBind.map((e) => new THREE.Vector3(e.c.x, e.c.y + 0.001 * k, lensZ));
    for (const c of lensC) {
      const rim = piece(grp, new THREE.TorusGeometry(lensR, wire, 6, 32), frame);
      rim.position.copy(c);
      rim.scale.y = 0.86;
      const lens = piece(grp, new THREE.CircleGeometry(lensR, 24), glass, false);
      lens.position.copy(c);
      lens.scale.y = 0.86;
    }
    // the bridge arches over the nose, resting on it
    let noseZ = -9;
    for (let i = 0; i < S.nBody; i++) if (isHeadSkin(i) && Math.abs(P[i * 3]) < 0.005 * k && Math.abs(P[i * 3 + 1] - (eyeY + 0.002 * k)) < 0.006 * k) noseZ = Math.max(noseZ, P[i * 3 + 2]);
    const inner = lensC.map((c) => c.clone().add(new THREE.Vector3(-Math.sign(c.x) * lensR, 0.002 * k, 0)));
    const bridgeMid = new THREE.Vector3(0, eyeY + 0.007 * k, Math.max(noseZ + wire * 1.5, lensZ - 0.004 * k));
    piece(grp, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([inner[0], bridgeMid, inner[1]]), 16, wire, 6), frame);
    // temple arms: from the hinge on the outer rim, along the side of the head, over the top of the ear, down behind it
    for (const [n, c] of lensC.entries()) {
      const sd = Math.sign(c.x);
      // the top of this ear and where it joins the head
      let earTop = -9, earZ = 0, earX = 0;
      for (let i = 0; i < S.nBody; i++) {
        if (earMask(i) < 0.6 || Math.sign(P[i * 3]) !== sd) continue;
        if (P[i * 3 + 1] > earTop) {
          earTop = P[i * 3 + 1];
          earZ = P[i * 3 + 2];
          earX = Math.abs(P[i * 3]);
        }
      }
      if (earTop < -1) continue;
      const surfX = (y: number, z: number): number => {
        let mx = 0;
        for (let i = 0; i < S.nBody; i++) if (isHeadSkin(i) && earMask(i) < 0.3 && Math.abs(P[i * 3 + 1] - y) < 0.008 * k && Math.abs(P[i * 3 + 2] - z) < 0.008 * k && Math.sign(P[i * 3]) === sd) mx = Math.max(mx, Math.abs(P[i * 3]));
        for (let j = 0; j < hairPts.length; j += 3) if (Math.abs(hairPts[j + 1] - y) < 0.008 * k && Math.abs(hairPts[j + 2] - z) < 0.008 * k && Math.sign(hairPts[j]) === sd) mx = Math.max(mx, Math.abs(hairPts[j]));
        return mx;
      };
      const hinge = c.clone().add(new THREE.Vector3(sd * lensR * 0.97, lensR * 0.3, -0.002 * k));
      const pts = [hinge];
      const yArm = (t: number): number => hinge.y + (earTop + 0.002 * k - hinge.y) * t;
      for (let j = 1; j <= 5; j++) {
        const t = j / 6;
        const z = hinge.z + (earZ - hinge.z) * t;
        const y = yArm(t);
        const x = Math.max(Math.abs(hinge.x), surfX(y, z) + 0.003 * k);
        pts.push(new THREE.Vector3(sd * x, y, z));
      }
      const overEar = new THREE.Vector3(sd * Math.max(earX * 0.97, surfX(earTop, earZ) + 0.002 * k), earTop + 0.0025 * k, earZ);
      pts.push(overEar);
      // the earpiece curls down behind the ear, tucked against the skull
      pts.push(new THREE.Vector3(sd * (overEar.x - 0.001 * k), earTop - 0.012 * k, earZ - 0.012 * k));
      pts.push(new THREE.Vector3(sd * (overEar.x - 0.003 * k), earTop - 0.026 * k, earZ - 0.014 * k));
      piece(grp, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 40, wire * 0.9, 6), frame);
      // the hinge block
      const hb = piece(grp, new THREE.BoxGeometry(0.004 * k, 0.003 * k, 0.005 * k), frame);
      hb.position.copy(hinge);
      void n;
    }
  }

  // ---------------------------------------------------------------- rig in the old shape
  const arm = (s: string): Arm => ({
    side: Math.sign(Jp[bi('hand' + s)].x),
    sh: bones[bi('upper' + s)],
    el: bones[bi('fore' + s)],
    hand: bones[bi('hand' + s)],
    fingers: [2, 3, 4, 5].map((f) => bones[bi('f' + f + 'a' + s)]),
    tips: [2, 3, 4, 5].map((f) => bones[bi('f' + f + 'b' + s)]),
  });
  const leg = (s: string): Leg => ({ side: Math.sign(Jp[bi('thigh' + s)].x), hip: bones[bi('thigh' + s)], knee: bones[bi('shin' + s)] });
  const arms = [arm('.L'), arm('.R')].sort((a, b) => a.side - b.side);
  const legs = [leg('.L'), leg('.R')].sort((a, b) => a.side - b.side);
  const exprIndex = new Map(exprNames.map((n, i) => [n, i]));
  const morphMeshes = meshes.filter((m) => m.geometry.morphAttributes.position);
  for (const m of morphMeshes) m.updateMorphTargets();
  const pale = new THREE.Color(0x8a8c88);
  void body;
  const rig: HumanRig = {
    human: true,
    root,
    pelvis: bones[bi('hips')],
    chest: bones[bi('spine1')],
    spine: bones[bi('spine')],
    headMount: headBone,
    head: headBone,
    neck: bones[bi('neck')],
    jaw: bones[bi('jaw')],
    arms,
    legs,
    skirt,
    scaleY: hipsY / 0.95,
    mouthY: my,
    mouthZ: lipFront,
    eyes: eyes.map(({ holder, ball }) => ({ holder, ball })),
    ballMat,
    blackEye,
    setExpr(name: ExprName, v: number): void {
      const i = exprIndex.get(name);
      if (i === undefined) return;
      for (const m of morphMeshes) if (m.morphTargetInfluences) m.morphTargetInfluences[i] = v;
    },
    mouthParts,
    setPale(t: number): void {
      skinMat.color.setRGB(1, 1, 1).lerp(pale, t);
      void t;
    },
  };
  return rig;
}
