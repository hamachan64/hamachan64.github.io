// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hamachan64.github.io',
  // 旧サイトの projectNN.html 形式のURLを維持するため file 形式で出力
  // リンク先の OGP 画像をビルド時に取り込んで最適化するため、https の外部画像を許可
  image: {
    remotePatterns: [{ protocol: 'https' }],
  },
  build: {
    format: 'file',
  },
});
