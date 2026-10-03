import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const works = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/works' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string(), // 英語タイトル
      concept: z.string().optional(), // 日本語コンセプト（カード・詳細見出しに使用）
      conceptEn: z.string().optional(),
      role: z.string().optional(),
      tech: z.string().optional(),
      year: z.string().optional(),
      cover: image().optional(),
      card: image().optional(), // 一覧と作品ページのビジュアルに使う画像。未指定なら cover
      cardFocus: z.string().default('0.5 0.5'), // トリミングの焦点 "x y"（0〜1）
      // 一覧の「かざす前／かざした後」（正方形）。target はかざす前の写真の中の物の矩形 "x y w h"（%）
      before: image().optional(),
      after: image().optional(),
      target: z.string().optional(),
      medium: z.string().optional(), // 物 → 端末（例：名刺 → スマートフォン）
      gallery: z.array(image()).default([]),
      youtube: z.string().optional(), // YouTube 動画ID
      youtubeAspect: z.enum(['vertical', 'wide']).default('vertical'),
      comingSoon: z.boolean().default(false),
      order: z.number(),
    }),
});

export const collections = { works };
