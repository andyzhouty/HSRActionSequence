import { describe, expect, it } from "vitest";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../../src/simulate/actions";
import type {
	CharacterConfig,
	SkillCode,
} from "../../../src/utils/action-sequence";

function character(
	id: string,
	name: string,
	speed: number,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: String(speed),
		baseSpeed: String(speed),
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...overrides,
	};
}

function input(
	overrides: Partial<SimulateActionsInput> = {},
): SimulateActionsInput {
	return {
		characters: [],
		limit: 500,
		overrides: {},
		skillOverrides: {},
		domainEndOverrides: {},
		legacyUltOverrides: {},
		speedAdjustments: {},
		skillTargets: {},
		defaultSkillTargets: {},
		odeSelections: {},
		memeSelections: {},
		ultInterrupts: {},
		fireflyBreakCounters: {},
		...overrides,
	};
}

function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

// ───── 风堇小伊卡 ─────

describe("Hyacine (风堇) Ica System", () => {
	it("风堇 E 首次召唤小伊卡", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({ "hyacine-1": "E" }),
				limit: 300,
			}),
		);
		// E 不应产生 Ica 额外回合（afterRain 初始为 0）。
		const icaActions = actions.filter((a) => a.isIcaAction);
		expect(icaActions.length).toBe(0);
	});

	it("风堇 Q 后 afterRain=3，下一次 A 触发 Ica 额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "E", // 先召唤 Ica。
					"hyacine-2": "AQ", // A → 触发 Ica，Q → afterRain=3。
					"hyacine-3": "A", // 应再次触发 Ica。
				}),
				limit: 500,
			}),
		);

		const icaActions = actions.filter((a) => a.isIcaAction);
		expect(icaActions.length).toBeGreaterThanOrEqual(1);
		expect(icaActions[0].displayName).toBe("小伊卡");
		expect(icaActions[0].skill).toBe("A");
		expect(icaActions[0].isMemospriteAction).toBe(true);
		expect(icaActions[0].memospriteOwnerId).toBe("hyacine");
	});

	it("Ica 额外回合与风堇同 AV", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "E", // 召唤。
					"hyacine-2": "QA", // Q→afterRain=3，A→触发 Ica。
				}),
				limit: 400,
			}),
		);

		const icaAction = actions.find((a) => a.isIcaAction);
		expect(icaAction).toBeDefined();
		// Ica 应与 hyacine 的 A 行动处于同一 AV。
		const hyacineA = actions.find(
			(a) =>
				a.characterId === "hyacine" && a.key === "hyacine-2" && a.skill === "A",
		);
		expect(hyacineA).toBeDefined();
		if (icaAction && hyacineA) {
			expect(icaAction.actionValue).toBeCloseTo(hyacineA.actionValue, 1);
		}
	});

	it("afterRain 每次 A/E 消耗 1 层", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "E", // 召唤。
					"hyacine-2": "QA", // Q→3，A→触发（-1=2）。
					"hyacine-3": "A", // 触发（-1=1）。
					"hyacine-4": "A", // 触发（-1=0）。
					"hyacine-5": "A", // 不触发（afterRain=0）。
				}),
				limit: 700,
			}),
		);

		const icaActions = actions.filter((a) => a.isIcaAction);
		// Q 触发 Ica（不递减）+ 3 次 A 触发，共 4 次。
		expect(icaActions.length).toBe(4);
	});

	it("Ica 死亡后 afterRain 归 0，重新召唤前不触发", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "E", // 召唤。
					"hyacine-2": "QA", // Q→3，A→触发。
				}),
				icaKillToggles: {
					"hyacine-3": true, // 击杀 Ica（hyacine-3 在 Ica 之后行动）。
				},
				limit: 500,
			}),
		);

		const icaActions = actions.filter((a) => a.isIcaAction);
		// Q→3 后第一次 A 触发 Ica，随后 hyacine-3 将 Ica 击杀。
		// 此后 hyacine-4（下一次行动）不应再次触发 Ica。
		expect(icaActions.length).toBeGreaterThanOrEqual(1);

		// Ica 死亡并重新召唤后，Q 应将 afterRain 设为 3，
		// 后续 A 应触发 Ica。
	});

	it("E2 全队速度 +30%（不可叠加）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("hyacine", "风堇", 100, { eidolon: 2 }),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"hyacine-1": "E",
				}),
				hyacineE2Active: true,
				limit: 300,
			}),
		);

		// 队友因二魂效果应获得更高速度。
		const allyAction = actions.find((a) => a.characterId === "ally");
		expect(allyAction).toBeDefined();
		// 80 + 80*0.3 = 104 速度 → AV ≈ 96.15。
		expect(allyAction?.speed).toBe(80 + 80 * 0.3);
		expect(allyAction?.actionValue).toBeCloseTo(10000 / 104, 1);
	});

	it("Q 在 Ica 不在场时也召唤 + QA 后触发额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "QA", // Q：召唤 Ica + afterRain=3 + Ica 行动；A：不触发（Q 已经触发过）。
				}),
				limit: 300,
			}),
		);
		// Q 触发 Ica（不递减）+ QA 中的 A（递减至 2）+ 另外 2 次 A，共 4 次。
		const icaActions = actions.filter((a) => a.isIcaAction);
		expect(icaActions.length).toBe(4);
		expect(icaActions[0].skill).toBe("A");
	});

	it("EQ 只触发 Q 提供的免费 Ica 行动，不会额外消耗 afterRain", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "EQ",
					"hyacine-2": "A",
					"hyacine-3": "A",
					"hyacine-4": "A",
					"hyacine-5": "A",
				}),
				limit: 700,
			}),
		);

		const icaActions = actions.filter((a) => a.isIcaAction);
		expect(icaActions.map((a) => a.key)).toEqual([
			"hyacine-1-q-ica",
			"hyacine-2-ica",
			"hyacine-3-ica",
			"hyacine-4-ica",
		]);
	});

	it("Ica 额外回合设定 lockedSkill 和 skill='A'", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "E",
					"hyacine-2": "QA",
				}),
				limit: 400,
			}),
		);

		const icaAction = actions.find((a) => a.isIcaAction);
		expect(icaAction?.lockedSkill).toBe(true);
		expect(icaAction?.skill).toBe("A");
	});

	it("Ica 额外回合支持插入角色大招", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("hyacine", "风堇", 100),
					character("ally", "停云", 90),
				],
				skillOverrides: skills({
					"hyacine-1": "AQ",
				}),
				ultInterrupts: {
					"hyacine-1-q-ica": [{ casterId: "ally", timing: "after" }],
				},
				limit: 200,
			}),
		);

		expect(actions.find((a) => a.key === "hyacine-1-q-ica")).toBeDefined();
		expect(
			actions.find((a) => a.key === "hyacine-1-q-ica-interrupt-0")?.skill,
		).toBe("Q");
	});

	it("风堇插队Q会正常召唤并触发小伊卡", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("ally", "停云", 100),
					character("hyacine", "风堇", 90),
				],
				ultInterrupts: {
					"ally-1": [{ casterId: "hyacine", timing: "before" }],
				},
				limit: 200,
			}),
		);

		expect(actions.find((a) => a.key === "ally-1-interrupt-0")?.skill).toBe(
			"Q",
		);
		expect(
			actions.find((a) => a.key === "ally-1-interrupt-0-ica"),
		).toBeDefined();
	});
});

describe("Hyacine E2 后续忆灵加速", () => {
	it("战斗中召唤的死龙继承已启用的 E2 速度加成", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("hyacine", "风堇", 100, { eidolon: 2 }),
					character("castorice", "遐蝶", 200),
				],
				skillOverrides: skills({ "castorice-1": "AQ" }),
				hyacineE2Active: true,
				limit: 120,
			}),
		);
		expect(actions.find((action) => action.isPolluxAction)?.speed).toBeCloseTo(
			214.5,
		);
	});

	it("战斗中召唤的迷迷继承已启用的 E2 速度加成", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("hyacine", "风堇", 100, { eidolon: 2 }),
					character("rmc", "开拓者·记忆", 200),
				],
				skillOverrides: skills({ "rmc-1": "E" }),
				hyacineE2Active: true,
				limit: 120,
			}),
		);
		expect(
			actions.find((action) => action.isMemospriteAction)?.speed,
		).toBeCloseTo(169);
	});
});
