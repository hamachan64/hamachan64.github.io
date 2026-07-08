/**
 * サイト全体のモーション制御
 * - Lenis: 慣性スムーススクロール（セッション中1回だけ生成）
 * - GSAP + ScrollTrigger: スクロール連動アニメーション（ページ遷移ごとに再構築）
 * - Astro ClientRouter(View Transitions) と共存するため、
 *   astro:page-load で初期化 / astro:before-swap で破棄する
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('js');

/* ==========================================================================
   Lenis（永続・1インスタンス）
   ========================================================================== */
let lenis: Lenis | null = null;

if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// 同一ページ内アンカーは Lenis でスムーススクロール
document.addEventListener('click', (e) => {
  const link = (e.target as Element).closest?.('a[href*="#"]') as HTMLAnchorElement | null;
  if (!link || !lenis) return;
  const url = new URL(link.href, location.href);
  if (url.pathname !== location.pathname || !url.hash) return;
  const target = document.querySelector(url.hash);
  if (!target) return;
  e.preventDefault();
  lenis.scrollTo(target as HTMLElement, { offset: -64 });
  history.pushState(null, '', url.hash);
});

/* ==========================================================================
   ユーティリティ: テキストを .word / .char に分解
   ========================================================================== */
function splitText(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone === '1') {
    return Array.from(el.querySelectorAll<HTMLElement>('.char'));
  }
  el.dataset.splitDone = '1';
  el.setAttribute('aria-label', el.textContent?.replace(/\s+/g, ' ').trim() ?? '');

  const chars: HTMLElement[] = [];
  const frag = document.createDocumentFragment();

  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const tokens = (node.textContent ?? '').split(/(\s+)/);
      tokens.forEach((token) => {
        if (!token) return;
        if (/^\s+$/.test(token)) {
          frag.appendChild(document.createTextNode(' '));
          return;
        }
        const word = document.createElement('span');
        word.className = 'word';
        word.setAttribute('aria-hidden', 'true');
        for (const ch of token) {
          const span = document.createElement('span');
          span.className = 'char';
          span.textContent = ch;
          word.appendChild(span);
          chars.push(span);
        }
        frag.appendChild(word);
      });
    } else {
      // <br> などはそのまま維持
      frag.appendChild(node.cloneNode(true));
    }
  });

  el.replaceChildren(frag);
  return chars;
}

/* ==========================================================================
   パーティクル（ホログラフィックの光の粒）
   ========================================================================== */
let particleRaf = 0;
let particleResize: (() => void) | null = null;

function initParticles() {
  const canvas = document.getElementById('holo-particles') as HTMLCanvasElement | null;
  if (!canvas || reducedMotion) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const HUES = [190, 260, 320, 150]; // cyan / violet / pink / mint
  const COUNT = Math.min(60, Math.floor(window.innerWidth / 24));
  let w = 0;
  let h = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  type P = { x: number; y: number; r: number; vy: number; vx: number; hue: number; tw: number; t: number };
  let dots: P[] = [];

  const spawn = (): P => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.8 + Math.random() * 2.2,
    vy: 0.12 + Math.random() * 0.35,
    vx: (Math.random() - 0.5) * 0.15,
    hue: HUES[Math.floor(Math.random() * HUES.length)],
    tw: 0.4 + Math.random() * 0.6,
    t: Math.random() * Math.PI * 2,
  });

  const resize = () => {
    w = canvas.offsetWidth;
    h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = Array.from({ length: COUNT }, spawn);
  };
  resize();
  particleResize = resize;
  window.addEventListener('resize', resize);

  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of dots) {
      p.y -= p.vy;
      p.x += p.vx;
      p.t += 0.02;
      if (p.y < -8) {
        p.y = h + 8;
        p.x = Math.random() * w;
      }
      const alpha = (0.25 + 0.55 * Math.abs(Math.sin(p.t))) * p.tw;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 95%, 75%, ${alpha})`;
      ctx.shadowColor = `hsla(${p.hue}, 95%, 70%, ${alpha})`;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    particleRaf = requestAnimationFrame(tick);
  };
  particleRaf = requestAnimationFrame(tick);
}

function destroyParticles() {
  cancelAnimationFrame(particleRaf);
  if (particleResize) {
    window.removeEventListener('resize', particleResize);
    particleResize = null;
  }
}

/* ==========================================================================
   カスタムカーソル
   ========================================================================== */
let cursorMove: ((e: PointerEvent) => void) | null = null;
let cursorOver: ((e: Event) => void) | null = null;
let cursorOut: ((e: Event) => void) | null = null;

function initCursor() {
  if (!finePointer || reducedMotion) return;
  const dot = document.querySelector<HTMLElement>('.cursor-dot');
  const ring = document.querySelector<HTMLElement>('.cursor-ring');
  if (!dot || !ring) return;

  const ringX = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });

  cursorMove = (e: PointerEvent) => {
    gsap.set(dot, { x: e.clientX, y: e.clientY });
    ringX(e.clientX);
    ringY(e.clientY);
  };
  window.addEventListener('pointermove', cursorMove);

  const HOVER = 'a, button, .holo-card, .hero-card';
  cursorOver = (e: Event) => {
    if ((e.target as Element).closest?.(HOVER)) document.body.classList.add('cursor-hover');
  };
  cursorOut = (e: Event) => {
    if ((e.target as Element).closest?.(HOVER)) document.body.classList.remove('cursor-hover');
  };
  document.addEventListener('mouseover', cursorOver);
  document.addEventListener('mouseout', cursorOut);
}

function destroyCursor() {
  if (cursorMove) window.removeEventListener('pointermove', cursorMove);
  if (cursorOver) document.removeEventListener('mouseover', cursorOver);
  if (cursorOut) document.removeEventListener('mouseout', cursorOut);
  cursorMove = cursorOver = cursorOut = null;
  document.body.classList.remove('cursor-hover');
}

/* ==========================================================================
   3Dチルト＋ホロ光沢（トレカのホロ加工）
   ========================================================================== */
function initTilt() {
  if (!finePointer || reducedMotion) return;
  const cards = document.querySelectorAll<HTMLElement>('.holo-card.is-link, .hero-card');

  cards.forEach((card) => {
    const strength = card.classList.contains('hero-card') ? 10 : 7;

    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.style.setProperty('--ry', `${(px - 0.5) * strength * 2}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * strength * 2}deg`);
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ==========================================================================
   ヘッダー＋スクロールプログレス
   ========================================================================== */
function initChrome() {
  const header = document.getElementById('site-header');
  const progress = document.querySelector<HTMLElement>('.scroll-progress');
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    if (header) {
      header.classList.toggle('is-scrolled', y > 10);
      if (y > 300 && y > lastY + 4) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y <= 300) header.classList.remove('is-hidden');
    }
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    }
    lastY = y;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));
}

/* ==========================================================================
   スクロール連動アニメーション
   ========================================================================== */
function initScrollAnimations() {
  // data-reveal: .is-inview を一度だけ付与（CSSトランジションで出現）
  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${i * 0.09}s`);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (reducedMotion) {
      el.classList.add('is-inview');
      return;
    }
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => el.classList.add('is-inview'),
    });
  });

  // data-split: 見出しの文字分解リビール
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    const chars = splitText(el);
    if (reducedMotion || chars.length === 0) return;
    gsap.to(chars, {
      y: 0,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.028,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  // Works カード: 奥からスタッガー出現
  const workCards = gsap.utils.toArray<HTMLElement>('[data-work-card]');
  if (workCards.length > 0 && !reducedMotion) {
    ScrollTrigger.batch(workCards, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1,
          ease: 'expo.out',
          stagger: 0.1,
        }),
    });
  }
}

