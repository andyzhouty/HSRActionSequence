import { describe, expect, it } from "vitest";
import type { CharacterConfig, SkillCode } from "../src/utils/actionSequence";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../src/utils/simulateActions";

function character(
	id: string,
	name: string,
	speed: number,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: String(speed),
		baseSpeed: String(speed),
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...overrides,
	};
}

function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

function input(
	overrides: Partial<SimulateActionsInput> = {},
): SimulateActionsInput {
	return {
		characters: [],
		limit: 500,
		overrides: {},
		skillOverrides: {},
		domainEndOverrides: {},
		legacyUltOverrides: {},
		speedAdjustments: {},
		skillTargets: {},
		defaultSkillTargets: {},
		odeSelections: {},
		memeSelections: {},
		ultInterrupts: {},
		fireflyBreakCounters: {},
		godmodeExtraActions: {},
		...overrides,
	};
}

// ───── 阿哈时刻 ─────

describe("Aha Instant (阿哈时刻)", () => {
	it("无欢愉角色时不生成阿哈时刻", () => {
		const actions = simulateActions(
			input({
				characters: [character("a", "停云", 100), character("b", "队友", 80)],
				limit: 200,
			}),
		);
		const aha = actions.find((a) => a.isAhaInstant);
		expect(aha).toBeUndefined();
	});

	it("一个欢愉角色时速度 = v1*0.2 + 80", () => {
		const actions = simulateActions(
			input({
				characters: [character("sparxie", "火花", 160)],
				limit: 500,
			}),
		);

		const aha = actions.find((a) => a.isAhaInstant);
		expect(aha).toBeDefined();
		// 火花 160 速 → 阿哈速度 = 160 * 0.2 + 80 = 112
		// 第一动 AV ≈ 10000/112 ≈ 89.29
		expect(aha!.actionValue).toBeCloseTo(89.29, 1);
	});

	it("多个欢愉角色时速度 = v1*0.2 + v2*0.1 + v3*0.05 + v4*0.025 + 80", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparxie", "火花", 160),
					character("yaoguang", "爻光", 120),
					character("evanescia", "绯英", 80),
				],
				limit: 400,
			}),
		);

		const aha = actions.find((a) => a.isAhaInstant);
		expect(aha).toBeDefined();
		// 160*0.2 + 120*0.1 + 80*0.05 + 80 = 32 + 12 + 4 + 80 = 128
		// 第一动 AV ≈ 10000/128 ≈ 78.13
		expect(aha!.actionValue).toBeCloseTo(78.13, 1);
	});

	it("加减速动态影响阿哈行动轴", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparxie", "火花", 160),
					character("yaoguang", "爻光", 120),
				],
				speedAdjustments: {
					"sparxie-1": { value: "-40", mode: "absolute" },
				},
				limit: 500,
			}),
		);

		// 第一动前：160*0.2 + 120*0.1 + 80 = 32 + 12 + 80 = 124 → 第一动 AV ≈ 80.65
		const firstAha = actions.find((a) => a.isAhaInstant && a.actionNo === 1);
		expect(firstAha).toBeDefined();
		expect(firstAha!.actionValue).toBeCloseTo(80.65, 1);

		// 火花减速后（160→120）：120*0.2 + 120*0.1 + 80 = 24 + 12 + 80 = 116 → 后续间隔 ≈ 86.21
		if (actions.length >= 2) {
			const secondAha = actions
				.filter((a) => a.isAhaInstant)
				.find((a) => a.actionNo === 2);
			if (secondAha) {
				const gap = secondAha.actionValue - firstAha!.actionValue;
				expect(gap).toBeCloseTo(86.21, 0);
			}
		}
	});
});

// ───── 银狼LV.999 ─────

