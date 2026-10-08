import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { Patient } from '../sim/types';
import type { Outfit } from './humanoid';

export type HairKind = 'none' | 'short' | 'slick' | 'bun' | 'long' | 'curls' | 'scarf' | 'habit' | 'bald';
export type HatKind = 'none' | 'trilby' | 'flat' | 'cloche' | 'nurse';
export type PropKind = 'none' | 'umbrella' | 'goose' | 'redcap' | 'folder' | 'slippers' | 'handbag' | 'bible' | 'cigarette' | 'lamp';
export type PoseKind = 'rest' | 'hold' | 'hug' | 'folded' | 'bag';
export type Facial = 'none' | 'moustache' | 'beard' | 'stubble';

export interface Look {
  female: boolean;
  age: number;
  height: number;
  build: number;
  hunch: number;
  skin: [number, number, number];
  hair: HairKind;
  hairColor: string;
  hat: HatKind;
  outfit: Outfit;
  top: string;
  bottom: string;
  shoes: string;
  accent: string;
  eye: string;
  glasses: boolean;
  facial: Facial;
  lipstick: boolean;
  prop: PropKind;
  pose: PoseKind;
  barefoot: boolean;
  grime: number; // coal dust, rain
}

export const SKIN: [number, number, number][] = [
  [236, 204, 180],
  [224, 186, 158],
  [206, 166, 132],
  [168, 124, 94],
  [124, 90, 66],
];
const HAIR = ['#14100d', '#2b1d14', '#4a3222', '#6b6560', '#b8b4aa', '#7a3b1c', '#b39a63'];
const EYES = ['#4b3623', '#2f4a6a', '#56694a', '#6b5a3b', '#1f1a16'];

const base: Look = {
  female: false, age: 45, height: 1.74, build: 1, hunch: 0, skin: SKIN[0], hair: 'short', hairColor: '#2b1d14', hat: 'none',
  outfit: 'overcoat', top: '#3a352c', bottom: '#2a2824', shoes: '#1a1612', accent: '#e4e0d4', eye: EYES[0], glasses: false,
  facial: 'none', lipstick: false, prop: 'none', pose: 'rest', barefoot: false, grime: 0,
};

/** Every named visitor, drawn from the cast notes. Silhouettes differ on purpose: height, weight, posture, outline of the coat. */
export const CAST_LOOKS: Record<string, Partial<Look>> = {
  walter: { age: 71, height: 1.7, build: 0.92, hunch: 0.35, hair: 'short', hairColor: '#c8c4ba', outfit: 'overcoat', top: '#3d3a2c', glasses: true, facial: 'moustache', prop: 'slippers', pose: 'hold', eye: EYES[1] },
  bernard: { age: 48, height: 1.66, build: 1.28, hair: 'bald', hairColor: '#4a3222', hat: 'flat', outfit: 'raincoat', top: '#5f6644', bottom: '#33302a', glasses: true, facial: 'stubble', prop: 'goose', pose: 'hug', skin: SKIN[1] },
  dolly: { female: true, age: 54, height: 1.67, build: 1.02, hair: 'curls', hairColor: '#7a2e1a', outfit: 'fur', top: '#3a1e1e', bottom: '#5b1a28', accent: '#6a5848', lipstick: true, prop: 'cigarette', pose: 'folded', shoes: '#4a1015', eye: EYES[2] },
  tobias: { age: 24, height: 1.83, build: 0.8, hunch: 0.2, hair: 'long', hairColor: '#4a3222', outfit: 'cardigan', top: '#8c7a52', bottom: '#3c3a34', pose: 'folded', eye: EYES[3] },
  ivor: { age: 52, height: 1.69, build: 1.15, hair: 'short', hairColor: '#2b2420', hat: 'flat', outfit: 'work', top: '#24262a', bottom: '#2e2c28', facial: 'moustache', prop: 'lamp', pose: 'hold', grime: 0.5, skin: SKIN[1] },
  mae: { female: true, age: 41, height: 1.62, build: 0.86, hunch: 0.25, hair: 'scarf', hairColor: '#4c4a47', outfit: 'overcoat', top: '#1f2a3d', bottom: '#2a2a30', prop: 'redcap', pose: 'hold', eye: EYES[1] },
  penhale: { age: 58, height: 1.86, build: 0.95, hair: 'slick', hairColor: '#8a8680', outfit: 'cassock', top: '#0f0f12', bottom: '#0f0f12', accent: '#f2f0ea', glasses: true, prop: 'bible', pose: 'folded' },
  rosa: { female: true, age: 34, height: 1.63, build: 0.95, hair: 'bun', hairColor: '#1b1410', hat: 'nurse', outfit: 'uniform', top: '#26365a', bottom: '#26365a', accent: '#eceae2', prop: 'handbag', pose: 'bag', skin: SKIN[2], eye: EYES[4] },
  marsh: { age: 50, height: 1.83, build: 1.0, hair: 'slick', hairColor: '#1b1613', outfit: 'suit', top: '#25272c', bottom: '#25272c', accent: '#ecebe4', prop: 'folder', pose: 'hold', eye: EYES[1] },
  gus: { age: 36, height: 1.79, build: 1.3, hair: 'short', hairColor: '#1a1410', outfit: 'work', top: '#4a2e1c', bottom: '#2c2a26', facial: 'stubble', pose: 'rest', skin: SKIN[2] },
  edie: { female: true, age: 60, height: 1.65, build: 0.95, hair: 'bun', hairColor: '#8a8478', hat: 'cloche', outfit: 'overcoat', top: '#8a6a44', bottom: '#4a3a2a', accent: '#e8e2d2', lipstick: true, prop: 'handbag', pose: 'bag', eye: EYES[2] },
};

