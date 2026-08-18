import { describe, expect, it } from "vitest";
import { getCharacterBaseSpeed } from "../../../src/data/characters";
import lightConeData from "../../../src/data/lightcones.json";
import {
	getEffectiveCharacterBaseSpeed,
	getElationLightconeSpeedPct,
} from "../../../src/mechanics/lightconeEffects";
import { simulateActions } from "../../../src/simulate/actions";
import { buildInitialStates } from "../../../src/simulate/init";
import type { CharacterConfig } from "../../../src/utils/action-sequence";
import { character, input } from "../../helpers/simulateActionTestUtils";

function makeCharacter(
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
		expect(buildInitialStates([makeCharacter("流萤")])[0].baseSpeed).toBe(104);
	});

	it("黎明恰如此燃烧对所有毁灭角色提供基础速度", () => {
		expect(
			getEffectiveCharacterBaseSpeed(
				makeCharacter("流萤", { lc_id: 23044, superimpose: 3 }),
			),
		).toBe(120);
		expect(
			getEffectiveCharacterBaseSpeed(
				makeCharacter("吉尔伽美什", { lc_id: 23044, superimpose: 3 }),
			),
		).toBe(113);
	});

	it("将光阴织成黄金对所有记忆角色提供同等基础速度", () => {
		expect(
			getEffectiveCharacterBaseSpeed(
				makeCharacter("遐蝶", { lc_id: 23036, superimpose: 4 }),
			),
		).toBe(113);
		expect(
			getEffectiveCharacterBaseSpeed(
				makeCharacter("开拓者·记忆", { lc_id: 23036, superimpose: 1 }),
			),
		).toBe(115);
	});
});

describe("光锥 23063 你将起身歌唱", () => {
	it("装备者首动提前 40%，全队速度 +20%", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100, { lc_id: 23063 }),
					character("ally", "布洛妮娅", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				limit: 300,
			}),
		);
		// robin: 被动 20% + 光锥 40% → 首动 = 10000×0.4/100 = 40，再被 +20% 全队加速重排 → 40×100/119
		const robinFirst = actions.find((action) => action.key === "robin-1");
		expect(robinFirst).toBeDefined();
		expect(robinFirst?.actionValue).toBeCloseTo((40 * 100) / 119, 1);
		expect(robinFirst?.speed).toBeCloseTo(119, 2);
		// ally（布洛妮娅，基础 99）：10000/(100+99×0.2)
		const allyFirst = actions.find((action) => action.key === "ally-1");
		expect(allyFirst).toBeDefined();
		expect(allyFirst?.actionValue).toBeCloseTo(10000 / 119.8, 1);
	});

	it("全队加速持续 2 个正常回合后移除", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100, { lc_id: 23063 }),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				limit: 300,
			}),
		);
		// robin: 第 1/2 动速度 119，第 3 动回到 100
		const robinActions = actions.filter(
			(action) => action.characterId === "robin",
		);
		expect(robinActions[0].speed).toBeCloseTo(119, 2);
		expect(robinActions[1].speed).toBeCloseTo(119, 2);
		expect(robinActions[2].speed).toBeCloseTo(100, 2);
	});
});

describe("光锥 23064 向浪花掷下盛夏", () => {
	it("23064/21066/22008 已写入光锥数据", () => {
		const ids = lightConeData.lightcones.map((lc) => lc.id);
		expect(ids).toContain(23064);
		expect(ids).toContain(21066);
		expect(ids).toContain(22008);
		const lc23064 = lightConeData.lightcones.find((lc) => lc.id === 23064);
		expect(lc23064?.path).toBe("Elation");
		const lc22008 = lightConeData.lightcones.find((lc) => lc.id === 22008);
		expect(lc22008?.path).toBe("Hunt");
	});

	it("按叠影加速：1/2/3/4/5 → 24%/28%/32%/36%/40%", () => {
		expect(getElationLightconeSpeedPct(1)).toBeCloseTo(0.24, 5);
		expect(getElationLightconeSpeedPct(2)).toBeCloseTo(0.28, 5);
		expect(getElationLightconeSpeedPct(3)).toBeCloseTo(0.32, 5);
		expect(getElationLightconeSpeedPct(4)).toBeCloseTo(0.36, 5);
		expect(getElationLightconeSpeedPct(5)).toBeCloseTo(0.4, 5);
	});

	it("装备者施放欢愉技后速度提高 24%（叠影1，基于基础速度）", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100, { lc_id: 23064 }),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				limit: 300,
			}),
		);
		// 阿哈时刻（100 速）触发水砂欢愉技后：100 + 107×0.24 = 125.68
		const spavenSecond = acts.find((a) => a.key === "spaven-2");
		expect(spavenSecond).toBeDefined();
		expect(spavenSecond?.speed).toBeCloseTo(100 + 107 * 0.24, 2);
	});
});
