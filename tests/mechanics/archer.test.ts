import { describe, expect, it } from "vitest";
import { hasSkillEffect } from "../../src/data/characters";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../src/simulate/actions";
import {
	type CharacterConfig,
	canUseSkillCode,
	isLockedResourceNameForCharacters,
	isNonAttackSkill,
	normalizeResourcesForCharacters,
} from "../../src/utils/actionSequence";

function c(
	id: string,
	name: string,
	speed: number,
	ext: Partial<CharacterConfig> = {},
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
		...ext,
	};
}

function inp(
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
		godmodeExtraActions: {},
		...overrides,
	};
}

describe("Archer (红A)", () => {
	it("hasSkillEffect works for both names", () => {
		expect(hasSkillEffect("红A", "Q", "archerUltimate")).toBe(true);
		expect(hasSkillEffect("Archer", "Q", "archerUltimate")).toBe(true);
	});

	it("canUseSkillCode accepts 4E for Archer", () => {
		const archer = c("archer", "红A", 150);
		expect(canUseSkillCode(archer, "4E")).toBe(true);
		expect(canUseSkillCode(archer, "2E")).toBe(true);
		expect(canUseSkillCode(archer, "E")).toBe(true);
		expect(canUseSkillCode(archer, "A")).toBe(true);
	});

	it("locks battle points first and Archer FUA charge second", () => {
		const archer = c("archer", "红A", 150);
		expect(
			normalizeResourcesForCharacters(["忆质", "自定义"], [archer]),
		).toEqual(["战技点", "红A追击", "自定义"]);
		expect(isLockedResourceNameForCharacters("战技点", [archer])).toBe(true);
		expect(isLockedResourceNameForCharacters("红A追击", [archer])).toBe(true);
	});

	it("4E generates main E + 3 extra E turns", () => {
		const acts = simulateActions(
			inp({
				characters: [c("archer", "红A", 150)],
				skillOverrides: { "archer-1": "4E" },
				limit: 200,
			}),
		);
		const main = acts.find((a) => a.key === "archer-1");
		expect(main).toBeDefined();
		expect(main?.skill).toBe("E");
		expect(main?.hasArcherExtraEs).toBe(true);

		const extras = acts.filter((a) => a.isArcherExtraE);
		expect(extras.length).toBe(3);
		expect(extras[0].archerExtraEIndex).toBe(2);
		expect(extras[1].archerExtraEIndex).toBe(3);
		expect(extras[2].archerExtraEIndex).toBe(4);
		expect(extras.every((a) => a.archerExtraEParentKey === main?.key)).toBe(
			true,
		);
	});

	it("E alone produces no extras", () => {
		const acts = simulateActions(
			inp({
				characters: [c("archer", "红A", 150)],
				skillOverrides: { "archer-1": "E" },
				limit: 200,
			}),
		);
		expect(acts.filter((a) => a.isArcherExtraE).length).toBe(0);
		expect(acts.find((a) => a.key === "archer-1")?.skill).toBe("E");
	});

	it("2E produces 1 extra E (2nd arrow)", () => {
		const acts = simulateActions(
			inp({
				characters: [c("archer", "红A", 150)],
				skillOverrides: { "archer-1": "2E" },
				limit: 200,
			}),
		);
		const extras = acts.filter((a) => a.isArcherExtraE);
		expect(extras.length).toBe(1);
		expect(extras[0].archerExtraEIndex).toBe(2);
		expect(extras[0].skill).toBe("E");
		expect(extras[0].lockedSkill).toBe(true);
	});

	it("technique starts with two charges, Q restores two charges up to four", () => {
		const acts = simulateActions(
			inp({
				characters: [c("archer", "Archer", 150, { techniqueOn: true })],
				legacyUltOverrides: { "archer-1": true },
				attackDisabled: { "archer-1": true },
				limit: 100,
			}),
		);
		const q = acts.find((action) => action.key === "archer-1");
		expect(q?.archerFuaCharge).toBe(4);
	});

	it("basic attacks stay enabled even when their attack toggle was previously disabled", () => {
		const acts = simulateActions(
			inp({
				characters: [
					c("archer", "红A", 200, { techniqueOn: false }),
					c("ally", "停云", 100),
				],
				skillOverrides: { "archer-1": "E" },
				attackDisabled: { "ally-1": true },
				limit: 100,
			}),
		);
		const archerFuas = acts.filter((action) => action.isArcherFua);
		expect(archerFuas).toHaveLength(1);
		expect(archerFuas[0]).toMatchObject({
			characterId: "archer",
			skill: "Z",
			lockedSkill: true,
			archerFuaCharge: 0,
		});
	});

	it("ally-targetable skills and Huohuo E do not trigger Archer follow-up attacks", () => {
		const actions = simulateActions(
			inp({
				characters: [
					c("archer", "红A", 100, { techniqueOn: false }),
					c("bronya", "布洛妮娅", 200),
					c("huohuo", "藿藿", 150),
				],
				skillOverrides: { "bronya-1": "E", "huohuo-1": "E" },
				limit: 80,
			}),
		);

		expect(
			actions
				.filter((action) => action.isArcherFua)
				.map((action) => ({ key: action.key, skill: action.skill })),
		).toEqual([]);
		expect(isNonAttackSkill(c("robin", "知更鸟", 100), "E")).toBe(true);
		expect(isNonAttackSkill(c("robin", "知更鸟", 100), "Q")).toBe(true);
		expect(isNonAttackSkill(c("ruanmei", "阮梅", 100), "E")).toBe(true);
		expect(isNonAttackSkill(c("ruanmei", "阮梅", 100), "Q")).toBe(true);
	});

	it("manual charge resource is clamped before the action attack is resolved", () => {
		const acts = simulateActions(
			inp({
				characters: [c("archer", "红A", 150)],
				skillOverrides: { "archer-1": "E" },
				resourceValues: { "archer-1": { 红A追击: "4" } },
				limit: 100,
			}),
		);
		const main = acts.find((action) => action.key === "archer-1");
		expect(main?.archerFuaCharge).toBe(4);
		expect(acts.filter((action) => action.isArcherFua)).toHaveLength(0);
	});

	it("Archer extra E supports before and after inserted Q", () => {
		const acts = simulateActions(
			inp({
				characters: [
					c("archer", "红A", 150),
					c("before", "停云", 120),
					c("after", "布洛妮娅", 110),
				],
				skillOverrides: { "archer-1": "2E" },
				attackDisabled: { "archer-1": true, "archer-1-ea2": true },
				ultInterrupts: {
					"archer-1-ea2": [
						{ casterId: "before", timing: "before" },
						{ casterId: "after", timing: "after" },
					],
				},
				limit: 100,
			}),
		);
		const before = acts.findIndex(
			(action) => action.key === "archer-1-ea2-interrupt-0",
		);
		const extra = acts.findIndex((action) => action.key === "archer-1-ea2");
		const after = acts.findIndex(
			(action) => action.key === "archer-1-ea2-interrupt-1",
		);
		expect(before).toBeLessThan(extra);
		expect(extra).toBeLessThan(after);
	});
});
