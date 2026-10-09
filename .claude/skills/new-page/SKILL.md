---
name: new-page
description: サイトに新しいページ（/about や /contact のような単独ページ）を追加する。「ページを追加」「/xxx を作って」「専用ページにして」などで使う。作品の追加は new-work を使う。
---

# ページを追加する

## 0. 作る前に決める

ユーザーに確認してから作る。

- **URL**（`src/pages/<name>.astro` → `/<name>`。`build.format: 'file'` なので実体は `/<name>.html`）
- **ヘッダーのナビに載せるか**（`Works / About / Contact` の3つで、増やすとバランスが崩れる。載せないなら、どこからリンクするか）
- **トップにも同じ内容のセクションがあるか**。ある場合は About と同じく、セクションをコンポーネントにして両方から使う（`AboutSection` の `standalone` が例）。トップは変えずに専用ページだけ変えたいことが多いので、差分は `standalone` で分ける

## 1. ページの骨組み

```astro
---
import Base from '../layouts/Base.astro';
import Lines from '../components/Lines.astro';
---

<Base title="<Name> — Yuki Hamaguchi" description="<日本語で1文>">
  <main id="top">
    <section class="wrap">
      <header class="sec-head">
        <h2 class="label label-ink"><Name></h2>
        <span class="label"><補足ラベル></span>
      </header>

      <div class="grid">
        <Lines as="h1" class="statement" lines={['1行目', '2行目']} />
        <div class="jp" data-fade>…</div>
      </div>
    </section>
  </main>
</Base>

<style>
  /* このページだけのスタイル（スコープ付き）。値は global.css のトークンを使う */
</style>
```

- 必ず `Base.astro` で包み、`<main id="top">` を置く（フッターの「Back to top」が `#top` に飛ぶ）
- 固定ヘッダーの下に潜らないよう、先頭のセクションは `padding-top: var(--header-h)` 以上を取る
- 出現アニメーション: 見出しは `<Lines>`、本文や画像は `data-fade` / `data-clip`。ページを開いた瞬間に順番に出すものは `data-manual` と `style="--d: 200ms"`
- WebGL の画像（`data-glass`）を使う場合は `src/lib/images.ts` の `previewSrc()` か `getImage()` で URL を作る。1ページに即時の `data-glass` は1〜2個まで
- 既存のクラス（`.wrap` `.grid` `.label` `.label-ink` `.statement` `.jp` `.sec-head` など）を先に `global.css` で探し、同じ見た目は新しく作らない

## 2. ナビに載せる場合

`src/components/Header.astro` の `links` に追加する。現在地の印（`aria-current`）は `app.ts` の `markCurrentNav()` が URL から自動で付ける。

## 3. 確認する

1. `npm run build` が通り、`dist/<name>.html` ができていること
2. `npm run dev -- --port 4329` を起動し、Playwright MCP で `/<name>` を幅 1440px と 375px で撮る
   - ヘッダーと内容が重なっていないか
   - 出現アニメーションが終わった状態で撮る（スクロールしてから `browser_wait_for` で1秒ほど待つ）
   - 他のページからリンクで遷移してもモーションが壊れないか（ClientRouter による遷移のため、直接開いたときと挙動が違うことがある）
3. `browser_console_messages` でエラーが出ていないこと
4. 確認が終わったら開発サーバーを止める
