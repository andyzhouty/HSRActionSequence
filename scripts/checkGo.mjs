import { execFileSync } from "node:child_process";

const formatting = execFileSync("gofmt", ["-l", "main.go"], {
	encoding: "utf8",
}).trim();
if (formatting) {
	throw new Error(`Go 文件未格式化：${formatting}`);
}

execFileSync("go", ["test", "./..."], { stdio: "inherit" });
execFileSync("go", ["vet", "./..."], { stdio: "inherit" });
console.log("Go 格式、测试和 vet 检查通过");
