import { describe, expect, it } from "vitest";
import { toNormalizedSavedData } from "../src/pages/action-sequence/savedData";

describe("Action sequence saved data normalization", () => {
	it("长夜月在队伍中时会自动补上忆质资源", () => {
		const normalized = toNormalizedSavedData({
			characters: [
				{
					id: "evernight",
					kind: "角色",
					name: "长夜月",
					speed: "100",
					baseSpeed: "100",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			],
			resources: ["战技点"],
			resourceValues: {},
		});

		expect(normalized.resources).toEqual(["忆质", "战技点"]);
	});

	it("长夜月不在队伍中时会自动移除忆质资源", () => {
		const normalized = toNormalizedSavedData({
			characters: [
				{
					id: "ally",
					kind: "角色",
					name: "布洛妮娅",
					speed: "100",
					baseSpeed: "100",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			],
			resources: ["战技点", "忆质"],
			resourceValues: {},
		});

		expect(normalized.resources).toEqual(["战技点"]);
	});
});
