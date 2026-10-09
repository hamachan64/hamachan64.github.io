// 一覧の「かざす前／後」用に、画像を 960×960 の正方形 WebP にする。
// 使い方: node .claude/skills/new-work/kazasu.mjs <入力画像> <出力.webp> [焦点x 焦点y]
//   焦点は 0〜1（省略時は中央）。例: 0.5 0.4 なら少し上寄りで切り抜く
import sharp from 'sharp';

const [input, output, fx = '0.5', fy = '0.5'] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: kazasu.mjs <input> <output.webp> [focusX focusY]');
  process.exit(1);
}

const SIZE = 960;
const img = sharp(input).rotate(); // EXIF の向きを反映
const { width, height } = await img.metadata();
const side = Math.min(width, height);
const left = Math.round((width - side) * Number(fx));
const top = Math.round((height - side) * Number(fy));

await img
  .extract({ left, top, width: side, height: side })
  .resize(SIZE, SIZE)
  .webp({ quality: 82 })
  .toFile(output);

console.log(`${output} (${SIZE}x${SIZE})`);
