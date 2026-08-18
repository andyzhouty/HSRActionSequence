import { describe, expect, it } from "vitest";
import {
	CHARACTER_IDS,
	isCharacterId,
	knownCharacterId,
	toCharacterId,
} from "../../../src/domain/identity";

describe("角色身份注册表", () => {
	it("使用强类型 CID 保存机制身份", () => {
		expect(toCharacterId(CHARACTER_IDS.spBlade)).toBe("1507");
		expect(knownCharacterId("cyrene")).toBe("1415");
		expect(isCharacterId("1415")).toBe(true);
		expect(isCharacterId("昔涟")).toBe(false);
	});

	it("拒绝空值和非数字 CID", () => {
		expect(() => toCharacterId("")).toThrow("无效的角色 CID");
		expect(() => toCharacterId("sp-blade")).toThrow("无效的角色 CID");
	});
});
