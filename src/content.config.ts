import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const works = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/works' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().nullish().transform((v) => v ?? ''), // 英語タイトル（空でも可）
      concept: z.string().optional(), // 日本語コンセプト（カード・詳細見出しに使用）
      conceptEn: z.string().optional(),
      // X の新作告知ポスト用（.github/scripts/announce-works.mjs）
      post: z.string().optional(), // 説明 2〜3 行。なければ concept を使う
      hashtags: z.array(z.string()).default([]), // 例: [AR, XR]（# は不要）
      role: z.string().optional(),
      tech: z.string().optional(),
      year: z.string().optional(),
      cover: image().optional(),
      card: image().optional(), // 一覧と作品ページのビジュアルに使う画像。未指定なら cover
      cardFocus: z.string().default('0.5 0.5'), // トリミングの焦点 "x y"（0〜1）
      // 一覧の「かざす前／かざした後」（正方形）
      before: image().optional(),
      after: image().optional(),
      medium: z.string().optional(), // 物 → 端末（例：名刺 → スマートフォン）
      gallery: z.array(image()).default([]),
      youtube: z.string().optional(), // YouTube 動画ID
      youtubeAspect: z.enum(['vertical', 'wide']).default('vertical'),
      // 受賞・展示・掲載などの実績（新しい順に書く）
      achievements: z
        .array(
          z.object({
            date: z.string(), // 例: "2026.05"
            title: z.string(),
            kind: z.string().optional(), // 例: 展示 / 受賞 / 掲載
            url: z.string().url().optional(), // イベントページ・記事など。あればリンク先の OGP 画像をサムネイルにする
            image: image().optional(), // OGP が取れないときの手動サムネイル。なければ文字だけ
          })
        )
        .default([]),
      // シリーズの特設ページ（例: immersnap → /immersnap）にまとめる作品
      series: z.enum(['immersnap']).optional(),
      // 特設ページでの展示ごとの紹介。比較表にも使う
      edition: z
        .object({
          name: z.string(), // 特設ページでの呼び名（例: NoMaps）
          venue: z.string(), // 会場・イベント名
          place: z.string().optional(), // 都市など
          lead: z.string(), // 1〜2 文の紹介
          leadEn: z.string().optional(),
          draw: z.string(), // 何で描くか
          appear: z.string(), // どこに現れるか
          keep: z.string(), // どう持ち帰るか
        })
        .optional(),
      comingSoon: z.boolean().default(false),
      order: z.number(),
    }),
});

// シリーズの特設ページ（例: /immersnap）全体の情報。本文はコンセプト文
const series = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/series' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string(), // 例: Interactive AR Photo Experience
      catch: z.array(z.string()), // ヒーローのキャッチ（1 要素 = 1 行）
      statement: z.array(z.string()), // Concept の見出し（1 要素 = 1 行）
      description: z.string(), // 検索結果・SNS シェア用の説明文
      keyVisual: image(),
      keyVisualCaption: z.string().optional(),
      // 体験の流れ（展示が変わっても共通のもの）
      stepsTitle: z.array(z.string()),
      steps: z.array(z.object({ en: z.string(), jp: z.string(), body: z.string(), bodyEn: z.string().optional() })),
      // 実績・展示歴（古い順に書く）
      achievements: z
        .array(
          z.object({
            date: z.string(), // 例: "2026.12"
            title: z.string(),
            kind: z.string().optional(), // 例: 展示 / 採択
            url: z.string().url().optional(),
          })
        )
        .default([]),
      // 動画（上から順に並ぶ）
      films: z
        .array(
          z.object({
            youtube: z.string(), // YouTube 動画ID
            title: z.string(),
            aspect: z.enum(['wide', 'vertical']).default('wide'),
            poster: image().optional(), // なければ YouTube のサムネイル
          })
        )
        .default([]),
    }),
});

export const collections = { works, series };
