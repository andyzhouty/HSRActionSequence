import { describe, expect, it } from "vitest";
import {
	computeSpAventurineFervorGain,
	getFervorThresholds,
	getSpAventurineFervorCap,
	isValidSpAventurineFervorValue,
} from "../../../src/mechanics/spAventurine";
import { simulateActions } from "../../../src/simulate/actions";
import {
	type GeneratedAction,
	getCharacterBaseSpeed,
	getCharacterCid,
	getCharacterPath,
	isLockedResourceNameForCharacters,
	isNonAttackSkill,
	normalizeResourcesForCharacters,
} from "../../../src/utils/action-sequence";
import { character, input } from "../../helpers/simulateActionTestUtils";

function gainAction(overrides: Partial<GeneratedAction> = {}): GeneratedAction {
	return {
		key: "ally-1",
		characterId: "ally",
		actionNo: 1,
		actionValue: 50,
		skill: "A",
		speed: 100,
		...overrides,
	};
}

describe("砂金·戏浪 数据", () => {
	it("昵称/CID/基础速度/命途", () => {
		expect(getCharacterCid("水砂")).toBe("1513");
		expect(getCharacterCid("sp砂金")).toBe("1513");
		expect(getCharacterCid("SP Aventurine")).toBe("1513");
		expect(getCharacterCid("Aventurine Waveflair")).toBe("1513");
		expect(getCharacterBaseSpeed("水砂")).toBe(107);
		expect(getCharacterPath("水砂")).toBe("Elation");
	});

	it("A/E/Q 均固定视为攻击", () => {
		const spAventurine = character("spaven", "水砂", 100);
		expect(isNonAttackSkill(spAventurine, "A")).toBe(false);
		expect(isNonAttackSkill(spAventurine, "E")).toBe(false);
		expect(isNonAttackSkill(spAventurine, "Q")).toBe(false);
	});

	it("队伍含水砂时自动锁定热意资源列", () => {
		const resources = normalizeResourcesForCharacters(
			["战技点"],
			[character("spaven", "水砂", 100)],
		);
		expect(resources[0]).toBe("热意");
		expect(
			isLockedResourceNameForCharacters("热意", [
				character("spaven", "水砂", 100),
			]),
		).toBe(true);
	});

	it("热意上限与阈值：E2+ 上限 50，阈值 10/20/30/40/50", () => {
		expect(getSpAventurineFervorCap(0)).toBe(30);
		expect(getSpAventurineFervorCap(1)).toBe(30);
		expect(getSpAventurineFervorCap(2)).toBe(50);
		expect(getSpAventurineFervorCap(6)).toBe(50);
		expect(getFervorThresholds(0)).toEqual([10]);
		expect(getFervorThresholds(1)).toEqual([10, 20, 30]);
		expect(getFervorThresholds(2)).toEqual([10, 20, 30, 40, 50]);
		expect(isValidSpAventurineFervorValue("", 0)).toBe(true);
		expect(isValidSpAventurineFervorValue("30", 0)).toBe(true);
		expect(isValidSpAventurineFervorValue("31", 0)).toBe(false);
		expect(isValidSpAventurineFervorValue("50", 2)).toBe(true);
		expect(isValidSpAventurineFervorValue("51", 2)).toBe(false);
		expect(isValidSpAventurineFervorValue("abc", 2)).toBe(false);
	});
});

