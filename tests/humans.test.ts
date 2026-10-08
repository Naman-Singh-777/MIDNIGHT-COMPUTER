import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAST_LOOKS } from '../src/render/looks';

// The baked bodies (public/characters/humans.bin, made by tools/mh-bake.mjs) are data the game trusts at load.
// These checks catch a bad bake before it reaches a player.
const json = JSON.parse(readFileSync('public/characters/humans.json', 'utf8'));
const bin = readFileSync('public/characters/humans.bin');
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);

describe('baked human bodies', () => {
  it('has a body for every named visitor, the mother and the sister', () => {
    for (const id of [...Object.keys(CAST_LOOKS), 'ada', 'sister']) expect(json.cast[id], id).toBeTruthy();
  });

  it('skin weights add up to one on every vertex', () => {
    const w = new Uint8Array(buf, json.layout.skinW.at, json.layout.skinW.n);
    const idx = new Uint8Array(buf, json.layout.skinIdx.at, json.layout.skinIdx.n);
    for (let i = 0; i < json.nOrig; i++) {
      expect(w[i * 4] + w[i * 4 + 1] + w[i * 4 + 2] + w[i * 4 + 3]).toBe(255);
      for (let j = 0; j < 4; j++) expect(idx[i * 4 + j]).toBeLessThan(json.bones.length);
    }
  });

  it('every body stands on the floor and fits in 16 bits without wrapping', () => {
    for (const [id, c] of Object.entries(json.cast) as [string, { pos: { at: number; n: number }; height: number }][]) {
      const p = new Int16Array(buf, c.pos.at, c.pos.n);
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < 13380 * 3; i += 3) {
        minY = Math.min(minY, p[i]);
        maxY = Math.max(maxY, p[i]);
      }
      expect(minY, id).toBeGreaterThanOrEqual(0);
      expect(maxY / json.scale, id).toBeCloseTo(c.height, 2);
      expect(c.height, id).toBeGreaterThan(1.3);
      expect(c.height, id).toBeLessThan(2.3);
    }
  });

  it('triangles only point at vertices that exist', () => {
    const t = new Uint16Array(buf, json.layout.body.at, json.layout.body.n);
    let max = 0;
    for (const v of t) max = Math.max(max, v);
    expect(max).toBeLessThan(json.nSplit);
    expect(t.length % 3).toBe(0);
  });

  it('has the tall one and a bone for every finger', () => {
    expect(json.cast.creature).toBeTruthy();
    const names = json.bones.map((b: { name: string }) => b.name);
    for (const s of ['.L', '.R']) for (let f = 2; f <= 5; f++) for (const p of ['a', 'b']) expect(names).toContain(`f${f}${p}${s}`);
  });

  it('carries the expression shapes the face uses', () => {
    for (const e of ['blinkL', 'blinkR', 'wideL', 'wideR', 'mouthOpen', 'smile', 'frown', 'sad']) expect(json.expr[e], e).toBeTruthy();
  });
});
