import { describe, expect, it } from "vitest";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../src/simulate/actions";
import type {
	CharacterConfig,
	SkillCode,
	UltInterrupt,
} from "../../src/utils/actionSequence";

const stripAv0 = (axs: { characterId: string }[]) =>
	axs.filter((a) => a.characterId !== "@av0");

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
		...overrides,
	};
}

function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

function interrupts(
	entries: Record<string, UltInterrupt[]>,
): Record<string, UltInterrupt[]> {
	return entries;
}

// ───── 阿格莱雅至高之姿速度 ─────

describe("Aglaea Supreme Stance speed", () => {
	it("速度 = currentSpeed + baseSpeed × 15% × 层数", () => {
		// 阿格莱雅 E → 衣匠行动（层数=1）→ Q → 衣匠再行动（层数=2）
		// 速度 160，基础速度 100，2 层：speed = 160 + 100 × 0.15 × 2 = 190
		const actions = simulateActions(
			input({
				characters: [
					character("aglaea", "阿格莱雅", 160, { baseSpeed: "100" }),
				],
				skillOverrides: skills({ "aglaea-1": "E", "aglaea-2": "AQ" }),
				limit: 500,
			}),
		);
		const supremeActions = actions.filter((a) => a.isAglaeaSupremeAction);
		expect(supremeActions.length).toBeGreaterThan(1);
		// 第一动是 Q 后即时行动（0 层），第二动才有层数加成
		expect(supremeActions[1].speed).toBe(175);
	});

	it("无基础速度时降级使用当前速度作为基础", () => {
		// 不设 baseSpeed，getAglaeaBaseSpeed 降级返回 currentSpeed
		// 1 层：speed = 160 + 160 × 0.15 × 1 = 184
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 160)],
				skillOverrides: skills({ "aglaea-1": "E", "aglaea-2": "AQ" }),
				limit: 500,
			}),
		);
		const supremeActions = actions.filter((a) => a.isAglaeaSupremeAction);
		expect(supremeActions.length).toBeGreaterThan(1);
		expect(supremeActions[1].speed).toBe(184);
	});

	it("无基础速度时降级使用当前速度作为基础", () => {
		// 不设 baseSpeed，等价于 baseSpeed = 160
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 160)],
				skillOverrides: skills({ "aglaea-1": "AQ" }),
				limit: 300,
			}),
		);
		const combatActions = actions.filter((a) => a.isAglaeaSupremeAction);
		expect(combatActions.length).toBeGreaterThan(0);
		// 速度 = 160 + 160 × 0.15 × 0（初始 0 层）
		expect(combatActions[0].speed).toBe(160);
	});
});

// ───── Aglaea Supreme Stance Activation ─────

