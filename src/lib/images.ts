import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/** WebGL のテクスチャ／プレビュー用の画像 URL（ページをまたいで同じ URL になるよう設定を固定） */
export async function previewSrc(img: ImageMetadata): Promise<string> {
  const r = await getImage({ src: img, width: Math.min(1800, img.width), format: "webp", quality: 80 });
  return r.src;
}
