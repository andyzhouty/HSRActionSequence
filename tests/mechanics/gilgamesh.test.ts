import { describe, expect, it } from "vitest";
import {
	getGilgameshBaseSpeed,
	hasGilgamesh,
} from "../../src/mechanics/gilgamesh";
import { simulateActions } from "../../src/simulate/actions";
import {
	hasGilgameshCharacter,
	normalizeResourcesForCharacters,
	type CharacterConfig,
} from "../../src/utils/actionSequence";

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
		baseSpeed: "",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...overrides,
	};
}

function input(overrides: Partial<Parameters<typeof simulateActions>[0]> = {}) {
	return {
		characters: [], limit: 500, overrides: {}, skillOverrides: {},
		domainEndOverrides: {}, legacyUltOverrides: {}, speedAdjustments: {},
		skillTargets: {}, defaultSkillTargets: {}, odeSelections: {}, memeSelections: {},
		ultInterrupts: {}, ...overrides,
	};
}

describe("Gilgamesh", () => {
	it("uses the configured base-speed rule and locks 兴致 as the first resource", () => {
		const gil = character("gil", "吉尔伽美什", 100, { lc_id: 23044, superimpose: 3 });
		expect(hasGilgamesh(gil)).toBe(true);
		expect(getGilgameshBaseSpeed(gil)).toBe(113);
		expect(hasGilgameshCharacter([gil])).toBe(true);
		expect(normalizeResourcesForCharacters(["战技点", "自定义"], [gil])).toEqual([
			"兴致", "战技点", "自定义",
		]);
	});

	it("uses AV0 manual 兴致, accumulates actions and permanently changes the lock at 10", () => {
		const actions = simulateActions(input({
			characters: [character("gil", "吉尔伽美什", 100)],
			resourceValues: { "@av0-1": { 兴致: "10" } },
			limit: 120,
		}));
		expect(actions.find((action) => action.key === "@av0-1")?.gilgameshInterest).toBe(10);
		expect(actions.find((action) => action.key === "gil-1")).toMatchObject({
			skill: "E", lockedSkill: true, gilgameshInterest: 0,
		});
	});

	it("technique adds three 兴致 on entry, including on top of E2", () => {
		const e0 = simulateActions(input({
			characters: [character("gil", "吉尔伽美什", 100, { techniqueOn: true })],
			limit: 1,
		}));
		const e2 = simulateActions(input({
			characters: [character("gil", "吉尔伽美什", 100, { eidolon: 2, techniqueOn: true })],
			limit: 1,
		}));
		expect(e0.find((action) => action.key === "@av0-1")?.gilgameshInterest).toBe(3);
		expect(e2.find((action) => action.key === "@av0-1")?.gilgameshInterest).toBe(8);
	});

	it("technique emits a locked T attack immediately after the AV0 action", () => {
		const actions = simulateActions(input({
			characters: [character("gil", "吉尔伽美什", 100, { techniqueOn: true })],
			limit: 1,
		}));
		const av0Index = actions.findIndex((action) => action.key === "@av0-1");
		const technique = actions[av0Index + 1];
		expect(technique).toMatchObject({
			key: "@av0-1-gilgamesh-technique",
			skill: "T",
			lockedSkill: true,
			isGilgameshTechniqueAction: true,
			gilgameshInterest: 3,
		});
	});

	it("applies Q and per-row manual 兴致 values as the following baseline", () => {
		const actions = simulateActions(input({
			characters: [character("gil", "吉尔伽美什", 100), character("ally", "停云", 200)],
			legacyUltOverrides: { "ally-1": true },
			resourceValues: { "ally-2": { 兴致: "7" } },
			limit: 130,
		}));
		expect(actions.find((action) => action.key === "ally-1")?.gilgameshInterest).toBe(3);
		expect(actions.find((action) => action.key === "ally-2")?.gilgameshInterest).toBe(7);
	});

	it("E2 starts at 5 and its Q does not clear 兴致 before adding its two-plus-five bonus", () => {
		const actions = simulateActions(input({
			characters: [character("gil", "吉尔伽美什", 100, { eidolon: 2 }), character("ally", "停云", 200)],
			ultInterrupts: { "ally-1": [{ casterId: "gil", timing: "after" }] },
			limit: 80,
		}));
		expect(actions.find((action) => action.key === "@av0-1")?.gilgameshInterest).toBe(5);
		expect(actions.find((action) => action.key === "ally-1-interrupt-0")?.gilgameshInterest).toBe(13);
	});

	it("counts Phainon domain EA/EW as exactly two 兴致, not one plus two", () => {
		const actions = simulateActions(input({
			characters: [
				character("gil", "吉尔伽美什", 1),
				character("phainon", "白厄", 100, { eidolon: 2 }),
			],
			skillOverrides: {
				"phainon-1": "AQ",
				"phainon-1-domain-0": "EW",
			},
			limit: 150,
		}));
		expect(actions.find((action) => action.key === "phainon-1-domain-0")).toMatchObject({
		skill: "EW", gilgameshInterest: 6,
		});
	});

	it("counts Phainon domain exit Q as only one normal-action 兴致", () => {
		const actions = simulateActions(input({
			characters: [
				character("gil", "吉尔伽美什", 1),
				character("phainon", "白厄", 100, { eidolon: 2 }),
			],
			skillOverrides: { "phainon-1": "AQ" },
			domainEndOverrides: { "phainon-1-domain-0": true },
			limit: 150,
		}));
		expect(actions.find((action) => action.key === "phainon-1-domain-0")).toMatchObject({
			skill: "Q", isDomainFinalAction: true, gilgameshInterest: 5,
		});
	});

	it("counts one Aha moment by its two Elation participants only once", () => {
		const actions = simulateActions(input({
			characters: [
				character("gil", "吉尔伽美什", 1),
				character("sparxie", "火花", 160),
				character("evanescia", "绯英", 120),
			],
			limit: 200,
		}));
		const aha = actions.find((action) => action.isAhaInstant);
		expect(aha).toBeDefined();
		const elationSkills = actions.filter(
			(action) => action.isElationSkill && action.elationSkillParentKey === aha?.key,
		);
		expect(elationSkills).toHaveLength(2);
		expect(elationSkills.map((action) => action.gilgameshInterest)).toEqual([
			aha?.gilgameshInterest,
			aha?.gilgameshInterest,
		]);
	});

	it("does not gain 兴致 from an Aha moment occurring inside Phainon domain", () => {
		const actions = simulateActions(input({
			characters: [
				character("gil", "吉尔伽美什", 1),
				character("phainon", "白厄", 200),
				character("sparxie", "火花", 160),
			],
			skillOverrides: { "phainon-1": "AQ" },
			limit: 150,
		}));
		const aha = actions.find((action) => action.isAhaInstant);
		expect(actions.find((action) => action.key === "phainon-1-domain-1")).toMatchObject({
			gilgameshInterest: 6,
		});
		expect(aha).toMatchObject({ gilgameshInterest: 6 });
	});

	it("emits a Z combo after every eighth Gilgamesh/Saber attack without adding 兴致 for Z", () => {
		const actions = simulateActions(input({
			characters: [character("gil", "吉尔伽美什", 100), character("saber", "Saber", 100)],
			limit: 500,
		}));
		const combo = actions.find((action) => action.isGilgameshComboAction);
		expect(combo).toMatchObject({ skill: "Z", isFuaAction: true, gilgameshInterest: 7 });
	});
});
