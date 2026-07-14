import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import { getDisplayOrderedActions } from "../../src/utils/actionDisplayOrder";
import { character, input } from "../helpers/simulateActionTestUtils";

describe("万敌血仇", () => {
	it("E6 开场进入血仇，弑神登神生成最高优先级的锁定 E 额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("mydei", "万敌", 100, { eidolon: 6 }),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				mydeiGodslayerToggles: { "enemy-1": true },
				limit: 100,
			}),
		);
		const extra = actions.find(
			(action) => action.key === "enemy-1-mydei-godslayer",
		);
		expect(extra).toMatchObject({
			characterId: "mydei",
			skill: "E",
			lockedSkill: true,
			isMydeiGodslayerAction: true,
			actionValue: 50,
		});
		const displayed = getDisplayOrderedActions(actions);
		expect(displayed.indexOf(extra)).toBeLessThan(
			displayed.findIndex((action) => action.key === "enemy-1"),
		);
	});

	it("E6 以下需先进入血仇，且会将下一正常行动提前至当前回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("mydei", "万敌", 100, { eidolon: 5 }),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				mydeiVendettaToggles: { "enemy-1": true },
				mydeiGodslayerToggles: { "enemy-1": true },
				limit: 100,
			}),
		);
		expect(
			actions.find((action) => action.key === "mydei-1")?.actionValue,
		).toBe(50);
		expect(
			actions.find((action) => action.key === "enemy-1-mydei-godslayer"),
		).toBeDefined();
	});

	it("E6 以下未进入血仇时不能触发弑神登神", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("mydei", "万敌", 100, { eidolon: 5 }),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				mydeiGodslayerToggles: { "enemy-1": true },
				limit: 100,
			}),
		);
		expect(actions.some((action) => action.isMydeiGodslayerAction)).toBe(false);
	});
});
