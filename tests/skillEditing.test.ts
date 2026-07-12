import { describe, expect, it } from "vitest";
import { validateActionSkillInput } from "../src/pages/action-sequence/skillEditing";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../src/utils/actionSequence";

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

describe("validateActionSkillInput for Evey", () => {
	it("允许忆灵长夜填写 A 和 E", () => {
		const owner = character("evernight", "长夜月");
		const evey = character("evernight-evey", "长夜", { kind: "忆灵" });
		const eveyAction = action("evernight-evey", {
			isEveyAction: true,
			isMemospriteAction: true,
			memospriteOwnerId: "evernight",
		});

		const resultA = validateActionSkillInput({
			action: eveyAction,
			character: evey,
			characters: [owner],
			nextSkill: "A",
		});
		const resultE = validateActionSkillInput({
			action: eveyAction,
			character: evey,
			characters: [owner],
			nextSkill: "E",
		});

		expect(resultA).toBeNull();
		expect(resultE).toBeNull();
	});
});
