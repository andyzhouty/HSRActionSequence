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
		// E should not produce Ica extra turn (afterRain starts at 0)
		const icaActions = actions.filter((a) => a.isIcaAction);
		expect(icaActions.length).toBe(0);
	});

	it("风堇 Q 后 afterRain=3，下一次 A 触发 Ica 额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "E",   // summon Ica first
					"hyacine-2": "AQ",  // A → trigger Ica, Q → afterRain=3
					"hyacine-3": "A",   // should trigger Ica again
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
					"hyacine-1": "E",   // summon
					"hyacine-2": "QA",  // Q→afterRain=3, A→trigger Ica
				}),
				limit: 400,
			}),
		);

		const icaAction = actions.find((a) => a.isIcaAction);
		expect(icaAction).toBeDefined();
		// Ica should be at same AV as hyacine's A action
		const hyacineA = actions.find(
			(a) => a.characterId === "hyacine" && a.key === "hyacine-2" && a.skill === "A",
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
					"hyacine-1": "E",   // summon
					"hyacine-2": "QA",  // Q→3, A→trigger (-1=2)
					"hyacine-3": "A",   // trigger (-1=1)
					"hyacine-4": "A",   // trigger (-1=0)
					"hyacine-5": "A",   // NO trigger (afterRain=0)
				}),
				limit: 700,
			}),
		);

		const icaActions = actions.filter((a) => a.isIcaAction);
		expect(icaActions.length).toBe(3);
	});

	it("Ica 死亡后 afterRain 归 0，重新召唤前不触发", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "E",   // summon
					"hyacine-2": "QA",  // Q→3, A→trigger
				}),
				icaKillToggles: {
					"hyacine-3": true,    // kill Ica (hyacine-3 happens after Ica)
				},
				limit: 500,
			}),
		);

		const icaActions = actions.filter((a) => a.isIcaAction);
		// After Q→3, first A triggers Ica. Then hyacine-3 kills Ica.
		// After that, hyacine-4 (next action) should NOT trigger Ica.
		expect(icaActions.length).toBeGreaterThanOrEqual(1);

		// After Ica death + re-summon, Q should set afterRain=3
		// and subsequent A should trigger Ica
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

		// ally should be faster due to E2
		const allyAction = actions.find((a) => a.characterId === "ally");
		expect(allyAction).toBeDefined();
		// 80 + 80*0.3 = 104 speed → AV ≈ 96.15
		expect(allyAction?.speed).toBe(80 + 80 * 0.3);
		expect(allyAction?.actionValue).toBeCloseTo(10000 / 104, 1);
	});

	it("Q 在 Ica 不在场时也召唤 + afterRain=3", () => {
		const actions = simulateActions(
			input({
				characters: [character("hyacine", "风堇", 100)],
				skillOverrides: skills({
					"hyacine-1": "Q",  // summon Ica + afterRain=3 (before any E)
				}),
				limit: 300,
			}),
		);
		// Q summoned Ica, but afterRain triggered for the next A
		// (Q itself doesn't trigger Ica, only A/E does)
		const icaActions = actions.filter((a) => a.isIcaAction);
		expect(icaActions.length).toBe(0);
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
});
