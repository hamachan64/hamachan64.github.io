---
name: new-work
description: ポートフォリオに作品（Works）を1件追加する、または制作中の作品を公開状態にする。assets/images/works/NN/ に画像が置かれたとき、「作品を追加」「projectNN を作って」「Coming soon を外して」などで使う。画像の下ごしらえ、src/content/works/projectNN.md の作成、ビルドと画面での確認まで行う。
---

# 作品を追加する

作品は `src/content/works/projectNN.md`（Content Collections）で管理している。ページ（`/projectNN`）、Works 一覧、トップは md から自動で生成されるので、**コンポーネントやページは編集しない**。スキーマは `src/content.config.ts` が正。

## 1. 情報を集める

まず次を確認する。分からない項目は推測で埋めずにユーザーに聞く（`role` や `year` を作らない）。

| 項目 | 必須 | 内容 |
|---|---|---|
| 番号 NN | ○ | 既存の最大 `order` + 1 が基本。`assets/images/works/NN/` の番号と合わせる |
| `title` | ○ | 日本語タイトル |
| `subtitle` | ○ | 英語タイトル |
| `concept` / `conceptEn` | | 一文のコンセプト（日・英） |
| `role` / `tech` / `year` | | 例: `Director / Engineer`、`Unity / WebAR`、`"2026"`（year は文字列） |
| `medium` | | 「物 → 端末」（例: `名刺 → スマートフォン`） |
| `youtube` / `youtubeAspect` | | 動画 ID と `vertical`（縦）か `wide`（横） |
| 本文 | | 日本語の説明。英語は `<div class="prose-en">` で囲む |

画像や本文がまだなら、`comingSoon: true` で枠だけ作る（`project07.md` が例）。

## 2. 画像を下ごしらえする

`assets/images/works/NN/` の中身を確認してから:

1. **HEIC は JPG に変換**（sharp は HEIC を読めない）: `sips -s format jpeg IMG_0001.HEIC --out NN-01.jpg`
2. **長辺 2400px より大きい、または 3MB を超える画像は縮める**: `sips -Z 2400 <file>`
3. **名前を `NN-01.jpg`, `NN-02.jpg` … に揃える**（並び順はユーザーに確認）。元のファイル名を変えるので、変える前に対応表を示す
4. 動画はリポジトリに置かない（YouTube を使う）

### かざす前／後（一覧の正方形画像）

Works 一覧は「かざす前（物だけ）」と「かざした後（AR が出ている）」の2枚を並べる。用意されていれば、960×960 の WebP にする。

```bash
node .claude/skills/new-work/kazasu.mjs <かざす前の画像> assets/images/works/kazasu/NN-before.webp 0.5 0.5
node .claude/skills/new-work/kazasu.mjs <かざした後の画像> assets/images/works/kazasu/NN-after.webp 0.5 0.5
```

末尾の2つの数字は切り抜きの焦点（0〜1）。主役が切れていたら調整する。素材がなければ `before` / `after` は省略してよい。

## 3. md を書く

既存の `project06.md` に倣う。画像パスは md からの相対パス（`../../../assets/images/works/NN/NN-01.jpg`）。

- `cover`: 代表画像。`card`: 一覧と作品ページのメインビジュアル（省略すると `cover`）
- `cardFocus`: メインビジュアルを切り抜くときの焦点 `"x y"`。人物や物が中央にない画像は調整する
- `gallery`: 詳細ページ下部に並べる画像（4枚周期で配置が変わる）
- `order`: 並び順。既存と重複させない

## 4. 確認する

1. `npm run build` が通ること
2. `npm run dev -- --port 4329` を起動し、Playwright MCP で次を確認する
   - `/projectNN` を幅 1440px と 375px で（メインビジュアルの切り抜き、タイトルの改行、ギャラリー）
   - `/works` で新しい作品の行。PC は画像（または索引の行）にマウスを乗せると「かざした後」に切り替わるので、`browser_hover` してから撮る。タッチ端末では画面中央を通過した作品が切り替わるが、Playwright で幅を 375px にしただけではマウス扱いのままなので、この挙動は再現されない
3. `cardFocus` や `kazasu.mjs` の焦点がずれていれば直して、撮り直す
4. 確認が終わったら開発サーバーを止める

最後に、追加・変換したファイルの一覧と、ユーザーに確認してほしい点（推測で決めた並び順や焦点など）を短く報告する。
