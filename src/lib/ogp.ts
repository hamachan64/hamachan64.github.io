const cache = new Map<string, Promise<string | undefined>>();

const meta = (html: string, key: string) => {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i'))?.[0];
  return tag?.match(/content=["']([^"']+)["']/i)?.[1];
};

async function load(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; portfolio-build)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const raw = meta(html, 'og:image') ?? meta(html, 'twitter:image');
    if (!raw) return undefined;
    const img = new URL(raw.replace(/&amp;/g, '&'), res.url).href;
    if (!img.startsWith('https:') || /\.svg(\?|$)/i.test(img)) return undefined;
    // 実際に画像として取得できるものだけ採用（ビルドが落ちないように）
    const head = await fetch(img, { signal: AbortSignal.timeout(8000) });
    return head.ok && head.headers.get('content-type')?.startsWith('image/') ? img : undefined;
  } catch {
    return undefined;
  }
}

/** リンク先の OGP 画像 URL。取得できなければ undefined（呼び出し側で手動画像 → 文字のみに切り替える） */
export function ogImage(url: string) {
  if (!cache.has(url)) cache.set(url, load(url));
  return cache.get(url)!;
}
