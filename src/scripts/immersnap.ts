/**
 * IMMERSNAP 特設ページ
 * - 背景：キービジュアルの「星座の光」と「舞う花びら」を canvas で描く
 * - スクロールで要素を出す（[data-rv]）
 * - Film はクリックされるまで YouTube を読み込まない
 */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================================
   Sky：星座と花びら
   ========================================================================== */
type Star = { x: number; y: number; vx: number; vy: number; r: number; z: number; tw: number; ring: boolean };
type Petal = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; ph: number; z: number };

function sky(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let stars: Star[] = [];
  let petals: Petal[] = [];
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    const area = (w * h) / (1440 * 900);
    const nStars = Math.round(Math.min(130, Math.max(46, 110 * area)));
    const nPetals = Math.round(Math.min(34, Math.max(12, 26 * area)));
    stars = Array.from({ length: nStars }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-0.12, 0.12),
      vy: rand(-0.08, 0.08),
      r: rand(0.6, 1.9),
      z: rand(0.3, 1),
      tw: rand(0, Math.PI * 2),
      ring: Math.random() < 0.12,
    }));
    petals = Array.from({ length: nPetals }, () => newPetal(true));
  }

  function newPetal(anywhere: boolean): Petal {
    const z = rand(0.35, 1);
    return {
      x: rand(-40, w + 40),
      y: anywhere ? rand(0, h) : rand(-60, -20),
      vx: rand(0.1, 0.5),
      vy: rand(0.25, 0.7) * z,
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.012, 0.012),
      s: rand(7, 14) * z,
      ph: rand(0, Math.PI * 2),
      z,
    };
  }

  function draw(t: number) {
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    ctx!.clearRect(0, 0, w, h);

    // 星：ゆっくり漂い、近い星どうしを細い線で結ぶ
    const pos = stars.map((s) => {
      if (!reduced) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -20) s.x = w + 20;
        if (s.x > w + 20) s.x = -20;
        if (s.y < -20) s.y = h + 20;
        if (s.y > h + 20) s.y = -20;
      }
      return { x: s.x + pointer.x * 18 * s.z, y: s.y + pointer.y * 18 * s.z };
    });

    const max = Math.min(150, Math.max(100, w * 0.09));
    ctx!.lineWidth = 0.6;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 > max * max) continue;
        const a = (1 - Math.sqrt(d2) / max) * 0.32;
        ctx!.strokeStyle = `rgba(110, 140, 255, ${a})`;
        ctx!.beginPath();
        ctx!.moveTo(pos[i].x, pos[i].y);
        ctx!.lineTo(pos[j].x, pos[j].y);
        ctx!.stroke();
      }
    }

    stars.forEach((s, i) => {
      const { x, y } = pos[i];
      const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.0016 + s.tw);
      if (s.ring) {
        ctx!.strokeStyle = `rgba(150, 185, 255, ${0.5 * tw})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
        ctx!.stroke();
        return;
      }
      const g = ctx!.createRadialGradient(x, y, 0, x, y, s.r * 7);
      g.addColorStop(0, `rgba(170, 200, 255, ${0.55 * tw})`);
      g.addColorStop(1, 'rgba(70, 110, 255, 0)');
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(x, y, s.r * 7, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = `rgba(235, 242, 255, ${0.95 * tw})`;
      ctx!.beginPath();
      ctx!.arc(x, y, s.r, 0, Math.PI * 2);
      ctx!.fill();
    });

    // 花びら：ゆらぎながら右下へ流れる
    petals.forEach((p, i) => {
      if (!reduced) {
        p.x += p.vx + Math.sin(t * 0.001 + p.ph) * 0.35;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > h + 40 || p.x > w + 60) petals[i] = newPetal(false);
      }
      const x = p.x + pointer.x * 30 * p.z;
      const y = p.y + pointer.y * 30 * p.z;
      const flip = Math.abs(Math.sin(t * 0.0012 + p.ph)) * 0.6 + 0.4;
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(p.rot);
      ctx!.scale(1, reduced ? 0.7 : flip);
      ctx!.fillStyle = `rgba(246, 196, 226, ${0.45 + 0.4 * p.z})`;
      ctx!.beginPath();
      ctx!.moveTo(0, -p.s);
      ctx!.quadraticCurveTo(p.s * 0.95, -p.s * 0.1, 0, p.s);
      ctx!.quadraticCurveTo(-p.s * 0.95, -p.s * 0.1, 0, -p.s);
      ctx!.fill();
      ctx!.restore();
    });
  }

  let raf = 0;
  let visible = true;
  const loop = (t: number) => {
    draw(t);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (reduced) return draw(0);
    if (!raf && visible) raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  resize();
  start();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      if (reduced) draw(0);
    }, 150);
  });
  window.addEventListener('pointermove', (e) => {
    pointer.tx = e.clientX / w - 0.5;
    pointer.ty = e.clientY / h - 0.5;
  });
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) start();
    else stop();
  });
}

const canvas = document.querySelector<HTMLCanvasElement>('[data-sky]');
if (canvas) sky(canvas);

/* ==========================================================================
   Reveal
   ========================================================================== */
const rv = document.querySelectorAll<HTMLElement>('[data-rv]');
if (reduced || !('IntersectionObserver' in window)) {
  rv.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -12% 0px' }
  );
  rv.forEach((el) => io.observe(el));
}

/* ==========================================================================
   Film
   ========================================================================== */
document.querySelectorAll<HTMLButtonElement>('[data-film]').forEach((btn) => {
  btn.addEventListener(
    'click',
    () => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.film}?autoplay=1&rel=0&playsinline=1`;
      iframe.title = btn.getAttribute('aria-label') ?? 'Film';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      btn.replaceWith(iframe);
    },
    { once: true }
  );
});
