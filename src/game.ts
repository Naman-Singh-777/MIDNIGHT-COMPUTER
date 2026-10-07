import * as THREE from 'three';
import { AudioEngine } from './audio/engine';
import { FixedClock } from './core/clock';
import { PAUSE_HTML, SPEAKER_VOICE, TITLE_HTML, endHtml, greeting } from './data/dialogue';
import { Physics } from './physics/world';
import { PlayerController, type InputState } from './player/controller';
import { buildEnvironment, type Env, type Interact } from './render/environment';
import { PatientView } from './render/patientView';
import { Post } from './render/post';
import { loadSave, writeSave } from './save/save';
import { Simulation } from './sim/simulation';
import { QUESTION_TEXT } from './sim/patients';
import type { DirectorCue, Patient, QuestionId, Verdict } from './sim/types';
import { Hud, formatClock } from './ui/hud';

const WINDOW_POS = { x: 0, y: 1.4, z: -1.5 };

export class Game {
  readonly sim: Simulation;
  private renderer: THREE.WebGLRenderer;
  private post: Post;
  private env: Env;
  private physics: Physics;
  private player: PlayerController;
  private view: PatientView;
  private audio = new AudioEngine();
  private hud: Hud;
  private input: InputState = { keys: new Set(), mouseDX: 0, mouseDY: 0, mouseNX: 0.5, mouseNY: 0.5 };
  private clock = new FixedClock(1 / 60);
  private ray = new THREE.Raycaster();
  private flashlight!: THREE.SpotLight;
  private save = loadSave();

  private running = false;
  private began = false;
  private ended = false;
  private time = 0;
  private lastPhase = 'none';
  private patientsSeen = 0;
  private flickerT = 0;
  private lightningT = 12;
  private flashV = 0;
  private figureT = 0;
  private leverT = 0;
  private breakerHold = 0;
  private hovered: Interact | null = null;
  private perfOn = false;
  private perfAcc = 0;
  private frameMs = 16;
  private speedUp = 1;
  private pendingTimers: number[] = [];
  /** Dev hook for automated checks. */
  debug = { frames: 0 };

  private constructor(private readonly canvas: HTMLCanvasElement, root: HTMLElement, physics: Physics, seed: number) {
    this.physics = physics;
    this.sim = new Simulation(seed);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(1);
    this.post = new Post(this.renderer);
    this.env = buildEnvironment(physics);
    this.player = new PlayerController(physics);
    this.view = new PatientView(this.env.patientSpawn, this.env.patientStand);
    this.env.scene.add(this.view.group);
    this.env.scene.add(this.player.camera);

    this.flashlight = new THREE.SpotLight(0xfff0d8, 0, 14, 0.42, 0.55, 1.6);
    this.env.scene.add(this.flashlight, this.flashlight.target);

    this.audio.muted = this.save.muted;
    this.hud = new Hud(root, {
      ask: (q) => this.ask(q),
      lookup: () => this.lookup(),
      face: () => this.face(),
      verdict: (v) => this.doVerdict(v),
      begin: () => this.begin(),
    });
    this.hud.overlay(TITLE_HTML);
    this.hud.setMode(true);
    this.bindSim();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.drawCrt();
    this.drawSlip(null);

    const qs = new URLSearchParams(location.search);
    this.speedUp = Math.max(1, Number(qs.get('fast')) || 1);
    if (qs.has('autostart')) this.begin();
  }

  static async create(canvas: HTMLCanvasElement, root: HTMLElement): Promise<Game> {
    const physics = await Physics.create();
    const qs = new URLSearchParams(location.search);
    const seed = qs.has('seed') ? Number(qs.get('seed')) : (Math.random() * 2 ** 31) | 0;
    const g = new Game(canvas, root, physics, seed);
    requestAnimationFrame((t) => g.frame(t));
    return g;
  }

  // ------------------------------------------------------------------ lifecycle
  private begin(): void {
    this.audio.start();
    this.hud.overlay(null);
    this.running = true;
    if (!this.began) {
      this.began = true;
      this.hud.setTask('Check each slip against the ledger. Trust the lamp.');
    }
    if (this.player.mode === 'floor') this.canvas.requestPointerLock?.();
  }

