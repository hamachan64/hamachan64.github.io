// push で新しく公開された Works を探し、X の投稿画面を開くリンク（投稿文入り）を作る
// 対象：新しく追加された作品／comingSoon: true から公開に切り替わった作品（comingSoon の作品は除く）
// 使い方: node announce-works.mjs <before-sha> <after-sha>  → 見つかった作品を JSON で標準出力へ
//        node announce-works.mjs --only <slug>             → 指定した作品だけ（既存作品のテスト・再投稿用）
import { execFileSync } from 'node:child_process';

const SITE = 'https://hamachan64.github.io';
const DIR = 'src/content/works';
const args = process.argv.slice(2);

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const show = (sha, path) => {
  try {
    return execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return undefined; // その時点ではファイルがなかった
  }
};

/** frontmatter のトップレベルの `key: value` だけを読む（配列やネストは使わないので無視） */
function frontmatter(md) {
  const block = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const data = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) data[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return data;
}

const isOpen = (data) => data.comingSoon !== 'true';

/** push の前後で、新しく公開された作品の slug を探す */
function releasedSlugs(before, after) {
  const changed = git('diff', '--name-only', '--diff-filter=AM', before, after, '--', DIR)
    .split('\n')
    .filter((p) => p.endsWith('.md'));
  return changed
    .filter((path) => {
      const prev = show(before, path);
      return isOpen(frontmatter(show(after, path))) && (prev === undefined || !isOpen(frontmatter(prev)));
    })
    .map((path) => path.split('/').pop().replace(/\.md$/, ''));
}

const slugs = args[0] === '--only' ? [args[1]] : releasedSlugs(args[0], args[1]);

const works = slugs.map((slug) => {
  const md = show('HEAD', `${DIR}/${slug}.md`);
  if (md === undefined) throw new Error(`作品が見つかりません: ${slug}`);
  const data = frontmatter(md);
  const url = `${SITE}/${slug}`;
  const text = [`新作「${data.title}」をポートフォリオに追加しました。`, data.concept, url].filter(Boolean).join('\n');
  return { title: data.title, url, text, intent: `https://x.com/intent/post?text=${encodeURIComponent(text)}` };
});

console.log(JSON.stringify(works));