describe("Silver Wolf LV.999", () => {
	it("AQ 开大后自拉条（Q 在后，A 在前 Q 在后）", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				skillOverrides: skills({
					"sw-1": "AQ",
				}),
				limit: 300,
			}),
		);

		// sw-1（A）在 AV=100 → sw-1-q（Q）在 AV=100 → Q 自拉条 100%
		// sw-2 在 AV=100（与 Q 同 AV）
		const sw1 = actions.find((a) => a.key === "sw-1");
		expect(sw1).toBeDefined();
		expect(sw1?.actionValue).toBeCloseTo(100, 2);
		expect(sw1?.skill).toBe("A");

		const swQ = actions.find((a) => a.key === "sw-1-q");
		expect(swQ).toBeDefined();
		expect(swQ?.actionValue).toBeCloseTo(100, 2);
		expect(swQ?.skill).toBe("Q");

		// A 在 Q 之前
		const sw1Index = actions.indexOf(sw1);
		const swQIndex = actions.indexOf(swQ);
		expect(sw1Index).toBeLessThan(swQIndex);

		const sw2 = actions.find((a) => a.key === "sw-2");
		expect(sw2).toBeDefined();
		// Q 后 100% 提前 → sw-2 在 AV=100（同 AV）
		expect(sw2?.actionValue).toBeCloseTo(100, 2);

		// 进入无敌玩家状态，技能锁定为 A
		expect(sw2?.skill).toBe("A");
	});

	it("无敌玩家状态下技能锁定为 A，正常行动 3 次后退出", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				skillOverrides: skills({
					"sw-1": "AQ",
					"sw-5": "E",
					"sw-6": "E",
				}),
				limit: 900,
			}),
		);

		// sw-1 (A, 计数0→1) → sw-1-q (Q) → sw-2 (A, 计数1→2) → sw-3 (A, 计数2→3, 退出)
		// sw-2 和 sw-3 的技能应是 A（被锁定），即使 override 是 ""
		// sw-4 及之后恢复正常，sw-5 的 override "E" 应生效
		const sw2 = actions.find((a) => a.key === "sw-2");
		const sw3 = actions.find((a) => a.key === "sw-3");
		const sw4 = actions.find((a) => a.key === "sw-4");
		const sw5 = actions.find((a) => a.key === "sw-5");

		expect(sw2?.skill).toBe("A");
		expect(sw3?.skill).toBe("A");
		// sw-4 退出后恢复正常，无 override 时 skill 为 ""
		expect(sw4).toBeDefined();
		// sw-5 的 E 应正常生效
		expect(sw5?.skill).toBe("E");
	});

	it("QA 开大进入无敌玩家（Q 在前，自拉条无效）", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				skillOverrides: skills({
					"sw-1": "QA",
				}),
				limit: 400,
			}),
		);

		// sw-1-q (Q) 先行动 → 进入无敌玩家，无自拉条
		// sw-1 (A) 后行动
		// 正常间隔：10000/100=100，sw-2 应在 200
		const swQ = actions.find((a) => a.key === "sw-1-q");
		expect(swQ).toBeDefined();
		expect(swQ?.actionValue).toBeCloseTo(100, 2);
		expect(swQ?.skill).toBe("Q");

		const sw1 = actions.find((a) => a.key === "sw-1");
		expect(sw1).toBeDefined();
		expect(sw1?.actionValue).toBeCloseTo(100, 2);
		expect(sw1?.skill).toBe("A");

		// Q 在 A 之前
		const swQIndex = actions.indexOf(swQ);
		const sw1Index = actions.indexOf(sw1);
		expect(swQIndex).toBeLessThan(sw1Index);

		// 无自拉条 → sw-2 在正常间隔后的 AV
		const sw2 = actions.find((a) => a.key === "sw-2");
		expect(sw2).toBeDefined();
		expect(sw2?.actionValue).toBeCloseTo(200, 2);
	});

	it("E2：在队友行动后可插入额外 A（不消耗正常行动次数）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sw", "银狼LV.999", 100),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"sw-1": "AQ",
					"ally-1": "E",
				}),
				godmodeExtraActions: {
					"ally-1": true,
				},
				limit: 300,
			}),
		);

		// ally-1 后应有 extra A（ally-1-godmode-A）
		const extraA = actions.find((a) => a.key === "ally-1-godmode-A");
		expect(extraA).toBeDefined();
		expect(extraA?.skill).toBe("A");
		expect(extraA?.displayName).toBe("银狼E2");
	});
});
