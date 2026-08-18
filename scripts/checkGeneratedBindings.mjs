import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const mainSource = await readFile(join(root, "main.go"), "utf8");
const declarationSource = await readFile(
	join(root, "frontend/wailsjs/go/main/App.d.ts"),
	"utf8",
);
const runtimeSource = await readFile(
	join(root, "frontend/wailsjs/go/main/App.js"),
	"utf8",
);

const exportedMethods = [
	...mainSource.matchAll(/func \(a \*App\) ([A-Z][A-Za-z0-9_]*)\(/g),
].map((match) => match[1]);
const generatedDeclarationMethods = [
	...declarationSource.matchAll(/export function ([A-Z][A-Za-z0-9_]*)\(/g),
].map((match) => match[1]);
const generatedRuntimeMethods = [
	...runtimeSource.matchAll(/export function ([A-Z][A-Za-z0-9_]*)\(/g),
].map((match) => match[1]);

function assertSameMethods(label, expected, actual) {
	const expectedSet = new Set(expected);
	const actualSet = new Set(actual);
	const missing = expected.filter((method) => !actualSet.has(method));
	const stale = actual.filter((method) => !expectedSet.has(method));
	if (missing.length > 0 || stale.length > 0) {
		throw new Error(
			`${label} 与 main.go 不一致：缺少 [${missing.join(", ")}]，多出 [${stale.join(", ")}]`,
		);
	}
}

assertSameMethods("App.d.ts", exportedMethods, generatedDeclarationMethods);
assertSameMethods("App.js", exportedMethods, generatedRuntimeMethods);
console.log(`Wails 绑定校验通过：${exportedMethods.length} 个 App 方法`);
