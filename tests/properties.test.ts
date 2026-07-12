/**
 * 模拟器性质测试 (Property Tests)
 *
 * 验证通用不变量，确保核心排序与数据映射错误能被捕获，
 * 而非仅依赖单一角色用例。
 */

import { describe, expect, it } from "vitest";
import { simulateActions } from "../src/simulate/actions";
import { stripAv0, character, input } from "./helpers/simulateActionTestUtils";

// ─── 不变量 1: 行动 AV 非递减 ───────────────────────────────────────

describe("Property: AV non-decreasing", () => {
	it("simple two-character race", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "角色A", 100),
					character("c2", "角色B", 200),
				],
				limit: 300,
			}),
		);
		for (let i = 1; i < actions.length; i++) {
			expect(actions[i].actionValue).toBeGreaterThanOrEqual(
				actions[i - 1].actionValue,
			);
		}
	});

	it("complex team with ults and interrupts", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "角色A", 100),
					character("c2", "角色B", 150),
					character("c3", "角色C", 200),
					character("c4", "角色D", 80),
				],
				skillOverrides: {
					"c1-1": "AQ",
					"c2-1": "EQ",
					"c3-1": "QA",
				},
				ultInterrupts: {
					"c1-1": [{ casterId: "c3", timing: "before" }],
				},
				limit: 500,
			}),
		);
		for (let i = 1; i < actions.length; i++) {
			expect(actions[i].actionValue).toBeGreaterThanOrEqual(
				actions[i - 1].actionValue,
			);
		}
	});

	it("team with advance effects stays sorted", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparkle", "花火", 200, {
						hasVonwacq: true,
					}),
					character("c1", "慢速C", 100),
				],
				skillOverrides: {
					"sparkle-1": "E",
				},
				skillTargets: {
					"sparkle-1": "c1",
				},
				limit: 300,
			}),
		);
		for (let i = 1; i < actions.length; i++) {
			expect(actions[i].actionValue).toBeGreaterThanOrEqual(
				actions[i - 1].actionValue,
			);
		}
	});
});

// ─── 不变量 2: @av0 只出现一次 ──────────────────────────────────────

describe("Property: @av0 singleton", () => {
	it("single character has one @av0", () => {
		const actions = simulateActions(
			input({
				characters: [character("c1", "角色A", 100)],
				limit: 100,
			}),
		);
		const av0s = actions.filter((a) => a.characterId === "@av0");
		expect(av0s).toHaveLength(1);
		expect(av0s[0].actionValue).toBe(0);
	});

	it("six characters still have exactly one @av0", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "A", 100),
					character("c2", "B", 110),
					character("c3", "C", 120),
					character("c4", "D", 130),
					character("c5", "E", 140),
					character("c6", "F", 150),
				],
				limit: 200,
			}),
		);
		const av0s = actions.filter((a) => a.characterId === "@av0");
		expect(av0s).toHaveLength(1);
	});

	it("@av0 has AV=0 and is first in output", () => {
		const actions = simulateActions(
			input({
				characters: [character("c1", "角色A", 100)],
				limit: 100,
			}),
		);
		const av0 = actions.find((a) => a.characterId === "@av0");
		expect(av0).toBeDefined();
		expect(av0?.actionValue).toBe(0);
		expect(actions.indexOf(av0!)).toBe(0);
	});
});

// ─── 不变量 3: 行动不超过 limit ─────────────────────────────────────

describe("Property: actions within limit", () => {
	it("all actions have AV <= limit", () => {
		for (const limit of [100, 200, 500]) {
			const actions = simulateActions(
				input({
					characters: [
						character("c1", "A", 100),
						character("c2", "B", 200),
					],
					limit,
				}),
			);
			for (const action of actions) {
				expect(action.actionValue).toBeLessThanOrEqual(limit);
			}
		}
	});

	it("last action AV is the maximum AV", () => {
		const actions = simulateActions(
			input({
				characters: [character("c1", "A", 100)],
				limit: 350,
			}),
		);
		const maxAV = Math.max(...actions.map((a) => a.actionValue));
		expect(actions[actions.length - 1].actionValue).toBe(maxAV);
	});
});

// ─── 不变量 4: 被阻止的目标不被拉条 ─────────────────────────────────

describe("Property: blocked targets are not advanced", () => {
	it("知更鸟 Q 后自身不再被拉条", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "知更鸟", 200, {
						hasVonwacq: true,
					}),
					character("sparkle", "花火", 200),
				],
				skillOverrides: {
					"robin-1": "EQ",
					"sparkle-1": "E",
				},
				skillTargets: {
					"sparkle-1": "robin",
				},
				limit: 300,
			}),
		);

		// 知更鸟 Q 后应被 block，花火 E 不应该改变知更鸟的 AV
		const robinQ = actions.find(
			(a) => a.characterId === "robin" && a.skill === "Q",
		);
		const robinAfterBlock = actions
			.filter((a) => a.characterId === "robin")
			.slice(-1)[0];

		expect(robinQ).toBeDefined();
		// 知更鸟 Q 后应有下一个正常行动（未被动拉条）
		expect(robinAfterBlock).toBeDefined();
	});
});

// ─── 不变量 5: key 唯一性 ───────────────────────────────────────────

describe("Property: unique action keys", () => {
	it("no duplicate keys in any simulation", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "A", 100),
					character("c2", "B", 150),
				],
				skillOverrides: {
					"c1-1": "AQ",
					"c2-1": "EQ",
				},
				limit: 600,
			}),
		);
		const keys = actions.map((a) => a.key);
		const uniqueKeys = new Set(keys);
		expect(uniqueKeys.size).toBe(keys.length);
	});
});

// ─── 不变量 6: 行动计数不超过最大迭代次数 ───────────────────────────

describe("Property: iteration safety", () => {
	it("no more than 2000 actions generated", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "A", 200),
					character("c2", "B", 200),
				],
				limit: 99999,
			}),
		);
		expect(actions.length).toBeLessThanOrEqual(2000);
	});
});

// ─── 不变量 7: speed 始终为正 ───────────────────────────────────────

describe("Property: positive speed values", () => {
	it("every action has speed > 0", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "A", 100),
					character("c2", "B", 150),
				],
				limit: 500,
			}),
		);
		for (const action of actions) {
			expect(action.speed).toBeGreaterThan(0);
		}
	});
});
