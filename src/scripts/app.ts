/**
 * サイト全体のモーション制御
 * - Lenis（慣性スクロール）と WebGL カードはセッションを通して1つだけ生成し、
 *   Astro の ClientRouter でページが切り替わってもそのまま生き続ける。
 * - ページ固有の処理は astro:page-load で初期化、astro:before-swap で破棄する。
 */
import gsap from 'gsap';
import Lenis from 'lenis';
import { SpatialCard, supportsWebGL } from './card-gl';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* ==========================================================================
   Lenis
   ========================================================================== */
let lenis: Lenis | null = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

document.addEventListener('click', (e) => {
  const link = (e.target as Element).closest?.('a[href*="#"]') as HTMLAnchorElement | null;
  if (!link) return;
  const url = new URL(link.href, location.href);
  if (url.pathname !== location.pathname || !url.hash) return;
  const target = document.querySelector<HTMLElement>(url.hash);
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else target.scrollIntoView();
  history.replaceState(null, '', url.hash);
});

/* ==========================================================================
   WebGL カード
   ========================================================================== */
let card: SpatialCard | null = null;
const canvas = document.getElementById('gl') as HTMLCanvasElement | null;

if (canvas && supportsWebGL()) {
  try {
    card = new SpatialCard(canvas, {
      reducedMotion,
      getVelocity: () => lenis?.velocity ?? 0,
    });
    gsap.ticker.add(() => card!.render(performance.now()));
  } catch (err) {
    console.warn('[card] WebGL disabled:', err);
    card = null;
  }
}

/* ==========================================================================
   リビール（IntersectionObserver で .is-in を付与するだけ。動きは CSS）
   ========================================================================== */
let io: IntersectionObserver | null = null;

function initReveals() {
  const targets = document.querySelectorAll<HTMLElement>('[data-lines], [data-fade], [data-clip]');
  if (reducedMotion) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io?.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 }
  );
  targets.forEach((el) => {
    if (el.hasAttribute('data-manual')) return;
    io!.observe(el);
  });
}

/* ==========================================================================
   Hero：フォントが揃ってから一斉に立ち上げる
   ========================================================================== */
function initHero() {
  const manual = document.querySelectorAll<HTMLElement>('[data-manual]');
  if (manual.length === 0) {
    card?.intro(0.1);
    return;
  }
  const go = () => {
    manual.forEach((el) => el.classList.add('is-in'));
    card?.intro(0.35);
  };
  if (reducedMotion) return go();
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(() =>
    requestAnimationFrame(go)
  );
}

/* ==========================================================================
   Hero 写真：鏡像側のホロがカーソルに追従（触れていない間はゆっくり漂う）
   ========================================================================== */
let photoCleanup: (() => void) | null = null;

function initHeroPhoto() {
  const photo = document.querySelector<HTMLElement>('[data-hero-photo]');
  const foil = photo?.querySelector<HTMLElement>('.hero-photo-foil');
  if (!photo || !foil || reducedMotion) return;

  const pos = { x: 70, y: 40 };
  const target = { x: 70, y: 40 };
  let hovering = false;

  const onMove = (e: PointerEvent) => {
    const r = foil.getBoundingClientRect();
    hovering = true;
    target.x = ((e.clientX - r.left) / r.width) * 100;
    target.y = ((e.clientY - r.top) / r.height) * 100;
  };
  const onLeave = () => (hovering = false);
  const tick = () => {
    if (!hovering) {
      const t = performance.now() / 1000;
      target.x = 55 + Math.sin(t * 0.35) * 30;
      target.y = 40 + Math.cos(t * 0.27) * 22;
    }
    pos.x += (target.x - pos.x) * 0.07;
    pos.y += (target.y - pos.y) * 0.07;
    foil.style.setProperty('--mx', `${pos.x.toFixed(2)}%`);
    foil.style.setProperty('--my', `${pos.y.toFixed(2)}%`);
  };
  photo.addEventListener('pointermove', onMove);
  photo.addEventListener('pointerleave', onLeave);
  gsap.ticker.add(tick);
  photoCleanup = () => {
    photo.removeEventListener('pointermove', onMove);
    photo.removeEventListener('pointerleave', onLeave);
    gsap.ticker.remove(tick);
  };
}

/* ==========================================================================
   data-fit：見出しを親の幅いっぱいに合わせる
   ========================================================================== */
