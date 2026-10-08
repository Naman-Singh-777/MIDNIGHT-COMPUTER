/**
 * The tall one. It walks the east corridor when the building is dark or when something got out of Ward B.
 * It is blind. It hears you. Rules the player can learn (from the Eyeless Dog and Alien Isolation notes):
 *  - Every noise raises its suspicion, scaled by how close you are. Running is loud, walking is quiet, crouching is silent.
 *  - Above 0.4 it stops and listens. Above 1 it hunts the place it last heard you, not where you are.
 *  - A torch in its face from close up counts as noise. It knows when it is being looked at.
 *  - A shut booth door stops it. It bangs, waits, gives up.
 *  - It kills on contact while hunting. Walking into it while it roams also kills, so give it the wall.
 * Pure logic. No DOM, no Three.js.
 */
export type StalkerMode = 'off' | 'roam' | 'listen' | 'hunt' | 'door' | 'leave';
export type StalkerEvent = 'growl' | 'shriek' | 'bang' | 'kill' | 'lost' | 'appear' | 'gone';

export interface StalkerInput {
  x: number;
  z: number;
  noise: number; // 0 silent .. 1 sprinting
  noiseRange: number; // metres
  torchOnIt: boolean;
  inBooth: boolean;
  doorClosed: boolean;
}

export const CORRIDOR_MIN_X = 2.3;
export const CORRIDOR_MAX_X = 13.8;
const MID_Z = 0.95;

export class Stalker {
  mode: StalkerMode = 'off';
  x = 13;
  z = MID_Z;
  sus = 0;
  heardX = 0;
  heardZ = MID_Z;
  private dir = -1;
  private life = 0; // seconds until it leaves on its own (Infinity for until-told)
  private timer = 0;
  private bangs = 0;
  /** Extra hunting speed. Every Understudy you let through makes it quicker. */
  rage = 0;

  get active(): boolean {
    return this.mode !== 'off';
  }

  /** Bring it out at x. It roams for `life` seconds and then walks off. */
  summon(x: number, life = Infinity): StalkerEvent[] {
    const fresh = this.mode === 'off';
    this.x = Math.min(CORRIDOR_MAX_X, Math.max(CORRIDOR_MIN_X, x));
    this.z = MID_Z;
    this.mode = this.mode === 'off' || this.mode === 'leave' ? 'roam' : this.mode;
    this.life = Math.max(fresh ? 0 : this.life, life);
    this.sus = fresh ? 0 : this.sus;
    return fresh ? ['appear'] : [];
  }

  dismiss(): void {
    if (this.mode !== 'off') this.mode = 'leave';
  }

  tick(dt: number, p: StalkerInput): StalkerEvent[] {
    if (this.mode === 'off') return [];
    const ev: StalkerEvent[] = [];
    if (this.life !== Infinity) {
      this.life -= dt;
      if (this.life <= 0 && this.mode !== 'hunt') this.mode = 'leave';
    }
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const dist = Math.hypot(dx, dz);

    // hearing
    if (this.mode !== 'leave' && this.mode !== 'door') {
      let heard = p.noise > 0.02 && dist < p.noiseRange ? p.noise * (1 - dist / p.noiseRange) * 1.7 : 0;
      if (p.torchOnIt && dist < 7) heard += 0.9;
      if (heard > 0) {
        this.sus += heard * dt;
        this.heardX = p.x;
        this.heardZ = p.z;
      } else this.sus = Math.max(0, this.sus - dt * (this.mode === 'hunt' ? 0.16 : 0.22));
    }

    const speed = (s: number): number => s * dt;
    switch (this.mode) {
      case 'roam': {
        this.x += speed(0.75) * this.dir;
        this.z += (MID_Z - this.z) * Math.min(1, dt);
        if (this.x < CORRIDOR_MIN_X + 0.2) this.dir = 1;
        if (this.x > CORRIDOR_MAX_X - 0.2) this.dir = -1;
        if (this.sus > 0.4) {
          this.mode = 'listen';
          this.timer = 0;
          ev.push('growl');
        }
        break;
      }
      case 'listen': {
        this.timer += dt;
        if (this.sus > 1) {
          this.mode = 'hunt';
          ev.push('shriek');
        } else if (this.sus < 0.15 && this.timer > 2) this.mode = 'roam';
        break;
      }
      case 'hunt': {
        const tx = this.heardX - this.x;
        const tz = this.heardZ - this.z;
        const td = Math.hypot(tx, tz);
        const v = 2.75 + this.rage * 0.3;
        if (td > 0.05) {
          const step = Math.min(td, speed(v));
          this.x += (tx / td) * step;
          this.z += (tz / td) * step;
        }
        // the booth door
        if (p.inBooth && this.x < 3.4 && p.doorClosed) {
          this.mode = 'door';
          this.timer = 0;
          this.bangs = 0;
          break;
        }
        this.x = Math.max(p.inBooth && !p.doorClosed ? -1.5 : CORRIDOR_MIN_X, Math.min(CORRIDOR_MAX_X, this.x));
        if (td < 0.3 && this.sus < 0.6) {
          this.mode = 'roam';
          ev.push('lost');
        }
        break;
      }
      case 'door': {
        this.timer += dt;
        if (this.timer > 1.1 * (this.bangs + 1) && this.bangs < 4) {
          this.bangs++;
          ev.push('bang');
        }
        if (!p.doorClosed && p.inBooth) {
          this.mode = 'hunt';
          this.heardX = p.x;
          this.heardZ = p.z;
        } else if (this.timer > 7) {
          this.sus = 0;
          this.mode = 'roam';
          this.dir = 1;
          ev.push('lost');
        }
        break;
      }
      case 'leave': {
        this.x += speed(1.1);
        if (this.x >= CORRIDOR_MAX_X + 0.5) {
          this.mode = 'off';
          ev.push('gone');
        }
        break;
      }
    }

    // contact
    const reach = this.mode === 'hunt' ? 0.75 : this.mode === 'roam' || this.mode === 'listen' ? 0.42 : 0;
    const nd = Math.hypot(p.x - this.x, p.z - this.z);
    const sameSide = p.inBooth === this.x < 1.9;
    if (reach > 0 && nd < reach && sameSide) ev.push('kill');
    return ev;
  }
}
