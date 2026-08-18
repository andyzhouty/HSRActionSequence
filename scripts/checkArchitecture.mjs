import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);

async function collectSourceFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
		else if (sourceExtensions.has(extname(entry.name))) files.push(path);
	}
	return files;
}

const rules = [
	{
		root: "src/domain",
		forbiddenDirectories: ["src/components", "src/simulate", "src/infrastructure"],
		forbiddenPackages: ["react", "../utils/backend", "../../utils/backend"],
	},
	{
		root: "src/data",
		forbiddenDirectories: ["src/components", "src/pages", "src/simulate"],
		forbiddenPackages: ["react"],
	},
	{
		root: "src/simulate",
		forbiddenDirectories: ["src/components", "src/pages", "src/infrastructure"],
		forbiddenPackages: ["react", "../utils/backend", "../../utils/backend"],
	},
	{
		root: "src/infrastructure",
		forbiddenDirectories: ["src/components", "src/pages", "src/simulate"],
		forbiddenPackages: ["react"],
	},
];

const violations = [];
for (const file of await collectSourceFiles(sourceRoot)) {
	const relativeFile = relative(root, file).replaceAll("\\", "/");
	const rule = rules.find(({ root: ruleRoot }) => relativeFile.startsWith(ruleRoot));
	if (!rule) continue;
	const source = await readFile(file, "utf8");
	const imports = [
		...source.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/g),
	].map((match) => match[2]);
	for (const specifier of imports) {
		const resolved = specifier.startsWith(".")
			? relative(root, resolve(dirname(file), specifier)).replaceAll("\\", "/")
			: specifier;
		const blockedDirectory = rule.forbiddenDirectories.find(
			(directory) => resolved === directory || resolved.startsWith(`${directory}/`),
		);
		const blockedPackage = rule.forbiddenPackages.find(
			(packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`),
		);
		if (blockedDirectory || blockedPackage) {
			violations.push(
				`${relativeFile}: 禁止从 ${specifier} 引入 ${blockedDirectory ?? blockedPackage}`,
			);
		}
	}
}

if (violations.length > 0) {
	throw new Error(`架构依赖检查失败：\n${violations.join("\n")}`);
}
console.log("架构依赖检查通过：领域、数据、模拟器和基础设施边界未发现反向依赖");
