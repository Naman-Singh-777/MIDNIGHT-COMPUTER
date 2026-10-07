import * as THREE from 'three';
import type { Physics, PlayerRig } from '../physics/world';

export type PlayerMode = 'desk' | 'floor';

export interface InputState {
  keys: Set<string>;
  mouseDX: number;
  mouseDY: number;
  mouseNX: number; // normalized cursor 0..1
  mouseNY: number;
}

const EYE_STAND = 1.62;
const EYE_SEAT = 1.28;
const DESK_POS = new THREE.Vector3(0, 0, 0.5);

export class PlayerController {
  readonly camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 60);
  readonly rig: PlayerRig;
  mode: PlayerMode = 'desk';
  yaw = 0;
  pitch = 0;
  stamina = 1;
  private vy = 0;
  private bob = 0;
  private eyeY = EYE_SEAT;
  private grounded = true;
  /** distance walked this frame, consumed by audio for footsteps */
  stepDelta = 0;
  sprinting = false;
  private smoothYaw = 0;
  private smoothPitch = 0;

  constructor(physics: Physics) {
    this.rig = physics.createPlayer(DESK_POS.x, 0.86, DESK_POS.z);
    this.camera.position.set(DESK_POS.x, EYE_SEAT, DESK_POS.z);
  }

  get feet(): THREE.Vector3 {
    const t = this.rig.body.translation();
    return new THREE.Vector3(t.x, t.y - 0.85, t.z);
  }

  sit(): void {
    this.mode = 'desk';
    this.rig.body.setTranslation({ x: DESK_POS.x, y: 0.86, z: DESK_POS.z }, true);
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
  }

  stand(): void {
    this.mode = 'floor';
    this.rig.body.setTranslation({ x: 0.2, y: 0.86, z: 1.15 }, true);
    this.yaw = 0;
    this.pitch = 0;
  }

  forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  update(dt: number, input: InputState, locked: boolean): void {
    if (this.mode === 'desk') this.updateDesk(dt, input);
    else this.updateFloor(dt, input, locked);
    input.mouseDX = 0;
    input.mouseDY = 0;
  }

  private updateDesk(dt: number, input: InputState): void {
    // seated: look follows the cursor with a gentle limit, like leaning over the desk
    const ty = -(input.mouseNX - 0.5) * 1.5;
    const tp = -(input.mouseNY - 0.5) * 0.9 - 0.12;
    this.smoothYaw += (ty - this.smoothYaw) * Math.min(1, dt * 6);
    this.smoothPitch += (tp - this.smoothPitch) * Math.min(1, dt * 6);
    this.yaw = this.smoothYaw;
    this.pitch = this.smoothPitch;
    this.stamina = Math.min(1, this.stamina + dt * 0.4);
    this.eyeY += (EYE_SEAT - this.eyeY) * Math.min(1, dt * 5);
    const breath = Math.sin(performance.now() * 0.0011) * 0.004;
    this.camera.position.set(DESK_POS.x, this.eyeY + breath, DESK_POS.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.stepDelta = 0;
    this.sprinting = false;
  }

  private updateFloor(dt: number, input: InputState, locked: boolean): void {
    if (locked) {
      this.yaw -= input.mouseDX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * 0.0022, -1.45, 1.45);
    }
    const k = input.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const moving = f !== 0 || s !== 0;
    const wantSprint = k.has('ShiftLeft') || k.has('ShiftRight');
    this.sprinting = wantSprint && moving && this.stamina > 0.05;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - dt * 0.22);
    else this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.1 : 0.3));
    const speed = this.sprinting ? 4.6 : 2.5;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward vector at yaw (camera looks down -z)
    let dx = (-sin * f + cos * s);
    let dz = (-cos * f - sin * s);
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;
    }
    this.vy = this.grounded ? -0.5 * dt : this.vy - 9.81 * dt;
    const desired = { x: dx, y: this.vy * dt + (this.grounded ? -0.02 : 0), z: dz };
    this.rig.controller.computeColliderMovement(this.rig.collider, desired);
    const m = this.rig.controller.computedMovement();
    this.grounded = this.rig.controller.computedGrounded();
    if (this.grounded) this.vy = 0;
    const t = this.rig.body.translation();
    this.rig.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    this.stepDelta = moving ? Math.hypot(m.x, m.z) : 0;

    if (moving) this.bob += dt * (this.sprinting ? 11 : 7.5);
    const bobY = moving ? Math.sin(this.bob) * (this.sprinting ? 0.045 : 0.025) : 0;
    this.eyeY += (EYE_STAND - this.eyeY) * Math.min(1, dt * 5);
    this.camera.position.set(t.x, t.y - 0.85 + this.eyeY + bobY, t.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  setAspect(a: number): void {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }
}
