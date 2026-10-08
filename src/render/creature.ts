import * as THREE from 'three';
import type { Patient } from '../sim/types';
import { drawFace, sculptHead } from './faces';
import { buildBody, rawSkinTexture, type Rig } from './humanoid';

/**
 * The tall one in the corridor. Two and a half metres, too thin, arms past its knees, no skin, and the
 * face the fakes wear underneath. It walks slowly with its head cocked, listening. When it hunts it drops
 * forward and its arms come up. Built once and shown or hidden; it holds no lights.
 */
export class CreatureView {
  readonly group = new THREE.Group();
  private rig: Rig;
  private head = new THREE.Group();
  private t = 0;
  private ph = 0;
  private lastX = 0;
  readonly faceImage: HTMLCanvasElement;

  constructor() {
    const skin = rawSkinTexture();
    const mats: THREE.Material[] = [];
    this.rig = buildBody(
      {
        height: 2.45,
        build: 0.62,
        female: false,
        hunch: 0.5,
        skin: new THREE.Color(0xb88878),
        outfit: 'creature',
        top: new THREE.Color(0),
        bottom: new THREE.Color(0),
        shoes: new THREE.Color(0),
        accent: new THREE.Color(0x3a2a24),
        barefoot: true,
        armLength: 1.45,
        skinMap: skin,
      },
      {
        mat: (c, m) => {
          const mm = new THREE.MeshLambertMaterial({ color: c, map: m ?? null });
          mats.push(mm);
          return mm;
        },
        mesh: (geo, mat, parent, x = 0, y = 0, z = 0) => {
          const m = new THREE.Mesh(geo, mat);
          m.position.set(x, y, z);
          parent.add(m);
          return m;
        },
      },
    );
    this.group.add(this.rig.root);
    // its head: long, the grin painted over sculpted bone
    const fake = { truth: 'understudy', hue: 0.77, faceMark: '' } as Patient;
    const tex = drawFace({ female: false, age: 70, skin: [190, 170, 160], hair: 'none', hairColor: '#000', eye: '#000', glasses: false, stubble: false }, fake, 7, 'reveal');
    this.faceImage = tex.image as HTMLCanvasElement;
    const skull = new THREE.SphereGeometry(0.14, 32, 24);
    sculptHead(skull, false);
    const bone = new THREE.Mesh(skull, new THREE.MeshLambertMaterial({ color: 0x9a7a6c, map: skin }));
    bone.scale.set(0.82, 1.5, 0.95);
    const patchGeo = new THREE.SphereGeometry(0.1425, 32, 24, 0.57, 2.0, 0.55, 1.9);
    sculptHead(patchGeo, false);
    const patch = new THREE.Mesh(patchGeo, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1 }));
    patch.scale.copy(bone.scale);
    this.head.add(bone, patch);
    this.head.position.y = 0.17;
    this.rig.headMount.add(this.head);
    this.group.visible = false;
  }

  /** mode: 'roam' | 'listen' | 'hunt' and so on, from the sim. */
  update(dt: number, on: boolean, x: number, z: number, mode: string, player: THREE.Vector3): void {
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    const g = this.group;
    const moved = x - this.lastX;
    this.lastX = x;
    g.position.set(x, 0, z);
    const hunting = mode === 'hunt';
    const listening = mode === 'listen' || mode === 'door';
    const face = hunting || listening ? Math.atan2(player.x - x, player.z - z) : moved >= 0 ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.y += (face - g.rotation.y) * Math.min(1, dt * (hunting ? 8 : 2));
    const speed = Math.abs(moved) / Math.max(dt, 1e-3);
    this.ph += dt * (speed > 0.05 ? 3 + speed * 2 : 0);
    const r = this.rig;
    for (const l of r.legs) {
      const s = Math.sin(this.ph + (l.side > 0 ? Math.PI : 0));
      l.hip.rotation.x = -s * (hunting ? 0.7 : 0.35);
      l.knee.rotation.x = Math.max(0, -s) * (hunting ? 1.1 : 0.6) + 0.15;
    }
    r.chest.rotation.x = hunting ? 0.95 : listening ? 0.7 : 0.45 + Math.sin(this.t * 0.6) * 0.04;
    for (const a of r.arms) {
      const s = Math.sin(this.ph + (a.side > 0 ? 0 : Math.PI));
      a.sh.rotation.x = hunting ? -1.2 + s * 0.2 : s * 0.15 + 0.1;
      a.sh.rotation.z = a.side * 0.12;
      a.el.rotation.x = hunting ? -0.3 : -0.15;
      for (const f of a.fingers) f.rotation.x = hunting ? -0.6 + Math.sin(this.t * 9 + a.side) * 0.3 : -0.2 + Math.sin(this.t * 3 + a.side) * 0.15;
    }
    // listening: the head cocks one way, then snaps the other
    this.head.rotation.z = listening ? Math.sin(this.t * 1.7) * 0.5 : Math.sin(this.t * 0.4) * 0.2;
    this.head.rotation.x = hunting ? -0.6 : -0.2;
    this.head.rotation.y = listening ? Math.sin(this.t * 4.3) * 0.25 : 0;
  }
}
