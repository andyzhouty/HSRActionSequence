/**
 * 模拟器性能基准测试
 *
 * 为典型场景建立耗时基线，防止性能回退。
 */

import { describe, expect, it } from "vitest";
import { simulateActions } from "../src/simulate/actions";
import { character, input } from "./helpers/simulateActionTestUtils";

/**
 * 性能预算（毫秒）：
 * - 4角色标准轴（500AV）：<50ms
 * - 高负载（大量插队+长轴）：<200ms
 */
const STANDARD_BUDGET_MS = 150;
const HEAVY_BUDGET_MS = 600;

describe("Performance: standard scenarios", () => {
	it("4-character team, 500 AV limit", () => {
		const start = performance.now();
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "A", 100),
					character("c2", "B", 120),
					character("c3", "C", 140),
					character("c4", "D", 160),
				],
				skillOverrides: {
					"c1-1": "AQ",
					"c2-1": "EQ",
				},
				limit: 500,
			}),
		);
		const elapsed = performance.now() - start;
		expect(actions.length).toBeGreaterThan(0);
		expect(elapsed).toBeLessThan(STANDARD_BUDGET_MS);
	});

	it("single character, 2000 AV limit", () => {
		const start = performance.now();
		const actions = simulateActions(
			input({
				characters: [character("c1", "A", 200)],
				limit: 2000,
			}),
		);
		const elapsed = performance.now() - start;
		expect(actions.length).toBeGreaterThan(10);
		expect(elapsed).toBeLessThan(STANDARD_BUDGET_MS);
	});
});

describe("Performance: heavy scenarios", () => {
	it("many interrupts with domain", () => {
		const start = performance.now();
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 106),
					character("sparkle", "花火", 200, { hasVonwacq: true }),
					character("bronya", "布洛妮娅", 200, { hasVonwacq: true }),
					character("robin", "知更鸟", 200, { hasVonwacq: true }),
				],
				skillOverrides: {
					"robin-1": "EQ",
					"sparkle-1": "E",
					"bronya-1": "E",
					"phainon-1": "Q",
				},
				skillTargets: {
					"sparkle-1": "phainon",
					"bronya-1": "phainon",
				},
				ultInterrupts: {
					"phainon-1": [
						{ casterId: "robin", timing: "before" },
					],
					"phainon-2-domain-3": [
						{ casterId: "sparkle", timing: "before" },
						{ casterId: "bronya", timing: "after" },
					],
				},
				limit: 700,
			}),
		);
		const elapsed = performance.now() - start;
		expect(actions.length).toBeGreaterThan(0);
		expect(elapsed).toBeLessThan(HEAVY_BUDGET_MS);
	});
});
