import { describe, expect, it } from "vitest";
import {
	type CharacterConfig,
	type SkillCode,
} from "../src/utils/actionSequence";
import {
	simulateActions,
	type SimulateActionsInput,
} from "../src/utils/simulateActions";

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
		hasEidolon1: false,
		hasEidolon2: false,
		hasEidolon4: false,
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

function skills(
	entries: Record<string, string>,
): Record<string, SkillCode> {
	return entries;
}

// ───── Aglaea Supreme Stance Activation ─────

describe("Aglaea Supreme Stance activation", () => {
	it("activates Supreme Stance from a normal ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "Q",
				}),
				limit: 140,
			}),
		);

		expect(actions.map((action) => action.key).slice(0, 3)).toEqual([
			"aglaea-1",
			"aglaea-2",
			"aglaea-garmentmaker-1",
		]);
		expect(actions.find((action) => action.key === "aglaea-2"))
			.toMatchObject({
				isAglaeaSupremeAction: true,
				actionValue: 100,
			});
	});

	it("resets Supreme Stance countdown instead of keeping the old one", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "Q",
					"aglaea-2": "Q",
				}),
				limit: 230,
			}),
		);
		const countdowns = actions.filter(
			(action) => action.isAglaeaCountdownAction,
		);
		expect(countdowns).toHaveLength(1);
		expect(countdowns[0].actionValue).toBeCloseTo(200, 4);
	});

	it("ignores stale manual override after Supreme Stance countdown reset", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "Q",
					"aglaea-2": "Q",
				}),
				overrides: {
					"aglaea-aglaea-countdown-1": "150",
				},
				limit: 230,
			}),
		);
		const countdown = actions.find(
			(action) => action.isAglaeaCountdownAction,
		);
		expect(countdown).toBeDefined();
		// The stale override should be ignored because the countdown was reset
		// by the second Q, so the AV should reflect the reset, not the override
		expect(countdown!.actionValue).toBeCloseTo(200, 4);
	});

	it("activates Supreme Stance from an interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("aglaea", "阿格莱雅", 100),
				],
				ultInterrupts: {
					"a-1": [{ casterId: "aglaea", timing: "before" }],
				},
				limit: 160,
			}),
		);

		expect(actions.map((action) => action.key).slice(0, 3)).toEqual([
			"a-1-interrupt-0",
			"a-1",
			"aglaea-1",
		]);
	});
});

// ───── Aglaea Countdown Manual Advance ─────

describe("Aglaea countdown manual advance", () => {
	it("countdown fires at normal AV without override", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "Q" }),
				limit: 250,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeCloseTo(200, 4);

		const garmentmaker = actions.filter(
			(a) => a.isAglaeaGarmentmakerAction,
		);
		expect(garmentmaker.length).toBeGreaterThan(0);
		expect(garmentmaker[0].actionValue).toBeLessThan(
			countdown!.actionValue,
		);
	});

	it("manual advance fires countdown early and dismisses garmentmaker", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "Q" }),
				overrides: {
					"aglaea-aglaea-countdown-1": "120",
				},
				limit: 250,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeCloseTo(120, 4);

		const aglaeaAfter = actions.filter(
			(a) =>
				a.characterId === "aglaea" &&
				a.actionValue > countdown!.actionValue,
		);
		if (aglaeaAfter.length > 0) {
			expect(
				aglaeaAfter.some((a) => a.isAglaeaSupremeAction),
			).toBe(false);
		}

		const garmentmakerAfter = actions.filter(
			(a) =>
				a.isAglaeaGarmentmakerAction &&
				a.actionValue > countdown!.actionValue,
		);
		expect(garmentmakerAfter).toHaveLength(0);
	});

	it("manual delay lets supreme stance continue longer", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "Q" }),
				overrides: {
					"aglaea-aglaea-countdown-1": "300",
				},
				limit: 400,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeCloseTo(300, 4);

		const garmentmakerCount = actions.filter(
			(a) => a.isAglaeaGarmentmakerAction,
		).length;
		expect(garmentmakerCount).toBeGreaterThan(1);
	});

	it("speed adjustment on countdown is ignored (countdown fires at set speed)", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "Q" }),
				speedAdjustments: {
					"aglaea-aglaea-countdown-1": {
						mode: "absolute",
						value: "-20",
					},
				},
				limit: 250,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeCloseTo(200, 4);
		expect(countdown!.speed).toBe(100);
	});

	it("second Q during supreme stance resets countdown", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "Q",
					"aglaea-2": "Q",
				}),
				limit: 250,
			}),
		);

		const countdowns = actions.filter(
			(a) => a.isAglaeaCountdownAction,
		);
		expect(countdowns).toHaveLength(1);

		const secondQ = actions.find((a) => a.key === "aglaea-2");
		expect(secondQ).toBeDefined();
		expect(countdowns[0].actionValue).toBeGreaterThan(
			secondQ!.actionValue,
		);
	});

	it("second Q resets countdown even if first was manually advanced", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "Q",
					"aglaea-2": "Q",
				}),
				overrides: {
					"aglaea-aglaea-countdown-1": "130",
				},
				limit: 250,
			}),
		);

		const countdowns = actions.filter(
			(a) => a.isAglaeaCountdownAction,
		);
		expect(countdowns).toHaveLength(1);

		const secondQ = actions.find((a) => a.key === "aglaea-2");
		expect(secondQ).toBeDefined();
		expect(countdowns[0].actionValue).toBeGreaterThan(
			secondQ!.actionValue,
		);
	});
});