describe("热意结算（纯函数）", () => {
	const spAventurine = character("spaven", "水砂", 100);
	const ally = character("ally", "大黑塔", 100);
	it("队友普攻：攻击 +1 与天赋 +1 合计 2", () => {
		const result = computeSpAventurineFervorGain({
			action: gainAction({ skill: "A" }),
			attacker: ally,
			isForcedAttack: false,
			attackDisabled: false,
			talentTriggersLeft: 6,
			isSelf: false,
		});
		expect(result.gain).toBe(2);
		expect(result.talentUsed).toBe(true);
		expect(result.isTeammateAttack).toBe(true);
	});

	it("战技/终结技/追击同样攻击 +1 与天赋 +1", () => {
		for (const skill of ["E", "Q"]) {
			const result = computeSpAventurineFervorGain({
				action: gainAction({ skill }),
				attacker: ally,
				isForcedAttack: false,
				attackDisabled: false,
				talentTriggersLeft: 6,
				isSelf: false,
			});
			expect(result.gain).toBe(2);
		}
		const fua = computeSpAventurineFervorGain({
			action: gainAction({ skill: "Z", isFuaAction: true }),
			attacker: ally,
			isForcedAttack: false,
			attackDisabled: false,
			talentTriggersLeft: 6,
			isSelf: false,
		});
		expect(fua.gain).toBe(2);
	});

	it("天赋次数耗尽后只计攻击 +1", () => {
		const result = computeSpAventurineFervorGain({
			action: gainAction({ skill: "A" }),
			attacker: ally,
			isForcedAttack: false,
			attackDisabled: false,
			talentTriggersLeft: 0,
			isSelf: false,
		});
		expect(result.gain).toBe(1);
		expect(result.talentUsed).toBe(false);
	});

	it("sp刃额外战技同时视为追加攻击，但只计 1 点", () => {
		const result = computeSpAventurineFervorGain({
			action: gainAction({ skill: "E", isSpBladeExtraAction: true }),
			attacker: character("spblade", "千冶·刃", 100),
			isForcedAttack: false,
			attackDisabled: false,
			talentTriggersLeft: 6,
			isSelf: false,
		});
		expect(result.gain).toBe(1);
		expect(result.talentUsed).toBe(true);
	});

	it("忆灵技/欢愉技不计入天赋，但攻击部分仍 +1", () => {
		const memosprite = computeSpAventurineFervorGain({
			action: gainAction({ skill: "A" }),
			attacker: character("gm", "衣匠", 35, { kind: "忆灵" }),
			isForcedAttack: false,
			attackDisabled: false,
			talentTriggersLeft: 6,
			isSelf: false,
		});
		expect(memosprite.gain).toBe(1);
		expect(memosprite.talentUsed).toBe(false);
		const elation = computeSpAventurineFervorGain({
			action: gainAction({ skill: "ES", isElationSkill: true }),
			attacker: ally,
			isForcedAttack: false,
			attackDisabled: false,
			talentTriggersLeft: 6,
			isSelf: false,
		});
		expect(elation.gain).toBe(1);
		expect(elation.talentUsed).toBe(false);
	});

	it("自身行动/敌人/迷迷拉条不计热意", () => {
		expect(
			computeSpAventurineFervorGain({
				action: gainAction({ skill: "A" }),
				attacker: spAventurine,
				isForcedAttack: false,
				attackDisabled: false,
				talentTriggersLeft: 6,
				isSelf: true,
			}).gain,
		).toBe(0);
		expect(
			computeSpAventurineFervorGain({
				action: gainAction({ skill: "A" }),
				attacker: character("enemy", "敌人", 100, { kind: "敌人" }),
				isForcedAttack: false,
				attackDisabled: false,
				talentTriggersLeft: 6,
				isSelf: false,
			}).gain,
		).toBe(0);
		expect(
			computeSpAventurineFervorGain({
				action: gainAction({ skill: "拉条", isMemeAction: true }),
				attacker: character("meme", "迷迷", 130, { kind: "忆灵" }),
				isForcedAttack: false,
				attackDisabled: false,
				talentTriggersLeft: 6,
				isSelf: false,
			}).gain,
		).toBe(0);
	});
});

