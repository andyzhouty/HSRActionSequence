/**
 * 模拟器性能基准测试
 *
 * 为典型场景建立耗时基线，防止性能回退。
 */

import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import { character, input } from "../helpers/simulateActionTestUtils";

/**
 * 性能预算（毫秒）：
 * - 标准轴：<200ms
 * - 高负载（大量插队+长轴）：<200ms
 * - 2000 AV 复合连动压力轴：<700ms
 */
const STANDARD_BUDGET_MS = 200;
const HEAVY_BUDGET_MS = 200;
// 2000 AV 的复合连动用于压测吞吐量，不是编辑时的常规交互负载。
const EXTREME_STRESS_BUDGET_MS = 700;

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
					"phainon-1": [{ casterId: "robin", timing: "before" }],
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

	it("Phainon domain with Aha and Gilgamesh resource tracking", () => {
		const start = performance.now();
		const actions = simulateActions(
			input({
				characters: [
					character("gil", "吉尔伽美什", 150, {
						eidolon: 2,
						techniqueOn: true,
					}),
					character("phainon", "白厄", 200, { eidolon: 2 }),
					character("sparxie", "火花", 180),
					character("evanescia", "绯英", 160),
				],
				skillOverrides: {
					"phainon-1": "AQ",
					"phainon-1-domain-0": "EW",
					"phainon-1-domain-1": "EA",
				},
				limit: 2000,
			}),
		);
		const elapsed = performance.now() - start;
		expect(actions.length).toBeGreaterThan(100);
		expect(elapsed).toBeLessThan(EXTREME_STRESS_BUDGET_MS);
	});

	it("Archer arrow chains with Himeko assists and Saber/Gilgamesh combo tracking", () => {
		const start = performance.now();
		const actions = simulateActions(
			input({
				characters: [
					character("archer", "Archer", 200),
					character("himeko", "sp姬子", 180, { eidolon: 2 }),
					character("gil", "吉尔伽美什", 160, { eidolon: 2 }),
					character("saber", "Saber", 150),
				],
				skillOverrides: {
					"archer-1": "E",
					"archer-2": "E",
					"archer-3": "E",
				},
				limit: 2000,
			}),
		);
		const elapsed = performance.now() - start;
		expect(actions.length).toBeGreaterThan(100);
		expect(elapsed).toBeLessThan(EXTREME_STRESS_BUDGET_MS);
	});
});
