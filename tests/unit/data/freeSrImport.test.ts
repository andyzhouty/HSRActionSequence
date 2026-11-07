import { describe, expect, it } from "vitest";
import { importFreeSrData } from "../../../src/pages/action-sequence/freeSrImport";

const relics = Array.from({ length: 6 }, (_, index) => ({
	item_id: 60000 + 127 * 10 + index + 1,
	equip_avatar: 1512,
	level: 15,
	main_affix_id: index === 3 ? 4 : 1,
	sub_affix_list: [{ sub_affix_id: 7, count: 2, step: 2 }],
}));

describe("FreeSR import", () => {
	it("imports object avatars and calculates speed from traces and relics", () => {
		const data = importFreeSrData({
			avatars: { 1512: { rank: 2, skills: { 1512201: 1, 1512203: 1 } } },
			lightcones: [],
			relics,
		});
		expect(data.characters?.[0]).toMatchObject({
			name: "知更鸟·晴歌",
			eidolon: 2,
			speed: "151.632",
		});
	});

	it("leaves speed blank when a speed affix lacks its tier", () => {
		const missingTier = structuredClone(relics);
		missingTier[0].sub_affix_list[0].step = undefined as unknown as number;
		const data = importFreeSrData({
			avatars: [{ avatar_id: 1512, data: { skills: {} } }],
			lightcones: [],
			relics: missingTier,
		});
		expect(data.characters?.[0].speed).toBe("");
	});

	it("rejects unsupported characters rather than dropping them", () => {
		expect(() =>
			importFreeSrData({
				avatars: [{ avatar_id: 99999 }],
				lightcones: [],
				relics: [],
			}),
		).toThrow("99999");
	});
});
