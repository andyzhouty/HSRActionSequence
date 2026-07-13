import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import {
	type CharacterConfig,
	canUseSkillCode,
} from "../../src/utils/actionSequence";
import {
	character,
	input,
	interrupts,
	skills,
	speedAdjustments,
	stripAv0,
} from "../helpers/simulateActionTestUtils";

describe("actions", () => {
	it("orders basic actions by action value and applies manual overrides", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("slow", "慢速", 100),
					character("fast", "快速", 200),
				],
				overrides: {
					"slow-1": "30",
				},
				limit: 120,
			}),
		);

		expect(
			stripAv0(actions)
				.map((action) => action.key)
				.slice(0, 3),
		).toEqual(["slow-1", "fast-1", "fast-2"]);
		expect(stripAv0(actions)[0].actionValue).toBe(30);
	});

	it("uses positive speed adjustment as acceleration and negative as slowdown", () => {
		const actions = simulateActions(
			input({
				characters: [character("c1", "角色 1", 100)],
				speedAdjustments: speedAdjustments({
					"c1-1": { mode: "absolute", value: "50" },
					"c1-2": { mode: "relative", value: "-50" },
				}),
				limit: 420,
			}),
		);

		expect(
			actions.find((action) => action.key === "c1-1")?.actionValue,
		).toBeCloseTo(100, 4);
		expect(
			actions.find((action) => action.key === "c1-2")?.actionValue,
		).toBeCloseTo(166.6667, 4);
		expect(
			actions.find((action) => action.key === "c1-3")?.actionValue,
		).toBeCloseTo(266.6667, 4);
	});

	it("applies team advance for Dance Dance Dance ultimates (14+2s)%", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "停云", 100, {
						hasDance: true,
					}),
					character("b", "队友", 80),
				],
				skillOverrides: skills({
					"a-1": "AQ",
				}),
				limit: 130,
			}),
		);

		expect(
			stripAv0(actions)
				.map((action) => action.key)
				.slice(0, 3),
		).toEqual(["a-1", "a-1-q", "b-1"]);
		// 叠 1: (14+2*1)% = 16%, advance = 1600/80 = 20
		// b-1 AV = max(100, 125-20) = 105
		expect(
			actions.find((action) => action.key === "b-1")?.actionValue,
		).toBeCloseTo(105, 4);
	});

	it("applies Fugue eidolon 2 team advance like Dance Dance Dance", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("fugue", "忘归人", 100, {
						eidolon: 2,
					}),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"fugue-1": "AQ",
				}),
				limit: 130,
			}),
		);

		expect(
			actions.find((action) => action.key === "ally-1")?.actionValue,
		).toBeCloseTo(100, 4);
	});

	it("applies Fugue eidolon 2 team advance like Dance Dance Dance", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("fugue", "忘归人", 100, {
						eidolon: 2,
					}),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"fugue-1": "AQ",
				}),
				limit: 130,
			}),
		);

		expect(
			actions.find((action) => action.key === "ally-1")?.actionValue,
		).toBeCloseTo(100, 4);
	});

	it("activates Aglaea Supreme Stance from a normal ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "AQ",
				}),
				limit: 140,
			}),
		);

		expect(
			stripAv0(actions)
				.map((action) => action.key)
				.slice(0, 4),
		).toEqual([
			"aglaea-1",
			"aglaea-1-q",
			"aglaea-2",
			"aglaea-garmentmaker-g1-1",
		]);
		expect(actions.find((action) => action.key === "aglaea-2")).toMatchObject({
			isAglaeaSupremeAction: true,
			actionValue: 100,
		});
	});

	it("resets Aglaea Supreme Stance countdown instead of keeping the old one", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "AQ",
					"aglaea-2": "AQ",
				}),
				limit: 230,
			}),
		);
		const countdowns = actions.filter(
			(action) => action.isAglaeaCountdownAction,
		);

		expect(countdowns).toHaveLength(1);
		expect(countdowns[0].actionValue).toBeCloseTo(200, 4);
	});

	it("ignores stale manual override after Aglaea Supreme Stance countdown reset", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "AQ",
					"aglaea-2": "AQ",
				}),
				overrides: {
					"aglaea-aglaea-countdown-1": "120",
				},
				limit: 230,
			}),
		);
		const countdowns = actions.filter(
			(action) => action.isAglaeaCountdownAction,
		);

		expect(countdowns).toHaveLength(1);
		expect(countdowns[0]).toMatchObject({
			key: "aglaea-aglaea-countdown-2",
			actionValue: 200,
		});
	});

	it("activates Aglaea Supreme Stance from an interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("aglaea", "阿格莱雅", 100),
				],
				ultInterrupts: interrupts({
					"a-1": [{ casterId: "aglaea", timing: "before" }],
				}),
				limit: 140,
			}),
		);

		expect(
			stripAv0(actions)
				.map((action) => action.key)
				.slice(0, 4),
		).toEqual([
			"a-1-interrupt-0",
			"a-1",
			"aglaea-1",
			"aglaea-garmentmaker-g1-1",
		]);
		expect(actions.find((action) => action.key === "aglaea-1")).toMatchObject({
			isAglaeaSupremeAction: true,
			actionValue: 100,
		});
	});
});

