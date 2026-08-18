import { describe, expect, it } from "vitest";
import {
	isSkillCode,
	parseSkillCode,
	SkillCodeParseError,
	tryParseSkillCode,
} from "../../../src/domain/skills";

describe("技能标识解析", () => {
	it("解析普通技能和大小写输入", () => {
		expect(parseSkillCode(" aq ")).toEqual({
			raw: "AQ",
			tokens: ["A", "Q"],
		});
	});

	it("解析红 A 连续战技数量", () => {
		expect(parseSkillCode("5e")).toEqual({
			raw: "5E",
			tokens: ["E"],
			archerExtraECount: 5,
		});
	});

	it("解析忆灵技能标识 M", () => {
		expect(parseSkillCode("M")).toEqual({ raw: "M", tokens: ["M"] });
	});

	it("拒绝未知标识并提供安全试解析入口", () => {
		expect(() => parseSkillCode("AX")).toThrow(SkillCodeParseError);
		expect(tryParseSkillCode("AX")).toBeNull();
		expect(isSkillCode("FE")).toBe(true);
		expect(isSkillCode("EFX")).toBe(false);
	});
});
