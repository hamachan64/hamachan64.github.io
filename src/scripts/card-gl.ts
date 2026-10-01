/**
 * Spatial Card — サイト全体を通して存在する、1枚の WebGL カード。
 *
 * レイアウトは CSS が決める：ページ内の `[data-card]`（.card-anchor）が“置き場所”で、
 * カードは毎フレーム、いま最も見えているアンカーの矩形へ滑らかに追従する。
 *  - data-src   : 表面に貼る画像 URL（アンカー内 <img> の currentSrc でも可）
 *  - data-face  : "back" で裏面（ホロ箔）を向ける
 *  - data-focus : "x y"（0〜1）トリミングの焦点
 * アンカーが変わって画像も変わるときはカードが一回転し、裏を向いた瞬間に絵柄が入れ替わる。
 * 同じアンカーのまま画像だけ変わるとき（Works のホバー）はノイズでディゾルブする。
 */
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from 'ogl';
import gsap from 'gsap';

const VERT = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float uBend;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vec3 p = position;
  // 速度に応じて紙のようにわずかにたわむ（中心が手前に膨らむ）
  p.z += uBend * (1.0 - 4.0 * p.x * p.x);
  vec3 n = normalize(vec3(8.0 * uBend * p.x, 0.0, 1.0));
  vN = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tFront;
uniform sampler2D tFrom;
uniform sampler2D tBack;
uniform vec2 uSize;
uniform float uAspect;
uniform float uFromAspect;
uniform vec2 uFocus;
uniform vec2 uFromFocus;
uniform float uMix;
uniform float uOpacity;
uniform float uTime;
uniform float uHasFront;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 cover(vec2 uv, float card, float img, vec2 focus) {
  vec2 s = card > img ? vec2(1.0, img / card) : vec2(card / img, 1.0);
  return (uv - 0.5) * s + 0.5 + (focus - 0.5) * (1.0 - s);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// 薄膜干渉っぽい、彩度を抑えたホロ箔のパレット
vec3 foil(float t) {
  vec3 c = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  return mix(vec3(0.82), c, 0.62);
}

void main() {
  vec2 px = (vUv - 0.5) * uSize;
  float r = min(uSize.x, uSize.y) * 0.048;
  float d = sdRound(px, uSize * 0.5, r);
  float alpha = 1.0 - smoothstep(-1.0, 0.5, d);
  if (alpha <= 0.0) discard;

  vec3 N = normalize(vN);
  bool front = gl_FrontFacing;
  if (!front) N = -N;
  vec3 V = normalize(-vView);
  vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 90.0);

  // 傾き（法線）で色相が流れる
  float g = noise(vUv * vec2(3.0, 4.0) + uTime * 0.03);
  float t = vUv.x * 0.55 + vUv.y * 0.8 + N.x * 2.2 - N.y * 1.6 + g * 0.25;
  // 光沢の帯
  float bandPos = 0.9 - N.x * 3.0 + N.y * 2.0;
  float band = smoothstep(0.3, 0.0, abs(vUv.x * 0.8 + vUv.y * 0.6 - bandPos));

  vec3 col;
  if (front) {
    vec2 uv = vUv;
    vec3 a = texture2D(tFrom, cover(uv, uSize.x / uSize.y, uFromAspect, uFromFocus)).rgb;
    vec3 b = texture2D(tFront, cover(uv, uSize.x / uSize.y, uAspect, uFocus)).rgb;
    float n = noise(uv * 5.0) * 0.65 + noise(uv * 23.0) * 0.35;
    float m = smoothstep(n - 0.08, n + 0.08, uMix * 1.16 - 0.08);
    col = mix(a, b, m);
    // ディゾルブの境界にだけ箔の光が走る
    float edge = smoothstep(0.1, 0.0, abs(n - (uMix * 1.16 - 0.08))) * step(0.001, uMix) * step(uMix, 0.999);
    col += foil(t + 0.3) * edge * 0.9;
    col = mix(col, vec3(0.08), (1.0 - uHasFront) * 0.85);
    // ラミネート：弱いホロと鏡面
    col = col * 0.97 + foil(t) * band * 0.09 + vec3(spec) * 0.22;
  } else {
    vec2 uv = vec2(1.0 - vUv.x, vUv.y);
    vec3 m = texture2D(tBack, cover(uv, uSize.x / uSize.y, 0.7, vec2(0.5))).rgb;
    vec3 ink = vec3(0.075, 0.073, 0.07);
    vec3 f = foil(t);
    col = mix(ink, f * 0.78, m.r * (0.55 + band * 0.45));
    col = mix(col, f * 0.35 + vec3(0.72) + band * 0.25, m.g);
    col += vec3(spec) * 0.45;
  }

  // 縁のハイライト
  float rim = 1.0 - smoothstep(0.0, 1.6, -d);
  col += rim * 0.18;

  gl_FragColor = vec4(col, alpha * uOpacity);
}
`;

const SHADOW_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uSize;
uniform float uBlur;
uniform float uOpacity;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 full = uSize + uBlur * 2.0;
  vec2 p = (vUv - 0.5) * full;
  float d = sdRound(p, uSize * 0.5, min(uSize.x, uSize.y) * 0.05);
  float a = 1.0 - smoothstep(-uBlur, uBlur, d);
  gl_FragColor = vec4(0.07, 0.06, 0.05, a * a * uOpacity);
}
`;

