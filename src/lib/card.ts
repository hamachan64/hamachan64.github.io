import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/** WebGL カードのテクスチャ用 URL（どのページでも同じ URL になるよう設定を固定） */
export async function cardSrc(img: ImageMetadata): Promise<string> {
  const r = await getImage({ src: img, width: Math.min(900, img.width), format: 'webp', quality: 82 });
  return r.src;
}
