import { describe, expect, it } from "vitest";
import {
	applyMessengerSpeedBuff,
	shouldTriggerMessengerUltimate,
} from "../../../src/mechanics/relicEffects";
import { simulateActions } from "../../../src/simulate/actions";
import { buildInitialStates } from "../../../src/simulate/init";
import type { CharacterConfig } from "../../../src/utils/action-sequence";
import {
	character,
	input,
	skills,
} from "../../helpers/simulateActionTestUtils";

function attackingCharacter(
	id: string,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return character(id, "普通角色", 100, {
		hasMessengerSet: true,
		...overrides,
	});
}

describe("信使套", () => {
	it("非攻击型终结技无需选择目标即可触发", () => {
		const ruanMei = character("ruan", "阮梅", 100, {
			hasMessengerSet: true,
		});

		expect(shouldTriggerMessengerUltimate(ruanMei, undefined)).toBe(true);
	});

	it("攻击型终结技仅在目标为我方时触发", () => {
		const attacker = attackingCharacter("attacker");

		expect(shouldTriggerMessengerUltimate(attacker, "角色")).toBe(true);
		expect(shouldTriggerMessengerUltimate(attacker, "忆灵")).toBe(true);
		expect(shouldTriggerMessengerUltimate(attacker, "敌人")).toBe(false);
		expect(shouldTriggerMessengerUltimate(attacker, "敌人", true)).toBe(true);
		expect(
			shouldTriggerMessengerUltimate(
				attackingCharacter("both", { hasWindSet: true }),
				"角色",
			),
		).toBe(false);
	});

	it("对我方目标施放攻击型终结技后，全队速度提高 12% 并持续一回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					attackingCharacter("attacker"),
					character("ally", "队友", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				skillOverrides: skills({ "attacker-1": "AQ" }),
				skillTargets: { "attacker-1": "ally" },
				limit: 320,
			}),
		);

		const allyActions = actions.filter(
			(action) => action.characterId === "ally",
		);
		const attackerActions = actions.filter(
			(action) => action.characterId === "attacker",
		);
		expect(allyActions[0]?.speed).toBeCloseTo(112, 4);
		expect(allyActions[1]?.speed).toBeCloseTo(100, 4);
		expect(attackerActions[2]?.speed).toBeCloseTo(112, 4);
		expect(attackerActions[3]?.speed).toBeCloseTo(100, 4);
	});

	it("攻击型终结技对敌人时不触发", () => {
		const actions = simulateActions(
			input({
				characters: [
					attackingCharacter("attacker"),
					character("ally", "队友", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				skillOverrides: skills({ "attacker-1": "AQ" }),
				skillTargets: { "attacker-1": "enemy" },
				limit: 220,
			}),
		);

		const allyActions = actions.filter(
			(action) => action.characterId === "ally",
		);
		expect(allyActions[0]?.speed).toBeCloseTo(100, 4);
	});

	it("Q 选择不攻击时即使目标为敌人也触发", () => {
		const actions = simulateActions(
			input({
				characters: [
					attackingCharacter("attacker"),
					character("ally", "队友", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				skillOverrides: skills({ "attacker-1": "AQ" }),
				skillTargets: { "attacker-1": "enemy" },
				attackDisabled: { "attacker-1-q": true },
				limit: 220,
			}),
		);

		const allyActions = actions.filter(
			(action) => action.characterId === "ally",
		);
		expect(allyActions[0]?.speed).toBeCloseTo(112, 4);
	});

	it("多个信使套同时触发也不会叠加速度", () => {
		const states = buildInitialStates([
			attackingCharacter("first"),
			attackingCharacter("second"),
			character("ally", "队友", 100),
		]);

		applyMessengerSpeedBuff(states, "first", 100);
		applyMessengerSpeedBuff(states, "second", 100);

		for (const state of states) {
			expect(state.currentSpeed).toBeCloseTo(112, 4);
			expect(state.messengerSpeedBuffTurns).toBe(1);
		}
	});
});
