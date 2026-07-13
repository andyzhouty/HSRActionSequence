import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import { isNonAttackSkill } from "../../src/utils/actionSequence";
import {
	character,
	input,
	skills,
	stripAv0,
} from "../helpers/simulateActionTestUtils";

describe("Saber", () => {
	it("Q 后仅下一次正常行动锁定为 A，之后恢复技能编辑", () => {
		const actions = stripAv0(
			simulateActions(
				input({
					characters: [character("saber", "Saber", 100)],
					skillOverrides: skills({
						"saber-2": "E",
						"saber-3": "E",
					}),
					legacyUltOverrides: { "saber-1": true },
					limit: 310,
				}),
			),
		);

		expect(actions.find((action) => action.key === "saber-1")?.skill).toBe("Q");
		expect(actions.find((action) => action.key === "saber-2")).toMatchObject({
			skill: "A",
			lockedSkill: true,
		});
		const thirdAction = actions.find((action) => action.key === "saber-3");
		expect(thirdAction?.skill).toBe("E");
		expect(thirdAction).not.toHaveProperty("lockedSkill");
	});

	it("任意行动后的 Saber 拉条将其放到该行动值，且可对自身生效", () => {
		const allyPull = stripAv0(
			simulateActions(
				input({
					characters: [
						character("saber", "Saber", 100),
						character("ally", "停云", 200),
					],
					saberAdvanceToggles: { "ally-1": true },
					limit: 110,
				}),
			),
		);
		expect(allyPull.slice(0, 2).map((action) => action.key)).toEqual([
			"ally-1",
			"saber-1",
		]);
		expect(allyPull[1].actionValue).toBe(50);

		const allyBeforeSaber = stripAv0(
			simulateActions(
				input({
					characters: [
						character("ally", "停云", 200),
						character("saber", "Saber", 100),
					],
					saberAdvanceToggles: { "ally-1": true },
					limit: 110,
				}),
			),
		);
		expect(allyBeforeSaber.slice(0, 2).map((action) => action.key)).toEqual([
			"ally-1",
			"saber-1",
		]);

		const selfPull = stripAv0(
			simulateActions(
				input({
					characters: [character("saber", "Saber", 100)],
					saberAdvanceToggles: { "saber-1": true },
					limit: 110,
				}),
			),
		);
		expect(selfPull.slice(0, 2).map((action) => action.actionValue)).toEqual([
			100, 100,
		]);
	});

	it("A/E/Q 固定视为攻击", () => {
		const saber = character("saber", "Saber", 100);
		expect(isNonAttackSkill(saber, "A")).toBe(false);
		expect(isNonAttackSkill(saber, "E")).toBe(false);
		expect(isNonAttackSkill(saber, "Q")).toBe(false);
	});
});