// ───── 技能代码合法性校验 ─────

describe("canUseSkillCode", () => {
	const char = (
		name: string,
		_opts?: { hasW?: boolean; wDomainOnly?: boolean },
	): CharacterConfig => ({
		id: name,
		kind: "角色",
		name,
		speed: "100",
		baseSpeed: "100",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
	});

	it("允许空字符串（普攻）", () => {
		expect(canUseSkillCode(char("任意角色"), "")).toBe(true);
	});

	it("允许标准技能", () => {
		expect(canUseSkillCode(char("任意角色"), "E")).toBe(true);
		expect(canUseSkillCode(char("任意角色"), "A")).toBe(true);
		expect(canUseSkillCode(char("任意角色"), "Q")).toBe(false);
	});

	it("拒绝 A+E 组合", () => {
		expect(canUseSkillCode(char("任意角色"), "AE")).toBe(false);
		expect(canUseSkillCode(char("任意角色"), "EA")).toBe(false);
	});

	it("拒绝未知字符", () => {
		expect(canUseSkillCode(char("任意角色"), "X")).toBe(false);
		expect(canUseSkillCode(char("任意角色"), "EX")).toBe(false);
	});

	describe("F（协战标记）规则", () => {
		it("F 必须在最前面", () => {
			expect(canUseSkillCode(char("任意角色"), "FE")).toBe(true);
			expect(canUseSkillCode(char("任意角色"), "EF")).toBe(false);
			expect(canUseSkillCode(char("任意角色"), "FQ")).toBe(true);
			expect(canUseSkillCode(char("任意角色"), "QF")).toBe(false);
		});

		it("含 F 时最多 2 个字符", () => {
			expect(canUseSkillCode(char("任意角色"), "F")).toBe(true);
			expect(canUseSkillCode(char("任意角色"), "FF")).toBe(true);
			expect(canUseSkillCode(char("任意角色"), "FE")).toBe(true);
			expect(canUseSkillCode(char("任意角色"), "FFE")).toBe(false);
			expect(canUseSkillCode(char("任意角色"), "FEA")).toBe(false);
		});
	});

	it("W 需要角色有 counterW 效果（由 characters.json 控制）", () => {
		// 无 counterW 的角色不能使用 W
		expect(canUseSkillCode(char("任意角色"), "W")).toBe(false);
	});
});

// ───── 推进/拉条机制 ─────

