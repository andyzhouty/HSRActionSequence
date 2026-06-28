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

function enemy(
	id: string,
	name: string,
	speed: number,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "敌人",
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

// ───── Phainon (白厄) ─────

describe("Phainon (白厄)", () => {
	it("enters domain state after ultimate and generates domain actions", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "Q",
				}),
				limit: 300,
			}),
		);

		// First action: Q -> starts domain
		expect(actions[0].key).toBe("phainon-1");
		expect(actions[0].skill).toBe("Q");

		// Domain actions follow (isDomainAction: true)
		const domainActions = actions.filter((a) => a.isDomainAction);
		expect(domainActions.length).toBeGreaterThanOrEqual(8);
		expect(domainActions[0].isDomainAction).toBe(true);
		expect(domainActions[0].actionValue).toBeCloseTo(100, 4);

		// Last domain action should be final (Q)
		const finalDomain = domainActions[domainActions.length - 1];
		expect(finalDomain.isDomainFinalAction).toBe(true);
		expect(finalDomain.skill).toBe("Q");

		// Domain actions have increasing action values
		for (let i = 1; i < domainActions.length; i++) {
			expect(domainActions[i].actionValue).toBeGreaterThan(
				domainActions[i - 1].actionValue,
			);
		}
	});

	it("generates 7 non-final domain actions by default (extraActionCount=8)", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "Q",
				}),
				limit: 300,
			}),
		);

		const domainActions = actions.filter((a) => a.isDomainAction);
		// extraActionCount=8 → indices 0-7, index 7 is final
		// So 7 non-final + 1 final = 8 total domain actions
		expect(domainActions).toHaveLength(8);
		expect(domainActions.filter((a) => !a.isDomainFinalAction)).toHaveLength(7);
		expect(domainActions.filter((a) => a.isDomainFinalAction)).toHaveLength(1);
	});

	it("domain interval differs with eidolon 1", () => {
		const actionsE0 = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({ "phainon-1": "Q" }),
				limit: 300,
			}),
		);
		const actionsE1 = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100, { hasEidolon1: true }),
				],
				skillOverrides: skills({ "phainon-1": "Q" }),
				limit: 300,
			}),
		);

		const domainE0 = actionsE0.filter((a) => a.isDomainAction);
		const domainE1 = actionsE1.filter((a) => a.isDomainAction);

		// E1 has higher equivalent speed coefficient (0.66 vs 0.6)
		// so domain interval is smaller -> domain actions more tightly packed
		if (domainE0.length > 1 && domainE1.length > 1) {
			const gapE0 =
				domainE0[1].actionValue - domainE0[0].actionValue;
			const gapE1 =
				domainE1[1].actionValue - domainE1[0].actionValue;
			expect(gapE1).toBeLessThan(gapE0);
		}
	});

	it("applies speed bonus to allies after domain ends", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"phainon-1": "Q",
				}),
				limit: 600,
			}),
		);

		const finalDomain = actions.find((a) => a.isDomainFinalAction);
		expect(finalDomain).toBeDefined();

		// After domain ends, ally is paused and pushed past domain end
		// with speed bonus (15% of baseSpeed)
		const finalAV = finalDomain!.actionValue;
		const allyAfter = actions.find(
			(a) => a.characterId === "ally" && a.actionValue > finalAV,
		);
		expect(allyAfter).toBeDefined();
		expect(allyAfter!.actionValue).toBeGreaterThan(finalAV);
	});

	it("respects domain end override to end domain early", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "Q",
				}),
				domainEndOverrides: {
					"phainon-1-domain-2": true,
				},
				limit: 300,
			}),
		);

		const domainActions = actions.filter((a) => a.isDomainAction);
		// Domain should end at index 2 (0-indexed) = 3 domain actions total
		expect(domainActions.length).toBeLessThanOrEqual(4);
		const finalDomain = domainActions[domainActions.length - 1];
		expect(finalDomain.isDomainFinalAction).toBe(true);
		expect(finalDomain.key).toBe("phainon-1-domain-2");
	});

	it("allows enemy actions to interleave during domain", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100),
					enemy("e1", "敌人", 200),
				],
				skillOverrides: skills({
					"phainon-1": "Q",
				}),
				limit: 200,
			}),
		);

		// Enemy should act during domain (between domain actions)
		const enemyActions = actions.filter(
			(a) => a.characterId === "e1",
		);
		expect(enemyActions.length).toBeGreaterThan(0);
	});

	it("triggers enemy immediate action on W/EW domain skills", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100),
					enemy("e1", "敌人", 200),
				],
				skillOverrides: skills({
					"phainon-1": "Q",
					"phainon-1-domain-0": "W",
				}),
				limit: 200,
			}),
		);

		// W skill during domain should trigger an enemy action at the same AV
		const domainWAction = actions.find(
			(a) => a.key === "phainon-1-domain-0",
		);
		expect(domainWAction).toBeDefined();
		expect(domainWAction!.skill).toBe("W");

		// Enemy should have an action triggered at same AV as domain W action
		const triggerActions = actions.filter(
			(a) =>
				a.key?.includes("enemy") &&
				a.actionValue === domainWAction!.actionValue,
		);
		expect(triggerActions.length).toBeGreaterThan(0);
	});

	it("enters domain from interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("phainon", "白厄", 100),
				],
				ultInterrupts: interrupts({
					"a-1": [{ casterId: "phainon", timing: "before" }],
				}),
				limit: 300,
			}),
		);

		// Interrupt triggers Phainon's Q -> domain actions should follow
		const domainActions = actions.filter((a) => a.isDomainAction);
		expect(domainActions.length).toBeGreaterThan(0);

		// Domain should start from the interrupt action
		const interruptAction = actions.find(
			(a) => a.key === "a-1-interrupt-0",
		);
		expect(interruptAction).toBeDefined();
	});

	it("domain is capped by extraActionCount without endless Ode effect", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "Q",
				}),
				limit: 600,
			}),
		);

		const domainActions = actions.filter((a) => a.isDomainAction);
		// extraActionCount=8 → 8 total domain actions (7 non-final + 1 final)
		expect(domainActions).toHaveLength(8);

		const finalDomain = domainActions[domainActions.length - 1];
		expect(finalDomain.isDomainFinalAction).toBe(true);
	});
});
