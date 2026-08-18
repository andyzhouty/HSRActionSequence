import { describe, expect, it } from "vitest";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../../src/simulate/actions";
import type { CharacterConfig, SkillCode } from "../../../src/utils/actionSequence";

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

function interrupts(
	entries: Record<string, import("../../../src/utils/actionSequence").UltInterrupt[]>,
): Record<string, import("../../../src/utils/actionSequence").UltInterrupt[]> {
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
	it("手动插队 Q 后也会生成绯英追击", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("actor", "停云", 100),
					character("evanescia", "绯英", 80),
				],
				ultInterrupts: {
					"actor-1": [{ casterId: "actor", timing: "after" }],
				},
				evanesciaFuaToggles: { "actor-1-interrupt-0": true },
				limit: 110,
			}),
		);

		expect(
			actions.find((action) => action.key === "actor-1-interrupt-0-fua"),
		).toMatchObject({ isFuaAction: true, skill: "Z" });
	});

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
		expect(aha?.actionValue).toBeCloseTo(89.29, 1);
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
		expect(aha?.actionValue).toBeCloseTo(78.13, 1);
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

		// 火花先行动并在自身回合后减速，阿哈第一动也会同步重新计算
		const firstAha = actions.find((a) => a.isAhaInstant && a.actionNo === 1);
		expect(firstAha).toBeDefined();
		expect(firstAha?.actionValue).toBeCloseTo(81.9, 1);

		// 火花减速后（160→120）：120*0.2 + 120*0.1 + 80 = 24 + 12 + 80 = 116 → 后续间隔 ≈ 86.21
		if (actions.length >= 2) {
			const secondAha = actions
				.filter((a) => a.isAhaInstant)
				.find((a) => a.actionNo === 2);
			if (secondAha) {
				const gap = secondAha.actionValue - firstAha?.actionValue;
				expect(gap).toBeCloseTo(86.21, 0);
			}
		}
	});

	it("爻光 Q 后生成一个额外阿哈时刻", () => {
		const actions = simulateActions(
			input({
				characters: [character("yaoguang", "爻光", 120)],
				skillOverrides: skills({
					"yaoguang-1": "AQ",
				}),
				limit: 300,
			}),
		);

		const extraAha = actions.find((a) => a.key === "yaoguang-1-q-extra-aha");
		const yaoguangQ = actions.find((a) => a.key === "yaoguang-1-q");
		expect(extraAha).toBeDefined();
		expect(yaoguangQ).toBeDefined();
		expect(extraAha?.isAhaInstant).toBe(true);
		expect(extraAha?.isExtraAha).toBe(true);
		expect(extraAha?.hasElationSkills).toBe(true);
		expect(extraAha?.actionValue).toBeCloseTo(yaoguangQ?.actionValue, 2);
		expect(
			actions.some(
				(action) =>
					action.isElationSkill &&
					action.elationSkillParentKey === extraAha?.key,
			),
		).toBe(true);
	});

	it("爻光额外阿哈支持前后插入 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("yaoguang", "爻光", 120),
					character("ally1", "停云", 100),
					character("ally2", "布洛妮娅", 90),
				],
				skillOverrides: skills({
					"yaoguang-1": "AQ",
				}),
				ultInterrupts: interrupts({
					"yaoguang-1-q-extra-aha": [
						{ casterId: "ally1", timing: "before" },
						{ casterId: "ally2", timing: "after" },
					],
				}),
				limit: 300,
			}),
		);

		const beforeQ = actions.find(
			(a) => a.key === "yaoguang-1-q-extra-aha-interrupt-0",
		);
		const extraAha = actions.find((a) => a.key === "yaoguang-1-q-extra-aha");
		const afterQ = actions.find(
			(a) => a.key === "yaoguang-1-q-extra-aha-interrupt-1",
		);
		expect(beforeQ).toBeDefined();
		expect(extraAha).toBeDefined();
		expect(afterQ).toBeDefined();
		expect(actions.indexOf(beforeQ!)).toBeLessThan(actions.indexOf(extraAha!));
		expect(actions.indexOf(extraAha!)).toBeLessThan(actions.indexOf(afterQ!));
	});

	it("阿哈时刻 after 插入昔涟 Q 会结算 6 魂全队拉条", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparxie", "火花", 160),
					character("cyrene", "昔涟", 80, { eidolon: 6 }),
				],
				ultInterrupts: interrupts({
					"@aha-1": [{ casterId: "cyrene", timing: "after" }],
				}),
				limit: 150,
			}),
		);

		const cyreneQ = actions.find(
			(action) => action.key === "@aha-1-interrupt-0",
		);
		const cyreneFirst = actions.find((action) => action.key === "cyrene-1");
		expect(cyreneQ?.skill).toBe("Q");
		expect(cyreneFirst?.actionValue).toBeCloseTo(89.2858, 4);
	});

	it("火花 2 魂后，任意阿哈时刻后都会跟一个火花额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [character("sparxie", "火花", 160, { eidolon: 2 })],
				limit: 200,
			}),
		);

		const aha = actions.find((a) => a.key === "@aha-1");
		const sparxieExtra = actions.find((a) => a.key === "@aha-1-sparxie-extra");
		expect(aha).toBeDefined();
		expect(sparxieExtra).toBeDefined();
		expect(sparxieExtra?.isSparxieExtraAction).toBe(true);
		expect(sparxieExtra?.actionValue).toBeCloseTo(aha?.actionValue, 2);
		expect(actions.indexOf(aha!)).toBeLessThan(actions.indexOf(sparxieExtra!));
	});

	it("火花额外回合支持前后插入 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparxie", "火花", 160, { eidolon: 2 }),
					character("ally1", "停云", 100),
					character("ally2", "布洛妮娅", 90),
				],
				ultInterrupts: interrupts({
					"@aha-1-sparxie-extra": [
						{ casterId: "ally1", timing: "before" },
						{ casterId: "ally2", timing: "after" },
					],
				}),
				limit: 200,
			}),
		);

		const beforeQ = actions.find(
			(a) => a.key === "@aha-1-sparxie-extra-interrupt-0",
		);
		const sparxieExtra = actions.find((a) => a.key === "@aha-1-sparxie-extra");
		const afterQ = actions.find(
			(a) => a.key === "@aha-1-sparxie-extra-interrupt-1",
		);
		expect(beforeQ).toBeDefined();
		expect(sparxieExtra).toBeDefined();
		expect(afterQ).toBeDefined();
		expect(actions.indexOf(beforeQ!)).toBeLessThan(
			actions.indexOf(sparxieExtra!),
		);
		expect(actions.indexOf(sparxieExtra!)).toBeLessThan(
			actions.indexOf(afterQ!),
		);
	});

	it("爻光的额外阿哈后也会继续跟火花额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparxie", "火花", 160, { eidolon: 2 }),
					character("yaoguang", "爻光", 120),
				],
				skillOverrides: skills({
					"yaoguang-1": "AQ",
				}),
				limit: 300,
			}),
		);

		const extraAha = actions.find((a) => a.key === "yaoguang-1-q-extra-aha");
		const sparxieExtra = actions.find(
			(a) => a.key === "yaoguang-1-q-extra-aha-sparxie-extra",
		);
		expect(extraAha).toBeDefined();
		expect(sparxieExtra).toBeDefined();
		expect(actions.indexOf(extraAha!)).toBeLessThan(
			actions.indexOf(sparxieExtra!),
		);
	});

	it("欢愉角色加速后，尚未行动的阿哈行动值会同步提前", () => {
		const actions = simulateActions(
			input({
				characters: [character("sparxie", "火花", 160)],
				speedAdjustments: {
					"sparxie-1": { value: "40", mode: "absolute" },
				},
				limit: 200,
			}),
		);

		const firstAha = actions.find((a) => a.key === "@aha-1");
		expect(firstAha).toBeDefined();
		expect(firstAha?.actionValue).toBeCloseTo(87.5, 1);
	});

	it("0行动值支持插入大招", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				ultInterrupts: interrupts({
					"@av0-1": [{ casterId: "sw", timing: "before" }],
				}),
				limit: 120,
			}),
		);

		expect(actions.find((a) => a.key === "@av0-1-interrupt-0")?.skill).toBe(
			"Q",
		);
		expect(actions.find((a) => a.key === "@av0-1")).toBeDefined();
	});
});