  private pause(): void {
    if (!this.running || this.ended) return;
    this.running = false;
    this.hud.overlay(PAUSE_HTML);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.resize(w, h);
    this.player.setAspect(w / h);
  }

  // ------------------------------------------------------------------ sim events
  private bindSim(): void {
    const b = this.sim.bus;
    b.on('patientArrived', ({ patient }) => {
      this.patientsSeen++;
      this.view.setPatient(patient);
      this.audio.knock({ x: 0, y: 1.3, z: -8.2 }, 2);
      this.lightningT = Math.min(this.lightningT, 3);
    });
    b.on('patientLeft', ({ verdict }) => {
      this.view.beginLeave(verdict);
      this.hud.showPatient(null);
      this.drawSlip(null);
      this.drawCrt();
    });
    b.on('verdictResult', ({ verdict }) => {
      if (verdict === 'admit') this.audio.stamp();
      else if (verdict === 'contain') {
        this.leverT = 1.4;
        this.audio.lever();
      } else this.audio.click();
    });
    b.on('cue', ({ cue, intensity }) => this.onCue(cue, intensity));
    b.on('powerChanged', ({ on }) => {
      if (on) this.audio.powerUp();
      else this.audio.powerDown();
      this.drawCrt();
      this.hud.setLedger(null, true, on);
    });
    b.on('taskChanged', ({ text, done }) => {
      this.hud.setTask(done ? '' : text);
      if (done) this.hud.subtitle('Task', text, 2500);
    });
    b.on('story', ({ text, speaker }) => {
      const who = speaker ?? 'Intercom';
      const v = SPEAKER_VOICE[who] ?? { pitch: 150, radio: true };
      const dur = this.audio.speak(text, v.pitch, v.radio);
      this.hud.subtitle(who, text, Math.max(4500, dur * 1000 + 800));
    });
    b.on('hallucination', ({ kind }) => {
      const behind = { x: this.player.camera.position.x, y: 1.5, z: this.player.camera.position.z + 2 };
      if (kind === 'phantom_step') this.audio.distantStep(behind);
      else if (kind === 'phantom_knock') this.audio.knock({ x: this.player.camera.position.x + 1.5, y: 1.4, z: this.player.camera.position.z }, 2);
      else if (kind === 'whisper_name') this.audio.whisper(behind, 0.22);
      else if (kind === 'shadow_figure') this.figureT = 2.2;
    });
    b.on('shiftEnded', ({ score }) => {
      this.ended = true;
      this.running = false;
      document.exitPointerLock?.();
      this.save.nights++;
      this.save.bestCorrect = Math.max(this.save.bestCorrect, score.correct);
      writeSave(this.save);
      this.hud.overlay(endHtml(score, 'Officer on duty'));
    });
  }

  private onCue(cue: DirectorCue, intensity: number): void {
    const camX = this.player.camera.position.x;
    const inBooth = this.sim.state.zone === 'booth';
    switch (cue) {
      case 'flicker':
        this.flickerT = 0.6 + intensity;
        break;
      case 'knock':
        this.audio.knock(inBooth ? WINDOW_POS : { x: camX + 3, y: 1.3, z: 0.1 }, 3);
        break;
      case 'distant_step':
        this.audio.distantStep(inBooth ? { x: 6, y: 0, z: 0.9 } : { x: camX - 4, y: 0, z: 0.9 });
        break;
      case 'phone_ring':
        this.audio.phoneRing();
        this.flickerPhone = 3;
        break;
      case 'whisper':
        this.audio.whisper({ x: camX + (Math.random() - 0.5) * 2, y: 1.5, z: this.player.camera.position.z + 1.6 }, 0.18 + intensity * 0.25);
        break;
      case 'door_creak': {
        this.audio.creak(inBooth ? { x: 1.8, y: 1, z: 0.8 } : { x: camX + 5, y: 1, z: 0.9 });
        const crate = this.env.props[4];
        crate?.phys.body.applyImpulse({ x: 0.4, y: 0.5, z: 0.2 }, true);
        break;
      }
      case 'drip_stop':
        this.sim.director.quiet = true;
        break;
      case 'power_back':
      case 'power_out':
        break;
    }
  }
  private flickerPhone = 0;

