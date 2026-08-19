import { describe, expect, it } from "vitest";
import {
	buildCharacterSelectors,
	buildMemospriteTargets,
} from "../../../src/contexts/actionSequenceSelectors";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../../../src/utils/action-sequence";

function character(
	id: string,
	name: string,
	kind: CharacterConfig["kind"] = "角色",
): CharacterConfig {
	return {
		id,
		kind,
		name,
		speed: "100",
		baseSpeed: "100",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
	};
}

describe("行动序列 selector", () => {
	it("只根据输入构建稳定的角色查询表", () => {
		const actions = [
			{
				key: "c1-1",
				characterId: "c1",
				actionNo: 1,
				actionValue: 100,
				skill: "E",
				speed: 100,
				displayName: "临时名称",
				targetKind: "敌人" as const,
			},
		] satisfies GeneratedAction[];
		const result = buildCharacterSelectors(
			[character("c1", "角色一")],
			[character("c1-meme", "忆灵", "忆灵")],
			actions,
		);

		expect(result.characterNames).toEqual({ c1: "临时名称" });
		expect(result.characterKinds).toMatchObject({
			c1: "敌人",
			"c1-meme": "忆灵",
		});
		expect(result.charactersById.c1?.name).toBe("角色一");
	});

	it("从角色机制声明生成忆灵目标，而不是由组件自行拼装", () => {
		const targets = buildMemospriteTargets([character("c1", "昔涟")]);
		expect(targets.length).toBeGreaterThan(0);
		expect(targets.every((target) => target.kind === "忆灵")).toBe(true);
	});
});
