import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics, DynamicProp } from '../physics/world';
import { DrawSurface, StaticBatch, makeMaterials, type Mats } from './materials';
import { Rain } from './rain';
import { buildDesk } from './desk';

export interface Interact {
  id: 'door' | 'lever' | 'breaker' | 'chair' | 'phone' | 'prop' | 'stain' | 'cabinet' | 'wardslot' | 'photo';
  prompt: string;
  range: number;
}

export interface Prop {
  mesh: THREE.Object3D;
  phys: DynamicProp;
}

export interface Env {
  scene: THREE.Scene;
  mats: Mats;
  lights: {
    lamp: THREE.SpotLight;
    lampBulb: THREE.Mesh;
    boothFill: THREE.PointLight;
    crt: THREE.PointLight;
    hall: THREE.PointLight;
    hemi: THREE.HemisphereLight;
    corridor: THREE.PointLight[];
    corridorBulbs: THREE.Mesh[];
    flash: THREE.DirectionalLight;
  };
  crt: DrawSurface;
  crtScreen: THREE.Mesh;
  slip: DrawSurface;
  slipMesh: THREE.Mesh;
  props: Prop[];
  interactables: THREE.Object3D[];
  boothDoor: { pivot: THREE.Group; collider: import('@dimforge/rapier3d-compat').Collider; open: boolean; t: number };
  hallDoorL: THREE.Mesh;
  hallDoorR: THREE.Mesh;
  outside: THREE.Mesh;
  patientSpawn: THREE.Vector3;
  patientStand: THREE.Vector3;
  leverArm: THREE.Group;
  breakerLever: THREE.Group;
  breakerLamp: THREE.Mesh;
  phoneLed: THREE.Mesh;
  desk: import('./desk').Desk;
  figure: THREE.Mesh;
  rainHall: Rain;
  rainYard: Rain;
  update(dt: number): void;
}

const H = 2.8;
const T = 0.15;