const SHADOW_VERT = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

type Rect = { x: number; y: number; w: number; h: number };
type Tex = { tex: Texture; aspect: number };

export interface CardOptions {
  reducedMotion: boolean;
  getVelocity: () => number;
}

export class SpatialCard {
  private renderer: Renderer;
  private gl: Renderer['gl'];
  private camera: Camera;
  private card: Mesh;
  private shadow: Mesh;
  private program: Program;
  private shadowProgram: Program;
  private textures = new Map<string, Promise<Tex>>();
  private loaded = new Map<string, Tex>();
  private blank: Texture;
  private anchors: HTMLElement[] = [];
  private active: HTMLElement | null = null;
  private lastRect: Rect | null = null;
  private W = 0;
  private H = 0;
  private mouse = { x: 0.5, y: 0.5 };
  private hasMouse = false;
  private shownSrc: string | null = null;
  private pendingSrc: string | null = null;
  private spinning = false;
  private introDone = false;
  private opts: CardOptions;

  // アニメーション状態（px / rad）
  s = {
    x: 0, y: 0, w: 0, h: 0,
    turn: 0, // 一回転 = 2π を積み上げる
    face: 0, // 0 = 表, π = 裏
    tiltX: 0, tiltY: 0,
    vel: 0,
    mix: 1,
    opacity: 0,
    lift: 0,
    introY: 0,
  };

  constructor(canvas: HTMLCanvasElement, opts: CardOptions) {
    this.opts = opts;
    this.renderer = new Renderer({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.camera = new Camera(this.gl, { near: 1, far: 5000 });
    this.camera.position.z = 1600;

    this.blank = new Texture(this.gl, {
      image: new Uint8Array([20, 20, 19, 255]),
      width: 1,
      height: 1,
      generateMipmaps: false,
    });

    const geo = new Plane(this.gl, { width: 1, height: 1, widthSegments: 24, heightSegments: 1 });
    this.program = new Program(this.gl, {
      vertex: VERT,
      fragment: FRAG,
      transparent: true,
      cullFace: false as unknown as number,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tFront: { value: this.blank },
        tFrom: { value: this.blank },
        tBack: { value: this.makeBack() },
        uSize: { value: [1, 1] },
        uAspect: { value: 1 },
        uFromAspect: { value: 1 },
        uFocus: { value: [0.5, 0.5] },
        uFromFocus: { value: [0.5, 0.5] },
        uMix: { value: 1 },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uBend: { value: 0 },
        uHasFront: { value: 0 },
      },
    });
    this.card = new Mesh(this.gl, { geometry: geo, program: this.program });

    this.shadowProgram = new Program(this.gl, {
      vertex: SHADOW_VERT,
      fragment: SHADOW_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSize: { value: [1, 1] },
        uBlur: { value: 30 },
        uOpacity: { value: 0 },
      },
    });
    this.shadow = new Mesh(this.gl, {
      geometry: new Plane(this.gl, { width: 1, height: 1 }),
      program: this.shadowProgram,
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.hasMouse = true;
      this.mouse.x = e.clientX / this.W;
      this.mouse.y = e.clientY / this.H;
    });
  }

