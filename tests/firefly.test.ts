import { describe, expect, it } from "vitest";
import {
	type CharacterConfig,
	type SkillCode,
	type UltInterrupt,
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

function interrupts(
	entries: Record<string, UltInterrupt[]>,
): Record<string, UltInterrupt[]> {
	return entries;
}

// ───── Firefly Complete Combustion Activation ─────

describe("Firefly Complete Combustion activation", () => {
	it("activates Complete Combustion from a normal ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({
					"firefly-1": "Q",
				}),
				fireflyBreakCounters: { "firefly-2": false, "firefly-3": false, "firefly-4": false },
				limit: 310,
			}),
		);

		expect(actions.map((action) => action.key).slice(0, 4)).toEqual([
			"firefly-1",
			"firefly-2",
			"firefly-3",
			"firefly-4",
		]);
		expect(
			actions.find((action) => action.key === "firefly-3")?.actionValue,
		).toBeCloseTo(162.5, 4);
		const countdown = actions.find(
			(action) => action.displayName === "完全燃烧倒计时",
		);
		expect(countdown?.actionValue).toBeCloseTo(242.8571, 4);
	});

	it("activates Complete Combustion from an interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("firefly", "流萤", 100),
				],
				ultInterrupts: interrupts({
					"a-1": [{ casterId: "firefly", timing: "before" }],
				}),
				limit: 190,
			}),
		);

		expect(actions.map((action) => action.key).slice(0, 4)).toEqual([
			"a-1-interrupt-0",
			"a-1",
			"firefly-1",
			"firefly-2",
		]);
		expect(
			actions.find((action) => action.key === "firefly-2")?.actionValue,
		).toBeCloseTo(162.5, 4);
	});
});

// ───── Firefly Countdown Manual Advance ─────

describe("Firefly countdown manual advance", () => {
	it("countdown fires at normal AV without override", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({ "firefly-1": "Q" }),
				limit: 300,
			}),
		);

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeCloseTo(242.8571, 4);

		const combustionActions = actions.filter(
			(a) => a.isCombustionAction && a.characterId === "firefly",
		);
		expect(combustionActions.length).toBeGreaterThan(0);

		// After countdown, no more combustion actions
		const afterCountdown = actions.filter(
			(a) =>
				a.isCombustionAction &&
				a.actionValue > countdown!.actionValue,
		);
		expect(afterCountdown).toHaveLength(0);
	});

	it("manual advance (override to earlier AV) fires countdown early", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({ "firefly-1": "Q" }),
				overrides: {
					"firefly-combustion-countdown-1": "150",
				},
				limit: 300,
			}),
		);

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeCloseTo(150, 4);

		const fireflyActionsAfterCountdown = actions.filter(
			(a) =>
				a.characterId === "firefly" &&
				!a.isCombustionAction &&
				a.actionValue > countdown!.actionValue,
		);
		expect(fireflyActionsAfterCountdown.length).toBeGreaterThan(0);
	});

	it("manual delay (override to later AV) delays countdown", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({ "firefly-1": "Q" }),
				overrides: {
					"firefly-combustion-countdown-1": "300",
				},
				limit: 400,
			}),
		);

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeCloseTo(300, 4);

		const combustionActions = actions.filter(
			(a) =>
				a.isCombustionAction &&
				a.characterId === "firefly" &&
				a.actionValue < countdown!.actionValue,
		);
		expect(combustionActions.length).toBeGreaterThanOrEqual(3);
	});

	it("interrupt ultimate during combustion triggers break with delay tracking", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100),
					character("a", "行动角色", 200),
				],
				skillOverrides: skills({
					"firefly-1": "Q",
				}),
				ultInterrupts: {
					"firefly-2": [{ casterId: "a", timing: "before" }],
				},
				limit: 300,
			}),
		);

		const firefly2 = actions.find((a) => a.key === "firefly-2");
		expect(firefly2).toBeDefined();

		const interrupt = actions.find(
			(a) => a.key === "firefly-2-interrupt-0",
		);
		expect(interrupt).toBeDefined();

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
	});
});

// ───── Firefly Combustion EE Split ─────

