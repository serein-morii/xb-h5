#!/usr/bin/env node
/* 构建产物自检：发布前抓「minifier 变量遮蔽 / chunk 引用悬空」类白屏问题。
 * 用法：node scripts/check-dist.mjs [distDir]
 * 检查项：
 *   1) entry chunk 的 createRoot 调用绑定未被同名 function 遮蔽
 *   2) 所有 chunk 里 __vite__mapDeps 引用的静态资源都存在
 *   3) index.html 引用的 entry/css 存在
 * 任一失败 exit 1。 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] || join(process.cwd(), "dist");
const assets = join(dist, "assets");
if (!existsSync(assets)) { console.error(`check-dist: ${assets} 不存在`); process.exit(1); }

const errors = [];
const files = readdirSync(assets).filter(f => f.endsWith(".js"));
const read = f => readFileSync(join(assets, f), "utf8");

/* 1) createRoot 绑定遮蔽检测：调用 `(0,X.createRoot)` 时，X 不得是本 chunk 内的 function 声明 */
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/\(0,(\w+)\.createRoot\)/g)) {
    const binding = m[1];
    // 绑定若是本 chunk 的顶层 function 声明 → 会被遮蔽（react-dom 只能来自 import）
    const shadowRe = new RegExp(`function ${binding}\\s*\\(`);
    if (shadowRe.test(src)) {
      errors.push(`${f}: createRoot 绑定 "${binding}" 被本 chunk 的 function 声明遮蔽（白屏模式，参照 2026-11-05 事故）`);
    }
  }
  // createRoot 必须经某 import 到达：本 chunk 有 createRoot 调用却没有任何 import → 必炸
  if (/\w+\.createRoot\(/.test(src) && !/import\s*\{/.test(src)) {
    errors.push(`${f}: 调用 createRoot 但 chunk 内没有任何 import（react-dom 缺失）`);
  }
}

/* 2) mapDeps / 字符串引用的 assets 是否齐全 */
const known = new Set(files);
for (const f of readdirSync(assets).filter(f => f.endsWith(".css"))) known.add(f);
let checked = 0;
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/"assets\/([A-Za-z0-9._-]+\.(?:js|css))"/g)) {
    checked += 1;
    if (!known.has(m[1])) errors.push(`${f}: 引用 assets/${m[1]} 不存在于产物`);
  }
}

/* 3) index.html 的入口引用 */
const html = readFileSync(join(dist, "index.html"), "utf8");
for (const m of html.matchAll(/(?:src|href)="(\/?assets\/[^"]+)"/g)) {
  const p = m[1].replace(/^\//, "");
  checked += 1;
  if (!existsSync(join(dist, p))) errors.push(`index.html: 引用 ${p} 不存在`);
}

console.log(`check-dist: ${files.length} chunks, ${checked} 个跨引用已核对`);
if (errors.length) {
  console.error(errors.map(e => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("check-dist: 通过");
