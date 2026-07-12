import { describe, expect, it } from "vitest";
import type {
	CharacterConfig,
	SkillCode,
	UltInterrupt,
} from "../src/utils/actionSequence";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../src/simulate/actions";

/** Filter out the utility @av0 target from action arrays */
const stripAv0 = (actions: { key: string; characterId: string }[]) =>
	actions.filter((a) => a.characterId !== "@av0");

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
		limit: 300,
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

function interrupts(
	entries: Record<string, UltInterrupt[]>,
): Record<string, UltInterrupt[]> {
	return entries;
}

// ───── Cyrene (昔涟) ─────

describe("Cyrene (昔涟)", () => {
	it("triggers memosprite action after ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [character("cyrene", "昔涟", 100)],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				limit: 210,
			}),
		);

		expect(stripAv0(actions).map((a) => a.key).slice(0, 4)).toEqual([
			"cyrene-1",
			"cyrene-1-q",
			"cyrene-1-memosprite-Q",
			"cyrene-2",
		]);
		const memosprite = actions.find((a) => a.key === "cyrene-1-memosprite-Q");
		expect(memosprite).toBeDefined();
		expect(memosprite?.displayName).toBe("德谬歌");
		expect(memosprite?.targetKind).toBe("忆灵");
		expect(memosprite?.isMemospriteAction).toBe(true);
		expect(memosprite?.memospriteOwnerId).toBe("cyrene");
		expect(memosprite?.actionValue).toBeCloseTo(100, 4);
	});

	it("applies generic ode to untargeted ally", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 100),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "generic",
						targetId: "ally",
					},
				},
				limit: 130,
			}),
		);

		const memosprite = actions.find((a) => a.key === "cyrene-1-memosprite-Q");
		expect(memosprite).toBeDefined();
		// ally (80 spd) acts at AV=125, after memosprite and Q (AV=100)
		expect(stripAv0(actions).map((a) => a.key).slice(0, 4)).toEqual([
			"cyrene-1",
			"cyrene-1-q",
			"cyrene-1-memosprite-Q",
			"ally-1",
		]);
	});

	it("applies immediateTurn ode effect (reason - Anaxa)", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 100),
					character("anaxa", "那刻夏", 200),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "reason",
						targetId: "anaxa",
					},
				},
				limit: 110,
			}),
		);

		// 理性之诗 immediateTurn pulls anaxa's next action to current AV
		// anaxa's action at AV=100 should have activeOdeLabels containing "理性"
		const anaxaAction = actions.find(
			(a) =>
				a.characterId === "anaxa" &&
				a.actionValue === 100 &&
				a.activeOdeLabels?.includes("理性"),
		);
		expect(anaxaAction).toBeDefined();
		expect(anaxaAction?.actionValue).toBeCloseTo(100, 4);
	});

	it("applies immediateEnhancedSkill ode effect (strife - Mydei)", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 100),
					character("mydei", "万敌", 200),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "strife",
						targetId: "mydei",
					},
				},
				limit: 110,
			}),
		);

		// 纷争之诗 immediateEnhancedSkill: target gets an extra E at same AV
		const extraAction = actions.find(
			(a) => a.key === "cyrene-1-memosprite-Q-ode-strife",
		);
		expect(extraAction).toBeDefined();
		expect(extraAction?.characterId).toBe("mydei");
		expect(extraAction?.skill).toBe("E");
		expect(extraAction?.actionValue).toBeCloseTo(100, 4);
	});

	it("does not apply ode to non-matching target name", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 100),
					character("other", "其他人", 80),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "genesis",
						targetId: "other",
					},
				},
				limit: 130,
			}),
		);

		// genesis ode only applies to RMC, not "其他人" - no extra action
		const extraAction = actions.find((a) => a.isOdeExtraAction);
		expect(extraAction).toBeUndefined();
	});

	it("emits memosprite from interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("cyrene", "昔涟", 100),
				],
				ultInterrupts: interrupts({
					"a-1": [{ casterId: "cyrene", timing: "before" }],
				}),
				limit: 130,
			}),
		);

		const memosprite = actions.find((a) => a.isMemospriteAction);
		expect(memosprite).toBeDefined();
		expect(memosprite?.displayName).toBe("德谬歌");
	});

	it("6魂首次大招的100%拉条会作用于昔涟自身及同AV已行动角色", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("ally", "队友", 100),
					character("cyrene", "昔涟", 100, { eidolon: 6 }),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				limit: 220,
			}),
		);

		const allyFirst = actions.find((action) => action.key === "ally-1");
		const cyreneFirst = actions.find((action) => action.key === "cyrene-1");
		const allySecond = actions.find((action) => action.key === "ally-2");
		const cyreneSecond = actions.find((action) => action.key === "cyrene-2");

		expect(allyFirst?.actionValue).toBeCloseTo(100, 4);
		expect(cyreneFirst?.actionValue).toBeCloseTo(100, 4);
		expect(cyreneSecond?.actionValue).toBeCloseTo(100, 4);
		expect(allySecond?.actionValue).toBeCloseTo(100.0001, 4);
	});

	it("6魂外部插队 Q 会将昔涟和全体我方按原行动顺序拉至当前行动值", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("actor", "行动角色", 100),
					character("cyrene", "昔涟", 80, { eidolon: 6 }),
					character("ally", "队友", 75),
				],
				ultInterrupts: interrupts({
					"actor-1": [{ casterId: "cyrene", timing: "before" }],
				}),
				limit: 140,
			}),
		);

		expect(actions.find((action) => action.key === "cyrene-1")?.actionValue)
			.toBeCloseTo(100, 4);
		expect(actions.find((action) => action.key === "ally-1")?.actionValue)
			.toBeCloseTo(100.0002, 4);
	});

	it("6魂昔涟 QE 时自身不吃首次 100% 拉条", () => {
		const actions = simulateActions(
			input({
				characters: [character("cyrene", "昔涟", 200, { eidolon: 6 })],
				skillOverrides: skills({
					"cyrene-1": "QE",
				}),
				limit: 120,
			}),
		);

		const cyreneSecond = actions.find(
			(action) => action.key === "cyrene-2",
		);
		expect(cyreneSecond?.actionValue).toBeCloseTo(100, 4);
	});

	it("德谬歌不能选择昔涟自身作为颂诗目标", () => {
		const actions = simulateActions(
			input({
				characters: [character("cyrene", "昔涟", 100)],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "generic",
						targetId: "cyrene",
					},
				},
				limit: 110,
			}),
		);

		const memosprite = actions.find(
			(action) => action.key === "cyrene-1-memosprite-Q",
		);
		expect(memosprite).toBeDefined();
		expect(
			actions.some((action) => action.isOdeExtraAction),
		).toBe(false);
	});

	it("romance ode: heart shows battle-long, battery on first non-Q action", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 200),
					character("aglaea", "阿格莱雅", 120),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
					"aglaea-1": "E",
				}),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "romance",
						targetId: "aglaea",
					},
				},
				limit: 300,
			}),
		);

		// 阿格莱雅应有浪漫 ode 标签
		const aglaeaActions = actions.filter((a) => a.characterId === "aglaea");
		expect(aglaeaActions.length).toBeGreaterThan(0);
		// 第一次非 Q 行动应有电池图标
		const firstNonQ = aglaeaActions.find(
			(a) => a.skill !== "Q" && !a.key.includes("-q"),
		);
		expect(firstNonQ).toBeDefined();
		expect(firstNonQ?.isRomanceAction).toBe(true);
		expect(firstNonQ?.activeOdeLabels).toContain("浪漫");

		// 后续行动不应有电池图标
		const laterActions = aglaeaActions.slice(1);
		for (const a of laterActions) {
			if (a.skill !== "Q" && !a.key.includes("-q")) {
				expect(a.isRomanceAction).toBeFalsy();
			}
		}
	});

	it("romance ode: recharges on second Deimos Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 200),
					character("aglaea", "阿格莱雅", 120),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
					"aglaea-1": "E",
					"cyrene-2": "AQ",
				}),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "romance",
						targetId: "aglaea",
					},
					"cyrene-2-memosprite-Q": {
						odeCode: "romance",
						targetId: "aglaea",
					},
				},
				limit: 450,
			}),
		);

		// 第一次 Deimos Q 后：aglaea-1 应有电池
		const first = actions.find((a) => a.key === "aglaea-1");
		expect(first?.isRomanceAction).toBe(true);

		// 第二次 Deimos Q 后：下一个阿格莱雅非 Q 行动应有电池
		const secondMemosprite = actions.find(
			(a) => a.key === "cyrene-2-memosprite-Q",
		);
		expect(secondMemosprite).toBeDefined();
		const afterSecond = actions
			.slice(actions.indexOf(secondMemosprite!) + 1)
			.filter((a) => a.characterId === "aglaea");
		const recharged = afterSecond.find(
			(a) => a.skill !== "Q" && !a.key.includes("-q") && a.isRomanceAction,
		);
		expect(recharged).toBeDefined();
		expect(recharged?.activeOdeLabels).toContain("浪漫");
	});
});