describe("Aglaea Supreme Stance activation", () => {
	it("activates Supreme Stance from a normal ultimate", () => {
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

	it("resets Supreme Stance countdown instead of keeping the old one", () => {
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

	it("ignores stale manual override after Supreme Stance countdown reset", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "AQ",
					"aglaea-2": "AQ",
				}),
				overrides: {
					"aglaea-aglaea-countdown-1": "150",
				},
				limit: 230,
			}),
		);
		const countdown = actions.find((action) => action.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		// The stale override should be ignored because the countdown was reset
		// by the second Q, so the AV should reflect the reset, not the override
		expect(countdown?.actionValue).toBeCloseTo(200, 4);
	});

	it("activates Supreme Stance from an interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("aglaea", "阿格莱雅", 100),
				],
				ultInterrupts: {
					"a-1": [{ casterId: "aglaea", timing: "before" }],
				},
				limit: 160,
			}),
		);

		expect(
			stripAv0(actions)
				.map((action) => action.key)
				.slice(0, 3),
		).toEqual(["a-1-interrupt-0", "a-1", "aglaea-1"]);
	});

	it("阿格莱雅插队 Q 后，立即行动归属阿格莱雅而非衣匠", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("ally", "行动角色", 100),
					character("aglaea", "阿格莱雅", 100),
				],
				ultInterrupts: {
					"ally-1": [{ casterId: "aglaea", timing: "before" }],
				},
				limit: 160,
			}),
		);

		const aglaeaImmediate = actions.find((action) => action.key === "aglaea-1");
		const garmentmakerFirst = actions.find(
			(action) => action.isAglaeaGarmentmakerAction,
		);
		expect(aglaeaImmediate?.actionValue).toBe(100);
		expect(garmentmakerFirst?.actionValue).toBe(100);
		expect(actions.indexOf(aglaeaImmediate!)).toBeLessThan(
			actions.indexOf(garmentmakerFirst!),
		);
	});

	it("阿格莱雅秘技开启时开场自动召唤衣匠，并让衣匠顶轴行动一次", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("aglaea", "阿格莱雅", 100, {
						hasAglaeaTechnique: true,
					}),
				],
				limit: 120,
			}),
		);

		const garmentmakerFirst = actions.find(
			(action) => action.isAglaeaGarmentmakerAction,
		);
		const aglaeaFirst = actions.find((action) => action.key === "aglaea-1");
		expect(garmentmakerFirst?.actionValue).toBe(0);
		expect(aglaeaFirst?.actionValue).toBe(100);
	});

	it("星期日不能单独拉条衣匠，但拉阿格莱雅时会顺带拉衣匠", () => {
		const baseInput = input({
			characters: [
				character("aglaea", "阿格莱雅", 120),
				character("sunday", "星期日", 160),
			],
			skillOverrides: skills({
				"aglaea-1": "E",
				"sunday-1": "E",
			}),
			limit: 220,
		});
		const directTarget = simulateActions(
			input({
				...baseInput,
				skillTargets: {
					"sunday-1": "aglaea-garmentmaker",
				},
			}),
		);
		const ownerTarget = simulateActions(
			input({
				...baseInput,
				skillTargets: {
					"sunday-1": "aglaea",
				},
			}),
		);

		const directGarmentmaker = directTarget.find(
			(a) => a.isAglaeaGarmentmakerAction && a.actionNo === 2,
		);
		const ownerGarmentmaker = ownerTarget.find(
			(a) => a.isAglaeaGarmentmakerAction && a.actionNo === 2,
		);
		expect(directGarmentmaker).toBeDefined();
		expect(ownerGarmentmaker).toBeDefined();
		expect(ownerGarmentmaker?.actionValue).toBeLessThan(
			directGarmentmaker?.actionValue,
		);
	});

	it("阿格莱雅插队 Q 不会额外把已在场衣匠拉到当前 AV", () => {
		const baseInput = input({
			characters: [
				character("aglaea", "阿格莱雅", 200),
				character("ally", "行动角色", 90),
			],
			skillOverrides: skills({
				"aglaea-1": "E",
			}),
			limit: 220,
		});
		const baseline = simulateActions(baseInput);
		const interrupt = simulateActions(
			input({
				...baseInput,
				ultInterrupts: {
					"ally-1": [{ casterId: "aglaea", timing: "before" }],
				},
			}),
		);

		const baselineGarmentmaker = baseline.find(
			(a) => a.isAglaeaGarmentmakerAction && a.actionNo === 2,
		);
		const interruptGarmentmaker = interrupt.find(
			(a) => a.isAglaeaGarmentmakerAction && a.actionNo === 2,
		);
		expect(baselineGarmentmaker).toBeDefined();
		expect(interruptGarmentmaker).toBeDefined();
		expect(interruptGarmentmaker?.actionValue).toBeCloseTo(
			baselineGarmentmaker?.actionValue,
			4,
		);
	});
});

// ───── Aglaea Countdown Manual Advance ─────

