import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		setupFiles: ["./tests/setup.ts"],
		css: true,
		testTimeout: 10000,
		// 并行执行 + 线程池（比 forks 更轻量）
		fileParallelism: true,
		pool: "threads",
		// 不使用 retry 掩盖共享状态或清理不完整导致的不稳定。
		retry: 0,
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["tests/**/*.test.{ts,tsx}"],
					exclude: [
						"tests/ui/**",
						"tests/integration/ui/**",
						"tests/quality/performance.test.ts",
					],
				},
			},
			{
				extends: true,
				test: {
					name: "ui",
					environment: "jsdom",
					include: ["tests/ui/**/*.test.tsx", "tests/integration/ui/**/*.test.tsx"],
				},
			},
			{
				extends: true,
				test: {
					name: "performance",
					environment: "node",
					include: ["tests/quality/performance.test.ts"],
				},
			},
		],
	},
});
