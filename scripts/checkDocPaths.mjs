/**
 * 文档路径一致性检查脚本
 *
 * 提取 docs-for-ai/ 中所有 Markdown 里的 `src/...` / `tests/...` 路径，
 * 验证对应文件在仓库中是否存在。
 *
 * 用法: node scripts/checkDocPaths.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOCS_DIR = resolve(ROOT, "docs-for-ai");

const PATH_RE = /`([a-z][a-z0-9_./-]*\.[a-z]{2,6})`/gi;

function findMdFiles(dir) {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(resolve(dir, entry.name));
		}
	}
	return files.sort();
}

function checkDocPaths() {
	const mdFiles = findMdFiles(DOCS_DIR);
	let errors = 0;

	for (const mdFile of mdFiles) {
		const content = readFileSync(mdFile, "utf-8");
		const relName = mdFile.replace(ROOT, "").replace(/^[/\\]/, "");

		for (const match of content.matchAll(PATH_RE)) {
			const path = match[1];
			// Skip URLs, node_modules, package names
			if (path.includes("://") || path.includes("node_modules")) continue;
			if (path.startsWith("http") || path.startsWith("www")) continue;
			if (path.startsWith(".") && path.length < 4) continue;
			// Only check project-specific paths
			if (!path.startsWith("src/") && !path.startsWith("tests/") &&
			    path !== "main.go" && path !== "wails.json" && path !== "go.mod" &&
			    path !== "go.sum" && path !== "appicon.png" && path !== "build/" &&
			    path !== "package.json" && path !== "vite.config.ts" &&
			    path !== "tsconfig.json" && path !== "vitest.config.ts" &&
			    path !== "biome.json" && path !== "pnpm-lock.yaml" &&
			    path !== "index.html" && path !== "LICENSE" && path !== "README.md") {
				continue;
			}

			const fullPath = resolve(ROOT, path);
			// Accept directories (e.g., build/, docs-for-ai/)
			if (path.endsWith("/")) continue;

			if (!existsSync(fullPath)) {
				console.error(
					`${relName}: path not found: \`${path}\``,
				);
				errors++;
			}
		}
	}

	if (errors > 0) {
		console.error(`\n${errors} doc path error(s) found.`);
		process.exit(1);
	}
	console.log("All doc paths verified OK.");
}

checkDocPaths();
