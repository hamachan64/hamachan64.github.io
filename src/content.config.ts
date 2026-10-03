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
      gallery: z.array(image()).default([]),
      youtube: z.string().optional(), // YouTube 動画ID
      youtubeAspect: z.enum(['vertical', 'wide']).default('vertical'),
      comingSoon: z.boolean().default(false),
      order: z.number(),
    }),
});

export const collections = { works };
