// Bakes the visitors' bodies from the MakeHuman 1.x system assets (CC0) into one compact file the game loads.
// Run: node tools/mh-bake.mjs   (fetches the assets into .cache/ on first run, about 120 MB of targets)
// Output: public/characters/humans.bin and humans.json
//
// What it does, per character: start from the MakeHuman base mesh, add the macro shapes (sex, age, weight,
// muscle, height, ancestry) with MakeHuman's own weighting, add the face shapes listed in CAST below, then
// store the positions as 16 bit integers. Topology, UVs, skin weights and expression shapes are shared.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cache = path.join(root, '.cache', 'makehuman');
const DATA = process.env.MH_DATA ?? path.join(cache, 'makehuman', 'data');
if (!fs.existsSync(path.join(DATA, '3dobjs', 'base.obj'))) {
  fs.mkdirSync(cache, { recursive: true });
  execSync('git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git ' + JSON.stringify(cache), { stdio: 'inherit' });
  execSync('git sparse-checkout set makehuman/data/3dobjs makehuman/data/rigs makehuman/data/targets', { cwd: cache, stdio: 'inherit' });
}
const OUT = path.join(root, 'public', 'characters');
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ base mesh
const objText = fs.readFileSync(path.join(DATA, '3dobjs', 'base.obj'), 'utf8').split('\n');
const V = [];
const VT = [];
const faces = { body: [], teethU: [], teethL: [] };
let group = '';
for (const line of objText) {
  if (line.startsWith('v ')) {
    const [, x, y, z] = line.trim().split(/\s+/).map(Number);
    V.push([x, y, z]);
  } else if (line.startsWith('vt ')) {
    const [, u, v] = line.trim().split(/\s+/).map(Number);
    VT.push([u, v]);
  } else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) {
    const key = group === 'body' ? 'body' : group === 'helper-upper-teeth' ? 'teethU' : group === 'helper-lower-teeth' ? 'teethL' : null;
    if (!key) continue;
    faces[key].push(line.trim().split(/\s+/).slice(1).map((t) => t.split('/').map((n) => Number(n) - 1)));
  }
}
// kept vertices: the body (0..13379) and the teeth, renumbered to follow the body
const keep = new Map();
const keepList = [];
const addKeep = (v) => {
  if (!keep.has(v)) {
    keep.set(v, keepList.length);
    keepList.push(v);
  }
};
for (let i = 0; i < 13380; i++) addKeep(i);
for (const k of ['teethU', 'teethL']) for (const f of faces[k]) for (const [v] of f) addKeep(v);
const nOrig = keepList.length;

// split by (vertex, uv) so UV seams stay sharp
const splitKey = new Map();
const splitOrig = [];
const splitUV = [];
const tri = { body: [], teeth: [] };
for (const k of ['body', 'teethU', 'teethL']) {
  for (const f of faces[k]) {
    const ids = f.map(([v, t]) => {
      const key = v * 100000 + (t ?? 0);
      let id = splitKey.get(key);
      if (id === undefined) {
        id = splitOrig.length;
        splitKey.set(key, id);
        splitOrig.push(keep.get(v));
        splitUV.push(t !== undefined && t >= 0 ? VT[t] : [0, 0]);
      }
      return id;
    });
    const out = k === 'body' ? tri.body : tri.teeth;
    for (let i = 1; i + 1 < ids.length; i++) out.push(ids[0], ids[i], ids[i + 1]);
  }
}
const nSplit = splitOrig.length;
if (nSplit > 65535) throw new Error('too many split vertices');