  // ------------------------------------------------------------------ desk actions
  private ask(q: QuestionId): void {
    const p = this.sim.state.current;
    if (!p || this.sim.state.phase !== 'present' || !this.running) return;
    const r = this.sim.ask(q);
    if (!r) return;
    this.hud.markAsked(q);
    this.hud.logLine('q', QUESTION_TEXT[q]);
    this.audio.click();
    const t = window.setTimeout(() => {
      const pitch = this.voicePitch(p);
      const dur = this.audio.speak(r.text, pitch, false, p.truth === 'understudy' && p.archetype === 'voice_mimic');
      this.view.speaking = dur;
      this.hud.logLine('a', `"${r.text}"`);
      this.hud.subtitle(p.displayName, r.text, Math.max(3500, dur * 1000 + 600));
    }, r.delay * 1000);
    this.pendingTimers.push(t);
  }

  private voicePitch(p: Patient): number {
    return p.archetype === 'voice_mimic' ? 208 : 105 + p.hue * 110;
  }

  private lookup(): void {
    if (!this.running) return;
    const e = this.sim.lookup();
    if (!e) {
      if (!this.sim.state.powerOn) this.hud.subtitle('Ledger terminal', 'No power. The screen is a dark mirror.', 2500);
      return;
    }
    this.hud.setLedger(e, false, true);
    this.drawCrt(e);
    this.audio.click();
  }

  private face(): void {
    if (!this.running) return;
    const m = this.sim.inspectFace();
    if (m) {
      this.hud.logLine('face', `Face: ${m}.`);
      this.audio.click();
    }
  }

  private doVerdict(v: Verdict): void {
    if (!this.running) return;
    if (v === 'contain' && !this.sim.state.powerOn) {
      this.hud.subtitle('Lever', 'The lever is electric. It does nothing in the dark.', 2800);
      return;
    }
    if (!this.sim.state.current || this.sim.state.phase !== 'present') {
      if (v === 'contain') this.audio.lever();
      return;
    }
    this.sim.verdict(v);
  }

