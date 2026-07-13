import { describe, expect, it } from "vitest";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../src/simulate/actions";
import type { CharacterConfig, SkillCode } from "../../src/utils/actionSequence";

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
		limit: 200,
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
		...overrides,
	};
}

function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

describe("Dan Heng Permansor Terrae Souldragon", () => {
	it("does not summon Souldragon without an initial Bondmate", () => {
		const actions = simulateActions(
			input({ characters: [character("dhpt", "丹恒·腾荒", 100)] }),
		);
		expect(actions.some((action) => action.isSouldragonAction)).toBe(false);
	});

	it("runs at 165 speed and advances 15% for each enabled Bondmate attack", () => {
		const base = {
			characters: [
				character("dhpt", "丹恒·腾荒", 100),
				character("ally", "队友", 200),
			],
			bondmateTarget: "ally",
			limit: 100,
		};
		const enabled = simulateActions(input(base));
		const disabled = simulateActions(
			input({ ...base, attackDisabled: { "ally-1": true } }),
		);

		expect(
			enabled.find((action) => action.isSouldragonAction)?.actionValue,
		).toBeCloseTo(50 + 250 / 165, 4);
		expect(
			disabled.find((action) => action.isSouldragonAction)?.actionValue,
		).toBeCloseTo(10000 / 165, 4);
	});

	it("summons after the first targeted E and treats that E as a non-attack", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("dhpt", "丹恒·腾荒", 200),
					character("ally", "队友", 100),
				],
				skillOverrides: skills({ "dhpt-1": "E" }),
				skillTargets: { "dhpt-1": "ally" },
				limit: 100,
			}),
		);

		const ownerE = actions.find((action) => action.key === "dhpt-1");
		const souldragon = actions.find((action) => action.isSouldragonAction);
		expect(ownerE?.actionValue).toBeCloseTo(30, 4);
		expect(souldragon?.actionValue).toBeCloseTo(30 + 10000 / 165, 4);
	});

	it("E2 ultimate advances Souldragon to the ultimate action value", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("dhpt", "丹恒·腾荒", 100, { eidolon: 2 }),
					character("ally", "队友", 80),
				],
				bondmateTarget: "ally",
				skillOverrides: skills({ "dhpt-1": "AQ" }),
				limit: 100,
			}),
		);
		const ultimate = actions.find((action) => action.key === "dhpt-1-q");
		const souldragon = actions.find((action) => action.isSouldragonAction);
		expect(souldragon?.actionValue).toBeCloseTo(ultimate?.actionValue ?? 0, 4);
	});

	it("switching Bondmate with E keeps the existing Souldragon schedule", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("dhpt", "丹恒·腾荒", 200),
					character("old", "旧同袍", 80),
					character("next", "新同袍", 100),
				],
				bondmateTarget: "old",
				skillOverrides: skills({ "dhpt-1": "E" }),
				skillTargets: { "dhpt-1": "next" },
				attackDisabled: { "next-1": true },
				limit: 100,
			}),
		);
		expect(
			actions.find((action) => action.isSouldragonAction)?.actionValue,
		).toBeCloseTo(10000 / 165, 4);
	});

	it("attributes Himeko Nova assist attacks to Himeko", () => {
		const base = {
			characters: [
				character("dhpt", "丹恒·腾荒", 100),
				character("himeko", "姬子·启行", 80),
				character("ally", "队友", 200),
			],
			bondmateTarget: "himeko",
			skillOverrides: skills({ "ally-1": "FE" }),
			limit: 100,
		};
		const enabled = simulateActions(input(base));
		const assist = enabled.find((action) => action.isAssistAction);
		expect(assist?.characterId).toBe("himeko");
		expect(
			enabled.find((action) => action.isSouldragonAction)?.actionValue,
		).toBeLessThan(10000 / 165);
	});

	it("Earth Ode consumes the scheduled Souldragon turn and reschedules it", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("dhpt", "丹恒·腾荒", 100),
					character("cyrene", "昔涟", 200),
				],
				bondmateTarget: "dhpt",
				attackDisabled: { "dhpt-1": true },
				skillOverrides: skills({ "cyrene-1": "AQ" }),
				odeSelections: {
					"cyrene-1-memosprite-Q": {
						odeCode: "earth",
						targetId: "dhpt",
					},
				},
				limit: 120,
			}),
		);
		const souldragonActions = actions.filter(
			(action) => action.isSouldragonAction,
		);
		expect(souldragonActions[0]?.actionValue).toBeCloseTo(50, 4);
		expect(souldragonActions[1]?.actionValue).toBeCloseTo(50 + 10000 / 165, 4);
	});

	it("keeps Souldragon actions running during Phainon's domain", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100),
					character("dhpt", "丹恒·腾荒", 100),
					character("ally", "队友", 80),
				],
				bondmateTarget: "ally",
				skillOverrides: skills({ "phainon-1": "AQ" }),
				limit: 300,
			}),
		);
		const domainActions = actions.filter((action) => action.isDomainAction);
		const souldragonDuringDomain = actions.find(
			(action) =>
				action.isSouldragonAction &&
				action.actionValue > (domainActions[0]?.actionValue ?? Infinity) &&
				action.actionValue < (domainActions.at(-1)?.actionValue ?? -Infinity),
		);
		expect(souldragonDuringDomain).toBeDefined();
		expect(souldragonDuringDomain?.targetKind).toBe("非忆灵");
	});

	it("advances Souldragon twice for two-character domain skills (EW/EA)", () => {
		const base = {
			characters: [
				character("phainon", "白厄", 100, { eidolon: 2 }),
				character("dhpt", "丹恒·腾荒", 100),
			],
			bondmateTarget: "phainon",
			domainEndOverrides: { "phainon-1-domain-1": true },
			attackDisabled: { "phainon-1": true },
			limit: 150,
		};

		const single = simulateActions(
			input({
				...base,
				skillOverrides: skills({
					"phainon-1": "AQ",
					"phainon-1-domain-0": "E",
				}),
			}),
		);
		const double = simulateActions(
			input({
				...base,
				skillOverrides: skills({
					"phainon-1": "AQ",
					"phainon-1-domain-0": "EW",
				}),
			}),
		);

		const singleSd2 = single.find(
			(a) => a.isSouldragonAction && a.actionNo === 2,
		);
		const doubleSd2 = double.find(
			(a) => a.isSouldragonAction && a.actionNo === 2,
		);
		// 双段攻击(EW)应比单段(E)使龙灵更早行动
		expect(singleSd2).toBeDefined();
		expect(doubleSd2).toBeDefined();
		expect(doubleSd2?.actionValue).toBeLessThan(singleSd2?.actionValue);
	});
});
