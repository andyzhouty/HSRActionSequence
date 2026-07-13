import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(__dirname, '..', 'docs-for-ai');
const OUTPUT_FILE = resolve(DOCS_DIR, '星铁排轴器文档.md');

// 1. 读取所有 markdown 文件并按编号排序
const files = readdirSync(DOCS_DIR)
  .filter(f => f.endsWith('.md') && f !== '星铁排轴器文档.md')
  .map(f => {
    const match = f.match(/^(\d+)/);
    return { file: f, num: match ? Number(match[1]) : 999 };
  })
  .sort((a, b) => a.num - b.num);

console.log('合并顺序：', files.map(f => f.file).join(' → '));

// 2. 合并并降级标题
const parts = ['# 星铁排轴器文档\n'];

for (const { file } of files) {
  const content = readFileSync(resolve(DOCS_DIR, file), 'utf-8');
  const demoted = content
    .split('\n')
    .map(line => {
      // 将标题降一级：# → ##, ## → ###, …
      if (/^#{1,6}\s/.test(line)) {
        return '#' + line;
      }
      return line;
    })
    .join('\n');

  parts.push(`\n<!-- 来自 ${file} -->\n${demoted}`);
}

writeFileSync(OUTPUT_FILE, parts.join(''), 'utf-8');
console.log(`✅ 合并完成：${OUTPUT_FILE}`);
