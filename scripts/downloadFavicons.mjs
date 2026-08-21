import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

const sourceFile = new URL("../src/data/characters.json", import.meta.url);
const outputDirectory = new URL("../static/favicon/", import.meta.url);
const assetUrl = (cid) =>
	`https://static.nanoka.cc/assets/hsr/avatarroundicon/${cid}.webp`;
const retryCount = 3;
const workerCount = 6;

const characterData = JSON.parse(await readFile(sourceFile, "utf8"));
const cids = characterData.characters.map((character) => character.cid);

await mkdir(outputDirectory, { recursive: true });

async function hasContent(file) {
	try {
		return (await stat(file)).size > 0;
	} catch {
		return false;
	}
}

async function download(cid) {
	const target = new URL(`${cid}.webp`, outputDirectory);
	if (await hasContent(target)) return { cid, status: "skipped" };

	let lastError = "未知错误";
	for (let attempt = 1; attempt <= retryCount; attempt += 1) {
		try {
			const response = await fetch(assetUrl(cid));
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const contentType = response.headers.get("content-type") ?? "";
			if (contentType && !contentType.includes("image/")) {
				throw new Error(`响应类型不是图片：${contentType}`);
			}
			const data = Buffer.from(await response.arrayBuffer());
			if (data.length === 0) throw new Error("响应内容为空");
			await writeFile(target, data);
			return { cid, status: "downloaded" };
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			if (attempt < retryCount) await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	return { cid, status: "failed", error: lastError };
}

let nextIndex = 0;
const results = [];
async function worker() {
	while (nextIndex < cids.length) {
		const index = nextIndex;
		nextIndex += 1;
		results[index] = await download(cids[index]);
		const result = results[index];
		if (result.status === "failed") {
			console.error(`下载失败 ${result.cid}：${result.error}`);
		} else {
			console.log(`${result.status === "skipped" ? "跳过" : "完成"}：${result.cid}.webp`);
		}
	}
}

await Promise.all(
	Array.from({ length: Math.min(workerCount, cids.length) }, () => worker()),
);

const failed = results.filter((result) => result.status === "failed");
const downloaded = results.filter((result) => result.status === "downloaded");
const skipped = results.filter((result) => result.status === "skipped");
console.log(
	`头像处理完成：下载 ${downloaded.length}，跳过 ${skipped.length}，失败 ${failed.length}，共 ${cids.length} 个。`,
);

if (failed.length > 0) process.exitCode = 1;
