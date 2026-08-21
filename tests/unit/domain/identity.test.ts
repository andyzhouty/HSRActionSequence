import { describe, expect, it } from "vitest";
import {
	areEquivalentCharacterCids,
	CHARACTER_IDS,
	getTrailblazerCid,
	getTrailblazerGender,
	isCharacterId,
	knownCharacterId,
	TRAILBLAZER_GENDER_PAIRS,
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

	it("按奇偶 CID 切换开拓者性别", () => {
		expect(TRAILBLAZER_GENDER_PAIRS).toHaveLength(5);
		expect(getTrailblazerGender("8002")).toBe("female");
		expect(getTrailblazerGender("8001")).toBe("male");
		expect(getTrailblazerCid("8002", "male")).toBe("8001");
		expect(getTrailblazerCid("8001", "female")).toBe("8002");
		expect(getTrailblazerGender("1001")).toBeUndefined();
		expect(areEquivalentCharacterCids("8008", "8007")).toBe(true);
		expect(areEquivalentCharacterCids("8007", "8008")).toBe(true);
		expect(areEquivalentCharacterCids("8008", "1001")).toBe(false);
	});
});
