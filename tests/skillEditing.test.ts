import { describe, expect, it } from "vitest";
import type { CharacterConfig, GeneratedAction } from "../src/utils/actionSequence";
import { validateActionSkillInput } from "../src/pages/action-sequence/skillEditing";

function character(
	id: string,
	name: string,
	options: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: "100",
		baseSpeed: "100",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...options,
	};
}

function action(
	characterId: string,
	overrides: Partial<GeneratedAction> = {},
): GeneratedAction {
	return {
		key: `${characterId}-1`,
		characterId,
		actionNo: 1,
		actionValue: 100,
		skill: "A",
		speed: 100,
		...overrides,
	};
}

describe("validateActionSkillInput for sp Himeko F", () => {
	it("允许 sp 姬子自己回合填写 F", () => {
		const nova = character("nova", "姬子·启行");
		const result = validateActionSkillInput({
			action: action("nova"),
			character: nova,
			characters: [nova],
			nextSkill: "F",
		});
		expect(result).toBeNull();
	});

	it("禁止 sp 姬子自己回合填写 FF", () => {
		const nova = character("nova", "姬子·启行", { eidolon: 6 });
		const result = validateActionSkillInput({
			action: action("nova"),
			character: nova,
			characters: [nova],
			nextSkill: "FF",
		});
		expect(result).toBe("sp 姬子自己回合不能使用 FF 连招");
	});
});
