import RAPIER from '@dimforge/rapier3d-compat';

export type Vec3 = { x: number; y: number; z: number };

export interface DynamicProp {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export interface PlayerRig {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
}

/** Thin wrapper so the rest of the game never touches Rapier types directly. */
export class Physics {
  readonly world: RAPIER.World;
  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
  }

  static async create(): Promise<Physics> {
    await RAPIER.init();
    return new Physics();
  }

  addStaticBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): RAPIER.Collider {
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz));
  }

  removeCollider(c: RAPIER.Collider): void {
    this.world.removeCollider(c, true);
  }

  addDynamicBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, mass = 1): DynamicProp {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.4).setAngularDamping(0.6));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setMass(mass).setRestitution(0.15).setFriction(0.8),
      body,
    );
    return { body, collider };
  }

  addDynamicCylinder(x: number, y: number, z: number, halfH: number, r: number, mass = 1): DynamicProp {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.4).setAngularDamping(0.6));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfH, r).setMass(mass).setRestitution(0.2).setFriction(0.7),
      body,
    );
    return { body, collider };
  }

  createPlayer(x: number, y: number, z: number): PlayerRig {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    // total height 1.7: capsule half-height 0.55 + radius 0.3 on each end
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), body);
    const controller = this.world.createCharacterController(0.01);
    controller.enableAutostep(0.25, 0.1, false);
    controller.enableSnapToGround(0.2);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setSlideEnabled(true);
    return { body, collider, controller };
  }

  /** Cast a ray, return hit distance or null. Used for line-of-sight checks. */
  ray(from: Vec3, dir: Vec3, maxToi: number, excludeCollider?: RAPIER.Collider): number | null {
    const r = new RAPIER.Ray(from, dir);
    const hit = this.world.castRay(r, maxToi, true, undefined, undefined, excludeCollider);
    return hit ? hit.timeOfImpact : null;
  }

  step(): void {
    this.world.step();
  }
}
