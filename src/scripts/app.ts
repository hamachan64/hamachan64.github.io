/**
 * サイト全体のモーション制御
 * - Lenis（慣性スクロール）はセッションを通して1つだけ生成する。
 * - ページ固有の処理（Glass、リビール、Works のプレビュー）は
 *   astro:page-load で初期化し、astro:before-swap で破棄する。
 */
import gsap from 'gsap';
import Lenis from 'lenis';
import { Glass, canUseGlass } from './glass';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const useGlass = !reducedMotion && canUseGlass();

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

const cleanups: Array<() => void> = [];

/* ==========================================================================
   Glass：[data-glass] の画像を WebGL で描く
   - data-glass         : ページを開いた時点で生成（Hero・作品ページのビジュアル）
   - data-glass="lazy"  : 画面に近づいたときだけ生成し、離れたら破棄する（Works の一覧）
     WebGL のコンテキストはブラウザごとに同時に持てる数が限られているため。
   ========================================================================== */
function createGlass(el: HTMLElement, intro: boolean): Glass | null {
  const focus = (el.dataset.focus || '0.5 0.5').split(/\s+/).map(Number) as [number, number];
  // 縦長の差し替え画像があれば、モバイルではそちらを使う（<picture> と同じ切り替え）
  const tall = !!el.dataset.srcTall && window.matchMedia('(max-width: 760px)').matches;
  const seam = tall ? el.dataset.seamTall : el.dataset.seam;
  try {
    return new Glass(el, {
      src: tall ? el.dataset.srcTall! : el.dataset.src!,
      focus,
      seam: seam ? Number(seam) : undefined,
      getVelocity: () => lenis?.velocity ?? 0,
      intro,
    });
  } catch (err) {
    console.warn('[glass] disabled:', err);
    return null;
  }
}

function initGlass() {
  if (!useGlass) return;

  document.querySelectorAll<HTMLElement>('[data-glass]:not([data-glass="lazy"])').forEach((el) => {
    // 登場の演出は WebGL 側で行うので、CSS のクリップは外す
    el.removeAttribute('data-clip');
    el.removeAttribute('data-manual');
    const g = createGlass(el, true);
    if (g) cleanups.push(() => g.destroy());
  });

  const lazy = document.querySelectorAll<HTMLElement>('[data-glass="lazy"]');
  if (lazy.length === 0) return;
  const live = new Map<HTMLElement, Glass>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        const el = target as HTMLElement;
        if (isIntersecting && !live.has(el)) {
          // 登場は CSS のクリップで見せ、ガラスは結像済みの状態から描く
          const g = createGlass(el, false);
          if (g) live.set(el, g);
        } else if (!isIntersecting && live.has(el)) {
          live.get(el)!.destroy();
          live.delete(el);
        }
      });
    },
    { rootMargin: '40% 0px' }
  );
  lazy.forEach((el) => io.observe(el));
  cleanups.push(() => {
    io.disconnect();
    live.forEach((g) => g.destroy());
    live.clear();
  });
}

/* ==========================================================================
   ヘッダー：下へスクロール中は隠し、戻ると出す
   ========================================================================== */
const header = document.querySelector<HTMLElement>('.header');
let lastY = window.scrollY;
window.addEventListener(
  'scroll',
  () => {
    const y = window.scrollY;
    if (header) {
      if (y > 160 && y > lastY + 4) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y <= 160) header.classList.remove('is-hidden');
    }
    lastY = y;
  },
  { passive: true }
);

/* ==========================================================================
   リビール（IntersectionObserver で .is-in を付与するだけ。動きは CSS）
   ========================================================================== */
function initReveals() {
  const targets = document.querySelectorAll<HTMLElement>('[data-lines], [data-fade], [data-clip]');
  if (reducedMotion) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
  targets.forEach((el) => {
    if (!el.hasAttribute('data-manual')) io.observe(el);
  });
  cleanups.push(() => io.disconnect());
}

/* Hero：フォントが揃ってから一斉に立ち上げる */
function initIntro() {
  const manual = document.querySelectorAll<HTMLElement>('[data-manual]');
  if (manual.length === 0) return;
  const go = () => manual.forEach((el) => el.classList.add('is-in'));
  if (reducedMotion) return go();
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(() =>
    requestAnimationFrame(go)
  );
}

/* ==========================================================================
   data-fit：見出しを親の幅いっぱいに合わせる
   ========================================================================== */
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
  cleanups.push(() => window.removeEventListener('resize', fit));
}

/* ==========================================================================
   Film：クリックまで YouTube を読み込まない
   ========================================================================== */
function initFilms() {
  document.querySelectorAll<HTMLButtonElement>('[data-film]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.film}?autoplay=1&rel=0&playsinline=1`;
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
document.addEventListener('astro:page-load', () => {
  initGlass();
  initFit();
  initReveals();
  initIntro();
  initFilms();
  lenis?.resize();
});

document.addEventListener('astro:before-swap', () => {
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
});

// 遷移前に紙面をそっと下げる
document.addEventListener('astro:before-preparation', (ev) => {
  const main = document.querySelector('main');
  if (!main || reducedMotion) return;
  const original = ev.loader;
  ev.loader = async () => {
    lenis?.stop();
    await Promise.all([original(), gsap.to(main, { opacity: 0, y: -24, duration: 0.55, ease: 'power2.in' })]);
  };
});

document.addEventListener('astro:after-swap', () => {
  lenis?.start();
  lenis?.resize();
  // Astro がスクロール位置（先頭 or 履歴の位置）を復元した後なので、Lenis をそこへ同期する
  lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
});