export function lookFor(p: Patient): Look {
  const rng = new Rng((Math.floor(p.hue * 1e6) ^ (p.sprite * 7919) ^ Math.floor(p.height * 1e4)) >>> 0);
  if (p.registryId === 'R209') {
    return { ...base, female: true, age: 64, height: 1.6, build: 0.84, hunch: 0.2, hair: 'bun', hairColor: '#b8b4aa', outfit: 'nightgown', top: '#6b5c4a', bottom: '#d8d2c2', accent: '#d8d2c2', eye: EYES[1], prop: 'none', pose: 'folded', barefoot: true };
  }
  if (p.archetype === 'voice_mimic') {
    return { ...base, female: true, age: 52, height: 1.68, build: 0.95, hair: 'habit', outfit: 'habit', top: '#14161f', bottom: '#14161f', accent: '#ecebe4', pose: 'folded', eye: EYES[1] };
  }
  if (p.castId && CAST_LOOKS[p.castId]) return { ...base, ...CAST_LOOKS[p.castId] };
  // anyone else: built from the seed
  const female = rng.chance(0.45);
  const t = rng.next();
  return {
    ...base,
    female,
    age: rng.int(24, 70),
    height: female ? rng.range(1.58, 1.7) : rng.range(1.68, 1.86),
    build: rng.range(0.85, 1.2),
    skin: SKIN[t < 0.55 ? 0 : t < 0.8 ? 1 : t < 0.9 ? 2 : t < 0.96 ? 3 : 4],
    hair: female ? rng.pick(['bun', 'curls', 'long'] as HairKind[]) : rng.pick(['short', 'slick', 'bald'] as HairKind[]),
    hairColor: rng.pick(HAIR),
    hat: rng.chance(0.4) ? (female ? 'cloche' : rng.pick(['trilby', 'flat'] as HatKind[])) : 'none',
    outfit: rng.pick(['overcoat', 'raincoat', 'suit', 'cardigan'] as Outfit[]),
    top: new THREE.Color().setHSL(rng.range(0.02, 0.62), rng.range(0.1, 0.3), rng.range(0.14, 0.3)).getStyle(),
    eye: rng.pick(EYES),
    glasses: rng.chance(0.3),
    facial: female ? 'none' : rng.pick(['none', 'moustache', 'stubble'] as Facial[]),
    prop: rng.pick(['none', 'umbrella', 'handbag', 'folder'] as PropKind[]),
  };
}