export function buildEnvironment(physics: Physics): Env {
  const mats = makeMaterials();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.FogExp2(0x070b0e, 0.055);

  const batch = new StaticBatch();
  const solid = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, collide = true, uv = 0.5): void => {
    batch.box(m, w, h, d, x, y, z, uv);
    if (collide) physics.addStaticBox(x, y, z, w / 2, h / 2, d / 2);
  };

  // ---------------------------------------------------------------- booth
  solid(mats.wood, 3.6, 0.1, 3.0, 0, -0.05, 0.3); // floor
  solid(mats.ceiling, 3.6, 0.1, 3.0, 0, H + 0.05, 0.3, false);
  // front wall with window opening x -1.3..1.3, y 0.95..2.2
  solid(mats.cream, 3.6 + T, 0.95, T, 0, 0.475, -1.2);
  solid(mats.cream, 3.6 + T, H - 2.2, T, 0, 2.2 + (H - 2.2) / 2, -1.2, false);
  solid(mats.cream, 0.5, 1.25, T, -1.55, 1.575, -1.2);
  solid(mats.cream, 0.5, 1.25, T, 1.55, 1.575, -1.2);
  // window frame in brass-ish wood
  solid(mats.woodDark, 2.7, 0.06, 0.2, 0, 0.98, -1.2, false);
  solid(mats.woodDark, 2.7, 0.06, 0.2, 0, 2.17, -1.2, false);
  // back + west walls
  solid(mats.cream, 3.6 + T, H, T, 0, H / 2, 1.8);
  solid(mats.cream, T, H, 3.0, -1.8, H / 2, 0.3);
  // east wall with door opening z 0.4..1.3, height 2.1
  solid(mats.cream, T, H, 1.6, 1.8, H / 2, -0.4);
  solid(mats.cream, T, H, 0.5, 1.8, H / 2, 1.55);
  solid(mats.cream, T, H - 2.1, 0.9, 1.8, 2.1 + (H - 2.1) / 2, 0.85, false);
  // wainscot trim
  solid(mats.woodDark, T + 0.04, 0.9, 3.0, -1.78, 0.45, 0.3, false);
  solid(mats.woodDark, 3.6, 0.9, 0.04, 0, 0.45, 1.77, false);

  // desk: modelled in desk.ts (collider added there)
  // filing cabinet + shelf
  solid(mats.metal, 0.5, 1.2, 0.6, -1.45, 0.6, 1.4);
  solid(mats.woodDark, 0.3, 0.05, 1.6, -1.62, 1.7, 0.5, false);

  // ---------------------------------------------------------------- intake hall (outside the glass)
  solid(mats.tileHall, 8, 0.1, 7.2, 0, -0.05, -4.6);
  solid(mats.ceiling, 8, 0.1, 7.2, 0, 3.45, -4.6, false);
  solid(mats.cream, T, 3.4, 7.2, -4, 1.7, -4.6);
  solid(mats.cream, T, 3.4, 7.2, 4, 1.7, -4.6);
  solid(mats.cream, 3.3, 3.4, T, -2.35, 1.7, -8.2);
  solid(mats.cream, 3.3, 3.4, T, 2.35, 1.7, -8.2);
  solid(mats.cream, 1.4, 0.6, T, 0, 3.1, -8.2, false);
  solid(mats.woodDark, 8, 1.0, 0.05, 0, 0.5, -1.35, false); // hall side of booth wainscot
  solid(mats.woodDark, 3.2, 0.5, 0.4, -2.6, 0.25, -4.6); // bench
  solid(mats.woodDark, 0.3, 1.6, 0.3, 3.5, 0.8, -2.2); // coat rack post

  // ---------------------------------------------------------------- east corridor
  const L0 = 1.9;
  const L1 = 14.2;
  const len = L1 - L0;
  const cx = (L0 + L1) / 2;
  solid(mats.tileCorr, len, 0.1, 1.9, cx, -0.05, 0.9);
  solid(mats.ceiling, len, 0.1, 1.9, cx, 2.95, 0.9, false);
  solid(mats.paintGreen, len, 1.2, T, cx, 0.6, -0.08);
  solid(mats.cream, len, 1.7, T, cx, 2.05, -0.08);
  solid(mats.paintGreen, len, 1.2, T, cx, 0.6, 1.88);
  solid(mats.cream, len, 1.7, T, cx, 2.05, 1.88);
  solid(mats.paintGreen, T, 3.0, 1.9, L1 + 0.075, 1.5, 0.9);
  // door recesses (decor) + alcove
  solid(mats.woodDark, 0.9, 2.1, 0.06, 5.5, 1.05, 0.0, false);
  solid(mats.woodDark, 0.9, 2.1, 0.06, 8.6, 1.05, 1.82, false);
  solid(mats.black, 1.4, 2.3, 0.9, 11.0, 1.15, 2.4, false); // dark alcove (visual only)
  // pipes along the ceiling
  solid(mats.metal, len, 0.08, 0.08, cx, 2.8, 0.25, false);
  solid(mats.rust, len, 0.06, 0.06, cx, 2.7, 0.4, false);

  const world = batch.build((g) => mergeGeometries(g, false));
  scene.add(world);

  // ---------------------------------------------------------------- glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.25), mats.glass);
  glass.position.set(0, 1.575, -1.22);
  scene.add(glass);
  physics.addStaticBox(0, 1.575, -1.22, 1.35, 0.625, 0.02);
  // scratches on the glass
  const scr = new DrawSurface(512, 256);
  scr.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 40; i++) {
    scr.ctx.beginPath();
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    scr.ctx.moveTo(x, y);
    scr.ctx.lineTo(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 30);
    scr.ctx.stroke();
  }
  scr.touch();
  const scratches = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.25), new THREE.MeshBasicMaterial({ map: scr.texture, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  scratches.position.set(0, 1.575, -1.215);
  scene.add(scratches);

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0x3a4a58, 0x15100c, 0.55);
  scene.add(hemi);

  const lamp = new THREE.SpotLight(0xffb468, 55, 7, 0.9, 0.7, 2);
  lamp.position.set(0.95, 1.45, -0.62);
  lamp.target.position.set(0.1, 0.78, -0.75);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(512, 512);
  lamp.shadow.bias = -0.0008;
  scene.add(lamp, lamp.target);

  const boothFill = new THREE.PointLight(0xffc88a, 7, 7, 2);
  boothFill.position.set(0, 2.4, 0.4);
  scene.add(boothFill);

  const crtLight = new THREE.PointLight(0x62ff9a, 2.2, 3.2, 2);
  crtLight.position.set(-0.9, 1.15, -0.35);
  scene.add(crtLight);

  const hall = new THREE.PointLight(0xdfe8ff, 34, 12, 2);
  hall.position.set(0, 3.0, -4.6);
  scene.add(hall);

  const flash = new THREE.DirectionalLight(0xbcd2ff, 0);
  flash.position.set(-3, 6, -9);
  scene.add(flash);

  // the desk and everything on it
  const desk = buildDesk(scene, physics, mats);
  const { lampBulb, crt, crtScreen, slip, slipMesh, phoneLed } = desk;

  // containment lever (east wall, inside booth)
  const leverBase = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.22), mats.metal);
  leverBase.position.set(1.7, 1.15, -0.55);
  const leverArm = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), mats.metal);
  stick.position.y = 0.15;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshLambertMaterial({ color: 0x8c1d1d }));
  knob.position.y = 0.31;
  leverArm.add(stick, knob);
  leverArm.position.set(1.65, 1.15, -0.55);
  leverArm.rotation.z = 0.7;
  scene.add(leverBase, leverArm);
  const leverHit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.35), new THREE.MeshBasicMaterial({ visible: false }));
  leverHit.position.set(1.62, 1.2, -0.55);
  leverHit.userData.interact = { id: 'lever', prompt: 'Containment lever', range: 3 } satisfies Interact;
  scene.add(leverHit);

  // intercom (west wall)
  const intercom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.2), mats.metal);
  intercom.position.set(-1.72, 1.45, 0.2);
  scene.add(intercom);

  // calendar
  const cal = new DrawSurface(128, 160);
  cal.ctx.fillStyle = '#e3d8b8';
  cal.ctx.fillRect(0, 0, 128, 160);
  cal.ctx.fillStyle = '#7a1f1f';
  cal.ctx.fillRect(0, 0, 128, 34);
  cal.ctx.fillStyle = '#fff';
  cal.ctx.font = 'bold 20px Georgia';
  cal.ctx.fillText('OCT 1963', 18, 24);
  cal.ctx.fillStyle = '#2a2018';
  cal.ctx.font = '12px Georgia';
  for (let i = 0; i < 31; i++) cal.ctx.fillText(String(i + 1), 8 + (i % 7) * 17, 56 + Math.floor(i / 7) * 20);
  cal.ctx.strokeStyle = '#7a1f1f';
  cal.ctx.beginPath();
  cal.ctx.arc(8 + (6 % 7) * 17 + 5, 52 + 20, 10, 0, 7);
  cal.ctx.stroke();
  cal.touch();
  const calMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.375), new THREE.MeshLambertMaterial({ map: cal.texture }));
  calMesh.position.set(-1.7, 1.55, -0.55);
  calMesh.rotation.y = Math.PI / 2;
  scene.add(calMesh);

  // chair
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), mats.woodDark);
  seat.position.y = 0.5;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), mats.woodDark);
  back.position.set(0, 0.8, 0.22);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 8), mats.metal);
  post.position.y = 0.25;
  chair.add(seat, back, post);
  chair.position.set(0, 0, 0.45);
  scene.add(chair);
  const chairHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  chairHit.position.set(0, 0.6, 0.45);
  chairHit.userData.interact = { id: 'chair', prompt: 'Sit at the desk', range: 2.2 } satisfies Interact;
  scene.add(chairHit);

  // booth door
  const doorPivot = new THREE.Group();
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 0.9), mats.woodDark);
  doorLeaf.position.set(0, 1.05, -0.45);
  doorPivot.add(doorLeaf);
  doorPivot.position.set(1.8, 0, 1.3);
  scene.add(doorPivot);
  const doorCollider = physics.addStaticBox(1.8, 1.05, 0.85, 0.04, 1.05, 0.45);
  const doorHit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.1, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
  doorHit.position.set(1.8, 1.05, 0.85);
  doorHit.userData.interact = { id: 'door', prompt: 'Booth door', range: 2.6 } satisfies Interact;
  scene.add(doorHit);

  // ---------------------------------------------------------------- hall doors + outside
  const doorMat = mats.woodDark;
  const hallDoorL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.08), doorMat);
  const hallDoorR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.08), doorMat);
  hallDoorL.position.set(-0.35, 1.3, -8.14);
  hallDoorR.position.set(0.35, 1.3, -8.14);
  scene.add(hallDoorL, hallDoorR);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), new THREE.MeshBasicMaterial({ color: 0x1a2634, fog: false }));
  outside.position.set(0, 1.3, -8.4);
  scene.add(outside);
  physics.addStaticBox(0, 1.3, -8.12, 0.7, 1.3, 0.04);

  const rainHall = new Rain(new THREE.Box3(new THREE.Vector3(-1.4, 0, -11.5), new THREE.Vector3(1.4, 3.2, -8.45)), 260);
  const rainYard = new Rain(new THREE.Box3(new THREE.Vector3(5.2, 0, 2.0), new THREE.Vector3(9.6, 3.2, 4.8)), 300);
  scene.add(rainHall.lines, rainYard.lines);

  // corridor window to the yard
  const yardGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), mats.glass);
  yardGlass.position.set(7.4, 1.6, 1.8);
  scene.add(yardGlass);
  const yardBack = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ color: 0x0e1822, fog: false }));
  yardBack.position.set(7.4, 1.6, 1.86);
  scene.add(yardBack);
  // a figure that only the mind should see
  const figure = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.7), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, fog: false }));
  figure.position.set(7.9, 1.0, 1.9);
  scene.add(figure);

  // corridor lights
  const corridorLights: THREE.PointLight[] = [];
  const corridorBulbs: THREE.Mesh[] = [];
  for (const x of [3.2, 6.6, 10.0, 13.2]) {
    const l = new THREE.PointLight(0xa9d8c4, 5.5, 7.5, 2);
    l.position.set(x, 2.6, 0.9);
    scene.add(l);
    corridorLights.push(l);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.14), new THREE.MeshBasicMaterial({ color: 0xcfeee0 }));
    bulb.position.copy(l.position).setY(2.9);
    scene.add(bulb);
    corridorBulbs.push(bulb);
  }

  // wheelchair in the alcove (silhouette is the point)
  const wc = new THREE.Group();
  const wSeat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), mats.black);
  wSeat.position.y = 0.5;
  const wBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.05), mats.black);
  wBack.position.set(0, 0.8, 0.25);
  const wheelGeo = new THREE.TorusGeometry(0.3, 0.02, 6, 20);
  const w1 = new THREE.Mesh(wheelGeo, mats.metal);
  w1.rotation.y = Math.PI / 2;
  w1.position.set(0.28, 0.3, 0.2);
  const w2 = w1.clone();
  w2.position.x = -0.28;
  wc.add(wSeat, wBack, w1, w2);
  wc.position.set(11.0, 0, 2.2);
  wc.rotation.y = 2.6;
  scene.add(wc);

  // ---------------------------------------------------------------- breaker panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.8), mats.metal);
  panel.position.set(14.0, 1.4, 0.9);
  scene.add(panel);
  const breakerLever = new THREE.Group();
  const bStick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.08), new THREE.MeshLambertMaterial({ color: 0xb0b0a8 }));
  bStick.position.y = 0.17;
  breakerLever.add(bStick);
  breakerLever.position.set(13.93, 1.35, 0.9);
  breakerLever.rotation.x = 0.9;
  scene.add(breakerLever);
  const breakerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0x300000 }));
  breakerLamp.position.set(13.93, 1.8, 0.9);
  scene.add(breakerLamp);
  const breakerHit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  breakerHit.position.set(13.7, 1.4, 0.9);
  breakerHit.userData.interact = { id: 'breaker', prompt: 'Breaker panel', range: 2.4 } satisfies Interact;
  scene.add(breakerHit);

  // ---------------------------------------------------------------- dynamic props
  const props: Prop[] = [];
  const addBoxProp = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, mass: number, tag = 'prop'): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.interact = { id: 'prop', prompt: tag, range: 2.4 } satisfies Interact;
    scene.add(mesh);
    props.push({ mesh, phys: physics.addDynamicBox(x, y, z, w / 2, h / 2, d / 2, mass) });
  };
  const addCylProp = (mat: THREE.Material, r: number, h: number, x: number, y: number, z: number, mass: number, tag = 'prop'): void => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, h, 14), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.interact = { id: 'prop', prompt: tag, range: 2.4 } satisfies Interact;
    scene.add(mesh);
    props.push({ mesh, phys: physics.addDynamicCylinder(x, y, z, h / 2, r, mass) });
  };
  addCylProp(mats.metal, 0.17, 0.3, 4.6, 0.2, 0.4, 1.5, 'Bucket');
  addBoxProp(mats.woodDark, 0.5, 0.4, 0.5, 8.7, 0.25, 0.5, 6, 'Crate');
  addBoxProp(mats.woodDark, 0.5, 0.4, 0.5, 8.8, 0.65, 0.55, 5, 'Crate');
  addBoxProp(mats.rust, 0.3, 0.3, 0.3, 12.2, 0.2, 1.4, 2, 'Tin box');

  const interactables: THREE.Object3D[] = [leverHit, chairHit, doorHit, breakerHit, ...props.map((p) => p.mesh), ...desk.hits];

  // ---------------------------------------------------------------- floor collider (big, thick)
  physics.addStaticBox(5, -0.5, -2, 14, 0.5, 9);

  const env: Env = {
    scene,
    mats,
    lights: { lamp, lampBulb, boothFill, crt: crtLight, hall, hemi, corridor: corridorLights, corridorBulbs, flash },
    crt,
    crtScreen,
    slip,
    slipMesh,
    props,
    interactables,
    boothDoor: { pivot: doorPivot, collider: doorCollider, open: false, t: 0 },
    hallDoorL,
    hallDoorR,
    outside,
    patientSpawn: new THREE.Vector3(0, 0, -7.4),
    patientStand: new THREE.Vector3(0, 0, -2.45),
    leverArm,
    breakerLever,
    breakerLamp,
    phoneLed,
    desk,
    figure,
    rainHall,
    rainYard,
    update(dt: number) {
      for (const p of props) {
        const t = p.phys.body.translation();
        const r = p.phys.body.rotation();
        p.mesh.position.set(t.x, t.y, t.z);
        p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
      rainHall.update(dt);
      rainYard.update(dt);
      const d = env.boothDoor;
      const target = d.open ? 1 : 0;
      d.t += (target - d.t) * Math.min(1, dt * 6);
      d.pivot.rotation.y = d.t * 1.7;
    },
  };
  return env;
}
