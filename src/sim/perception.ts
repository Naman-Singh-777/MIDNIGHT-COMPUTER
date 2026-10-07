/**
 * Perception layer. Everything here is presentation: it reads the truth and
 * returns how the world should *look and sound* to a frightened officer.
 * Nothing in this file may change simulation truth.
 */
export interface Distortion {
  vignette: number; // 0..1
  grain: number; // 0..1
  aberration: number; // 0..1
  wobble: number; // 0..1 slow screen sway
  hallucinationRate: number; // events per minute
  whisperGain: number; // 0..1
}

export function distortionFor(sanity: number, fear: number): Distortion {
  const loss = 1 - Math.max(0, Math.min(100, sanity)) / 100; // 0 calm .. 1 broken
  const f = Math.max(0, Math.min(1, fear));
  return {
    vignette: 0.25 + loss * 0.45 + f * 0.2,
    grain: 0.18 + loss * 0.3 + f * 0.1,
    aberration: loss * 0.5 + f * 0.35,
    wobble: Math.max(0, loss - 0.35) * 0.8,
    hallucinationRate: sanity > 70 ? 0 : (70 - sanity) / 70 * 3.2,
    whisperGain: Math.max(0, loss - 0.2) * 0.9,
  };
}