/* ==========================================================================
   Hero イントロ＋パララックス
   ========================================================================== */
function initHero() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  const title = hero.querySelector<HTMLElement>('[data-split-hero]');
  const fades = hero.querySelectorAll<HTMLElement>('[data-hero-fade]');
  const card = hero.querySelector<HTMLElement>('[data-hero-card]');

  if (reducedMotion) return;

  const chars = title ? splitText(title) : [];
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

  if (chars.length > 0) {
    tl.from(chars, {
      yPercent: 115,
      duration: 1.1,
      stagger: 0.04,
    });
  }
  if (card) {
    tl.from(card, { opacity: 0, y: 60, rotate: -4, duration: 1.2 }, 0.25);
  }
  if (fades.length > 0) {
    tl.from(fades, { opacity: 0, y: 26, duration: 0.9, stagger: 0.12 }, 0.55);
  }

  // 文字マスク（overflow hidden）用ラッパー
  title?.querySelectorAll<HTMLElement>('.word').forEach((w) => {
    w.style.overflow = 'hidden';
    w.style.verticalAlign = 'bottom';
  });

  // パララックス：カードとテキストが異なる速度で流れる
  if (card) {
    gsap.to(card, {
      yPercent: -14,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 },
    });
  }
  const heroText = hero.querySelector('.hero-text');
  if (heroText) {
    gsap.to(heroText, {
      yPercent: 10,
      opacity: 0.25,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 },
    });
  }
}

/* ==========================================================================
   VISION セクション：ピン留め＋文字のスクラブ点灯
   ========================================================================== */
function initVision() {
  const pin = document.querySelector<HTMLElement>('.vision-pin');
  if (!pin) return;

  const lines = pin.querySelectorAll<HTMLElement>('[data-scrub-text]');
  const allChars: HTMLElement[] = [];
  lines.forEach((line) => allChars.push(...splitText(line)));
  if (allChars.length === 0) return;

  if (reducedMotion) {
    allChars.forEach((c) => (c.style.opacity = '1'));
    return;
  }

  gsap.to(allChars, {
    opacity: 1,
    ease: 'none',
    stagger: 0.06,
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: '+=140%',
      pin: true,
      scrub: 0.4,
      anticipatePin: 1,
    },
  });
}

/* ==========================================================================
   ライフサイクル（Astro ClientRouter 対応）
   ========================================================================== */
const cleanups: Array<() => void> = [];

function initPage() {
  initChrome();
  initHero();
  initVision();
  initScrollAnimations();
  initTilt();
  initParticles();
  initCursor();
  ScrollTrigger.refresh();
}

function destroyPage() {
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
  destroyParticles();
  destroyCursor();
  ScrollTrigger.getAll().forEach((st) => st.kill());
}

document.addEventListener('astro:page-load', initPage);
document.addEventListener('astro:before-swap', destroyPage);
