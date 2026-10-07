import * as THREE from 'three';
import type { Distortion } from '../sim/perception';

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uWobble;
uniform float uExposure;
uniform float uFlash;
uniform float uDesat;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  // slow sway when sanity is low
  uv += vec2(sin(uTime * 0.7 + uv.y * 3.0), cos(uTime * 0.5 + uv.x * 3.0)) * 0.004 * uWobble;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  // mild barrel distortion, like old glass
  uv = 0.5 + c * (1.0 + r2 * 0.06);
  float ab = uAberration * 0.006 * (0.4 + r2 * 3.0);
  vec3 col;
  col.r = texture2D(tScene, uv + vec2(ab, 0.0)).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - vec2(ab, 0.0)).b;
  col += uFlash * vec3(0.5, 0.6, 0.8);
  col *= uExposure;
  col = aces(col);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l) * vec3(0.9, 1.0, 1.05), uDesat);
  col = pow(col, vec3(1.0 / 2.2));
  float vig = smoothstep(0.85, 0.2, length(c) * (0.9 + uVignette * 0.9));
  col *= mix(1.0, vig, 0.35 + uVignette * 0.6);
  float scan = 0.97 + 0.03 * sin(uv.y * uRes.y * 3.14159);
  col *= scan;
  float n = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
  col += n * (0.018 + uGrain * 0.05);
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * Scene renders into a half-float target at an adaptive scale, then one
 * fullscreen pass does tone mapping, grading and the perception distortion.
 */
export class Post {
  private rt: THREE.WebGLRenderTarget;
  private readonly mat: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly scene = new THREE.Scene();
  scale = 0.75;
  private frames = 0;
  private acc = 0;
  private w = 1;
  private h = 1;
  adaptive = true;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.rt = this.makeRT(2, 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tScene: { value: this.rt.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uVignette: { value: 0.3 },
        uGrain: { value: 0.2 },
        uAberration: { value: 0 },
        uWobble: { value: 0 },
        uExposure: { value: 1.0 },
        uFlash: { value: 0 },
        uDesat: { value: 0.12 },
      },
    });
    this.quad = new THREE.Mesh(geo, this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private makeRT(w: number, h: number): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      samples: 2,
    });
    return rt;
  }

  resize(cssW: number, cssH: number): void {
    this.w = cssW;
    this.h = cssH;
    this.applyScale();
  }

  private applyScale(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(160, Math.floor(this.w * dpr * this.scale));
    const h = Math.max(90, Math.floor(this.h * dpr * this.scale));
    this.rt.setSize(w, h);
    this.mat.uniforms.uRes.value.set(w, h);
  }

  /** Adjust render scale from measured frame time. Keeps Iris Xe class GPUs smooth. */
  adapt(frameMs: number): void {
    if (!this.adaptive) return;
    this.acc += frameMs;
    this.frames++;
    if (this.frames < 45) return;
    const avg = this.acc / this.frames;
    this.frames = 0;
    this.acc = 0;
    let s = this.scale;
    if (avg > 21 && s > 0.5) s -= 0.05;
    else if (avg < 12 && s < 1) s += 0.05;
    if (Math.abs(s - this.scale) > 1e-4) {
      this.scale = Math.round(s * 100) / 100;
      this.applyScale();
    }
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time: number, d: Distortion, exposure: number, flash: number, desat: number): void {
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uVignette.value = d.vignette;
    u.uGrain.value = d.grain;
    u.uAberration.value = d.aberration;
    u.uWobble.value = d.wobble;
    u.uExposure.value = exposure;
    u.uFlash.value = flash;
    u.uDesat.value = desat;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.cam);
  }
}