describe("Aglaea countdown manual advance", () => {
	it("countdown fires at normal AV without override", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "AQ" }),
				limit: 250,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown?.actionValue).toBeCloseTo(200, 4);

		const garmentmaker = actions.filter((a) => a.isAglaeaGarmentmakerAction);
		expect(garmentmaker.length).toBeGreaterThan(0);
		expect(garmentmaker[0].actionValue).toBeLessThan(countdown?.actionValue);
	});

	it("manual advance fires countdown early and dismisses garmentmaker", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "AQ" }),
				overrides: {
					"aglaea-aglaea-countdown-1": "120",
				},
				limit: 250,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown?.actionValue).toBeCloseTo(120, 4);

		const aglaeaAfter = actions.filter(
			(a) =>
				a.characterId === "aglaea" && a.actionValue > countdown?.actionValue,
		);
		if (aglaeaAfter.length > 0) {
			expect(aglaeaAfter.some((a) => a.isAglaeaSupremeAction)).toBe(false);
		}

		const garmentmakerAfter = actions.filter(
			(a) =>
				a.isAglaeaGarmentmakerAction && a.actionValue > countdown?.actionValue,
		);
		expect(garmentmakerAfter).toHaveLength(0);
	});

	it("manual delay lets supreme stance continue longer", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "AQ" }),
				overrides: {
					"aglaea-aglaea-countdown-1": "300",
				},
				limit: 400,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown?.actionValue).toBeCloseTo(300, 4);

		const garmentmakerCount = actions.filter(
			(a) => a.isAglaeaGarmentmakerAction,
		).length;
		expect(garmentmakerCount).toBeGreaterThan(1);
	});

	it("speed adjustment on countdown is ignored (countdown fires at set speed)", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({ "aglaea-1": "AQ" }),
				speedAdjustments: {
					"aglaea-aglaea-countdown-1": {
						mode: "absolute",
						value: "-20",
					},
				},
				limit: 250,
			}),
		);

		const countdown = actions.find((a) => a.isAglaeaCountdownAction);
		expect(countdown).toBeDefined();
		expect(countdown?.actionValue).toBeCloseTo(200, 4);
		expect(countdown?.speed).toBe(100);
	});

	it("second Q during supreme stance resets countdown", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "AQ",
					"aglaea-2": "AQ",
				}),
				limit: 250,
			}),
		);

		const countdowns = actions.filter((a) => a.isAglaeaCountdownAction);
		expect(countdowns).toHaveLength(1);

		const secondQ = actions.find((a) => a.key === "aglaea-2");
		expect(secondQ).toBeDefined();
		expect(countdowns[0].actionValue).toBeGreaterThan(secondQ?.actionValue);
	});

	it("second Q resets countdown even if first was manually advanced", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "AQ",
					"aglaea-2": "AQ",
				}),
				overrides: {
					"aglaea-aglaea-countdown-1": "130",
				},
				limit: 250,
			}),
		);

		const countdowns = actions.filter((a) => a.isAglaeaCountdownAction);
		expect(countdowns).toHaveLength(1);

		const secondQ = actions.find((a) => a.key === "aglaea-2");
		expect(secondQ).toBeDefined();
		expect(countdowns[0].actionValue).toBeGreaterThan(secondQ?.actionValue);
	});
});

// ───── 全队综合测试 ─────

