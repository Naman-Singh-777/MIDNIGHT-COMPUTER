import * as THREE from 'three';
import type { Patient, Verdict } from '../sim/types';

const puffTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(220,235,255,0.55)');
  gr.addColorStop(1, 'rgba(220,235,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

function faceTexture(p: Patient): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const skin = 150 + Math.floor(p.hue * 60);
  g.fillStyle = `rgb(${skin + 40},${skin},${skin - 20})`;
  g.fillRect(0, 0, 128, 128);
  // eyes
  g.fillStyle = '#e8e4da';
  g.beginPath();
  g.ellipse(44, 60, 11, 7, 0, 0, 7);
  g.ellipse(84, 60, 11, 7, 0, 0, 7);
  g.fill();
  g.fillStyle = '#17120e';
  g.beginPath();
  g.arc(44, 60, 5, 0, 7);
  g.arc(84, 60, 5, 0, 7);
  g.fill();
  // brows
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(32, 45);
  g.lineTo(54, 43);
  g.moveTo(74, 43);
  g.lineTo(96, 45);
  g.stroke();
  // mouth: mimics smile a little wider than they should
  g.strokeStyle = '#5a2a28';
  g.lineWidth = 3;
  g.beginPath();
  const w = p.truth === 'understudy' ? 26 : 16;
  g.moveTo(64 - w, 96);
  g.quadraticCurveTo(64, p.truth === 'understudy' ? 112 : 100, 64 + w, 96);
  g.stroke();
  // the mark the photograph should match
  g.fillStyle = 'rgba(70,35,30,0.8)';
  const m = p.faceMark;
  if (m.includes('left brow')) g.fillRect(34, 36, 18, 3);
  else if (m.includes('right cheek')) g.fillRect(92, 76, 4, 4);
  else if (m.includes('left eye')) g.fillRect(40, 70, 3, 3);
  else if (m.includes('chin')) g.fillRect(56, 112, 14, 8);
  else if (m.includes('nose')) g.fillRect(62, 66, 4, 18);
  else if (m.includes('ear')) g.fillRect(2, 60, 6, 10);
  else if (m.includes('tooth')) { g.fillStyle = '#e8e4da'; g.fillRect(58, 98, 5, 6); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type ViewPhase = 'none' | 'approaching' | 'present' | 'leaving';

export class PatientView {
  readonly group = new THREE.Group();
  private body!: THREE.Mesh;
  private head!: THREE.Group;
  private hat: THREE.Object3D | null = null;
  private puffs: THREE.Sprite[] = [];
  private patient: Patient | null = null;
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private verdict: Verdict | 'timeout' | null = null;
  speaking = 0;
  /** Read by the game so the door and lightning can follow the patient. */
  progress = 0;

  constructor(private readonly spawn: THREE.Vector3, private readonly stand: THREE.Vector3) {
    this.group.visible = false;
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      s.scale.setScalar(0.05);
      this.puffs.push(s);
      this.group.add(s);
    }
  }

  setPatient(p: Patient | null): void {
    this.patient = p;
    this.verdict = null;
    this.t = 0;
    if (this.body) this.group.remove(this.body, this.head);
    if (this.hat) this.group.remove(this.hat);
    this.hat = null;
    if (!p) {
      this.group.visible = false;
      return;
    }
    const coat = new THREE.Color().setHSL(p.hue, 0.22, 0.2 + (p.sprite === 1 ? 0.06 : 0));
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.27, 0.0),
      new THREE.Vector2(0.3, 0.55),
      new THREE.Vector2(0.24, 1.05),
      new THREE.Vector2(0.27, 1.32),
      new THREE.Vector2(0.14, 1.42),
      new THREE.Vector2(0.001, 1.44),
    ];
    this.body = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshLambertMaterial({ color: coat }));
    this.body.castShadow = true;
    this.head = new THREE.Group();
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 18, 14),
      new THREE.MeshLambertMaterial({ map: faceTexture(p) }),
    );
    skull.rotation.y = Math.PI; // texture faces +z
    skull.scale.set(0.92, 1.12, 0.95);
    this.head.add(skull);
    this.head.position.y = 1.58;
    if (p.sprite === 0) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), new THREE.MeshLambertMaterial({ color: coat.clone().multiplyScalar(0.7) }));
      brim.position.y = 0.11;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 14), brim.material);
      crown.position.y = 0.17;
      const hat = new THREE.Group();
      hat.add(brim, crown);
      this.head.add(hat);
    } else if (p.sprite === 1) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshLambertMaterial({ color: 0x3a2e28 }));
      bun.position.set(0, 0.12, -0.1);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), bun.material);
      cap.position.y = 0.03;
      this.head.add(bun, cap);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshLambertMaterial({ color: 0x2c2420 }));
      hair.position.y = 0.04;
      this.head.add(hair);
    }
    this.group.add(this.body, this.head);
    this.group.scale.setScalar(p.height);
    this.group.position.copy(this.spawn);
    this.group.rotation.y = 0;
    this.group.visible = true;
  }

  beginLeave(v: Verdict | 'timeout'): void {
    this.verdict = v;
    this.t = 0;
    this.from.copy(this.group.position);
    if (v === 'admit' || v === 'observe') this.to.set(-3.2, 0, -3.2);
    else if (v === 'refuse' || v === 'timeout') this.to.copy(this.spawn).setZ(-9.5);
    else this.to.copy(this.group.position);
  }

  update(dt: number, phase: ViewPhase, cam: THREE.Vector3, quiet: boolean): void {
    const p = this.patient;
    if (!p || !this.group.visible) return;
    this.t += dt;
    const understudy = p.truth === 'understudy';
    const g = this.group;
    const sway = understudy ? Math.sin(this.t * 0.9) * 0.012 : Math.sin(this.t * 0.9 + p.hue * 6) * 0.01 + Math.sin(this.t * 2.3) * 0.006;

    if (phase === 'approaching') {
      const k = Math.min(1, this.t / 3.5);
      this.progress = k;
      g.position.lerpVectors(this.spawn, this.stand, k);
      g.position.y = Math.abs(Math.sin(this.t * 5.2)) * 0.035 * (1 - k * 0.6);
      g.rotation.y = 0;
    } else if (phase === 'present') {
      this.progress = 1;
      g.position.copy(this.stand);
      g.position.x += sway;
      g.position.y = 0;
    } else if (phase === 'leaving') {
      const k = Math.min(1, this.t / 2.6);
      if (this.verdict === 'contain') {
        g.position.copy(this.stand);
        g.position.y = -Math.pow(k, 2) * 2.4;
      } else {
        g.position.lerpVectors(this.from, this.to, k);
        g.position.y = Math.abs(Math.sin(this.t * 5.2)) * 0.03;
        g.rotation.y = this.to.x < -1 ? -1.2 : 0;
      }
      if (k >= 1 && this.verdict !== null) g.visible = false;
    }

    // head: humans look at you with a lag; the Understudy looks at you a little too early and too still
    const dx = cam.x - g.position.x;
    const dz = cam.z - g.position.z;
    const yaw = Math.atan2(dx, dz) - g.rotation.y;
    const lag = understudy ? 14 : 4;
    this.head.rotation.y += (THREE.MathUtils.clamp(yaw, -1, 1) - this.head.rotation.y) * Math.min(1, dt * lag);
    this.head.rotation.z = understudy ? 0.06 + Math.sin(this.t * 0.3) * 0.01 : Math.sin(this.t * 0.7 + p.hue * 5) * 0.03;
    this.head.rotation.x = this.speaking > 0 ? Math.sin(this.t * 11) * 0.04 : 0;
    this.speaking = Math.max(0, this.speaking - dt);

    // breath fog in the cold hall. The Understudy sometimes forgets.
    const breath = !p.tells.includes('no_breath') && !quiet;
    this.puffs.forEach((s, i) => {
      const ph = ((this.t + i * 1.15) % 3.45) / 3.45;
      const mat = s.material as THREE.SpriteMaterial;
      if (!breath || phase !== 'present' || ph > 0.7) {
        mat.opacity = 0;
        return;
      }
      s.position.set(0, 1.5 + ph * 0.1, 0.22 + ph * 0.35);
      s.scale.setScalar(0.08 + ph * 0.35);
      mat.opacity = (1 - ph / 0.7) * 0.55 * Math.min(1, ph * 8);
    });
  }
}