  // ------------------------------------------------------------------ input
  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.input.keys.add(e.code);
      if (e.code === 'F3') {
        e.preventDefault();
        this.perfOn = !this.perfOn;
        if (!this.perfOn) this.hud.perf(null);
      }
      if (e.code === 'KeyM') {
        this.audio.muted = !this.audio.muted;
        this.save.muted = this.audio.muted;
        writeSave(this.save);
      }
      if (!this.running) return;
      this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    window.addEventListener('blur', () => this.input.keys.clear());
    window.addEventListener('mousemove', (e) => {
      this.input.mouseNX = e.clientX / window.innerWidth;
      this.input.mouseNY = e.clientY / window.innerHeight;
      if (document.pointerLockElement === this.canvas) {
        this.input.mouseDX += e.movementX;
        this.input.mouseDY += e.movementY;
      }
    });
    this.canvas.addEventListener('click', () => {
      if (!this.running) return;
      if (this.player.mode === 'floor') {
        if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
      } else if (this.hovered?.id === 'lever') this.doVerdict('contain');
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.player.mode === 'floor' && this.running && document.pointerLockElement !== this.canvas) this.pause();
    });
  }

  private onKey(code: string): void {
    const desk = this.player.mode === 'desk';
    if (desk) {
      const qs: Record<string, QuestionId> = { Digit1: 'name', Digit2: 'dob', Digit3: 'sender', Digit4: 'kin', Digit5: 'memory' };
      if (qs[code]) this.ask(qs[code]);
      else if (code === 'KeyZ') this.lookup();
      else if (code === 'KeyX') this.face();
      else if (code === 'KeyA') this.doVerdict('admit');
      else if (code === 'KeyO') this.doVerdict('observe');
      else if (code === 'KeyR') this.doVerdict('refuse');
      else if (code === 'KeyL') this.doVerdict('contain');
      else if (code === 'KeyQ') {
        this.player.stand();
        this.hud.setMode(false);
        this.canvas.requestPointerLock?.();
      }
    } else {
      if (code === 'KeyF') {
        this.flashlightOn = !this.flashlightOn;
        this.sim.setFlashlight(this.flashlightOn);
        this.audio.click();
      } else if (code === 'KeyE') this.interact();
    }
  }
  private flashlightOn = false;

  private interact(): void {
    const h = this.hovered;
    if (!h) return;
    const env = this.env;
    if (h.id === 'door') {
      const d = env.boothDoor;
      d.open = !d.open;
      if (d.open) this.physics.removeCollider(d.collider);
      else d.collider = this.physics.addStaticBox(1.8, 1.05, 0.85, 0.04, 1.05, 0.45);
      this.audio.creak({ x: 1.8, y: 1, z: 0.9 });
    } else if (h.id === 'chair') {
      this.player.sit();
      document.exitPointerLock?.();
      this.hud.setMode(true);
      this.flashlightOn = false;
      this.sim.setFlashlight(false);
    } else if (h.id === 'lever') {
      this.doVerdict('contain');
    }
  }

  // ------------------------------------------------------------------ drawing
  private drawCrt(e?: import('./sim/types').RegistryEntry): void {
    const s = this.env.crt;
    const g = s.ctx;
    g.fillStyle = '#031008';
    g.fillRect(0, 0, 512, 384);
    if (this.sim.state.powerOn) {
      g.fillStyle = '#62ff9a';
      g.font = 'bold 22px "Courier New", monospace';
      g.fillText('VESPER HOLLOW LEDGER', 24, 40);
      g.font = '18px "Courier New", monospace';
      if (e) {
        const rows = [`REC  ${e.id}`, `NAME ${e.name}`, `BORN ${e.dob}`, `REF  ${e.sender}`, `KIN  ${e.kin}`, `BAND ${e.wristband}`, `FACE ${e.photoMark}`];
        if (e.note) rows.push(`NOTE ${e.note}`);
        rows.forEach((r, i) => g.fillText(r.slice(0, 34), 24, 84 + i * 30));
      } else {
        g.fillText('READY. NO RECORD OPEN.', 24, 90);
        g.fillText(formatClock(this.sim.state.minute), 24, 130);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < 384; y += 3) g.fillRect(0, y, 512, 1);
    }
    s.touch();
  }

  private drawSlip(p: Patient | null): void {
    const s = this.env.slip;
    const g = s.ctx;
    g.fillStyle = '#e6dcc0';
    g.fillRect(0, 0, 256, 320);
    if (p) {
      g.fillStyle = '#2a2018';
      g.font = 'bold 15px Georgia';
      g.fillText('ADMISSION SLIP', 60, 28);
      g.font = 'italic 14px Georgia';
      const rows = [p.docs.slipName, p.docs.slipDob, p.docs.slipSender, p.docs.wristband, p.docs.photoMark];
      const lab = ['Name', 'Born', 'By', 'Band', 'Photo'];
      rows.forEach((r, i) => {
        g.fillStyle = '#6b5a45';
        g.font = '11px Georgia';
        g.fillText(lab[i], 14, 66 + i * 44);
        g.fillStyle = '#2a2018';
        g.font = 'italic 14px Georgia';
        g.fillText(r.slice(0, 26), 14, 84 + i * 44);
      });
    }
    s.touch();
  }

  // ------------------------------------------------------------------ interaction raycast
  private pickInteract(): Interact | null {
    const cam = this.player.camera;
    if (this.player.mode === 'desk') {
      this.ray.setFromCamera(new THREE.Vector2(this.input.mouseNX * 2 - 1, -(this.input.mouseNY * 2 - 1)), cam);
    } else {
      this.ray.setFromCamera(new THREE.Vector2(0, 0), cam);
    }
    const hits = this.ray.intersectObjects(this.env.interactables, false);
    for (const h of hits) {
      const it = h.object.userData.interact as Interact | undefined;
      if (it && h.distance <= it.range) {
        if (this.player.mode === 'desk' && it.id !== 'lever') continue;
        return it;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ frame
  private frame(nowMs: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (nowMs - (this.lastMs || nowMs)) / 1000);
    this.lastMs = nowMs;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.1;
    this.time += dt;
    this.debug.frames++;
    this.post.adapt(dt * 1000);

    const sim = this.sim;
    if (this.running) {
      for (let i = 0; i < this.speedUp; i++) sim.tick(dt);
      const steps = this.clock.advance(dt);
      for (let i = 0; i < steps; i++) this.physics.step();
      this.player.update(dt, this.input, document.pointerLockElement === this.canvas);
    } else {
      this.player.update(0, this.input, false);
    }

    const s = sim.state;
    const f = this.player.feet;
    sim.setZone(f.x > 12.4 ? 'breaker' : f.x > 2.0 ? 'corridor' : 'booth');

    // patient phase transitions
    if (s.phase !== this.lastPhase) {
      if (s.phase === 'present' && s.current) this.onPatientPresent(s.current);
      this.lastPhase = s.phase;
    }
    this.view.update(dt, s.phase, this.player.camera.position, s.powerOn && this.sim.director.quiet);
    this.animateWorld(dt);
    this.updateHud();

    // audio
    if (this.audio.ready) {
      const fwd = this.player.forward();
      this.audio.setListener(this.player.camera.position, fwd);
      this.audio.update(dt, {
        tension: sim.director.tension,
        fear: s.fear,
        zone: s.zone,
        power: s.powerOn,
        quiet: sim.director.quiet,
        sanity: s.sanity,
        rainGain: 0.55,
      });
      if (this.player.stepDelta > 0) this.audio.walk(this.player.stepDelta, this.player.sprinting);
    }

    this.hovered = this.running ? this.pickInteract() : null;
    this.updatePrompt(dt);

    this.env.update(dt);
    const d = sim.distortion;
    const dark = !s.powerOn ? 1.5 : 1.0;
    this.post.render(this.env.scene, this.player.camera, this.time, d, dark, this.flashV * 0.25, 0.12 + (1 - s.sanity / 100) * 0.4);

    if (this.perfOn) this.perfTick(dt);
  }
  private lastMs = 0;

  private onPatientPresent(p: Patient): void {
    this.hud.showPatient(p);
    this.drawSlip(p);
    this.drawCrt();
    const line = greeting(p, this.patientsSeen);
    const pitch = this.voicePitch(p);
    const dur = this.audio.speak(line, pitch, false, p.archetype === 'voice_mimic');
    this.view.speaking = dur;
    this.hud.subtitle(p.displayName, line, Math.max(4000, dur * 1000 + 700));
  }

  private animateWorld(dt: number): void {
    const env = this.env;
    const s = this.sim.state;
    const L = env.lights;
    // lamp: honest early, unreliable once the Understudy has learned
    let lampMul = s.powerOn ? 1 : 0;
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      lampMul *= Math.random() > 0.45 ? 1 : 0.08;
    } else if (s.powerOn && s.stage >= 3) {
      lampMul *= 0.92 + Math.sin(this.time * 31) * 0.05 * (s.stage - 2);
    }
    L.lamp.intensity = 55 * lampMul;
    (L.lampBulb.material as THREE.MeshBasicMaterial).color.setScalar(s.powerOn ? 1 : 0.05).multiply(new THREE.Color(1, 0.85, 0.6));
    L.boothFill.intensity = (s.powerOn ? 7 : 0) * (this.flickerT > 0 ? lampMul : 1);
    L.crt.intensity = s.powerOn ? 2.2 : 0;
    L.hall.intensity = (s.powerOn ? 34 : 0) * (this.flickerT > 0 ? 0.5 + 0.5 * lampMul : 1);
    L.hemi.intensity = s.powerOn ? 0.55 : 0.22;
    const emergency = !s.powerOn;
    L.corridor.forEach((l, i) => {
      const flick = s.zone !== 'booth' && this.flickerT > 0 ? (Math.random() > 0.5 ? 1 : 0.1) : 1;
      l.intensity = emergency ? 0.9 + Math.sin(this.time * 2 + i) * 0.4 : 5.5 * flick;
      l.color.set(emergency ? 0xff3a2a : 0xa9d8c4);
      (L.corridorBulbs[i].material as THREE.MeshBasicMaterial).color.set(emergency ? 0x5a0d08 : 0xcfeee0);
    });

    // lightning
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.flashV = 1;
      this.lightningT = 18 + Math.random() * 30;
      const delay = 400 + Math.random() * 1600;
      this.pendingTimers.push(window.setTimeout(() => this.audio.thunder(), delay));
    }
    this.flashV = Math.max(0, this.flashV - dt * 3.5);
    const flicker = this.flashV > 0.2 ? 1 : this.flashV * 3;
    L.flash.intensity = flicker * 2.2;
    (env.outside.material as THREE.MeshBasicMaterial).color.setRGB(0.1 + flicker * 0.5, 0.15 + flicker * 0.55, 0.22 + flicker * 0.8);

    // hall doors follow the patient
    const open = s.phase === 'approaching' && this.view.progress < 0.9 ? 1 : 0;
    this.doorOpen += (open - this.doorOpen) * Math.min(1, dt * 4);
    env.hallDoorL.position.x = -0.35 - this.doorOpen * 0.75;
    env.hallDoorR.position.x = 0.35 + this.doorOpen * 0.75;

    // lever and breaker
    const target = this.leverT > 0 ? -0.7 : 0.7;
    this.leverT = Math.max(0, this.leverT - dt);
    env.leverArm.rotation.z += (target - env.leverArm.rotation.z) * Math.min(1, dt * 8);
    env.breakerLever.rotation.x += ((s.powerOn ? -0.9 : 0.9) - env.breakerLever.rotation.x) * Math.min(1, dt * 6);
    (env.breakerLamp.material as THREE.MeshBasicMaterial).color.set(s.powerOn ? 0x30ff60 : 0xff2010);
    this.flickerPhone = Math.max(0, this.flickerPhone - dt);
    (env.phoneLed.material as THREE.MeshBasicMaterial).color.set(this.flickerPhone > 0 && Math.sin(this.time * 18) > 0 ? 0xff6a10 : 0x331100);

    // the figure that should not be there
    this.figureT = Math.max(0, this.figureT - dt);
    (env.figure.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, this.figureT * 1.2);

    // flashlight follows the camera
    const cam = this.player.camera;
    this.flashlight.position.copy(cam.position);
    this.flashlight.target.position.copy(cam.position).add(this.player.forward().multiplyScalar(3));
    this.flashlight.intensity = this.flashlightOn && this.player.mode === 'floor' ? 28 : 0;
  }
  private doorOpen = 0;

  private updateHud(): void {
    const s = this.sim.state;
    this.hud.setClock(s.minute);
    this.hud.setSanity(s.sanity);
    this.hud.setStamina(this.player.stamina, this.player.mode === 'floor');
  }

  private updatePrompt(dt: number): void {
    const s = this.sim.state;
    const h = this.hovered;
    const heldE = this.input.keys.has('KeyE');
    if (this.player.mode === 'desk') {
      this.hud.prompt(h?.id === 'lever' ? 'Click: pull the containment lever' : null);
      this.breakerHold = 0;
      return;
    }
    if (h?.id === 'breaker') {
      if (!s.powerOn) {
        this.breakerHold = heldE ? this.breakerHold + dt : 0;
        this.hud.prompt('Hold E: throw the breaker', Math.min(1, this.breakerHold / 1.3));
        if (this.breakerHold >= 1.3) {
          this.sim.restorePower();
          this.breakerHold = 0;
        }
      } else this.hud.prompt('The breaker is holding');
      return;
    }
    this.breakerHold = 0;
    if (h?.id === 'door') this.hud.prompt(`E: ${this.env.boothDoor.open ? 'close' : 'open'} the booth door`);
    else if (h?.id === 'chair') this.hud.prompt('E: sit at the desk');
    else if (h?.id === 'lever') this.hud.prompt('E: pull the containment lever');
    else this.hud.prompt(null);
  }

  private perfTick(dt: number): void {
    this.perfAcc += dt;
    if (this.perfAcc < 0.5) return;
    this.perfAcc = 0;
    const i = this.renderer.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    this.hud.perf(
      [
        `fps ${(1000 / this.frameMs).toFixed(0)}  frame ${this.frameMs.toFixed(1)}ms`,
        `scale ${this.post.scale.toFixed(2)}  calls ${i.render.calls}  tris ${i.render.triangles}`,
        `geo ${i.memory.geometries}  tex ${i.memory.textures}  prog ${i.programs?.length ?? 0}`,
        mem ? `heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'heap n/a',
        `tension ${this.sim.director.tension.toFixed(2)} ${this.sim.director.pace}`,
        `sanity ${this.sim.state.sanity.toFixed(0)} fear ${this.sim.state.fear.toFixed(2)} stage ${this.sim.state.stage}`,
      ].join('\n'),
    );
  }
}
