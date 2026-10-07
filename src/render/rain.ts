import * as THREE from 'three';

/** A cheap rain volume: one LineSegments object, positions moved on the CPU. */
export class Rain {
  readonly lines: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly speed: Float32Array;
  constructor(private readonly box: THREE.Box3, count: number) {
    this.pos = new Float32Array(count * 6);
    this.speed = new Float32Array(count);
    const size = new THREE.Vector3();
    box.getSize(size);
    for (let i = 0; i < count; i++) {
      const x = box.min.x + Math.random() * size.x;
      const y = box.min.y + Math.random() * size.y;
      const z = box.min.z + Math.random() * size.z;
      this.pos.set([x, y, z, x - 0.01, y - 0.28, z], i * 6);
      this.speed[i] = 7 + Math.random() * 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.35, fog: false }));
    this.lines.frustumCulled = false;
  }
  update(dt: number): void {
    const n = this.speed.length;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      const dy = this.speed[i] * dt;
      this.pos[o + 1] -= dy;
      this.pos[o + 4] -= dy;
      if (this.pos[o + 4] < this.box.min.y) {
        const top = this.box.max.y;
        this.pos[o + 1] = top;
        this.pos[o + 4] = top - 0.28;
      }
    }
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