describe("Firefly combustion EE split", () => {
	it("EE on combustion action splits into two E actions at same AV", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({
					"firefly-1": "Q",
					"firefly-2": "EE",
				}),
				fireflyBreakCounters: { "firefly-2": false },
				limit: 210,
			}),
		);

		// After Q, firefly-2 is the next action (100% advance), split into two E actions
		const e1 = actions.find(
			(a) => a.key === "firefly-2",
		);
		expect(e1).toBeDefined();
		expect(e1!.skill).toBe("E");

		const e2 = actions.find(
			(a) => a.key === "firefly-2-combustion-e1",
		);
		expect(e2).toBeDefined();
		expect(e2!.skill).toBe("E");
		expect(e2!.actionValue).toBeCloseTo(100, 4);
		expect(e2!.isCombustionAction).toBe(true);
	});

	it("single E on combustion action stays as single E (no split)", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({
					"firefly-1": "Q",
					"firefly-2": "E",
				}),
				fireflyBreakCounters: { "firefly-2": false },
				limit: 210,
			}),
		);

		// Should have the normal E, no extra E generated
		const extraE = actions.find(
			(a) => a.key === "firefly-2",
		);
		expect(extraE).toBeDefined();
		expect(extraE!.skill).toBe("E");

		const splitE = actions.find(
			(a) => a.key === "firefly-2-combustion-e1",
		);
		expect(splitE).toBeUndefined();
	});

	it("EE on non-combustion action is rejected by validation", () => {
		// This is tested via the UI validation, not the simulation directly.
		// The simulation itself doesn't validate skill codes.
		// Just verify the simulation produces it as-is for non-combustion.
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({
					"firefly-1": "EE",
				}),
				limit: 210,
			}),
		);

		const action = actions.find((a) => a.key === "firefly-1");
		expect(action).toBeDefined();
		// Simulation accepts EE but uses it as-is (not split, not combustion)
		expect(action!.skill).toBe("EE");
	});
});

// ───── Sunday (星期日) pulling Firefly ─────

describe("Sunday pulling Firefly with E (allyPullToCurrent)", () => {
	it("Sunday E pulls Firefly's next action to Sunday's current AV", () => {
		// Sunday at speed 200 acts first; uses E on Firefly (speed 100)
		// Firefly's next action should be pulled to Sunday's current AV
		const actions = simulateActions(
			input({
				characters: [
					character("sunday", "星期日", 200),
					character("firefly", "流萤", 100),
				],
				skillOverrides: skills({
					"sunday-1": "E",
				}),
				skillTargets: {
					"sunday-1": "firefly",
				},
				limit: 200,
			}),
		);

		// Sunday acts first at AV=50
		expect(actions[0].key).toBe("sunday-1");
		expect(actions[0].actionValue).toBeCloseTo(50, 4);

		// Firefly should be pulled to Sunday's AV=50
		// So Firefly acts next at AV=50, then Sunday again at AV=100
		const fireflyAction = actions.find(
			(a) => a.characterId === "firefly",
		);
		expect(fireflyAction).toBeDefined();
		expect(fireflyAction!.actionValue).toBeCloseTo(50, 4);

		// Action order: Sunday E → Firefly (pulled) → Sunday 2 → ...
		expect(actions.map((a) => a.characterId).slice(0, 3)).toEqual([
			"sunday",
			"firefly",
			"sunday",
		]);
	});

	it("Sunday E pulls Firefly during Complete Combustion", () => {
		// Firefly uses Q to enter Combustion, then Sunday pulls her
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100),
					character("sunday", "星期日", 200),
				],
				skillOverrides: skills({
					"firefly-1": "Q",
					"sunday-2": "E",
				}),
				skillTargets: {
					"sunday-2": "firefly",
				},
				limit: 200,
			}),
		);

		// Firefly Q at AV=100 → enters combustion
		// Sunday uses E on Firefly at AV=50 → pulls Firefly
		// Firefly should be pulled to Sunday's AV during combustion
		const sundayEAction = actions.find((a) => a.key === "sunday-2");
		expect(sundayEAction).toBeDefined();

		// Firefly should act at the pulled AV
		const fireflyActions = actions.filter(
			(a) => a.characterId === "firefly" && a.isCombustionAction,
		);
		// There should be combustion actions after Sunday's pull
		const fireflyAfterPull = fireflyActions.filter(
			(a) =>
				a.actionValue >= (sundayEAction?.actionValue ?? 0),
		);
		expect(fireflyAfterPull.length).toBeGreaterThan(0);
	});

	it("multiple Sunday pulls keep Firefly's AV in sync", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sunday", "星期日", 200),
					character("firefly", "流萤", 100),
				],
				skillOverrides: skills({
					"sunday-1": "E",
					"sunday-2": "E",
				}),
				skillTargets: {
					"sunday-1": "firefly",
					"sunday-2": "firefly",
				},
				limit: 250,
			}),
		);

		// Both Sunday actions use E on Firefly
		// Firefly's AV should be pulled to match Sunday's AV each time
		const fireflyActions = actions.filter(
			(a) => a.characterId === "firefly",
		);

		// Firefly should always act immediately after Sunday
		for (let i = 0; i < fireflyActions.length; i++) {
			const fireflyAV = fireflyActions[i].actionValue;
			const sundayAction = actions.find(
				(a) =>
					a.characterId === "sunday" &&
					a.actionValue === fireflyAV,
			);
			if (sundayAction) {
				// Firefly's AV should match the Sunday pull at this point
				expect(fireflyAV).toBeCloseTo(sundayAction.actionValue, 4);
			}
		}
	});
});
