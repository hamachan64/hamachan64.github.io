// push で新しく公開された Works を探し、X の投稿画面を開くリンク（投稿文入り）を作る
// 対象：新しく追加された作品／comingSoon: true から公開に切り替わった作品（comingSoon の作品は除く）
// 使い方: node announce-works.mjs <before-sha> <after-sha>  → 見つかった作品を JSON で標準出力へ
//        node announce-works.mjs --only <slug>             → 指定した作品だけ（既存作品のテスト・再投稿用）
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const SITE = 'https://hamachan64.github.io';
const DIR = 'src/content/works';
const LIMIT = 280; // X の文字数上限（日本語などは 1 文字 2 カウント、URL は 23 カウント）
const args = process.argv.slice(2);

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const show = (sha, path) => {
  try {
    return execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return undefined; // その時点ではファイルがなかった
  }
};

const frontmatter = (md) => yaml.load(md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '') ?? {};
const isOpen = (data) => !data.comingSoon;

/** X での文字数（twitter-text と同じく、ラテン文字や記号の一部は 1、それ以外は 2、URL は 23） */
function weightedLength(text) {
  let n = 0;
  for (const part of text.split(/(https?:\/\/\S+)/)) {
    if (/^https?:\/\//.test(part)) {
      n += 23;
      continue;
    }
    for (const ch of part) {
      const c = ch.codePointAt(0);
      const light = c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037);
      n += light ? 1 : 2;
    }
  }
  return n;
}

/**
 * 【WORKS】
 * 作品名
 *
 * 説明（post。なければ concept）
 *
 * 展示：直近の実績
 *
 * #タグ
 * URL
 */
function compose(data, url) {
  const description = (data.post ?? data.concept ?? '').trim();
  const latest = data.achievements?.[0];
  const credit = latest && (latest.kind ? `${latest.kind}：${latest.title}` : latest.title);
  const tags = (data.hashtags ?? []).map((t) => `#${String(t).replace(/^#/, '')}`).join(' ');
  const blocks = [`【WORKS】\n${data.title}`, description, credit, [tags, url].filter(Boolean).join('\n')];
  return blocks.filter(Boolean).join('\n\n');
}

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
  const path = `${DIR}/${slug}.md`;
  if (!existsSync(path)) throw new Error(`作品が見つかりません: ${slug}`);
  const data = frontmatter(readFileSync(path, 'utf8'));
  const url = `${SITE}/${slug}`;
  const text = compose(data, url);
  const length = weightedLength(text);
  return {
    title: data.title,
    url,
    text,
    length,
    over: length > LIMIT,
    intent: `https://x.com/intent/post?text=${encodeURIComponent(text)}`,
  };
});

console.log(JSON.stringify(works));
