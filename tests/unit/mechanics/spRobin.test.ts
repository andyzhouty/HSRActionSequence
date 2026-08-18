import { describe, expect, it } from "vitest";
import {
	getSpRobinFeverCap,
	isValidSpRobinFeverValue,
} from "../../../src/mechanics/spRobin";
import { simulateActions } from "../../../src/simulate/actions";
import {
	isNonAttackSkill,
	normalizeResourcesForCharacters,
} from "../../../src/utils/action-sequence";
import { character, input } from "../../helpers/simulateActionTestUtils";

describe("知更鸟·晴歌 SP Robin", () => {
	it("E 召唤晴空乐手，速度 = 面板速度 × 1.8，行动锁定 A", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 120),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				skillOverrides: { "robin-1": "E" },
				limit: 300,
			}),
		);
		const songbirds = actions.find((action) => action.isSongbirdsAction);
		expect(songbirds).toBeDefined();
		expect(songbirds).toMatchObject({
			characterId: "robin-songbirds",
			targetKind: "忆灵",
			skill: "A",
			lockedSkill: true,
			songbirdsOwnerId: "robin",
		});
		expect(songbirds!.speed).toBeCloseTo(120 * 1.8);
	});

	it("E 固定视为非攻击（不显示攻击开关、不触发追击）", () => {
		const robin = character("robin", "sp知更鸟", 120);
		expect(isNonAttackSkill(robin, "E")).toBe(true);
		expect(isNonAttackSkill(robin, "Q")).toBe(true);
		// 行为验证：SP Robin 的 E 不消耗卡芙卡追击充能、不触发其 Z
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 120),
					character("kafka", "卡芙卡", 100),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				skillOverrides: { "robin-1": "E" },
				limit: 300,
			}),
		);
		// robin-1 为 E，不应在其同 AV 生成卡芙卡 Z（robin 后续默认 A 仍会触发）
		expect(actions.some((action) => action.key === "robin-1-kafka-fua")).toBe(
			false,
		);
	});

	it("晴空乐手速度包含 95 × 局内百分比速度buff（藿藿E1 +12%）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 120),
					character("huohuo", "藿藿", 100, { eidolon: 1 }),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				skillOverrides: { "robin-1": "E" },
				limit: 300,
			}),
		);
		const songbirds = actions.find((action) => action.isSongbirdsAction);
		expect(songbirds).toBeDefined();
		// (120 + 95 × 0.12) × 1.8 = 131.4 × 1.8 = 236.52
		expect(songbirds!.speed).toBeCloseTo((120 + 95 * 0.12) * 1.8, 5);
	});

	it("Q 使指定我方单体立即行动", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("ally", "布洛妮娅", 150),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				skillOverrides: { "robin-1": "AQ" },
				skillTargets: { "robin-1": "ally" },
				limit: 300,
			}),
		);
		// robin 首动提前 20% 在 AV=80，Q 将 ally 拉到 80（原本 ally-2 在 133.33）
		const allyFirst = actions.find((action) => action.key === "ally-1");
		const allySecond = actions.find((action) => action.key === "ally-2");
		expect(allyFirst).toBeDefined();
		expect(allySecond!.actionValue).toBeCloseTo(80);
		// 被拉条的 ally 在 Q 同 AV 优先行动
		const robinFirst = actions.find((action) => action.key === "robin-1");
		expect(allySecond!.actionValue).toBeLessThanOrEqual(
			robinFirst!.actionValue,
		);
	});

	it("Q 使目标在 2 个正常回合内不能使其他我方目标行动提前（舞舞舞只保留自身部分）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 200),
					character("bronya", "布洛妮娅", 100, { lc_id: 21018 }),
					character("dps", "大黑塔", 150),
					character("enemy", "敌人", 400, { kind: "敌人" }),
				],
				skillOverrides: {
					"robin-1": "AQ",
					"bronya-1": "AQ",
				},
				skillTargets: { "robin-1": "bronya" },
				limit: 300,
			}),
		);
		// robin(200速) 首动提前 20% 在 40，AQ 拉 bronya 到 40 并施加 debuff
		// bronya(100速,舞舞舞) 被拉到 40 后 AQ：舞舞舞全队拉条 16% 只保留自身部分
		const robinSecond = actions.find((action) => action.key === "robin-2");
		const dpsFirst = actions.find((action) => action.key === "dps-1");
		const bronyaSecond = actions.find((action) => action.key === "bronya-2");
		// 若无 debuff：robin-2 会被拉到 max(50, 100-8)=92，dps-1 会被拉到 max(50,66.67-10.67)=56
		// 有 debuff：只有 bronya 自己行动提前——A 自拉条 30%（150-30）+ 舞舞舞自身部分 16%（120-16）
		expect(robinSecond!.actionValue).toBeCloseTo(90);
		expect(dpsFirst!.actionValue).toBeCloseTo(66.667, 1);
		expect(bronyaSecond!.actionValue).toBeCloseTo(94);
	});

	it("Q debuff 抑制花火/布洛妮娅单体拉条", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 200),
					character("bronya", "布洛妮娅", 100),
					character("dps", "大黑塔", 150),
					character("enemy", "敌人", 400, { kind: "敌人" }),
				],
				skillOverrides: {
					"robin-1": "AQ",
					"bronya-1": "E",
				},
				skillTargets: {
					"robin-1": "bronya",
					"bronya-1": "dps",
				},
				limit: 300,
			}),
		);
		// bronya 被 debuff 后 E 拉 dps 无效，dps-1 仍在其原定 66.67
		const dpsFirst = actions.find((action) => action.key === "dps-1");
		expect(dpsFirst!.actionValue).toBeCloseTo(66.667, 1);
	});

	it("Fever：开关开启后 SP Robin 无自身回合，倒计时以 140 速持续行动", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				spRobinFeverToggles: { "enemy-1": true, "enemy-6": false },
				limit: 300,
			}),
		);
		// enemy-1 在 33.33 开 Fever（robin 首动提前 20% 在 80，D=(80-33.33)×100=4666.67），enemy-6 在 200 手动关闭
		// 倒计时以 140 速持续行动：104.76、176.19 两次
		const countdownActions = actions.filter(
			(action) => action.isSpRobinFeverCountdownAction,
		);
		expect(countdownActions.length).toBe(2);
		expect(countdownActions[0].actionValue).toBeCloseTo(
			33.333 + 10000 / 140,
			1,
		);
		expect(countdownActions[0].speed).toBe(140);
		expect(countdownActions[1].actionValue).toBeCloseTo(
			33.333 + (2 * 10000) / 140,
			1,
		);
		// Fever 期间（至手动关闭 200）SP Robin 不应有自身回合
		const robinDuring = actions.find(
			(action) => action.characterId === "robin" && action.actionValue < 199,
		);
		expect(robinDuring).toBeUndefined();
		// 手动关闭后：nextAV = 200 + max(0, 4666.67-5000)/100 = 200（剩余路程不足 5000，立即行动）
		const robinAfter = actions.find((action) => action.characterId === "robin");
		expect(robinAfter).toBeDefined();
		expect(robinAfter!.actionValue).toBeCloseTo(200, 1);
	});

	it("在 SP Robin 自己的回合开启 Fever 时，该回合被跳过", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				spRobinFeverToggles: { "robin-1": true, "enemy-5": false },
				limit: 300,
			}),
		);
		// robin-1 原定 AV=100，Fever 于此开启后该回合被跳过；enemy-5(166.67) 手动关闭
		const robinActedAt100 = actions.find(
			(action) => action.characterId === "robin" && action.actionValue < 166,
		);
		expect(robinActedAt100).toBeUndefined();
		// 剩余路程 D = (100-100)×100 = 0 → 关闭后 robin 立即行动于 166.67
		const robinFirst = actions.find((action) => action.characterId === "robin");
		expect(robinFirst).toBeDefined();
		expect(robinFirst!.actionValue).toBeCloseTo(166.667, 1);
	});

	it("Fever 期间被欢愉主 Q（直接拉条）提前的量会计入被提前量", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("emc", "开拓者·欢愉", 300),
					character("enemy", "敌人", 400, { kind: "敌人" }),
				],
				skillOverrides: { "emc-1": "AQ" },
				skillTargets: { "emc-1": "robin" },
				spRobinFeverToggles: { "enemy-1": true, "enemy-2": false },
				limit: 300,
			}),
		);
		// enemy-1 在 25 开 Fever，D = 7500；emc Q 在 33.33 提前 50%（3750 距离）
		// enemy-2 在 50 手动关闭：max(0, 7500-5000-3750)=0 → robin 立即行动于 50
		const robinFirst = actions.find((action) => action.characterId === "robin");
		expect(robinFirst).toBeDefined();
		expect(robinFirst!.actionValue).toBeCloseTo(50, 1);
	});

	it("Fever 与白厄境界重叠时，Fever 倒计时随境界停滞，境界结束后继续行动", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("phainon", "白厄", 300),
					character("enemy", "敌人", 400, { kind: "敌人" }),
				],
				skillOverrides: { "phainon-1": "AQ" },
				spRobinFeverToggles: { "enemy-1": true, "enemy-12": false },
				limit: 400,
			}),
		);
		const domainFinal = actions.find((action) => action.isDomainFinalAction);
		expect(domainFinal).toBeDefined();
		const domainEndAV = domainFinal!.actionValue;
		// 境界期间：SP Robin 与 Fever 倒计时都不应行动
		const robinDuringDomain = actions.find(
			(action) =>
				action.characterId === "robin" && action.actionValue < domainEndAV,
		);
		expect(robinDuringDomain).toBeUndefined();
		const countdownDuringDomain = actions.find(
			(action) =>
				action.isSpRobinFeverCountdownAction &&
				action.actionValue < domainEndAV,
		);
		expect(countdownDuringDomain).toBeUndefined();
		// 境界结束后：倒计时继续以 140 速行动；enemy-12(300) 手动关闭后 SP Robin 恢复
		const countdown = actions.find(
			(action) => action.isSpRobinFeverCountdownAction,
		);
		expect(countdown).toBeDefined();
		expect(countdown!.actionValue).toBeGreaterThan(domainEndAV);
		const robinFirst = actions.find((action) => action.characterId === "robin");
		expect(robinFirst).toBeDefined();
		expect(robinFirst!.actionValue).toBeGreaterThan(300);
	});

	it("Fever 可手动关闭，并移除倒计时", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				spRobinFeverToggles: { "enemy-1": true, "enemy-2": false },
				limit: 300,
			}),
		);
		// enemy-1 在 AV=33.33 进入 Fever（robin 首动提前 20% 在 80，剩余路程 = (80-33.33)×100 = 4666.67）
		// enemy-2 在 AV=66.67 手动关闭：nextAV = 66.67 + max(0, 4666.67-5000)/100 = 66.67
		const robinFirst = actions.find((action) => action.characterId === "robin");
		expect(robinFirst).toBeDefined();
		expect(robinFirst!.actionValue).toBeCloseTo((100 / 3) * 2, 1);
		// 倒计时被移除，不应出现
		expect(actions.some((action) => action.isSpRobinFeverCountdownAction)).toBe(
			false,
		);
	});

	it("Fever 期间被拉条的量会在结束时从剩余路程中扣除", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("sunday", "星期日", 300),
					character("enemy", "敌人", 400, { kind: "敌人" }),
				],
				skillOverrides: { "sunday-1": "E" },
				skillTargets: { "sunday-1": "robin" },
				spRobinFeverToggles: { "enemy-1": true, "enemy-2": false },
				limit: 300,
			}),
		);
		// enemy-1 在 AV=25 进入 Fever（剩余路程 = (100-25)×100 = 7500）
		// 星期日 E 在 AV=33.33 将 robin 拉满 → 被提前量 = 7500
		// enemy-2 在 50 手动关闭：max(0, 7500-5000-7500)/100 = 0 → robin 立即行动于 50
		const robinFirst = actions.find((action) => action.characterId === "robin");
		expect(robinFirst).toBeDefined();
		expect(robinFirst!.actionValue).toBeCloseTo(50, 1);
	});

	it("队伍含 SP Robin 时自动锁定氛围值资源列", () => {
		const resources = normalizeResourcesForCharacters(
			["战技点"],
			[character("robin", "sp知更鸟", 100)],
		);
		expect(resources[0]).toBe("氛围值");
	});

	it("被动：进场时行动提前 20%", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "sp知更鸟", 100),
					character("enemy", "敌人", 300, { kind: "敌人" }),
				],
				limit: 300,
			}),
		);
		// 首动 AV = 10000 × (1 - 0.2) / 100 = 80（无被动时为 100）
		const robinFirst = actions.find((action) => action.key === "robin-1");
		expect(robinFirst).toBeDefined();
		expect(robinFirst!.actionValue).toBeCloseTo(80, 5);
	});

	it("氛围值上限：星魂 0/1 为 50，星魂 2+ 为 70", () => {
		expect(getSpRobinFeverCap(0)).toBe(50);
		expect(getSpRobinFeverCap(1)).toBe(50);
		expect(getSpRobinFeverCap(2)).toBe(70);
		expect(getSpRobinFeverCap(6)).toBe(70);
	});

	it("氛围值输入校验：空串或不超过上限的整数合法，超出/非数字拒绝", () => {
		expect(isValidSpRobinFeverValue("", 0)).toBe(true);
		expect(isValidSpRobinFeverValue("0", 0)).toBe(true);
		expect(isValidSpRobinFeverValue("50", 0)).toBe(true);
		expect(isValidSpRobinFeverValue("51", 0)).toBe(false);
		expect(isValidSpRobinFeverValue("70", 2)).toBe(true);
		expect(isValidSpRobinFeverValue("71", 2)).toBe(false);
		expect(isValidSpRobinFeverValue("abc", 1)).toBe(false);
		expect(isValidSpRobinFeverValue("-1", 1)).toBe(false);
		expect(isValidSpRobinFeverValue("1.5", 1)).toBe(false);
	});
});
