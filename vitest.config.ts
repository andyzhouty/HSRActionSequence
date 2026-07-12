import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./tests/setup.ts"],
		css: true,
		testTimeout: 10000,
		// 并行执行 + 线程池（比 forks 更轻量）
		fileParallelism: true,
		pool: "threads",
		// 交互测试偶发超时时自动重试一次
		retry: 1,
	},
});