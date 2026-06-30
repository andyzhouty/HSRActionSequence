import { describe, expect, it } from "vitest";
import type {
	CharacterConfig,
	SkillCode,
} from "../src/utils/actionSequence";
import {
	type SimulateActionsInput,
	simulateActions,
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

// ───── 遐蝶死龙 ─────

describe("Castorice (遐蝶) Pollux Summon", () => {
	it("遐蝶 Q 召唤死龙，死龙立即行动", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
				}),
				limit: 200,
			}),
		);

		// castorice-1 (A, AV=100) → castorice-1-q (Q, AV=100, summon pollux)
		// pollux-1 at AV=100
		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBeGreaterThanOrEqual(1);
		expect(polluxActions[0].actionValue).toBeCloseTo(100, 1);
		expect(polluxActions[0].displayName).toBe("死龙");
	});

	it("死龙 EA 行动后驻场（polluxCount < 3）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
				}),
				limit: 400,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBeGreaterThanOrEqual(2);
		// First pollux action is EA (no despawn), second action follows
		expect(polluxActions[0].skill).toBe("EA");
		expect(polluxActions[1].actionValue).toBeGreaterThan(
			polluxActions[0].actionValue,
		);
	});

	it("死龙 E 行动后离场", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E",
				}),
				limit: 400,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBe(1);
		expect(polluxActions[0].skill).toBe("E");
	});

	it("死龙 3 回合后自动离场", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "A",
					"castorice-pollux-2": "A",
					"castorice-pollux-3": "A",
				}),
				limit: 600,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		// After 3 A actions, pollux should despawn (3 actions = polluxCount=3)
		expect(polluxActions.length).toBe(3);
	});

	it("死龙离场后遐蝶可再次 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E",
					"castorice-2": "AQ",
				}),
				limit: 500,
			}),
		);

		// First Q → pollux → E despawn → second Q possible
		const castoriceQ = actions.filter(
			(a) => a.characterId === "castorice" && a.skill === "Q",
		);
		expect(castoriceQ.length).toBe(2);
	});

	it("E2 遐蝶自拉条 100%，排在死龙之前", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
				}),
				limit: 200,
			}),
		);

		// E2: after Q, castorice self-advance 100% → castorice-2 before pollux-1
		const castorice2 = actions.find(
			(a) => a.characterId === "castorice" && a.actionNo === 2,
		);
		const pollux1 = actions.find((a) => a.isPolluxAction);
		expect(castorice2).toBeDefined();
		expect(pollux1).toBeDefined();
		// castorice should act before pollux (both at ~100 AV)
		const castoriceIdx = actions.indexOf(castorice2!);
		const polluxIdx = actions.indexOf(pollux1!);
		expect(castoriceIdx).toBeLessThan(polluxIdx);
	});

	it("E2 QE 不产生独立 main action，自拉条后下一动继承 E", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"castorice-1": "QE",
				}),
				limit: 300,
			}),
		);

		// QE with E2: only Q front action, no separate E main action
		// Castorice actions: c1-1-q (Q, AV=100) → c1-2 (E, AV=100, pulled by E2)
		const castoriceActions = actions.filter(
			(a) => a.characterId === "castorice",
		);
		console.log("Castorice actions:", castoriceActions.map(a => a.key + " skill=" + a.skill + " AV=" + a.actionValue).join(", "));

		// Should NOT have a separate E action at the same AV as the Q
		const mainE = castoriceActions.find(
			(a) => a.key === "castorice-1" && a.skill === "E",
		);
		expect(mainE).toBeUndefined();

		// The pulled action should have skill E
		const pulledAction = castoriceActions.find(
			(a) => a.actionNo === 2,
		);
		expect(pulledAction).toBeDefined();
		expect(pulledAction?.skill).toBe("E");
	});
});
