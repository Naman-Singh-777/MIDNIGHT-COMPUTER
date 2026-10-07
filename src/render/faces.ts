import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { Patient } from '../sim/types';

/**
 * Painted faces for the front patch of each head. A 512px canvas drawn in a 128-unit space.
 * People get pores, blood under the skin, wet eyes and tired lids.
 * The Understudy gets nearly all of that, then too much of the rest: a smile that keeps going,
 * pupils that shrink to pins, skin with no pores at all. 'reveal' is the face it has when it stops trying.
 */
export type FaceState = 'open' | 'blink' | 'talk' | 'stare' | 'reveal';

export interface FaceLook {
  female: boolean;
  age: number;
  skin: [number, number, number];
  hair: string;
  hairColor: string;
  eye: string;
  glasses: boolean;
  stubble: boolean;
}

const S = 4; // canvas pixels per face unit

function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number): void {
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, color.replace('A', String(alpha)));
  gr.addColorStop(1, color.replace('A', '0'));
  g.fillStyle = gr;
  g.fillRect(-rx, -rx, rx * 2, rx * 2);
  g.restore();
}

function curve(g: CanvasRenderingContext2D, pts: number[], color: string, w: number): void {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  g.stroke();
}

export function drawFace(look: FaceLook, p: Patient, stage: number, state: FaceState): THREE.CanvasTexture {
  const mimic = p.truth === 'understudy';
  const reveal = state === 'reveal';
  const c = document.createElement('canvas');
  c.width = c.height = 128 * S;
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const n = new Rng(Math.floor(p.hue * 1e6) + 17);
  const st = Math.min(stage, 7);
  const age = look.age;

  // ---------------------------------------------------------------- skin
  const grey = reveal ? 0.62 : mimic ? 0.1 + st * 0.03 : 0;
  const [sr, sg, sb] = look.skin;
  const mix = (v: number, to: number): number => Math.round(v * (1 - grey) + to * grey);
  const r = mix(sr, 176), gg = mix(sg, 180), b = mix(sb, 172);
  const base = g.createRadialGradient(64, 54, 4, 64, 66, 82);
  base.addColorStop(0, `rgb(${Math.min(255, r + 14)},${Math.min(255, gg + 10)},${Math.min(255, b + 8)})`);
  base.addColorStop(0.6, `rgb(${r},${gg},${b})`);
  base.addColorStop(1, `rgb(${r - 58},${gg - 66},${b - 62})`);
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);

  // blood under the skin: humans flush, the Understudy has none
  if (!mimic) {
    for (let i = 0; i < 26; i++) blob(g, n.range(14, 114), n.range(30, 120), n.range(6, 16), n.range(5, 12), 'rgba(170,70,60,A)', n.range(0.03, 0.07));
    blob(g, 34, 80, 15, 10, 'rgba(185,80,70,A)', 0.2);
    blob(g, 94, 80, 15, 10, 'rgba(185,80,70,A)', 0.2);
    blob(g, 64, 70, 6, 14, 'rgba(180,85,70,A)', 0.12); // nose tip warmth
  }
  // the bone under it: forehead and cheekbone light, temples and hollows dark
  blob(g, 64, 30, 30, 14, 'rgba(255,240,225,A)', mimic ? 0.24 : 0.14);
  blob(g, 36, 72, 12, 7, 'rgba(255,236,220,A)', 0.14);
  blob(g, 92, 72, 12, 7, 'rgba(255,236,220,A)', 0.14);
  blob(g, 8, 52, 16, 26, 'rgba(40,20,14,A)', 0.4);
  blob(g, 120, 52, 16, 26, 'rgba(40,20,14,A)', 0.4);
  const hollow = 0.16 + Math.max(0, age - 40) / 160 + (mimic ? st * 0.03 : 0);
  blob(g, 28, 94, 12, 14, 'rgba(50,24,18,A)', hollow);
  blob(g, 100, 94, 12, 14, 'rgba(50,24,18,A)', hollow);
  // eye sockets. The Understudy's sink a little more with every stage.
  const sock = reveal ? 0 : 0.34 + Math.max(0, age - 30) / 200 + (mimic ? st * 0.05 : 0);
  blob(g, 46, 59, 17, 12, 'rgba(60,28,30,A)', sock);
  blob(g, 82, 59, 17, 12, 'rgba(60,28,30,A)', sock);
  // nose bridge and shadow under the nose and lip
  g.fillStyle = 'rgba(255,238,222,0.14)';
  g.fillRect(62.4, 50, 3.2, 26);
  blob(g, 58, 70, 4, 12, 'rgba(70,32,24,A)', 0.2);
  blob(g, 70, 70, 4, 12, 'rgba(70,32,24,A)', 0.2);
  blob(g, 64, 88, 10, 3.5, 'rgba(50,22,18,A)', 0.34);
  blob(g, 64, 112, 12, 7, 'rgba(255,236,220,A)', 0.12); // chin
  const jaw = g.createLinearGradient(0, 108, 0, 128);
  jaw.addColorStop(0, 'rgba(30,14,10,0)');
  jaw.addColorStop(1, 'rgba(30,14,10,0.5)');
  g.fillStyle = jaw;
  g.fillRect(0, 108, 128, 20);

  // pores and freckles, humans only. The Understudy's skin is too clean.
  if (!mimic) {
    const img = g.getImageData(0, 0, 128 * S, 128 * S);
    const d = img.data;
    let seed = (Math.floor(p.hue * 1e6) | 0) + 99;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) | 0;
      const v = ((seed >>> 16) & 255) / 255 - 0.5;
      const k = v * 16;
      d[i] = Math.max(0, Math.min(255, d[i] + k));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k * 0.9));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k * 0.85));
    }
    g.putImageData(img, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.scale(S, S);
    for (let i = 0; i < 90 + age * 3; i++) {
      g.fillStyle = `rgba(${100 + n.int(0, 40)},55,40,${n.range(0.05, 0.16)})`;
      const s2 = n.range(0.3, 0.9);
      g.fillRect(n.range(8, 120), n.range(14, 122), s2, s2);
    }
    g.restore();
  } else if (!reveal) {
    blob(g, 70, 40, 22, 12, 'rgba(255,255,250,A)', 0.12 + st * 0.02); // a waxy sheen
  }

  // hairline
  const hl = g.createLinearGradient(0, 0, 0, 26);
  hl.addColorStop(0, look.hair === 'none' ? 'rgba(0,0,0,0)' : look.hairColor);
  hl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hl;
  g.fillRect(0, 0, 128, 26);

  // lines that age puts on a face
  const lineA = Math.min(0.42, Math.max(0, age - 22) / 90);
  if (lineA > 0 && !reveal) {
    const lc = `rgba(70,34,26,${lineA})`;
    curve(g, [48, 80, 40, 92, 45, 104], lc, 0.9); // nasolabial
    curve(g, [80, 80, 88, 92, 83, 104], lc, 0.9);
    curve(g, [36, 34, 64, 29, 92, 34], `rgba(70,34,26,${lineA * 0.6})`, 0.6); // forehead
    curve(g, [40, 38, 64, 34, 88, 38], `rgba(70,34,26,${lineA * 0.5})`, 0.6);
    curve(g, [30, 62, 27, 66, 29, 70], lc, 0.6); // crow's feet
    curve(g, [98, 62, 101, 66, 99, 70], lc, 0.6);
  }

  // ---------------------------------------------------------------- eyes
  const ey = 60;
  const spread = mimic ? st * 0.45 : 0;
  const lift = mimic && st >= 2 ? 1.2 : 0; // one eye sits higher. You notice it later.
  const eyeScale = mimic ? 1.03 + st * 0.02 : 1;
  const drawEye = (cx0: number, flip: number): void => {
    const cx = cx0 - flip * spread;
    const y = ey - (flip < 0 ? lift : 0);
    if (reveal) {
      g.fillStyle = '#050304';
      g.beginPath();
      g.ellipse(cx, y + 1, 13, 12, 0, 0, 7);
      g.fill();
      blob(g, cx, y + 1, 18, 17, 'rgba(10,4,6,A)', 0.8);
      g.fillStyle = '#f4f1e8';
      g.beginPath();
      g.arc(cx + flip * 1.5, y, 0.9, 0, 7);
      g.fill();
      // something black runs from it
      g.strokeStyle = 'rgba(12,6,8,0.85)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(cx - 3, y + 11);
      g.bezierCurveTo(cx - 4, y + 22, cx - 1, y + 30, cx - 3, y + 44);
      g.stroke();
      return;
    }
    if (state === 'blink') {
      blob(g, cx, y, 13, 6, 'rgba(90,50,44,A)', 0.4);
      curve(g, [cx - 12, y, cx, y + 4.5, cx + 12, y], '#2a1712', 1.4);
      curve(g, [cx - 11, y + 2, cx, y + 6, cx + 10, y + 2], 'rgba(40,20,14,0.6)', 0.5);
      return;
    }
    const ry = (state === 'stare' ? 8.6 : 6.3) * eyeScale;
    const rx = 11.5 * eyeScale;
    g.save();
    g.beginPath();
    g.moveTo(cx - rx, y + 0.5);
    g.quadraticCurveTo(cx - 2, y - ry * 1.55, cx + rx, y);
    g.quadraticCurveTo(cx + 2, y + ry * 1.25, cx - rx, y + 0.5);
    g.closePath();
    g.clip();
    // sclera: never pure white, darker at the corners
    const sc = g.createRadialGradient(cx, y, 1, cx, y, rx);
    sc.addColorStop(0, mimic ? '#ecebe6' : '#e9e1d2');
    sc.addColorStop(1, mimic ? '#b8b8b2' : '#a99183');
    g.fillStyle = sc;
    g.fillRect(cx - rx, y - ry * 1.6, rx * 2, ry * 3);
    blob(g, cx - flip * (rx - 1.5), y + 0.5, 3, 3, 'rgba(200,90,90,A)', 0.55); // the pink inner corner
    if (!mimic || st < 2) {
      g.strokeStyle = 'rgba(170,50,50,0.35)';
      g.lineWidth = 0.25;
      for (let i = 0; i < 3 + Math.floor(age / 15); i++) {
        const sx = cx + flip * n.range(5, 10);
        g.beginPath();
        g.moveTo(sx, y + n.range(-2, 2));
        g.quadraticCurveTo(sx - flip * 2, y + n.range(-3, 3), sx - flip * n.range(3, 5), y + n.range(-1, 1));
        g.stroke();
      }
    }
    // iris: dark rim, threads, pupil
    const ir = 5.4 * eyeScale;
    const ix = cx + (state === 'stare' ? 0 : flip * 0.4);
    const iris = g.createRadialGradient(ix, y, 0.5, ix, y, ir);
    iris.addColorStop(0, look.eye);
    iris.addColorStop(0.75, mimic ? look.eye + 'aa' : look.eye);
    iris.addColorStop(1, '#0d0a08');
    g.fillStyle = iris;
    g.beginPath();
    g.arc(ix, y, ir, 0, 7);
    g.fill();
    g.strokeStyle = 'rgba(255,240,210,0.12)';
    g.lineWidth = 0.25;
    for (let a = 0; a < 6.28; a += 0.35) {
      g.beginPath();
      g.moveTo(ix + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8);
      g.lineTo(ix + Math.cos(a + 0.1) * ir * 0.85, y + Math.sin(a + 0.1) * ir * 0.85);
      g.stroke();
    }
    const pupil = mimic ? (st >= 3 ? 0.7 : 1.6) : state === 'stare' ? 2.6 : 2.2;
    g.fillStyle = '#050403';
    g.beginPath();
    g.arc(ix, y, pupil, 0, 7);
    g.fill();
    // the lid's shadow on the top of the eye
    const lidSh = g.createLinearGradient(0, y - ry * 1.4, 0, y - ry * 0.2);
    lidSh.addColorStop(0, 'rgba(30,14,10,0.75)');
    lidSh.addColorStop(1, 'rgba(30,14,10,0)');
    g.fillStyle = lidSh;
    g.fillRect(cx - rx, y - ry * 1.6, rx * 2, ry * 1.5);
    g.restore();
    // wet: catchlights on people only
    if (!mimic) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(ix + 1.6, y - 2, 0.9, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.arc(ix - 1.8, y + 1.6, 0.5, 0, 7);
      g.fill();
    }
    // upper lid line, crease, lower lid
    curve(g, [cx - rx - 0.5, y + 0.6, cx - 2, y - ry * 1.58, cx + rx + 0.5, y], 'rgba(28,14,10,0.95)', 1.1);
    curve(g, [cx - rx + 1, y - 4, cx, y - ry - 6.5, cx + rx, y - 4.5], 'rgba(70,34,28,0.4)', 0.6);
    curve(g, [cx - rx + 1, y + 1.4, cx + 2, y + ry * 1.3, cx + rx - 0.5, y + 0.5], 'rgba(255,220,210,0.35)', 0.5);
    curve(g, [cx - rx + 2, y + 6.5, cx, y + 10.5 + age / 25, cx + rx - 1, y + 6], 'rgba(80,40,36,0.28)', 0.7);
    if (look.female) {
      g.strokeStyle = 'rgba(14,8,6,0.8)';
      g.lineWidth = 0.4;
      for (let i = -5; i <= 5; i++) {
        const lx = cx + i * 2;
        const ly = y - Math.cos((i / 6) * 1.3) * ry * 1.25;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx + i * 0.35, ly - 2.4);
        g.stroke();
      }
    }
  };
  drawEye(46, 1);
  drawEye(82, -1);

  // brows, hair by hair
  if (!reveal) {
    const bc = look.hair === 'none' || look.hair === 'habit' ? '#4a3a2e' : look.hairColor;
    const by = state === 'stare' ? 40 : 43.5;
    g.strokeStyle = bc;
    g.lineWidth = look.female ? 0.35 : 0.55;
    for (const [x0, x1, dir] of [
      [31, 58, 1],
      [70, 97, -1],
    ] as const) {
      for (let i = 0; i < (look.female ? 46 : 70); i++) {
        const t = n.next();
        const x = x0 + (x1 - x0) * t;
        const arch = Math.sin(t * Math.PI) * -4 + (dir > 0 ? (1 - t) * 2 : t * 2);
        const y = by + arch + n.range(-1, 1) * (look.female ? 0.6 : 1.2);
        g.beginPath();
        g.moveTo(x, y + 1);
        g.lineTo(x + dir * n.range(1.5, 2.6), y - n.range(0.3, 1.2));
        g.stroke();
      }
    }
  }

  // nostrils
  g.fillStyle = reveal ? 'rgba(20,8,8,0.8)' : 'rgba(40,16,12,0.6)';
  g.beginPath();
  g.ellipse(59, 83.5, 2.6, 1.5, -0.3, 0, 7);
  g.ellipse(69, 83.5, 2.6, 1.5, 0.3, 0, 7);
  g.fill();

  if (look.glasses && !reveal) {
    g.strokeStyle = '#17130f';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(46, ey, 14.5, 11.5, 0, 0, 7);
    g.moveTo(96.5, ey);
    g.ellipse(82, ey, 14.5, 11.5, 0, 0, 7);
    g.moveTo(60, ey - 3);
    g.quadraticCurveTo(64, ey - 6, 68, ey - 3);
    g.stroke();
    blob(g, 42, ey - 4, 6, 3, 'rgba(230,240,255,A)', 0.18);
    blob(g, 78, ey - 4, 6, 3, 'rgba(230,240,255,A)', 0.18);
  }
  if (look.stubble && !look.female && !reveal) {
    for (let i = 0; i < 900; i++) {
      const x = n.range(26, 102);
      const y = n.range(84, 124);
      if (Math.abs(x - 64) < 14 && y < 92) continue;
      g.fillStyle = `rgba(28,22,18,${n.range(0.15, 0.4)})`;
      g.fillRect(x, y, 0.4, 0.7);
    }
  }

  // ---------------------------------------------------------------- mouth
  const lip = look.female ? [150, 60, 64] : [150, 92, 84];
  const lipCol = (a: number): string => `rgba(${lip[0] - (mimic ? 30 : 0)},${lip[1]},${lip[2]},${a})`;
  const my = 99;
  // the Understudy's smile keeps going past where a mouth stops
  const half = mimic ? 15 + st * 2.6 : 14;
  if (reveal) {
    g.fillStyle = '#070304';
    g.beginPath();
    g.ellipse(64, 106, 17, 23, 0, 0, 7);
    g.fill();
    blob(g, 64, 106, 24, 30, 'rgba(25,6,8,A)', 0.7);
    g.fillStyle = '#d9d1bc';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const tx = 64 + Math.cos(a) * 15.5;
      const ty = 106 + Math.sin(a) * 21;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(64 + Math.cos(a) * 11.5, 106 + Math.sin(a) * 16);
      g.lineTo(64 + Math.cos(a + 0.12) * 15.5, 106 + Math.sin(a + 0.12) * 21);
      g.fill();
    }
    // the corners split up toward the ears
    g.strokeStyle = 'rgba(40,10,12,0.9)';
    g.lineWidth = 1.2;
    curve(g, [48, 100, 34, 92, 18, 76], 'rgba(40,10,12,0.9)', 1.2);
    curve(g, [80, 100, 94, 92, 110, 76], 'rgba(40,10,12,0.9)', 1.2);
  } else if (state === 'talk') {
    g.fillStyle = '#2a0b0c';
    g.beginPath();
    g.ellipse(64, my + 1.5, half * 0.52, 6, 0, 0, 7);
    g.fill();
    g.fillStyle = '#d6cdb8';
    g.fillRect(64 - half * 0.42, my - 3.8, half * 0.84, 2.6);
    g.strokeStyle = lipCol(0.95);
    g.lineWidth = 2.6;
    g.beginPath();
    g.ellipse(64, my + 1.5, half * 0.54, 6.4, 0, 0, 7);
    g.stroke();
  } else {
    const curl = mimic ? 6 + st * 1.3 : state === 'stare' ? 0 : 2.5;
    // upper lip, lower lip, the line between
    g.fillStyle = lipCol(0.85);
    g.beginPath();
    g.moveTo(64 - half, my - curl * 0.3);
    g.quadraticCurveTo(58, my - 4.5, 64, my - 3);
    g.quadraticCurveTo(70, my - 4.5, 64 + half, my - curl * 0.3);
    g.quadraticCurveTo(64, my + curl * 0.6, 64 - half, my - curl * 0.3);
    g.fill();
    g.fillStyle = lipCol(0.7);
    g.beginPath();
    g.moveTo(64 - half * 0.8, my);
    g.quadraticCurveTo(64, my + curl * 0.6 + 6, 64 + half * 0.8, my);
    g.quadraticCurveTo(64, my + curl * 0.6, 64 - half * 0.8, my);
    g.fill();
    blob(g, 64, my + curl * 0.3 + 3.2, 5, 1.5, 'rgba(255,230,220,A)', 0.3);
    if (mimic && st >= 3) {
      g.fillStyle = '#dcd5c2';
      g.beginPath();
      g.moveTo(64 - half + 3, my - curl * 0.25);
      g.quadraticCurveTo(64, my + curl * 0.6 + 2, 64 + half - 3, my - curl * 0.25);
      g.quadraticCurveTo(64, my + curl * 0.3 - 3, 64 - half + 3, my - curl * 0.25);
      g.fill();
      g.strokeStyle = 'rgba(70,46,36,0.6)';
      g.lineWidth = 0.35;
      for (let i = -9; i <= 9; i++) {
        g.beginPath();
        g.moveTo(64 + i * (half / 10), my - 2);
        g.lineTo(64 + i * (half / 10), my + 3);
        g.stroke();
      }
    }
    curve(g, [64 - half, my - curl * 0.3, 64, my + curl * 0.6, 64 + half, my - curl * 0.3], 'rgba(40,14,12,0.85)', 0.8);
    if (mimic && st >= 2) {
      // skin pulled tight at the corners, like the face is being held up from behind
      for (const sd of [-1, 1]) {
        for (let k = 0; k < 3; k++) curve(g, [64 + sd * (half - 1), my - curl * 0.3 + k, 64 + sd * (half + 5), my - 4 - k * 2, 64 + sd * (half + 9), my - 9 - k * 3], 'rgba(60,30,26,0.35)', 0.4);
      }
    }
  }

  // ---------------------------------------------------------------- the mark the photograph should match
  const m = p.faceMark;
  if (!reveal) {
    if (m.includes('left brow')) {
      g.fillStyle = 'rgba(205,165,150,0.95)';
      g.save();
      g.translate(42, 40);
      g.rotate(0.5);
      g.fillRect(-1, -7, 2, 14);
      g.restore();
    } else if (m.includes('right cheek')) {
      g.fillStyle = 'rgba(60,30,24,0.9)';
      g.beginPath();
      g.arc(93, 78, 1.7, 0, 7);
      g.fill();
    } else if (m.includes('left eye')) {
      g.fillStyle = 'rgba(110,55,35,0.85)';
      g.beginPath();
      g.arc(40, 73, 1.1, 0, 7);
      g.fill();
    } else if (m.includes('chin')) {
      blob(g, 64, 116, 9, 6, 'rgba(160,60,55,A)', 0.75);
    } else if (m.includes('nose')) {
      curve(g, [62, 56, 67, 68, 61, 80], 'rgba(80,38,32,0.6)', 1.2);
    } else if (m.includes('tooth') || m.includes('teeth')) {
      g.fillStyle = '#d8cfb9';
      g.fillRect(59, my - 3, 9, 4.5);
      g.fillStyle = 'rgba(40,14,12,0.95)';
      if (m.includes('chipped')) g.fillRect(60, my - 3, 3, 2.4);
      else g.fillRect(63.2, my - 3, 1.4, 4.5);
    }
  }
  if (reveal) {
    // veins under the grey, at the temples and down the neck
    g.strokeStyle = 'rgba(40,40,60,0.45)';
    g.lineWidth = 0.5;
    for (let i = 0; i < 14; i++) {
      const x = i < 7 ? n.range(4, 22) : n.range(106, 124);
      let y = n.range(30, 60);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        y += n.range(4, 9);
        g.lineTo(x + n.range(-4, 4), y);
      }
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Push a sphere around so it has a skull underneath: sockets, brow, cheekbones, a jaw that narrows. */
export function sculptHead(geo: THREE.BufferGeometry, female: boolean): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const d = new THREE.Vector3();
  const bumps: [number, number, number, number, number][] = [
    // x, y, z (unit direction), amount, width
    [-0.274, 0.13, 0.952, -0.075, 0.15],
    [0.274, 0.13, 0.952, -0.075, 0.15],
    [-0.26, 0.36, 0.9, female ? 0.02 : 0.04, 0.13],
    [0.26, 0.36, 0.9, female ? 0.02 : 0.04, 0.13],
    [-0.45, -0.08, 0.89, 0.035, 0.15],
    [0.45, -0.08, 0.89, 0.035, 0.15],
    [-0.42, -0.32, 0.85, -0.03, 0.14],
    [0.42, -0.32, 0.85, -0.03, 0.14],
    [0, -0.42, 0.9, 0.025, 0.16],
    [0, -0.68, 0.73, female ? 0.02 : 0.04, 0.13],
    [-0.75, 0.25, 0.6, -0.03, 0.2],
    [0.75, 0.25, 0.6, -0.03, 0.2],
  ];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    if (len === 0) continue;
    d.copy(v).divideScalar(len);
    let k = 1;
    for (const [x, y, z, amt, w] of bumps) {
      const dx = d.x - x, dy = d.y - y, dz = d.z - z;
      k += amt * Math.exp(-(dx * dx + dy * dy + dz * dz) / (w * w));
    }
    v.copy(d).multiplyScalar(len * k);
    if (d.y < -0.2) v.x *= 1 - (female ? 0.22 : 0.15) * Math.min(1, (-d.y - 0.2) / 0.6);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

let fabric: THREE.CanvasTexture | null = null;
/** Shared wool texture: weave, pilling, rain darkening, long folds. Tinted by the material colour. */
export function fabricTexture(): THREE.CanvasTexture {
  if (fabric) return fabric;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, 256, 256);
  const n = new Rng(4242);
  for (let y = 0; y < 256; y += 2) {
    for (let x = 0; x < 256; x += 2) {
      const v = 175 + ((x + y) % 4 === 0 ? 22 : -10) + n.int(-18, 18);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 2, 2);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = n.range(0, 256);
    const gr = g.createLinearGradient(x - 10, 0, x + 10, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.5, `rgba(0,0,0,${n.range(0.15, 0.35)})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - 10, 0, 20, 256);
  }
  for (let i = 0; i < 30; i++) {
    const x = n.range(0, 256), y = n.range(0, 256), r = n.range(10, 40);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(20,24,30,0.22)');
    gr.addColorStop(1, 'rgba(20,24,30,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  fabric = new THREE.CanvasTexture(c);
  fabric.colorSpace = THREE.SRGBColorSpace;
  fabric.wrapS = fabric.wrapT = THREE.RepeatWrapping;
  fabric.repeat.set(3, 3);
  return fabric;
}
