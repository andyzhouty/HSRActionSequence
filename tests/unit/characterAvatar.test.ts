import { describe, expect, it } from "vitest";
import { getCharacterAvatarUrl } from "../../src/utils/characterAvatar";

describe("角色头像路径", () => {
	it("按 CID 指向 favicon 静态资源", () => {
		expect(getCharacterAvatarUrl("8001")).toContain("favicon/8001.webp");
	});

	it("拒绝空值和非数字标识", () => {
		expect(getCharacterAvatarUrl(undefined)).toBeUndefined();
		expect(getCharacterAvatarUrl("meme-8007")).toBeUndefined();
	});
});