  /* ------------------------------------------------------------------ */
  private resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.renderer.setSize(this.W, this.H);
    const fov = (2 * Math.atan(this.H / 2 / this.camera.position.z) * 180) / Math.PI;
    this.camera.perspective({ fov, aspect: this.W / this.H });
  }

  /** 裏面の版（R = ギョーシェ模様の箔, G = 銀箔の文字） */
  private makeBack(): Texture {
    const w = 700;
    const h = 1000;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // ギョーシェ（重なり合う楕円）
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = 1.4;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    for (let i = 0; i < 72; i++) {
      ctx.rotate(Math.PI / 72);
      ctx.beginPath();
      ctx.ellipse(0, 0, 250, 92, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // 外周の細い罫
    ctx.strokeStyle = 'rgb(255,0,0)';
    for (let i = 0; i < 6; i++) {
      const m = 34 + i * 7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(m, m, w - m * 2, h - m * 2, 26 - i * 2);
      ctx.stroke();
    }

    const draw = () => {
      ctx.fillStyle = 'rgb(0,255,0)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 150px "Archivo Variable", sans-serif';
      (ctx as unknown as { fontStretch: string }).fontStretch = 'condensed';
      ctx.fillText('YH', w / 2, h / 2 + 6);
      ctx.font = '500 17px "IBM Plex Mono", monospace';
      ctx.fillText('YUKI HAMAGUCHI', w / 2, 110);
      ctx.fillText('AR CARD CREATOR — TOKYO', w / 2, h - 110);
      ctx.font = '400 13px "IBM Plex Mono", monospace';
      ctx.fillText('PHYSICAL × VIRTUAL', w / 2, h - 84);
    };

    const tex = new Texture(this.gl, { image: c, generateMipmaps: false });
    // フォント読み込み後に文字を描いて更新
    Promise.all([
      document.fonts.load('700 150px "Archivo Variable"'),
      document.fonts.load('500 17px "IBM Plex Mono"'),
    ])
      .catch(() => undefined)
      .then(() => {
        draw();
        tex.image = c;
        tex.needsUpdate = true;
      });
    return tex;
  }

  private load(src: string): Promise<Tex> {
    let p = this.textures.get(src);
    if (!p) {
      p = new Promise<Tex>((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          const tex = new Texture(this.gl, { image: img, generateMipmaps: false });
          const t = { tex, aspect: img.naturalWidth / img.naturalHeight };
          this.loaded.set(src, t);
          resolve(t);
        };
        img.onerror = reject;
        img.src = src;
      });
      this.textures.set(src, p);
    }
    return p;
  }

  preload(srcs: string[]) {
    srcs.forEach((s) => s && this.load(s).catch(() => undefined));
  }

  /* ------------------------------------------------------------------ */
  /** ページ遷移ごとに呼ぶ：アンカーを拾い直す */
  scan() {
    this.anchors = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'));
    this.preload(this.anchors.map((a) => this.srcOf(a)).filter(Boolean) as string[]);
    const extra = Array.from(document.querySelectorAll<HTMLElement>('[data-card-preload]')).map(
      (el) => el.dataset.cardPreload!
    );
    // 一覧の画像は少し待ってから
    setTimeout(() => this.preload(extra), 1200);
  }

  private srcOf(a: HTMLElement): string | null {
    if (a.dataset.face === 'back') return null;
    if (a.dataset.src) return a.dataset.src;
    const img = a.querySelector('img');
    return img ? img.currentSrc || img.src : null;
  }

  private focusOf(a: HTMLElement): [number, number] {
    const f = (a.dataset.focus || '0.5 0.5').split(/\s+/).map(Number);
    return [f[0] ?? 0.5, f[1] ?? 0.5];
  }

  private pickAnchor(): HTMLElement | null {
    let best: HTMLElement | null = null;
    let bestScore = 0;
    let currentScore = 0;
    for (const a of this.anchors) {
      const r = a.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const overlap = Math.max(0, Math.min(r.bottom, this.H) - Math.max(r.top, 0));
      const score = overlap / Math.min(r.height, this.H);
      if (a === this.active) currentScore = score;
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    // ヒステリシス：拮抗している間は今のアンカーを維持
    if (this.active && this.active.isConnected && best !== this.active && bestScore < currentScore + 0.15) {
      return this.active;
    }
    return best ?? (this.active && this.active.isConnected ? this.active : null);
  }

  /* ------------------------------------------------------------------ */
  private setFront(src: string, dissolve: boolean, focus: [number, number]) {
    const t = this.loaded.get(src);
    if (!t) return false;
    const u = this.program.uniforms;
    if (dissolve && this.shownSrc && !this.opts.reducedMotion) {
      u.tFrom.value = u.tFront.value;
      u.uFromAspect.value = u.uAspect.value;
      u.uFromFocus.value = u.uFocus.value;
      this.s.mix = 0;
      gsap.to(this.s, { mix: 1, duration: 1.1, ease: 'power2.inOut', overwrite: true });
    } else {
      this.s.mix = 1;
    }
    u.tFront.value = t.tex;
    u.uAspect.value = t.aspect;
    u.uFocus.value = focus;
    u.uHasFront.value = 1;
    this.shownSrc = src;
    return true;
  }

  private spin(dir = 1) {
    this.spinning = true;
    gsap.to(this.s, {
      turn: Math.round(this.s.turn / (Math.PI * 2) + dir) * Math.PI * 2,
      duration: this.opts.reducedMotion ? 0 : 1.5,
      ease: 'power3.inOut',
      overwrite: 'auto',
      onComplete: () => {
        this.spinning = false;
      },
    });
  }

  private update(time: number) {
    const s = this.s;
    const rm = this.opts.reducedMotion;
    const anchor = this.pickAnchor();

    if (anchor) {
      const src = this.srcOf(anchor);
      const focus = this.focusOf(anchor);
      const wantBack = anchor.dataset.face === 'back';
      const anchorChanged = anchor !== this.active;

      if (anchorChanged || wantBack !== this.wantBack) {
        this.active = anchor;
        this.wantBack = wantBack;
        gsap.to(s, {
          face: wantBack ? Math.PI : 0,
          duration: rm ? 0 : 1.3,
          ease: 'power3.inOut',
          overwrite: 'auto',
        });
      }

      if (src && src !== this.shownSrc && src !== this.pendingSrc) {
        if (!this.shownSrc) {
          // 初回：読み込めたら即表示
          this.pendingSrc = src;
        } else if (anchorChanged && !wantBack) {
          this.pendingSrc = src;
          this.spin(anchor.compareDocumentPosition(this.lastAnchorEl ?? anchor) & 2 ? 1 : -1);
        } else if (!anchorChanged) {
          this.pendingSrc = null;
          if (!this.setFront(src, true, focus)) {
            this.pendingSrc = src;
            this.pendingDissolve = true;
          }
        } else {
          // 裏面のアンカー：表は見えないので裏で差し替える
          this.pendingSrc = src;
        }
      } else if (src && src === this.shownSrc) {
        this.program.uniforms.uFocus.value = focus;
      }
      this.lastAnchorEl = anchor;

      const r = anchor.getBoundingClientRect();
      if (r.width > 0) {
        this.lastRect = {
          x: r.left + r.width / 2 - this.W / 2,
          y: -(r.top + r.height / 2 - this.H / 2),
          w: r.width,
          h: r.height,
        };
      }
    }

    // 裏を向いている間に絵柄を差し替え
    if (this.pendingSrc && this.loaded.has(this.pendingSrc)) {
      const facingBack = Math.cos(s.turn + s.face) < -0.1;
      const first = !this.shownSrc;
      if (first || facingBack || !this.spinning || this.pendingDissolve) {
        this.setFront(this.pendingSrc, !first && !facingBack, this.active ? this.focusOf(this.active) : [0.5, 0.5]);
        this.pendingSrc = null;
        this.pendingDissolve = false;
      }
    }

    if (this.lastRect) {
      const r = this.lastRect;
      if (s.w === 0 || rm) {
        Object.assign(s, { x: r.x, y: r.y, w: r.w, h: r.h });
      } else {
        const k = 0.11;
        s.x += (r.x - s.x) * k;
        s.y += (r.y - s.y) * (k * 1.6);
        s.w += (r.w - s.w) * k;
        s.h += (r.h - s.h) * k;
      }
    }

    // ポインタで傾く（カード中心からの相対位置）
    if (!rm) {
      let tx = 0;
      let ty = 0;
      if (this.hasMouse) {
        const cx = (s.x + this.W / 2) / this.W;
        const cy = (-s.y + this.H / 2) / this.H;
        tx = gsap.utils.clamp(-0.5, 0.5, this.mouse.y - cy) * 0.55;
        ty = gsap.utils.clamp(-0.5, 0.5, this.mouse.x - cx) * 0.75;
      }
      s.tiltX += (tx - s.tiltX) * 0.06;
      s.tiltY += (ty - s.tiltY) * 0.06;
      const v = gsap.utils.clamp(-60, 60, this.opts.getVelocity());
      s.vel += (v - s.vel) * 0.1;
    }

    const t = time / 1000;
    const idle = rm ? 0 : 1;
    const rotY = s.turn + s.face + s.tiltY + Math.sin(t * 0.45) * 0.06 * idle;
    const rotX = s.tiltX - s.vel * 0.006 + Math.sin(t * 0.6) * 0.035 * idle;
    const rotZ = Math.sin(t * 0.35) * 0.012 * idle;
    const floatY = Math.sin(t * 0.8) * 4 * idle;

    this.card.position.set(s.x, s.y + floatY + s.introY, s.lift);
    this.card.rotation.set(rotX, rotY, rotZ);
    this.card.scale.set(Math.max(s.w, 1), Math.max(s.h, 1), 1);

    const u = this.program.uniforms;
    u.uSize.value = [s.w, s.h];
    u.uMix.value = s.mix;
    u.uOpacity.value = s.opacity;
    u.uTime.value = t;
    u.uBend.value = gsap.utils.clamp(-26, 26, -s.vel * 0.5);

    // 影：カードの見かけの幅に合わせて縮み、傾きの反対へずれる
    const blur = Math.max(18, s.w * 0.09);
    const sw = s.w * Math.max(0.08, Math.abs(Math.cos(rotY))) * 0.94;
    const sh = s.h * Math.max(0.3, Math.abs(Math.cos(rotX))) * 0.94;
    this.shadow.position.set(s.x - s.tiltY * 40 + 6, s.y + floatY + s.introY - s.h * 0.035 - 18, -40);
    this.shadow.scale.set(sw + blur * 2, sh + blur * 2, 1);
    this.shadowProgram.uniforms.uSize.value = [sw, sh];
    this.shadowProgram.uniforms.uBlur.value = blur;
    this.shadowProgram.uniforms.uOpacity.value = s.opacity * 0.34;
  }

  private lastAnchorEl: HTMLElement | null = null;
  private wantBack = false;
  private pendingDissolve = false;

  render(time: number) {
    this.update(time);
    if (this.s.opacity <= 0.001 || this.s.w < 2) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      return;
    }
    this.renderer.render({ scene: this.shadow, camera: this.camera });
    this.renderer.render({ scene: this.card, camera: this.camera, clear: false });
  }

  /** 初回の登場：裏向きで落ちてきて、表へ返る */
  intro(delay = 0.3) {
    if (this.introDone) return;
    this.introDone = true;
    const s = this.s;
    if (this.opts.reducedMotion) {
      s.opacity = 1;
      return;
    }
    s.turn = -Math.PI * 3;
    s.introY = 220;
    s.lift = 300;
    gsap.to(s, { opacity: 1, duration: 0.5, delay, ease: 'none' });
    gsap.to(s, { introY: 0, duration: 2.0, delay, ease: 'expo.out' });
    gsap.to(s, { lift: 0, duration: 2.2, delay, ease: 'expo.out' });
    gsap.to(s, { turn: 0, duration: 2.4, delay, ease: 'expo.out' });
  }
}

export function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
