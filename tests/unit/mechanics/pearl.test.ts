import { describe, expect, it } from "vitest";
import {
	getCharacterParticipantId,
	hasSkillEffect,
} from "../../../src/data/characters";
import { simulateActions } from "../../../src/simulate/actions";
import {
	canSelectSkillTargetForAction,
	isNonAttackSkill,
} from "../../../src/utils/action-sequence";
import {
	getDisplayOrderedActions,
	getExtraTurnParentKey,
} from "../../../src/utils/actionDisplayOrder";
import {
	character,
	input,
	interrupts,
	skills,
} from "../../helpers/simulateActionTestUtils";

function runPearlUltimate(params: {
	allies?: ReturnType<typeof character>[];
	eidolon?: number;
	targetId?: string;
}) {
	const pearl = character("pearl", "真珠", 200, {
		eidolon: params.eidolon ?? 0,
	});
	const target = character("target", "停云", 100);
	return simulateActions(
		input({
			characters: [pearl, ...(params.allies ?? []), target],
			skillOverrides: skills({ "pearl-1": "AQ" }),
			skillTargets: {
				"pearl-1": params.targetId ?? "target",
			},
			limit: 200,
		}),
	);
}

describe("真珠行动轴机制", () => {
	it("使用参演编号 104，并识别 Pearl 别名", () => {
		expect(getCharacterParticipantId("真珠")).toBe(104);
		expect(getCharacterParticipantId("Pearl")).toBe(104);
		expect(hasSkillEffect("真珠", "Q", "pearlUltimate")).toBe(true);
	});

	it("战技和欢愉技不视为攻击", () => {
		expect(isNonAttackSkill(character("pearl", "真珠", 100), "E")).toBe(
			true,
		);
		expect(isNonAttackSkill(character("pearl", "真珠", 100), "ES")).toBe(true);
	});

	it.each([
		{ name: "1 名欢愉角色时提前 10%", allies: [], expected: 90 },
		{
			name: "2 名欢愉角色时提前 15%",
			allies: [character("sparxie", "火花", 100)],
			expected: 85,
		},
		{
			name: "3 名欢愉角色时提前 30%",
			allies: [
				character("sparxie", "火花", 100),
				character("yaoguang", "爻光", 100),
			],
			expected: 70,
		},
	])("$name", ({ allies, expected }) => {
		const actions = runPearlUltimate({ allies });
		expect(actions.find((action) => action.key === "pearl-1-q")).toMatchObject({
			skill: "Q",
		});
		const targetAction = actions.find((action) => action.key === "target-1");

		expect(targetAction?.actionValue).toBeCloseTo(expected, 4);
	});

	it("4 名欢愉角色时为目标生成一个额外回合", () => {
		const actions = runPearlUltimate({
			allies: [
				character("sparxie", "火花", 100),
				character("yaoguang", "爻光", 100),
				character("evanescia", "绯英", 100),
			],
		});
		const extraActions = actions.filter((action) => action.isPearlExtraAction);

		expect(extraActions).toHaveLength(1);
		expect(extraActions[0]).toMatchObject({
			key: "pearl-1-pearl-extra-target",
			characterId: "target",
			actionValue: 50,
			skill: "A",
		});
		expect(getExtraTurnParentKey(extraActions[0])).toBe("pearl-1");
		const ordered = getDisplayOrderedActions(actions);
		expect(
			ordered.findIndex((action) => action.key === "pearl-1-q"),
		).toBeLessThan(ordered.findIndex((action) => action.isPearlExtraAction));
	});

	it("星魂 2 额外提前其他欢愉角色，但不重复提前真珠和目标", () => {
		const actions = runPearlUltimate({
			eidolon: 2,
			allies: [
				character("sparxie", "火花", 100),
				character("yaoguang", "爻光", 100),
			],
		});

		expect(
			actions.find((action) => action.key === "sparxie-1")?.actionValue,
		).toBeCloseTo(70, 4);
		expect(
			actions.find((action) => action.key === "yaoguang-1")?.actionValue,
		).toBeCloseTo(70, 4);
		expect(
			actions.find((action) => action.key === "pearl-2")?.actionValue,
		).toBeCloseTo(100, 4);
		expect(
			actions.find((action) => action.key === "target-1")?.actionValue,
		).toBeCloseTo(70, 4);
	});

	it("只接受除自身外的我方角色作为目标", () => {
		const pearl = character("pearl", "真珠", 200);
		const ally = character("ally", "停云", 100);
		const memosprite = {
			...character("meme", "迷迷", 100),
			kind: "忆灵" as const,
		};

		expect(canSelectSkillTargetForAction(pearl, ally)).toBe(true);
		expect(canSelectSkillTargetForAction(pearl, memosprite)).toBe(false);

		const selfTargetActions = runPearlUltimate({ targetId: "pearl" });
		expect(selfTargetActions.some((action) => action.isPearlExtraAction)).toBe(
			false,
		);
		const invalidTargetActions = simulateActions(
			input({
				characters: [pearl, memosprite, ally],
				skillOverrides: skills({ "pearl-1": "AQ" }),
				skillTargets: { "pearl-1": "meme" },
				limit: 150,
			}),
		);
		expect(
			invalidTargetActions.find((action) => action.key === "meme-1"),
		).toMatchObject({ actionValue: 100 });
		expect(
			invalidTargetActions.some((action) => action.isPearlExtraAction),
		).toBe(false);
	});

	it("普通施放与插队施放的 Q 使用相同行动提前结果", () => {
		const normalActions = runPearlUltimate({});
		const interruptActions = simulateActions(
			input({
				characters: [
					character("trigger", "停云", 200),
					character("pearl", "真珠", 100),
					character("target", "布洛妮娅", 100),
				],
				ultInterrupts: interrupts({
					"trigger-1": [{ casterId: "pearl", timing: "before" }],
				}),
				skillTargets: { "trigger-1-interrupt-0": "target" },
				limit: 150,
			}),
		);

		expect(
			interruptActions.find((action) => action.key === "target-1")?.actionValue,
		).toBeCloseTo(
			normalActions.find((action) => action.key === "target-1")?.actionValue ??
				0,
			4,
		);
	});
});