describe("砂金·戏浪 模拟", () => {
	it("热意初始为 0，秘技开启时初始为 2", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				limit: 300,
			}),
		);
		expect(acts.find((a) => a.key === "spaven-1")?.spAventurineFervor).toBe(0);
		const acts2 = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100, { techniqueOn: true }),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				limit: 300,
			}),
		);
		expect(acts2.find((a) => a.key === "spaven-1")?.spAventurineFervor).toBe(2);
	});

	it("队友普攻后热意 +2（攻击 +1、天赋 +1）", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("ally", "大黑塔", 150),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				limit: 300,
			}),
		);
		// ally-1 在 66.67 普攻 → 2；水砂-1 在 100 记录热意 2
		expect(acts.find((a) => a.key === "spaven-1")?.spAventurineFervor).toBe(2);
		expect(acts.find((a) => a.key === "ally-1")?.spAventurineFervor).toBe(2);
	});

	it("热意达到 10 立即施放一次普通欢愉技", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("ally", "大黑塔", 150),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				resourceValues: { "ally-1": { 热意: "9" } },
				limit: 300,
			}),
		);
		// ally-1：手动 9 + 攻击/天赋 2 = 11，越过阈值 10 → 立即普通欢愉技
		const immediate = acts.find(
			(a) => a.key === "ally-1-elation-spaven-fervor-10",
		);
		expect(immediate).toBeDefined();
		expect(immediate?.isElationSkill).toBe(true);
		expect(immediate?.isEnhancedElationSkill).toBeUndefined();
		expect(immediate?.elationSkillParentKey).toBe("ally-1");
		expect(acts.find((a) => a.key === "ally-1")?.spAventurineFervor).toBe(11);
	});

	it("E1：热意达到 20/30 也各施放一次普通欢愉技", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100, { eidolon: 1 }),
					character("ally", "大黑塔", 150),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				resourceValues: { "ally-1": { 热意: "18" } },
				limit: 300,
			}),
		);
		expect(
			acts.find((a) => a.key === "ally-1-elation-spaven-fervor-20"),
		).toBeDefined();
		const acts2 = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100, { eidolon: 1 }),
					character("ally", "大黑塔", 150),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				resourceValues: { "ally-1": { 热意: "28" } },
				limit: 300,
			}),
		);
		expect(
			acts2.find((a) => a.key === "ally-1-elation-spaven-fervor-30"),
		).toBeDefined();
	});

	it("E2：热意达到 40 施放欢愉技，自身施放欢愉技后额外 +4", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100, { eidolon: 2 }),
					character("ally", "大黑塔", 150),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				resourceValues: { "ally-1": { 热意: "38" } },
				limit: 300,
			}),
		);
		const immediate = acts.find(
			(a) => a.key === "ally-1-elation-spaven-fervor-40",
		);
		expect(immediate).toBeDefined();
		// 欢愉技本身再 +4：该 ES 行动记录热意 44
		expect(immediate?.spAventurineFervor).toBe(44);
	});

	it("阿哈时刻内热意 >= 10 时欢愉技强化，强化后热意清空", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				resourceValues: { "@aha-1": { 热意: "10" } },
				limit: 300,
			}),
		);
		const ahaElation = acts.find(
			(a) => a.isElationSkill && a.elationSkillParentKey === "@aha-1",
		);
		expect(ahaElation).toBeDefined();
		expect(ahaElation?.isEnhancedElationSkill).toBe(true);
		// 强化后热意清空（E0 无 +4），水砂下一动记录 0
		expect(acts.find((a) => a.key === "spaven-2")?.spAventurineFervor).toBe(0);
	});

	it("E6：累计两次欢愉技后，后续所有欢愉技均为强化版", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100, { eidolon: 6 }),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				resourceValues: { "@aha-1": { 热意: "10" } },
				limit: 350,
			}),
		);
		const es1 = acts.find((a) => a.elationSkillParentKey === "@aha-1");
		const es2 = acts.find((a) => a.elationSkillParentKey === "@aha-2");
		const es3 = acts.find((a) => a.elationSkillParentKey === "@aha-3");
		expect(es1?.isEnhancedElationSkill).toBe(true);
		expect(es2?.isEnhancedElationSkill).toBeUndefined();
		expect(es3?.isEnhancedElationSkill).toBe(true);
	});

	it("队伍只有水砂一名欢愉角色时，队友攻击使阿哈速度 +25，阿哈行动后解除", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("ally", "大黑塔", 100),
				],
				overrides: { "ally-1": "120", "ally-2": "400" },
				limit: 300,
			}),
		);
		const ahaActs = acts.filter((a) => a.isAhaInstant);
		// aha 基础 100 速：第一次行动 100（尚未触发加速）
		expect(ahaActs[0].speed).toBe(100);
		// ally-1(120) 攻击 → +25：下次阿哈提前到 120 + (200-120)×100/125 = 184
		expect(ahaActs[1].actionValue).toBeCloseTo(184, 1);
		expect(ahaActs[1].speed).toBe(125);
		// 阿哈行动结束后解除 +25：第三次按 100 速排
		expect(ahaActs[2].speed).toBe(100);
	});

	it("队伍不止一名欢愉角色时不触发阿哈加速", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("emc", "开拓者·欢愉", 100),
					character("ally", "大黑塔", 150),
				],
				limit: 300,
			}),
		);
		const aha = acts.find((a) => a.isAhaInstant);
		// 阿哈速度 = 100×0.2 + 100×0.1 + 80 = 110，队友攻击不触发 +25
		expect(aha).toBeDefined();
		expect(aha?.speed).toBe(110);
	});

	it("自身 E 获得 4 点热意", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				skillOverrides: { "spaven-1": "E" },
				limit: 300,
			}),
		);
		expect(acts.find((a) => a.key === "spaven-1")?.spAventurineFervor).toBe(4);
	});

	it("自身 Q 获得 8 点热意", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				skillOverrides: { "spaven-1": "AQ" },
				limit: 300,
			}),
		);
		expect(acts.find((a) => a.key === "spaven-1-q")?.spAventurineFervor).toBe(
			8,
		);
		expect(acts.find((a) => a.key === "spaven-2")?.spAventurineFervor).toBe(8);
	});

	it("Q 后自身速度 +30% 持续 4 回合后移除", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("spaven", "水砂", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				skillOverrides: { "spaven-1": "AQ" },
				limit: 600,
			}),
		);
		const spavenActions = acts.filter(
			(a) => a.characterId === "spaven" && a.skill !== "Q" && !a.isElationSkill,
		);
		// 100 + 107×0.3 = 132.1；Q 不是正常回合不消耗，后续 4 个正常回合保持加速，之后恢复 100
		expect(spavenActions[1].speed).toBeCloseTo(132.1, 2);
		expect(spavenActions[2].speed).toBeCloseTo(132.1, 2);
		expect(spavenActions[3].speed).toBeCloseTo(132.1, 2);
		expect(spavenActions[4].speed).toBeCloseTo(132.1, 2);
		expect(spavenActions[5].speed).toBeCloseTo(100, 2);
	});
});
