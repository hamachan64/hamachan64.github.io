/**
 * Glass — 画像を「ガラス越しの像」として描く WebGL レイヤー。
 *
 * ポートレートは本人（実像）とガラスに映った姿（鏡像）が向かい合う写真。
 * seam（継ぎ目）より右の鏡像側だけを“仮想”として扱い、
 *  - カーソルが触れると水面のように波紋が立ち、波頭がわずかに分光する
 *  - スクロールすると鏡像だけが実像から遅れてずれる
 *  - 読み込み時は実像が先に現れ、鏡像は継ぎ目から外へ向かって結像する
 * seam を持たない画像（作品プレビューなど）は全体が鏡像として振る舞い、
 * 画像の切り替えは中心から広がる波紋で行う。
 *
 * canvas は対象要素の中に置くので、スクロールとのズレは起きない。
 */
import { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';
import gsap from 'gsap';

const VERT = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tA;
uniform sampler2D tB;
uniform float uAspA;
uniform float uAspB;
uniform vec2 uFocA;
uniform vec2 uFocB;
uniform vec2 uSize;
uniform float uMix;
uniform vec2 uMouse;
uniform float uHover;
uniform float uRipple;
uniform float uVel;
uniform float uTime;
uniform float uSeam;
uniform float uReveal;
uniform float uVirtual;
varying vec2 vUv;

vec2 cover(vec2 uv, float box, float img, vec2 f) {
  vec2 s = box > img ? vec2(1.0, img / box) : vec2(box / img, 1.0);
  return (uv - 0.5) * s + 0.5 + (f - 0.5) * (1.0 - s);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// 彩度を抑えた薄膜干渉の色
vec3 film(float t) {
  return mix(vec3(0.85), 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))), 0.7);
}

vec3 sampleSplit(sampler2D t, vec2 uv, vec2 disp, float box, float asp, vec2 foc) {
  vec2 o = disp * 0.9;
  float r = texture2D(t, cover(uv + disp + o, box, asp, foc)).r;
  float g = texture2D(t, cover(uv + disp, box, asp, foc)).g;
  float b = texture2D(t, cover(uv + disp - o, box, asp, foc)).b;
  return vec3(r, g, b);
}

