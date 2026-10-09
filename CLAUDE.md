# hamachan64.github.io

Yuki Hamaguchi（XR エンジニア／クリエイター）のポートフォリオサイト。Astro 5 の静的サイトを GitHub Pages で公開している。

## コマンド

- `npm run dev` — 開発サーバー（既定ポート 4321。Claude が確認に使うときは `npm run dev -- --port 4329`）
- `npm run build` — 本番ビルド（`dist/` に出力、数秒で終わる）。作業の区切りでは必ず通すこと
- デプロイ: `main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）でビルド・公開される。`main` へ直接 push しない。ブランチ → PR → マージ

## 構成

- `src/pages/` — ルーティング。`[slug].astro` が作品詳細（`/project01` など）
- `src/content/works/*.md` — 作品データ（Content Collections）。スキーマは `src/content.config.ts`
- `src/layouts/Base.astro` — 全ページ共通の head / Header / Footer / スクリプト読み込み
- `src/components/` — セクション単位のコンポーネント（`AboutSection` は `standalone` で専用ページにも使う）
- `src/scripts/app.ts` — Lenis・GSAP によるモーションとページ遷移。`glass.ts` は OGL（WebGL）の画像表現
- `src/styles/global.css` — トークン（色・フォント・余白・イージング）と共通クラス
- `assets/images/works/NN/` — 作品画像。`assets/images/works/kazasu/` は一覧の「かざす前／後」の正方形画像

### 触らないもの

- ルート直下の `index.html` / `project0X.html` / `style.css` / `script.js` は旧サイトの残骸で、ビルドには使われていない。編集しない
- `astro.config.mjs` の `build.format: 'file'` は旧 URL（`/project01.html`）を維持するための設定。変えない

## 実装のルール

- ページは必ず `Base.astro` で包む。`<main id="top">` を置く
- 出現アニメーションは属性で付ける（`app.ts` が拾う）: `data-fade`（フェード）、`data-clip`（画像のクリップ）、`<Lines>` コンポーネント（見出しの行ごとの出現）。`data-manual` はページ読み込み時に順番に出すもの、`style="--d: 200ms"` で遅延
- WebGL で描く画像は `data-glass`（即時）か `data-glass="lazy"`（一覧など、近づいたときだけ生成）。画像 URL は `src/lib/images.ts` の `previewSrc()` で作る。WebGL のコンテキスト数には上限があるので、1ページに即時の `data-glass` を増やしすぎない
- ページ遷移は `astro:transitions` の ClientRouter。ページ固有の処理は `astro:page-load` で初期化し `astro:before-swap` で破棄する（`app.ts` の `cleanups` に積む）
- `prefers-reduced-motion` のときはモーションと WebGL を切る前提で、それでも内容が読めること
- 色・フォント・余白は `global.css` のトークン（`--paper` `--ink` `--mute` `--line` `--f-sans` `--f-jp` `--f-min` `--margin` `--gutter` `--ease-out` など）を使い、値を直書きしない
- レイアウトは `.wrap.grid`（12 カラム、760px 以下は 4 カラム）。ブレークポイントは 1100px と 760px、タッチ端末は `(hover: none)`
- コンポーネント固有のスタイルは `.astro` 内の `<style>`（スコープ付き）に書く

## デザインの方向性

- 紙（`--paper`）とモノクロ写真＝現実が基調。**色は、仮想（鏡像・かざした後）に触れたときの光のにじみにだけ現れる**
- エディトリアルな組版。大きな余白、細い罫線、ラベルは小さな欧文
- 書体: 欧文 Archivo（長体）、和文本文 Zen Kaku Gothic New、ステートメント Zen Old Mincho
- やらないこと: ネオン・グラデーションの多用、角丸カード＋影の「よくある AI っぽい」UI、絵文字、汎用アイコンの羅列
- 文言は日本語が主、英語は補足（`subtitle` / `conceptEn` / `.prose-en`）

## 画像

- 作品画像は `astro:assets` がビルド時に WebP へ最適化するので、公開サイトの重さは気にしなくてよい。ただしリポジトリが肥大化するため、**元画像は長辺 2400px・3MB 程度まで縮めてから置く**（macOS なら `sips -Z 2400 <file>`）
- HEIC は Astro（sharp）で読めないので JPG に変換する（`sips -s format jpeg in.heic --out out.jpg`）
- 動画はリポジトリに置かず YouTube（frontmatter の `youtube`）を使う

## 確認のしかた

- UI を変えたら、開発サーバーを開いて Playwright MCP で **幅 1440px と 375px** のスクリーンショットを撮って確認する。ホバー・スクロール後の状態が肝の演出は、その操作をしてから撮る
- スクリーンショットはコンテキストを多く使うので、変更箇所に絞って撮る。全ページ巡回は頼まれたときだけ
- Astro の API で迷ったら、記憶ではなく Astro Docs MCP で現行ドキュメントを確認する（Astro 5 の Content Layer は古い書き方と違う）

## Git

- コミットメッセージは日本語で、何をなぜ変えたかを1行目に（例:「Works を作品ごとに画像を見せるレイアウトに変更」）
- デザインの試作は `design/<名前>` ブランチで行う
- PR を作る前に `/security-review` を実行し、指摘があれば直すか、直さない理由を PR に書く。公開リポジトリなので、秘密情報（API キー、`.env`、個人のメールアドレス以外の連絡先など）を含めない