describe("team advance 24%", () => {
	it("忘归人 E2 Q 后全队 24% 拉条", () => {
		// 忘归人（150速）Q 后，队友（100速）的下一动应提前 2400/100 = 24
		const actions = simulateActions(
			input({
				characters: [
					character("fugue", "忘归人", 150, { eidolon: 2 }),
					character("a", "行动角色", 100),
				],
				skillOverrides: skills({ "fugue-1": "AQ" }),
				limit: 150,
			}),
		);
		const teamAV = actions.filter((a) => a.key === "a-1")[0]?.actionValue;
		// 无拉条时 a-1 在 10000/100 = 100 AV
		// 忘归人 Q 在 10000/150 ≈ 66.67 AV，24% 拉条 = 2400/100 = 24
		// a-1 AV = max(66.67, 100 - 24) = 76
		expect(teamAV).toBeCloseTo(76, 2);
	});

	it("舞舞舞 Harmony Q 后全队 (14+2s)% 拉条", () => {
		// 停云（Harmony）装备舞舞舞 Q 后全队 (14+2s)% 拉条（叠 1 = 16%）
		const actions = simulateActions(
			input({
				characters: [
					character("tingyun", "停云", 150, { hasDance: true }),
					character("a", "行动角色", 100),
				],
				skillOverrides: skills({ "tingyun-1": "AQ" }),
				limit: 150,
			}),
		);
		const teamAV = actions.filter((a) => a.key === "a-1")[0]?.actionValue;
		// 叠 1: 16%, advance = 1600/100 = 16
		// a-1 AV = max(66.67, 100-16) = 84
		expect(teamAV).toBeCloseTo(84, 2);
	});

	it("非 Harmony 角色舞舞舞无效", () => {
		// 希儿（Hunt）装备舞舞舞，Q 后不应拉条
		const actions = simulateActions(
			input({
				characters: [
					character("seele", "希儿", 150, { hasDance: true }),
					character("a", "行动角色", 100),
				],
				skillOverrides: skills({ "seele-1": "AQ" }),
				limit: 150,
			}),
		);
		const teamAV = actions.filter((a) => a.key === "a-1")[0]?.actionValue;
		// 无拉条，a-1 在 100 AV
		expect(teamAV).toBeCloseTo(100, 2);
	});
});

describe("robin ultimate team lineup", () => {
	it("知更鸟 Q 后全队顶轴排列", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "知更鸟", 200),
					character("a", "行动角色", 100),
					character("b", "行动角色", 150),
				],
				skillOverrides: skills({ "robin-1": "AQ" }),
				limit: 200,
			}),
		);
		// 知更鸟 Q 在 10000/200*0.75 = 37.5（首动25%提前）
		// 之后知更鸟速度变 90，nextAV = 37.5 + 10000/90 ≈ 148.61
		// a-1（100速）和 b-1（150速）被拉到知更鸟 Q 的 AV（37.5）附近排列
		const _afterQ = actions.filter((a) => a.actionValue >= 37);
		// a-1 和 b-1 应在知更鸟 Q 之后立即行动（排在 37.5 附近）
		const aAction = actions.find((a) => a.key === "a-1");
		const bAction = actions.find((a) => a.key === "b-1");
		expect(aAction).toBeDefined();
		expect(bAction).toBeDefined();
		// a-1 和 b-1 应被拉到 37.5 附近（同 AV 或略偏移）
		expect(aAction?.actionValue).toBeCloseTo(37.5, 1);
		expect(bAction?.actionValue).toBeCloseTo(37.5, 1);
	});
});

describe("sparkle E 50% advance", () => {
	it("花火 E 将目标提前 50%，不超过当前 AV", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparkle", "花火", 200),
					character("seele", "希儿", 100),
				],
				skillOverrides: skills({ "sparkle-1": "E" }),
				skillTargets: { "sparkle-1": "seele" },
				limit: 150,
			}),
		);
		// 花火在 50 AV 行动，希儿原定在 100 AV
		// 花火 E 将希儿拉条 50%: newAV = max(50, 100-50) = 50
		const seeleAction = actions.find((a) => a.characterId === "seele");
		expect(seeleAction).toBeDefined();
		expect(seeleAction?.actionValue).toBeCloseTo(50, 2);
	});
});

