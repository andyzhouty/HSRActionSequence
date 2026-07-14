import { describe, expect, it } from "vitest";
import { getCharacterBaseSpeed } from "../../src/data/characters";
import { getEffectiveCharacterBaseSpeed } from "../../src/mechanics/baseSpeed";
import { buildInitialStates } from "../../src/simulate/init";
import type { CharacterConfig } from "../../src/utils/actionSequence";

function character(
	name: string,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id: name,
		kind: "角色",
		name,
		speed: "150",
		baseSpeed: "999",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...overrides,
	};
}

describe("角色基础速度与光锥", () => {
	it("从 characters.json 读取角色基础速度，而非旧存档的可编辑字段", () => {
		expect(getCharacterBaseSpeed("流萤")).toBe(104);
		expect(buildInitialStates([character("流萤")])[0].baseSpeed).toBe(104);
	});

	it("黎明恰如此燃烧对所有毁灭角色提供基础速度", () => {
		expect(
			getEffectiveCharacterBaseSpeed(
				character("流萤", { lc_id: 23044, superimpose: 3 }),
			),
		).toBe(120);
		expect(
			getEffectiveCharacterBaseSpeed(
				character("吉尔伽美什", { lc_id: 23044, superimpose: 3 }),
			),
		).toBe(113);
	});

	it("将光阴织成黄金对所有记忆角色提供同等基础速度", () => {
		expect(
			getEffectiveCharacterBaseSpeed(
				character("遐蝶", { lc_id: 23036, superimpose: 4 }),
			),
		).toBe(113);
		expect(
			getEffectiveCharacterBaseSpeed(
				character("开拓者·记忆", { lc_id: 23036, superimpose: 1 }),
			),
		).toBe(115);
	});
});
