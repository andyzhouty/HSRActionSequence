import { describe, expect, it } from "vitest";
import { toNormalizedSavedData } from "../../../src/pages/action-sequence/savedData";
import {
	defaultCharacters,
	normalizeRelicSets,
	toggleRelicSet,
} from "../../../src/utils/action-sequence";

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

	it("风套与信使套互斥且允许都不激活", () => {
		const bothSets = {
			...defaultCharacters[0],
			hasWindSet: true,
			hasMessengerSet: true,
		};
		const normalized = normalizeRelicSets(bothSets);
		expect(normalized.hasWindSet).toBe(false);
		expect(normalized.hasMessengerSet).toBe(false);

		const windOnly = toggleRelicSet(defaultCharacters[0], "wind");
		expect(windOnly.hasWindSet).toBe(true);
		expect(windOnly.hasMessengerSet).toBe(false);

		const messengerOnly = toggleRelicSet(windOnly, "messenger");
		expect(messengerOnly.hasWindSet).toBe(false);
		expect(messengerOnly.hasMessengerSet).toBe(true);

		const none = toggleRelicSet(messengerOnly, "messenger");
		expect(none.hasWindSet).toBe(false);
		expect(none.hasMessengerSet).toBe(false);
	});

	it("导入数据中的双套装状态会被清理", () => {
		const normalized = toNormalizedSavedData({
			characters: [
				{
					...defaultCharacters[0],
					hasWindSet: true,
					hasMessengerSet: true,
				},
			],
		});

		expect(normalized.characters[0].hasWindSet).toBe(false);
		expect(normalized.characters[0].hasMessengerSet).toBe(false);
	});
});
