/** Fixed-step accumulator. Sim runs at a steady rate regardless of render FPS. */
export class FixedClock {
  private acc = 0;
  constructor(
    readonly step: number,
    private readonly maxSteps = 5,
  ) {}
  /** Returns how many fixed steps to run for this frame delta (seconds). */
  advance(dt: number): number {
    this.acc += Math.min(dt, 0.25);
    let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) {
      this.acc -= this.step;
      n++;
    }
    if (n === this.maxSteps) this.acc = 0;
    return n;
  }
  get alpha(): number {
    return this.acc / this.step;
  }
}
