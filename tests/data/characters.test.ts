import { describe, expect, it } from "vitest";
import {
	getCharacterCid,
	hasSkillEffect,
	normalizeName,
} from "../../src/data/characters";

describe("角色昵称匹配", () => {
	it("忽略英文字母与混合昵称的大小写", () => {
		expect(getCharacterCid("SABER")).toBe("1014");
		expect(getCharacterCid("c8")).toBe("1014");
		expect(getCharacterCid("DHPT")).toBe("1414");
		expect(getCharacterCid("Sp银狼")).toBe("1506");
		expect(getCharacterCid("SP姬子")).toBe("1510");
		expect(hasSkillEffect("ARCHER", "Q", "archerUltimate")).toBe(true);
	});

	it("标准化仍会忽略首尾和内部空白", () => {
		expect(normalizeName("  Dr. Ratio  ")).toBe(normalizeName("dr.ratio"));
	});
});