void main() {
  vec2 uv = vUv;
  float box = uSize.x / uSize.y;
  bool hasSeam = uSeam > 0.0;

  // 画像上の x で実像／鏡像を判定（トリミングされても継ぎ目は写真に追従する）
  float ix = cover(uv, box, uAspA, uFocA).x;
  float virt = hasSeam ? smoothstep(uSeam - 0.0015, uSeam + 0.0015, ix) : 1.0;

  // --- 結像（イントロ） ---
  float n = noise(uv * vec2(3.0, 9.0));
  // 実像：下から立ち上がる
  float rf = uReveal * 1.1 - 0.05;
  float physVis = 1.0 - smoothstep(rf - 0.025, rf + 0.025, uv.y);
  // 鏡像：継ぎ目から外へ（seam が無い画像は実像と同じ）
  float local = hasSeam ? (ix - uSeam) / (1.0 - uSeam) : 0.0;
  float front = local - (uVirtual * 1.3 - 0.15) + (n - 0.5) * 0.18;
  float virtVis = hasSeam ? 1.0 - smoothstep(-0.03, 0.03, front) : physVis;
  float frontW = hasSeam ? exp(-abs(front) * 22.0) * (1.0 - smoothstep(0.85, 1.0, uVirtual)) : 0.0;

  // --- 触れたときの波紋 ---
  vec2 p = vec2(uv.x * box, uv.y);
  vec2 m = vec2(uMouse.x * box, uMouse.y);
  vec2 d = p - m;
  float r = length(d);
  vec2 dir = r > 1e-4 ? d / r : vec2(0.0);
  // 波紋は「動かした分だけ」立ち、止まると静まる。静止時はレンズのような歪みだけ
  float rip = sin(r * 46.0 - uTime * 5.0) * exp(-r * 9.0) * uHover * uRipple;
  vec2 disp = dir * rip * 0.008;
  disp -= d * exp(-r * r * 22.0) * 0.035 * uHover;

  // --- スクロールで鏡像だけが遅れる ---
  disp.y += uVel * 0.0008;
  // 呼吸のような、ごく弱い揺らぎ
  disp.x += (noise(vec2(uv.y * 3.0, uTime * 0.25)) - 0.5) * 0.0025;

  // 結像の波頭
  disp.x += frontW * 0.035;

  // --- 画像切り替え：中心から広がる波紋 ---
  float tr = length((uv - 0.5) * vec2(box, 1.0));
  float f2 = uMix * 1.5 - 0.25;
  float showB = 1.0 - smoothstep(f2 - 0.04, f2 + 0.04, tr + (n - 0.5) * 0.08);
  float ring = exp(-abs(tr - f2) * 26.0) * step(0.001, uMix) * step(uMix, 0.999);
  disp += (uv - 0.5) / max(tr, 1e-3) * ring * 0.03;

  disp *= virt;
  disp.x /= box;

  vec3 colA = sampleSplit(tA, uv, disp, box, uAspA, uFocA);
  vec3 colB = sampleSplit(tB, uv, disp, box, uAspB, uFocB);
  vec3 col = mix(colA, colB, showB);

  // 波頭にだけ、薄く光の干渉色が乗る
  float glint = (abs(rip) * 0.9 + ring * 0.7 + frontW * 0.9) * virt;
  col += film(uv.x * 0.7 + uv.y * 0.4 + uTime * 0.04) * glint * 0.16;

  float alpha = mix(physVis, virtVis, virt);
  gl_FragColor = vec4(col, alpha);
}
`;

type Tex = { tex: Texture; aspect: number };

export interface GlassOptions {
  src: string;
  focus?: [number, number];
  seam?: number;
  getVelocity?: () => number;
  reducedMotion?: boolean;
}

export class Glass {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private program: Program;
  private mesh: Mesh;
  private cache = new Map<string, Promise<Tex>>();
  private current = '';
  private visible = false;
  private revealed = false;
  private ready = false;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private opts: GlassOptions;
  private hover = { target: 0, mouse: [0.5, 0.5] as [number, number] };
  private vel = 0;
  private ripple = 0;
  private last: [number, number] | null = null;
  private mixTween: gsap.core.Tween | null = null;
  private tick = () => this.render();
  private onMove = (e: PointerEvent) => this.pointer(e);
  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    // タッチ：触れた場所に波紋を立てて、ゆっくり引いていく
    this.pointer(e, true);
    this.ripple = 1;
    clearTimeout(this.touchTimer);
    this.touchTimer = window.setTimeout(() => (this.hover.target = 0), 900);
  };
  private touchTimer = 0;
  private lastScroll = window.scrollY;
  private onLeave = () => {
    this.hover.target = 0;
    this.last = null;
  };

  s = { reveal: 0, virtual: 0, hover: 0, mix: 0 };

  constructor(host: HTMLElement, opts: GlassOptions) {
    this.host = host;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'glass-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);

    this.renderer = new Renderer({
      canvas: this.canvas,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    const gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const blank = new Texture(gl, {
      image: new Uint8Array([226, 224, 218, 255]),
      width: 1,
      height: 1,
      generateMipmaps: false,
    });

    this.program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      transparent: true,
      depthTest: false,
      uniforms: {
        tA: { value: blank },
        tB: { value: blank },
        uAspA: { value: 1 },
        uAspB: { value: 1 },
        uFocA: { value: opts.focus ?? [0.5, 0.5] },
        uFocB: { value: opts.focus ?? [0.5, 0.5] },
        uSize: { value: [1, 1] },
        uMix: { value: 0 },
        uMouse: { value: [0.5, 0.5] },
        uHover: { value: 0 },
        uRipple: { value: 0 },
        uVel: { value: 0 },
        uTime: { value: 0 },
        uSeam: { value: opts.seam ?? -1 },
        uReveal: { value: 0 },
        uVirtual: { value: opts.seam ? 0 : 1 },
      },
    });
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program: this.program });
    this.blankTex = { tex: blank, aspect: 1 };

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.intro();
    });
    this.io.observe(host);

    host.addEventListener('pointermove', this.onMove);
    host.addEventListener('pointerleave', this.onLeave);
    host.addEventListener('pointerdown', this.onDown);
    gsap.ticker.add(this.tick);

    this.load(opts.src).then((t) => {
      const u = this.program.uniforms;
      u.tA.value = t.tex;
      u.uAspA.value = t.aspect;
      this.current = opts.src;
      this.ready = true;
      this.host.classList.add('is-gl');
      if (this.visible) this.intro();
    });
  }

  private resize() {
    const r = this.host.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height);
    this.program.uniforms.uSize.value = [r.width, r.height];
  }

  private blankTex: Tex | null = null;

  private load(src: string): Promise<Tex> {
    if (src === 'blank' && this.blankTex) return Promise.resolve(this.blankTex);
    let p = this.cache.get(src);
    if (!p) {
      p = new Promise<Tex>((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () =>
          resolve({
            tex: new Texture(this.renderer.gl, { image: img, generateMipmaps: false }),
            aspect: img.naturalWidth / img.naturalHeight,
          });
        img.onerror = reject;
        img.src = src;
      });
      this.cache.set(src, p);
    }
    return p;
  }

  preload(srcs: string[]) {
    srcs.forEach((s) => this.load(s).catch(() => undefined));
  }

  private intro() {
    if (this.revealed || !this.ready) return;
    this.revealed = true;
    const rm = this.opts.reducedMotion;
    gsap.to(this.s, { reveal: 1, duration: rm ? 0 : 1.5, ease: 'expo.inOut' });
    if (this.opts.seam) {
      gsap.to(this.s, { virtual: 1, duration: rm ? 0 : 1.8, delay: rm ? 0 : 1.05, ease: 'power3.out' });
    } else {
      this.s.virtual = 1;
    }
  }

  /** 画像を差し替える（中心から波紋が広がって入れ替わる） */
  async show(src: string, focus: [number, number] = [0.5, 0.5]) {
    if (src === this.current) return;
    this.current = src;
    const t = await this.load(src);
    if (this.current !== src) return;
    const u = this.program.uniforms;
    if (this.mixTween) {
      // 途中なら、いま見えている方を確定させてから次へ
      this.mixTween.kill();
      if (this.s.mix > 0.5) {
        u.tA.value = u.tB.value;
        u.uAspA.value = u.uAspB.value;
        u.uFocA.value = u.uFocB.value;
      }
    }
    u.tB.value = t.tex;
    u.uAspB.value = t.aspect;
    u.uFocB.value = focus;
    this.s.mix = 0;
    this.mixTween = gsap.to(this.s, {
      mix: 1,
      duration: this.opts.reducedMotion ? 0 : 1.1,
      ease: 'power2.inOut',
      onComplete: () => {
        u.tA.value = u.tB.value;
        u.uAspA.value = u.uAspB.value;
        u.uFocA.value = u.uFocB.value;
        this.s.mix = 0;
        this.mixTween = null;
      },
    });
  }

  private pointer(e: PointerEvent, touch = false) {
    if (e.pointerType !== 'mouse' && !touch) return;
    const r = this.host.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    this.hover.mouse = [x, y];
    if (this.last) {
      const moved = Math.hypot(e.clientX - this.last[0], e.clientY - this.last[1]);
      this.ripple = Math.min(1, this.ripple + moved * 0.012);
    }
    this.last = [e.clientX, e.clientY];
    // 継ぎ目がある画像は、鏡像側に触れたときだけ反応する
    const seam = this.opts.seam;
    this.hover.target = seam ? (x > this.seamX() ? 1 : 0) : 1;
  }

  /** 継ぎ目の位置を要素上の x（0〜1）に換算 */
  private seamX(): number {
    const u = this.program.uniforms;
    const [w, h] = u.uSize.value as number[];
    const box = w / h;
    const img = u.uAspA.value as number;
    const sx = box > img ? 1 : box / img;
    const fx = (u.uFocA.value as number[])[0];
    const off = 0.5 - sx * 0.5 + (fx - 0.5) * (1 - sx);
    return ((this.opts.seam ?? 0.5) - off) / sx;
  }

  private render() {
    if (!this.visible || !this.ready) return;
    const s = this.s;
    s.hover += (this.hover.target - s.hover) * 0.06;
    // スクロール速度（px/フレーム）。Lenis が平滑化していないタッチ操作でも取れるよう自前で測る
    const y = window.scrollY;
    const raw = this.opts.getVelocity?.() || y - this.lastScroll;
    this.lastScroll = y;
    const v = gsap.utils.clamp(-50, 50, raw);
    this.vel += (v - this.vel) * 0.08;

    const u = this.program.uniforms;
    const [mx, my] = u.uMouse.value as number[];
    u.uMouse.value = [mx + (this.hover.mouse[0] - mx) * 0.12, my + (this.hover.mouse[1] - my) * 0.12];
    u.uHover.value = s.hover;
    this.ripple *= 0.965;
    u.uRipple.value = this.ripple;
    u.uVel.value = this.opts.reducedMotion ? 0 : this.vel;
    u.uTime.value = performance.now() / 1000;
    u.uReveal.value = s.reveal;
    u.uVirtual.value = s.virtual;
    u.uMix.value = s.mix;
    this.renderer.render({ scene: this.mesh });
  }

  destroy() {
    gsap.ticker.remove(this.tick);
    this.io.disconnect();
    this.ro.disconnect();
    this.host.removeEventListener('pointermove', this.onMove);
    this.host.removeEventListener('pointerleave', this.onLeave);
    this.host.removeEventListener('pointerdown', this.onDown);
    clearTimeout(this.touchTimer);
    this.mixTween?.kill();
    gsap.killTweensOf(this.s);
    this.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
    this.host.classList.remove('is-gl');
  }
}

export function canUseGlass(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
