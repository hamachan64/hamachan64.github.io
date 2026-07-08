// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hamachan64.github.io',
  // 旧サイトの projectNN.html 形式のURLを維持するため file 形式で出力
  build: {
    format: 'file',
  },
});