describe("Aglaea team integration", () => {
	it("Aglaea+Robin+Sunday+Huohuo: Robin E 起手, 衣匠行动后 Robin Q 插队 (after aglaea-garmentmaker-g1-1)", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("robin", "知更鸟", 120, { hasVonwacq: true }),
					character("sunday", "星期日", 160, {
						hasVonwacq: true,
						hasWindSet: true,
						hasDance: true,
					}),
					character("huohuo", "藿藿", 150),
					character("aglaea", "阿格莱雅", 120),
				],
				skillOverrides: skills({
					"robin-1": "E",
					"sunday-1": "E",
					"sunday-2": "E",
					"aglaea-1": "E",
					"aglaea-2": "E",
				}),
				skillTargets: {
					"sunday-1": "aglaea",
					"sunday-2": "aglaea",
				},
				ultInterrupts: interrupts({
					// Robin Q 在衣匠行动后立刻插队（同一 AV）
					"aglaea-garmentmaker-g1-1": [{ casterId: "robin", timing: "after" }],
				}),
				limit: 300,
			}),
		);

		// 基本验证
		expect(actions.length).toBeGreaterThan(0);

		// 1) Robin 首动为 E
		expect(stripAv0(actions)[0].key).toBe("robin-1");
		expect(stripAv0(actions)[0].skill).toBe("E");

		// 2) Aglaea 前两动都是 E（召唤衣匠 + 第二次行动）
		expect(actions.find((a) => a.key === "aglaea-1")?.skill).toBe("E");
		expect(actions.find((a) => a.key === "aglaea-2")?.skill).toBe("E");

		// 3) Robin Q 在衣匠行动后（同一 AV）直接插队
		const interrupt = actions.find(
			(a) => a.key === "aglaea-garmentmaker-g1-1-interrupt-0",
		);
		expect(interrupt).toBeDefined();
		expect(interrupt?.characterId).toBe("robin");
		expect(interrupt?.skill).toBe("Q");

		// 4) 衣匠与插队在前后紧邻的同一 AV
		const garmentmakerActions = actions.filter((a) => a.displayName === "衣匠");
		expect(garmentmakerActions.length).toBeGreaterThan(0);
		const firstGarmentmaker = garmentmakerActions[0];
		expect(firstGarmentmaker).toBeDefined();
		// 衣匠在 AV≈38 行动后 Robin 立刻在同一 AV 插队
		expect(firstGarmentmaker.actionValue).toBeCloseTo(
			interrupt?.actionValue ?? 0,
			1,
		);
		// 衣匠在插队之前
		const garmentmakerIndex = actions.indexOf(firstGarmentmaker);
		const interruptIndex = actions.indexOf(interrupt);
		expect(garmentmakerIndex).toBeLessThan(interruptIndex);

		// 5) 插队后 Robin 进入 concerto（速度变为 90）
		const robinAfterInterrupt = actions.find((a) => a.key === "robin-2");
		expect(robinAfterInterrupt).toBeDefined();
		// Robin 速度 90, 10000/90 ≈ 111.11, 插队在 37.50, 所以第二次行动 ≈ 148.61
		expect(robinAfterInterrupt?.actionValue).toBeCloseTo(148.61, 1);
	});

	it("AQ in Supreme Stance splits into A + extra Q at same AV", () => {
		const actions = simulateActions(
			input({
				characters: [character("aglaea", "阿格莱雅", 100)],
				skillOverrides: skills({
					"aglaea-1": "AQ",
					"aglaea-2": "AQ",
				}),
				limit: 300,
			}),
		);

		// aglaea-1 的 AQ：A 为主行动，Q 为插队
		const aAction1 = actions.find((a) => a.key === "aglaea-1");
		expect(aAction1).toBeDefined();
		expect(aAction1?.skill).toBe("A");

		const qInterrupt1 = actions.find((a) => a.key === "aglaea-1-q");
		expect(qInterrupt1).toBeDefined();
		expect(qInterrupt1?.skill).toBe("Q");

		// aglaea-2 的 AQ：第二次 A+Q
		const aAction2 = actions.find((a) => a.key === "aglaea-2");
		expect(aAction2).toBeDefined();
		expect(aAction2?.skill).toBe("A");

		const qExtra = actions.find((a) => a.key === "aglaea-2-q");
		expect(qExtra).toBeDefined();
		expect(qExtra?.skill).toBe("Q");
		expect(qExtra?.actionValue).toBeCloseTo(aAction2?.actionValue ?? 0, 4);
	});
});
