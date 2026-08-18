import { describe, expect, it } from "vitest";
import { simulateActions } from "../../../src/simulate/actions";
import { isNonAttackSkill } from "../../../src/utils/action-sequence";
import {
	character,
	input,
	skills,
} from "../../helpers/simulateActionTestUtils";

describe("缇宝终结技追加攻击", () => {
	it("其他角色 Q 各触发一次，缇宝 Q 重置其可触发次数", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("tribbie", "缇宝", 100),
					character("ally", "丹恒", 200),
				],
				skillOverrides: skills({
					"ally-1": "AQ",
					"ally-2": "AQ",
					"ally-3": "AQ",
					"tribbie-1": "AQ",
				}),
				limit: 170,
			}),
		);
		const tribbieFuas = actions.filter((action) => action.isTribbieFuaAction);
		expect(tribbieFuas.map((action) => action.key)).toEqual([
			"ally-1-tribbie-fua",
			"ally-2-tribbie-fua",
		]);
		expect(
			tribbieFuas.every((action) => action.skill === "Z" && action.lockedSkill),
		).toBe(true);
	});

	it("E6 缇宝自身 Q 也会触发 Z", () => {
		const actions = simulateActions(
			input({
				characters: [character("tribbie", "缇宝", 100, { eidolon: 6 })],
				skillOverrides: skills({ "tribbie-1": "AQ" }),
				limit: 110,
			}),
		);
		expect(
			actions.find((action) => action.key === "tribbie-1-tribbie-fua"),
		).toMatchObject({
			skill: "Z",
			isTribbieFuaAction: true,
			lockedSkill: true,
		});
	});

	it("E 固定非攻击，Q 保持攻击判定", () => {
		const tribbie = character("tribbie", "缇宝", 100);
		expect(isNonAttackSkill(tribbie, "E")).toBe(true);
		expect(isNonAttackSkill(tribbie, "Q")).toBe(false);
	});
});