describe("bronya A self advance 30%", () => {
	it("布洛妮娅 A 后自身 30% 提前", () => {
		const actions = simulateActions(
			input({
				characters: [character("bronya", "布洛妮娅", 200)],
				skillOverrides: skills({ "bronya-1": "A" }),
				limit: 150,
			}),
		);
		// 布洛妮娅在 50 AV 普攻，下一动提前 30%: 3000/200 = 15
		// 原 nextAV = 50 + 50 = 100，提前后 = max(50, 100-15) = 85
		const bronya2 = actions.find((a) => a.key === "bronya-2");
		expect(bronya2).toBeDefined();
		expect(bronya2?.actionValue).toBeCloseTo(85, 2);
	});
});

// ───── 首动提前 ─────

describe("first action advance", () => {
	it("翁瓦克 40% 首动提前", () => {
		const actions = simulateActions(
			input({
				characters: [character("a", "行动角色", 100, { hasVonwacq: true })],
				limit: 150,
			}),
		);
		// 首动 AV = 10000/100 * (1-0.4) = 60
		expect(stripAv0(actions)[0].actionValue).toBeCloseTo(60, 2);
	});

	it("知更鸟 25% 首动提前", () => {
		const actions = simulateActions(
			input({
				characters: [character("robin", "知更鸟", 100)],
				limit: 150,
			}),
		);
		// 首动 AV = 10000/100 * (1-0.25) = 75
		expect(stripAv0(actions)[0].actionValue).toBeCloseTo(75, 2);
	});
});

describe("wind set", () => {
	it("风套 Q 后 25% 行动提前", () => {
		const actions = simulateActions(
			input({
				characters: [character("a", "行动角色", 100, { hasWindSet: true })],
				skillOverrides: skills({ "a-1": "AQ" }),
				limit: 250,
			}),
		);
		// a-1（Q）在 100 AV，风套 25% 提前：2500/100 = 25
		// a-2 AV = max(100, 100+100 - 25) = 175
		const a2 = actions.find((a) => a.key === "a-2");
		expect(a2).toBeDefined();
		expect(a2?.actionValue).toBeCloseTo(175, 2);
	});

	it("无风套时 Q 后正常间隔", () => {
		const actions = simulateActions(
			input({
				characters: [character("a", "行动角色", 100)],
				skillOverrides: skills({ "a-1": "AQ" }),
				limit: 250,
			}),
		);
		const a2 = actions.find((a) => a.key === "a-2");
		expect(a2).toBeDefined();
		// 无风套：a-2 在 100 + 100 = 200 AV
		expect(a2?.actionValue).toBeCloseTo(200, 2);
	});
});

describe("The Herta", () => {
	it("大黑塔 AQ 后，大招会使自身 100% 自拉条", () => {
		const actions = simulateActions(
			input({
				characters: [character("herta", "大黑塔", 100)],
				skillOverrides: skills({
					"herta-1": "AQ",
				}),
				limit: 300,
			}),
		);

		const firstAction = actions.find((action) => action.key === "herta-1");
		const ultimateAction = actions.find((action) => action.key === "herta-1-q");
		const nextAction = actions.find((action) => action.key === "herta-2");

		expect(firstAction?.skill).toBe("A");
		expect(firstAction?.actionValue).toBeCloseTo(100, 2);
		expect(ultimateAction?.skill).toBe("Q");
		expect(ultimateAction?.actionValue).toBeCloseTo(100, 2);
		expect(nextAction?.actionValue).toBeCloseTo(100, 2);
		expect(nextAction?.lockedSkill).not.toBe(true);
		expect(actions.some((action) => action.key.includes("-godmode-A"))).toBe(
			false,
		);
	});
});