// ------------------------------------------------------------------ targets
const targetCache = new Map();
const findTarget = (name) => {
  for (const dir of ['', 'macrodetails', 'macrodetails/height', 'macrodetails/proportions', 'nose', 'mouth', 'chin', 'cheek', 'head', 'eyebrows', 'forehead', 'ears', 'neck', 'eyes', 'expression/units/caucasian']) {
    const p = path.join(DATA, 'targets', dir, name + '.target');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('no target ' + name);
};
const target = (name) => {
  if (targetCache.has(name)) return targetCache.get(name);
  const rows = [];
  for (const line of fs.readFileSync(findTarget(name), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const [i, x, y, z] = line.trim().split(/\s+/).map(Number);
    rows.push([i, x, y, z]);
  }
  targetCache.set(name, rows);
  return rows;
};

// MakeHuman's macro weighting (apps/humanmodifier.py), in the same value ranges it uses
const ageValue = (years) => (years < 25 ? (years < 11 ? ((years - 1) / 10) * 0.1875 : 0.1875 + ((years - 11) / 14) * 0.3125) : 0.5 + ((years - 25) / 65) * 0.5);
function macroWeights(c) {
  const out = [];
  const g = { female: 1 - c.gender, male: c.gender };
  const a = ageValue(c.age);
  const age = a < 0.5 ? { baby: Math.max(0, 1 - a * 5.333), child: 0, young: Math.max(0, (a - 0.1875) * 3.2), old: 0 } : { baby: 0, child: 0, young: 1 - (a * 2 - 1), old: a * 2 - 1 };
  if (a < 0.5) age.child = Math.max(0, Math.min(1, 5.333 * a) - age.young);
  const three = (v, lo, mid, hi) => (v < 0.5 ? { [lo]: 1 - v * 2, [mid]: v * 2, [hi]: 0 } : { [lo]: 0, [mid]: 1 - (v - 0.5) * 2, [hi]: (v - 0.5) * 2 });
  const mus = three(c.muscle, 'minmuscle', 'averagemuscle', 'maxmuscle');
  const wt = three(c.weight, 'minweight', 'averageweight', 'maxweight');
  // the game sets the final height; this only shifts proportions (longer legs, smaller head), so keep it gentle
  const h = 0.5 + (c.height - 0.5) * 0.4;
  const ht = h < 0.5 ? { minheight: 1 - h * 2 } : { maxheight: (h - 0.5) * 2 };
  const pr = { idealproportions: c.proportions ?? 0.5 };
  for (const [gk, gw] of Object.entries(g)) for (const [ak, aw] of Object.entries(age)) {
    if (!gw || !aw) continue;
    for (const [mk, mw] of Object.entries(mus)) for (const [wk, ww] of Object.entries(wt)) {
      const w = gw * aw * mw * ww;
      if (w < 1e-4) continue;
      out.push([`universal-${gk}-${ak}-${mk}-${wk}`, w]);
      for (const [hk, hw] of Object.entries(ht)) if (hw > 1e-4) out.push([`${gk}-${ak}-${mk}-${wk}-${hk}`, w * hw]);
      if (ak !== 'baby') for (const [pk, pw] of Object.entries(pr)) if (pw > 1e-4) out.push([`${gk}-${ak}-${mk}-${wk}-${pk}`, w * pw]);
    }
    const eth = c.eth ?? { caucasian: 1 };
    for (const [ek, ew] of Object.entries(eth)) if (ew > 0) out.push([`${ek}-${gk}-${ak}`, gw * aw * ew]);
  }
  return out;
}

// ------------------------------------------------------------------ the cast
// gender 0 female to 1 male; muscle, weight, height 0 to 1 with 0.5 average; eth ancestry mix.
// face: MakeHuman region shapes and their strength. These carry each person's identity and asymmetry.
const CAST = {
  walter: { gender: 1, age: 71, muscle: 0.35, weight: 0.42, height: 0.42, face: { 'head-oval': 0.6, 'head-scale-vert-incr': 0.25, 'nose-scale-vert-incr': 0.5, 'nose-scale-depth-incr': 0.4, 'nose-hump-incr': 0.4, 'nose-point-down': 0.4, 'l-eye-eyefold-down': 0.3, 'r-eye-eyefold-down': 0.45, 'l-eye-height2-incr': 0.3, 'r-eye-height2-incr': 0.2, 'l-eye-bag-incr': 0.6, 'r-eye-bag-incr': 0.7, 'l-cheek-volume-decr': 0.5, 'r-cheek-volume-decr': 0.6, 'mouth-angles-down': 0.4, 'mouth-upperlip-volume-decr': 0.4, 'l-ear-scale-incr': 0.5, 'r-ear-scale-incr': 0.6, 'l-ear-lobe-incr': 0.6, 'r-ear-lobe-incr': 0.6, 'chin-prominent-incr': 0.2, 'forehead-scale-vert-incr': 0.4, 'eyebrows-trans-down': 0.3 } },
  bernard: { gender: 1, age: 48, muscle: 0.45, weight: 0.92, height: 0.3, face: { 'head-round': 0.7, 'head-fat-incr': 0.7, 'neck-double-incr': 0.8, 'nose-scale-horiz-incr': 0.5, 'nose-point-width-incr': 0.6, 'nose-flaring-incr': 0.4, 'chin-prominent-decr': 0.5, 'chin-width-incr': 0.4, 'l-cheek-volume-incr': 0.6, 'r-cheek-volume-incr': 0.6, 'mouth-lowerlip-volume-incr': 0.4, 'l-eye-scale-decr': 0.3, 'r-eye-scale-decr': 0.3, 'r-eye-trans-down': 0.15 } },
  dolly: { gender: 0, age: 54, muscle: 0.4, weight: 0.6, height: 0.48, face: { 'head-round': 0.3, 'l-cheek-bones-incr': 0.7, 'r-cheek-bones-incr': 0.7, 'l-cheek-volume-incr': 0.4, 'r-cheek-volume-incr': 0.5, 'mouth-upperlip-volume-incr': 0.5, 'mouth-lowerlip-volume-incr': 0.6, 'mouth-cupidsbow-incr': 0.6, 'nose-scale-horiz-decr': 0.3, 'nose-point-up': 0.4, 'l-eye-eyefold-angle-up': 0.4, 'r-eye-eyefold-angle-up': 0.4, 'eyebrows-angle-up': 0.6, 'chin-prominent-incr': 0.3, 'r-eye-height2-incr': 0.2 } },
  tobias: { gender: 1, age: 24, muscle: 0.3, weight: 0.12, height: 0.85, face: { 'head-oval': 0.5, 'head-scale-horiz-decr': 0.3, 'l-cheek-volume-decr': 0.9, 'r-cheek-volume-decr': 0.9, 'l-cheek-bones-incr': 0.6, 'r-cheek-bones-incr': 0.5, 'forehead-temple-decr': 0.6, 'l-eye-bag-incr': 0.5, 'r-eye-bag-incr': 0.6, 'nose-scale-vert-incr': 0.3, 'nose-hump-incr': 0.3, 'chin-width-decr': 0.4, 'mouth-scale-horiz-decr': 0.2, 'l-eye-push1-in': 0.4, 'r-eye-push1-in': 0.5, 'neck-scale-horiz-decr': 0.4 } },
  ivor: { gender: 1, age: 52, muscle: 0.85, weight: 0.7, height: 0.25, face: { 'head-square': 0.7, 'forehead-nubian-incr': 0.4, 'eyebrows-trans-forward': 0.6, 'eyebrows-trans-down': 0.2, 'nose-scale-horiz-incr': 0.6, 'nose-volume-incr': 0.6, 'nose-hump-incr': 0.6, 'nose-curve-convex': 0.5, 'nose-trans-in': 0.15, 'chin-width-incr': 0.6, 'l-eye-scale-decr': 0.12, 'r-eye-scale-decr': 0.04, 'mouth-scale-horiz-incr': 0.3, 'neck-scale-horiz-incr': 0.6, 'l-ear-flap-incr': 0.5 } },
  mae: { gender: 0, age: 41, muscle: 0.3, weight: 0.15, height: 0.4, face: { 'head-oval': 0.4, 'l-cheek-volume-decr': 0.8, 'r-cheek-volume-decr': 0.8, 'forehead-temple-decr': 0.5, 'l-eye-bag-incr': 0.8, 'r-eye-bag-incr': 0.8, 'l-eye-push1-in': 0.6, 'r-eye-push1-in': 0.6, 'mouth-lowerlip-volume-decr': 0.3, 'mouth-angles-down': 0.5, 'nose-scale-horiz-decr': 0.2, 'chin-width-decr': 0.3, 'eyebrows-angle-down': 0.3 } },
  penhale: { gender: 1, age: 58, muscle: 0.4, weight: 0.28, height: 0.95, face: { 'head-oval': 0.7, 'head-scale-vert-incr': 0.6, 'head-scale-horiz-decr': 0.5, 'forehead-temple-decr': 1, 'l-cheek-volume-decr': 1, 'r-cheek-volume-decr': 1, 'l-cheek-bones-incr': 0.8, 'r-cheek-bones-incr': 0.8, 'chin-height-incr': 0.6, 'chin-prominent-incr': 0.5, 'nose-scale-vert-incr': 0.6, 'nose-point-down': 0.5, 'nose-greek-incr': 0.4, 'mouth-scale-horiz-decr': 0.3, 'mouth-upperlip-volume-decr': 0.35, 'mouth-lowerlip-volume-decr': 0.25, 'l-eye-push1-in': 0.35, 'r-eye-push1-in': 0.35, 'l-eye-height2-incr': 0.4, 'r-eye-height2-incr': 0.45, 'eyebrows-angle-down': 0.2, 'l-ear-rot-backward': 0.5, 'r-ear-rot-backward': 0.5 } },
  rosa: { gender: 0, age: 34, muscle: 0.5, weight: 0.5, height: 0.42, eth: { caucasian: 0.55, african: 0.25, asian: 0.2 }, face: { 'head-round': 0.4, 'l-cheek-volume-incr': 0.6, 'r-cheek-volume-incr': 0.6, 'l-cheek-bones-incr': 0.3, 'r-cheek-bones-incr': 0.3, 'mouth-upperlip-volume-incr': 0.3, 'mouth-lowerlip-volume-incr': 0.5, 'nose-point-width-incr': 0.3, 'nose-scale-depth-decr': 0.2, 'l-eye-scale-incr': 0.2, 'r-eye-scale-incr': 0.2, 'eyebrows-angle-up': 0.3, 'chin-prominent-decr': 0.2, 'mouth-dimples-in': 0.5 } },
  marsh: { gender: 1, age: 50, muscle: 0.55, weight: 0.5, height: 0.75, face: { 'head-rectangular': 0.6, 'chin-prominent-incr': 0.7, 'chin-height-incr': 0.4, 'chin-cleft-incr': 0.6, 'nose-scale-vert-incr': 0.3, 'nose-greek-incr': 0.4, 'mouth-scale-horiz-decr': 0.2, 'mouth-upperlip-volume-decr': 0.5, 'eyebrows-trans-down': 0.3, 'l-eye-height2-decr': 0.3, 'r-eye-height2-decr': 0.3, 'l-cheek-bones-incr': 0.4, 'r-cheek-bones-incr': 0.4 } },
  gus: { gender: 1, age: 36, muscle: 0.8, weight: 0.85, height: 0.65, face: { 'head-square': 0.6, 'head-fat-incr': 0.4, 'eyebrows-trans-forward': 1, 'forehead-nubian-incr': 0.6, 'nose-scale-horiz-incr': 0.7, 'nose-curve-convex': 0.7, 'nose-trans-out': 0.3, 'chin-width-incr': 0.7, 'mouth-scale-horiz-incr': 0.3, 'l-eye-scale-decr': 0.5, 'r-eye-scale-decr': 0.2, 'r-eye-trans-down': 0.4, 'l-ear-flap-incr': 0.8, 'r-ear-scale-decr': 0.3, 'neck-scale-horiz-incr': 0.8 } },
  hester: { gender: 0, age: 84, muscle: 0.15, weight: 0.25, height: 0.15, face: { 'head-age-incr': 1, 'head-oval': 0.3, 'l-cheek-volume-decr': 1, 'r-cheek-volume-decr': 1, 'forehead-temple-decr': 0.7, 'l-eye-bag-incr': 1, 'r-eye-bag-incr': 1, 'l-eye-eyefold-down': 0.5, 'r-eye-eyefold-down': 0.35, 'mouth-upperlip-volume-decr': 1, 'mouth-lowerlip-volume-decr': 0.9, 'mouth-angles-down': 0.7, 'mouth-laugh-lines-in': 0.8, 'nose-scale-vert-incr': 0.3, 'nose-point-down': 0.6, 'chin-prominent-incr': 0.5, 'l-ear-lobe-incr': 0.8, 'r-ear-lobe-incr': 0.8, 'l-ear-scale-incr': 0.4, 'r-ear-scale-incr': 0.4 } },
  hollis: { gender: 1, age: 55, muscle: 0.9, weight: 0.8, height: 1, eth: { african: 0.75, caucasian: 0.25 }, face: { 'head-square': 0.8, 'eyebrows-trans-forward': 0.8, 'forehead-nubian-incr': 0.5, 'nose-scale-horiz-incr': 0.5, 'nose-flaring-incr': 0.6, 'chin-width-incr': 0.8, 'chin-prominent-incr': 0.4, 'l-eye-bag-incr': 0.5, 'r-eye-bag-incr': 0.6, 'mouth-lowerlip-volume-incr': 0.3, 'r-eye-scale-decr': 0.25, 'neck-scale-horiz-incr': 1, 'l-ear-scale-decr': 0.2 } },
  june: { gender: 0, age: 68, muscle: 0.3, weight: 0.45, height: 0.32, face: { 'head-round': 0.5, 'l-cheek-volume-incr': 0.3, 'r-cheek-volume-incr': 0.3, 'l-eye-bag-incr': 0.5, 'r-eye-bag-incr': 0.5, 'mouth-cupidsbow-incr': 0.4, 'nose-point-up': 0.3, 'nose-scale-horiz-decr': 0.2, 'eyebrows-angle-up': 0.4, 'l-eye-eyefold-down': 0.4, 'r-eye-eyefold-down': 0.4 } },
  edie: { gender: 0, age: 60, muscle: 0.4, weight: 0.45, height: 0.5, face: { 'head-oval': 0.5, 'l-cheek-bones-incr': 0.6, 'r-cheek-bones-incr': 0.6, 'chin-prominent-incr': 0.4, 'nose-scale-vert-incr': 0.3, 'nose-greek-incr': 0.5, 'mouth-upperlip-volume-incr': 0.2, 'l-eye-bag-incr': 0.3, 'r-eye-bag-incr': 0.4, 'eyebrows-angle-up': 0.5, 'mouth-angles-down': 0.2 } },
  ada: { gender: 0, age: 66, muscle: 0.25, weight: 0.22, height: 0.32, face: { 'head-oval': 0.5, 'l-cheek-volume-decr': 0.7, 'r-cheek-volume-decr': 0.7, 'l-eye-bag-incr': 0.7, 'r-eye-bag-incr': 0.7, 'forehead-temple-decr': 0.5, 'mouth-angles-down': 0.3, 'nose-point-up': 0.2, 'eyebrows-angle-up': 0.3, 'mouth-upperlip-volume-decr': 0.4 } },
  sister: { gender: 0, age: 52, muscle: 0.4, weight: 0.4, height: 0.55, face: { 'head-oval': 0.6, 'l-cheek-bones-incr': 0.5, 'r-cheek-bones-incr': 0.5, 'mouth-scale-horiz-decr': 0.3, 'mouth-upperlip-volume-decr': 0.5, 'nose-scale-vert-incr': 0.2, 'l-eye-push1-in': 0.4, 'r-eye-push1-in': 0.4 } },
  // stock bodies for the people without a name; the game blends two of these
  m_young: { gender: 1, age: 30, muscle: 0.5, weight: 0.5, height: 0.55, face: { 'nose-scale-vert-incr': 0.2, 'chin-prominent-incr': 0.2 } },
  m_old: { gender: 1, age: 64, muscle: 0.4, weight: 0.6, height: 0.45, face: { 'l-eye-bag-incr': 0.5, 'r-eye-bag-incr': 0.5, 'nose-volume-incr': 0.3, 'head-round': 0.3 } },
  f_young: { gender: 0, age: 29, muscle: 0.45, weight: 0.45, height: 0.5, face: { 'l-cheek-bones-incr': 0.3, 'r-cheek-bones-incr': 0.3 } },
  // the tall one starts as a starved, very old man; the game stretches him far past this
  creature: { gender: 1, age: 88, muscle: 0, weight: 0, height: 1, face: { 'head-age-incr': 1, 'head-oval': 1, 'head-scale-vert-incr': 1, 'head-scale-horiz-decr': 0.6, 'forehead-temple-decr': 1, 'l-cheek-volume-decr': 1, 'r-cheek-volume-decr': 1, 'l-cheek-bones-incr': 1, 'r-cheek-bones-incr': 0.7, 'l-eye-push1-in': 1, 'r-eye-push1-in': 0.8, 'l-eye-bag-incr': 1, 'r-eye-bag-incr': 1, 'r-eye-trans-down': 0.5, 'mouth-scale-horiz-incr': 1, 'mouth-upperlip-volume-decr': 1, 'mouth-lowerlip-volume-decr': 1, 'mouth-angles-down': 1, 'chin-height-incr': 1, 'chin-prominent-incr': 0.6, 'nose-scale-depth-decr': 0.8, 'nose-volume-decr': 1, 'neck-scale-horiz-decr': 1, 'neck-scale-vert-incr': 1, 'l-ear-scale-decr': 0.6, 'r-ear-rot-backward': 1 } },
  f_old: { gender: 0, age: 63, muscle: 0.35, weight: 0.55, height: 0.4, face: { 'l-eye-bag-incr': 0.5, 'r-eye-bag-incr': 0.5, 'mouth-angles-down': 0.3 } },
};

// ------------------------------------------------------------------ rig: 27 bones merged from MakeHuman's 163
const skel = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs', 'default.mhskel'), 'utf8'));
const weightsJson = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs', 'default_weights.mhw'), 'utf8')).weights;
const merge = (b) => {
  if (/^(levator|orbicularis|risorius|oris|temporalis|platysma|mandible)/.test(b) && skel.bones[b]) return merge(skel.bones[b].parent);
  const s = b.endsWith('.L') ? '.L' : b.endsWith('.R') ? '.R' : '';
  const n = s ? b.slice(0, -2) : b;
  if (n === 'root' || n === 'pelvis') return 'hips';
  if (n === 'spine05' || n === 'spine04') return 'spine';
  if (n === 'spine03') return 'spine1';
  if (n === 'spine02' || n === 'spine01' || n === 'breast') return 'chest';
  if (n.startsWith('neck')) return 'neck';
  if (n === 'jaw' || n === 'special04' || n.startsWith('tongue')) return 'jaw';
  if (n === 'head' || n.startsWith('special') || n === 'eye') return 'head';
  if (n === 'clavicle' || n === 'shoulder01') return 'clav' + s;
  if (n.startsWith('upperarm')) return 'upper' + s;
  if (n.startsWith('lowerarm')) return 'fore' + s;
  if (n === 'wrist' || n.startsWith('metacarpal')) return 'hand' + s;
  if (n.startsWith('finger1')) return 'thumb' + s;
  // one bone per finger at the knuckle, one for the two end joints together: fingers move on their own
  const fm = /^finger([2-5])-([123])$/.exec(n);
  if (fm) return 'f' + fm[1] + (fm[2] === '1' ? 'a' : 'b') + s;
  if (n.startsWith('upperleg')) return 'thigh' + s;
  if (n.startsWith('lowerleg')) return 'shin' + s;
  if (n === 'foot' || n.startsWith('toe')) return 'foot' + s;
  // face muscles and anything else: whatever their parent maps to
  const par = skel.bones[b]?.parent;
  if (!par) throw new Error('unmapped bone ' + b);
  return merge(par);
};
const BONES = ['hips', 'spine', 'spine1', 'chest', 'neck', 'head', 'jaw'];
const PARENT = { hips: null, spine: 'hips', spine1: 'spine', chest: 'spine1', neck: 'chest', head: 'neck', jaw: 'head' };
// where each merged bone pivots: the head joint of these MakeHuman bones, averaged
const PIVOT = { hips: ['upperleg01.L', 'upperleg01.R'], spine: ['spine04'], spine1: ['spine03'], chest: ['spine02'], neck: ['neck01'], head: ['head'], jaw: ['jaw'] };
for (const s of ['.L', '.R']) {
  const add = (n, parent, piv) => {
    BONES.push(n + s);
    PARENT[n + s] = parent;
    PIVOT[n + s] = piv.map((p) => p + s);
  };
  add('clav', 'chest', ['clavicle']);
  add('upper', 'clav' + s, ['upperarm01']);
  add('fore', 'upper' + s, ['lowerarm01']);
  add('hand', 'fore' + s, ['wrist']);
  for (let f = 2; f <= 5; f++) {
    add('f' + f + 'a', 'hand' + s, ['finger' + f + '-1']);
    add('f' + f + 'b', 'f' + f + 'a' + s, ['finger' + f + '-2']);
  }
  add('thumb', 'hand' + s, ['finger1-2']);
  add('thigh', 'hips', ['upperleg01']);
  add('shin', 'thigh' + s, ['lowerleg01']);
  add('foot', 'shin' + s, ['foot']);
}
const boneIndex = new Map(BONES.map((b, i) => [b, i]));
// skin weights: top four merged bones per kept vertex
const acc = Array.from({ length: nOrig }, () => new Map());
for (const [b, list] of Object.entries(weightsJson)) {
  const m = boneIndex.get(merge(b));
  for (const [v, w] of list) {
    const k = keep.get(v);
    if (k === undefined) continue;
    acc[k].set(m, (acc[k].get(m) ?? 0) + w);
  }
}
const skinIdx = new Uint8Array(nOrig * 4);
const skinW = new Uint8Array(nOrig * 4);
for (let i = 0; i < nOrig; i++) {
  let e = [...acc[i].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!e.length) e = [[boneIndex.get(i >= 13380 ? 'head' : 'hips'), 1]];
  const sum = e.reduce((s, x) => s + x[1], 0);
  // round down, then give what is left to the strongest bone so the four always add to exactly 255
  const qs = e.map(([, w]) => Math.floor((w / sum) * 255));
  qs[0] += 255 - qs.reduce((s, x) => s + x, 0);
  e.forEach(([b], j) => {
    skinIdx[i * 4 + j] = b;
    skinW[i * 4 + j] = qs[j];
  });
}
// lower teeth ride the jaw
for (const f of faces.teethL) for (const [v] of f) {
  const k = keep.get(v);
  skinIdx.fill(0, k * 4, k * 4 + 4);
  skinW.fill(0, k * 4, k * 4 + 4);
  skinIdx[k * 4] = boneIndex.get('jaw');
  skinW[k * 4] = 255;
}
for (const f of faces.teethU) for (const [v] of f) {
  const k = keep.get(v);
  skinIdx.fill(0, k * 4, k * 4 + 4);
  skinW.fill(0, k * 4, k * 4 + 4);
  skinIdx[k * 4] = boneIndex.get('head');
  skinW[k * 4] = 255;
}

// ------------------------------------------------------------------ masks for skin colour (shared)
// Each mask is how far a region shape moves a vertex, so it falls off softly like real colouring does.
const MASKS = {
  lips: ['mouth-upperlip-volume-incr', 'mouth-lowerlip-volume-incr'],
  cheeks: ['l-cheek-volume-incr', 'r-cheek-volume-incr'],
  bags: ['l-eye-bag-incr', 'r-eye-bag-incr'],
  brows: ['eyebrows-trans-up'],
  ears: ['l-ear-scale-incr', 'r-ear-scale-incr'],
  nose: ['nose-point-width-incr', 'nose-flaring-incr'],
  lids: ['eye-left-closure', 'eye-right-closure'],
};
const maskNames = Object.keys(MASKS);
const masks = new Uint8Array(nOrig * maskNames.length);
maskNames.forEach((m, mi) => {
  const mag = new Float32Array(nOrig);
  for (const t of MASKS[m]) for (const [i, x, y, z] of target(t)) {
    const k = keep.get(i);
    if (k !== undefined) mag[k] = Math.max(mag[k], Math.hypot(x, y, z));
  }
  let max = 0;
  for (const v of mag) max = Math.max(max, v);
  for (let i = 0; i < nOrig; i++) masks[i * maskNames.length + mi] = Math.round(Math.min(1, mag[i] / max) * 255);
});

// ------------------------------------------------------------------ expressions (sparse, shared)
const EXPR = {
  blinkL: ['eye-left-closure'], blinkR: ['eye-right-closure'], wideL: ['eye-left-opened-up'], wideR: ['eye-right-opened-up'],
  mouthOpen: ['mouth-open'], smile: ['mouth-corner-puller'], frown: ['mouth-depression'], sad: ['eyebrows-left-inner-up', 'eyebrows-right-inner-up'],
  browDown: ['eyebrows-left-down', 'eyebrows-right-down'], pucker: ['mouth-pursing'],
};

// ------------------------------------------------------------------ build each body
const Q = 14000; // stored units per metre (16 bit, so up to 2.34 m)
const DM = 0.1; // MakeHuman works in decimetres
const sides = { x: 0 };
function build(c) {
  const P = keepList.map((v) => V[v].slice());
  const all = V.map((v) => v.slice()); // full set for joints and eye helpers
  const apply = (name, w) => {
    for (const [i, x, y, z] of target(name)) {
      all[i][0] += x * w;
      all[i][1] += y * w;
      all[i][2] += z * w;
    }
  };
  for (const [n, w] of macroWeights(c)) apply(n, w);
  for (const [n, w] of Object.entries(c.face ?? {})) apply(n, w);
  for (let k = 0; k < nOrig; k++) P[k] = all[keepList[k]];
  // stand on the floor
  let minY = Infinity;
  for (let i = 0; i < 13380; i++) minY = Math.min(minY, all[i][1]);
  const pos = new Int16Array(nOrig * 3);
  const maxY = Math.max(...P.map((p) => p[1] - minY)) * DM;
  if (maxY * Q > 32767) throw new Error(`body too tall to store: ${maxY} m`);
  for (let k = 0; k < nOrig; k++) {
    pos[k * 3] = Math.round(P[k][0] * DM * Q);
    pos[k * 3 + 1] = Math.round((P[k][1] - minY) * DM * Q);
    pos[k * 3 + 2] = Math.round(P[k][2] * DM * Q);
  }
  const jpos = (name) => {
    const ids = skel.joints[name];
    const s = [0, 0, 0];
    for (const i of ids) for (let a = 0; a < 3; a++) s[a] += all[i][a];
    return [(s[0] / ids.length) * DM, (s[1] / ids.length - minY) * DM, (s[2] / ids.length) * DM];
  };
  const joints = {};
  for (const b of BONES) {
    const ps = PIVOT[b].map((mb) => jpos(skel.bones[mb].head));
    joints[b] = ps.reduce((a, p) => a.map((x, i) => x + p[i] / ps.length), [0, 0, 0]).map((x) => +x.toFixed(5));
  }
  const eyes = ['helper-l-eye', 'helper-r-eye'].map((g, gi) => {
    const lo = gi === 0 ? 14598 : 14670;
    const pts = all.slice(lo, lo + 72);
    const c3 = pts.reduce((a, p) => a.map((x, i) => x + p[i] / pts.length), [0, 0, 0]);
    const r = pts.reduce((m, p) => Math.max(m, Math.hypot(p[0] - c3[0], p[1] - c3[1], p[2] - c3[2])), 0);
    return { c: [c3[0] * DM, (c3[1] - minY) * DM, c3[2] * DM].map((x) => +x.toFixed(5)), r: +(r * DM).toFixed(5) };
  });
  return { pos, joints, eyes, height: +((Math.max(...all.slice(0, 13380).map((p) => p[1])) - minY) * DM).toFixed(4) };
}

// ------------------------------------------------------------------ write
const chunks = [];
let offset = 0;
const put = (arr) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) {
    chunks.push(new Uint8Array(pad));
    offset += pad;
  }
  const at = offset;
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  chunks.push(bytes);
  offset += bytes.byteLength;
  return { at, n: arr.length };
};
const json = { license: 'Body mesh, rig, weights and shapes: MakeHuman 1.x system assets, CC0 1.0 (makehumancommunity.org). Baked by tools/mh-bake.mjs.', scale: Q, nOrig, nSplit, bones: BONES.map((b) => ({ name: b, parent: PARENT[b] })), masks: maskNames, layout: {}, cast: {}, expr: {} };
json.layout.splitOrig = put(Uint16Array.from(splitOrig));
json.layout.uv = put(Uint16Array.from(splitUV.flatMap(([u, v]) => [Math.round(Math.min(1, Math.max(0, u)) * 65535), Math.round(Math.min(1, Math.max(0, v)) * 65535)])));
json.layout.body = put(Uint16Array.from(tri.body));
json.layout.teeth = put(Uint16Array.from(tri.teeth));
json.layout.skinIdx = put(skinIdx);
json.layout.skinW = put(skinW);
json.layout.masks = put(masks);
for (const [name, list] of Object.entries(EXPR)) {
  const d = new Map();
  for (const t of list) for (const [i, x, y, z] of target(t)) {
    const k = keep.get(i);
    if (k === undefined) continue;
    const o = d.get(k) ?? [0, 0, 0];
    d.set(k, [o[0] + x, o[1] + y, o[2] + z]);
  }
  const idx = Uint16Array.from([...d.keys()]);
  const del = Int16Array.from([...d.values()].flatMap((v) => v.map((x) => Math.round(x * DM * Q))));
  json.expr[name] = { idx: put(idx), d: put(del) };
}
for (const [name, c] of Object.entries(CAST)) {
  const b = build(c);
  json.cast[name] = { pos: put(b.pos), joints: b.joints, eyes: b.eyes, height: b.height, female: c.gender < 0.5, age: c.age };
  process.stdout.write(name + ' ' + b.height + 'm  ');
}
const bin = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
fs.writeFileSync(path.join(OUT, 'humans.bin'), bin);
fs.writeFileSync(path.join(OUT, 'humans.json'), JSON.stringify(json));
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'The body mesh, skeleton, skin weights and shape targets used to build humans.bin come from the MakeHuman 1.x system assets\n(https://github.com/makehumancommunity/makehuman), released under CC0 1.0 Universal. Thanks to the MakeHuman team.\n');
console.log(`\nwrote ${(bin.length / 1024).toFixed(0)} KB, ${nSplit} vertices, ${tri.body.length / 3} body triangles, ${BONES.length} bones`);
void sides;