let fitCleanup: (() => void) | null = null;

function initFit() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-fit]'));
  if (els.length === 0) return;
  const fit = () => {
    els.forEach((el) => {
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize);
      const avail = el.clientWidth;
      el.style.width = 'max-content';
      const natural = el.getBoundingClientRect().width;
      el.style.width = '';
      if (natural > 0) el.style.fontSize = `${(base * avail) / natural}px`;
    });
  };
  fit();
  document.fonts.ready.then(fit);
  window.addEventListener('resize', fit);
  fitCleanup = () => window.removeEventListener('resize', fit);
}

/* ==========================================================================
   Works インデックス：行ホバー / スクロール位置でカードの絵柄を切り替え
   ========================================================================== */
let worksCleanup: (() => void) | null = null;

function initWorks() {
  const list = document.querySelector<HTMLElement>('[data-works]');
  const anchor = document.querySelector<HTMLElement>('[data-works-card]');
  if (!list || !anchor) return;
  const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-row]'));
  const fallbackImg = anchor.querySelector('img');
  let hovering = false;
  let current: HTMLElement | null = null;

  const activate = (row: HTMLElement) => {
    if (row === current) return;
    current = row;
    rows.forEach((r) => r.classList.toggle('is-active', r === row));
    const src = row.dataset.cardPreload;
    if (src) {
      delete anchor.dataset.face;
      anchor.dataset.src = src;
      anchor.dataset.focus = row.dataset.focus || '0.5 0.5';
      if (fallbackImg) fallbackImg.src = src;
    } else {
      anchor.dataset.face = 'back';
    }
  };

  const onEnter = (e: Event) => {
    hovering = true;
    list.classList.add('is-hovering');
    activate(e.currentTarget as HTMLElement);
  };
  const onLeaveList = () => {
    hovering = false;
    list.classList.remove('is-hovering');
  };
  rows.forEach((r) => {
    r.addEventListener('pointerenter', onEnter);
    r.addEventListener('focus', onEnter);
  });
  list.addEventListener('pointerleave', onLeaveList);

  // ホバーしていない間は、画面中央に最も近い行をアクティブに
  const onScroll = () => {
    if (hovering) return;
    const mid = window.innerHeight * 0.5;
    let best = rows[0];
    let bestD = Infinity;
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      const d = Math.abs(b.top + b.height / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    activate(best);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  worksCleanup = () => {
    window.removeEventListener('scroll', onScroll);
    list.removeEventListener('pointerleave', onLeaveList);
  };
}

/* ==========================================================================
   Film：クリックまで YouTube を読み込まない
   ========================================================================== */
function initFilms() {
  document.querySelectorAll<HTMLButtonElement>('[data-film]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const id = btn.dataset.film!;
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
        iframe.title = btn.getAttribute('aria-label') || 'Film';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        btn.parentElement!.classList.add('is-playing');
        btn.replaceWith(iframe);
      },
      { once: true }
    );
  });
}

/* ==========================================================================
   ページのライフサイクル
   ========================================================================== */
function initPage() {
  card?.scan();
  initFit();
  initReveals();
  initHero();
  initHeroPhoto();
  initWorks();
  initFilms();
  lenis?.resize();
  if (card) root.classList.add('gl-ready');
}

function destroyPage() {
  io?.disconnect();
  io = null;
  worksCleanup?.();
  worksCleanup = null;
  fitCleanup?.();
  fitCleanup = null;
  photoCleanup?.();
  photoCleanup = null;
}

document.addEventListener('astro:page-load', initPage);
document.addEventListener('astro:before-swap', destroyPage);

// 遷移前に紙面をそっと下げる（カードは残って次のページへ移動する）
document.addEventListener('astro:before-preparation', (ev) => {
  const main = document.querySelector('main');
  if (!main || reducedMotion) return;
  const original = ev.loader;
  ev.loader = async () => {
    lenis?.stop();
    await Promise.all([
      original(),
      gsap.to(main, { opacity: 0, y: -24, duration: 0.55, ease: 'power2.in' }),
    ]);
  };
});

document.addEventListener('astro:after-swap', () => {
  lenis?.start();
  lenis?.resize();
  // Astro がスクロール位置（先頭 or 履歴の位置）を復元した後なので、Lenis をそこへ同期する
  lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
});
