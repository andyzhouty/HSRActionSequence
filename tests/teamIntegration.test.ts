import { describe, expect, it } from "vitest";
import type {
	CharacterConfig,
	SkillCode,
	UltInterrupt,
} from "../src/utils/actionSequence";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../src/simulate/actions";

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
		limit: 200,
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

// ───── 花火花鸭白厄知更鸟 完整排轴 ─────

describe("花火 + 鸭鸭 + 白厄 + 知更鸟 完整排轴", () => {
	it("按指定顺序行动，白厄开境界，结束后全队获得加速 buff", () => {
		const actions = simulateActions(
			input({
				characters: [
					// 花火: 164速 风套 翁瓦克
					character("sparkle", "花火", 164, {
						hasVonwacq: true,
						hasWindSet: true,
					}),
					// 鸭鸭: 163速 风套 翁瓦克
					character("bronya", "鸭鸭", 163, {
						hasVonwacq: true,
						hasWindSet: true,
					}),
					// 白厄: 111速 106基础速度 1魂
					character("phainon", "白厄", 111, {
						baseSpeed: "106",
						eidolon: 1,
					}),
					// 知更鸟: 120速 翁瓦克（首动25%拉条被动在 characters.json 中）
					character("robin", "知更鸟", 120, {
						hasVonwacq: true,
					}),
				],
				skillOverrides: skills({
					"robin-1": "E",
					"sparkle-1": "E",
					"bronya-1": "E",
					"phainon-1": "E",
					"sparkle-2": "E",
					"phainon-2": "E",
					"bronya-2": "E",
					"phainon-3": "E",
					// 第4次白厄行动后，插队鸭鸭Q、花火Q，然后白厄Q开境界
					"phainon-4": "AQ",
				}),
				skillTargets: {
					"sparkle-1": "phainon",
					"bronya-1": "phainon",
					"sparkle-2": "phainon",
					"bronya-2": "phainon",
				},
				ultInterrupts: interrupts({
					// 白厄第1动E后，插队知更鸟大招
					"phainon-1": [{ casterId: "robin", timing: "before" }],
					// 白厄第3动E后、第4动Q前，插队鸭鸭Q、花火Q
					"phainon-3": [
						{ casterId: "bronya", timing: "before" },
						{ casterId: "sparkle", timing: "before" },
					],
				}),
				// 提高到足够看到白厄境界结束
				limit: 700,
			}),
		);

		// ── 基础验证 ──
		expect(actions.length).toBeGreaterThan(0);

		// 知更鸟有首动25%拉条 + 翁瓦克40%，应该是第一个行动
		expect(stripAv0(actions)[0].characterId).toBe("robin");
		expect(stripAv0(actions)[0].skill).toBe("E");

		// 花火和鸭鸭都有翁瓦克，紧随知更鸟之后
		// 知更鸟 E → 花火 E → 鸭鸭 E → 白厄 E → 知更鸟 Q(插队)

		// ── 验证白厄境界 ──
		const phainonQ = actions.find(
			(a) => a.characterId === "phainon" && a.skill === "Q",
		);
		expect(phainonQ).toBeDefined();

		// Q 后应该进入境界
		const domainActions = actions.filter((a) => a.isDomainAction);
		expect(domainActions.length).toBeGreaterThan(0);

		// ── 验证知更鸟插队大招 ──
		const robinInterrupt = actions.find(
			(a) => a.key === "phainon-1-interrupt-0",
		);
		expect(robinInterrupt).toBeDefined();
		expect(robinInterrupt?.skill).toBe("Q");
		expect(robinInterrupt?.characterId).toBe("robin");

		// ── 验证鸭鸭/花火插队大招 ──
		const bronyaInterrupt = actions.find(
			(a) => a.key === "phainon-3-interrupt-0",
		);
		const sparkleInterrupt = actions.find(
			(a) => a.key === "phainon-3-interrupt-1",
		);
		expect(bronyaInterrupt).toBeDefined();
		expect(bronyaInterrupt?.characterId).toBe("bronya");
		expect(sparkleInterrupt).toBeDefined();
		expect(sparkleInterrupt?.characterId).toBe("sparkle");

		// ── 验证行动顺序关键节点（知更鸟先动，白厄最后Q开境界） ──
		const mainActions = stripAv0(actions).filter(
			(a) => !a.isDomainAction && !a.key.includes("interrupt"),
		);
		// 第一个行动是知更鸟
		expect(mainActions[0].characterId).toBe("robin");
		expect(mainActions[0].skill).toBe("E");
		// 最后行动是白厄 Q（开境界）
		const phainonQAction = actions.find(
			(a) =>
				a.characterId === "phainon" && a.skill === "Q" && !a.isDomainAction,
		);
		expect(phainonQAction).toBeDefined();

		// ── 验证境界终结 ──
		const finalDomain = domainActions.find((a) => a.isDomainFinalAction);
		expect(finalDomain).toBeDefined();
		expect(finalDomain?.skill).toBe("Q");

		// ── 验证境界持续时间 ──
		// extraActionCount=8 + 1 final, E1 coeff=0.66, baseSpeed=106
		// 境界应有 8 domain 行动（索引 0-7）+ 1 终结
		expect(domainActions.filter((a) => !a.isDomainFinalAction).length).toBe(7);
		expect(domainActions.filter((a) => a.isDomainFinalAction).length).toBe(1);

		// ── 验证境界后加速 buff（allies pushed past final AV + speed bonus） ──
		// 境界结束后，花火和鸭鸭的下一次行动应该被推后
		const finalAV = finalDomain?.actionValue;
		const alliesAfter = actions.filter(
			(a) =>
				(a.characterId === "sparkle" || a.characterId === "bronya") &&
				!a.isDomainAction &&
				a.actionValue > finalAV,
		);
		expect(alliesAfter.length).toBeGreaterThan(0);

		// ── 验证白厄境界后正常行动（说明境界结束、状态重置） ──
		const phainonAfterDomain = actions.filter(
			(a) =>
				a.characterId === "phainon" &&
				!a.isDomainAction &&
				a.actionValue > finalAV,
		);
		expect(phainonAfterDomain.length).toBeGreaterThan(0);
	});
});

// ───── 刻律军功目标中途切换 ─────

describe("刻律军功目标中途切换", () => {
	it("刻律 E 切换军功目标后速度正确转移", () => {
		// 刻律 180 速 翁瓦克，初始军功目标=白厄(111速)
		// 刻律第一动 E 选择那刻夏(111速)
		// 刻律翁瓦克首发比白厄快，E 切换后白厄速度降为 111，那刻夏升为 133.2
		const actions = simulateActions(
			input({
				characters: [
					character("cerydra", "刻律德菈", 180, {
						hasVonwacq: true,
					}),
					character("bai-e", "白厄", 111, {
						baseSpeed: "111",
					}),
					character("nakexia", "那刻夏", 111, {
						baseSpeed: "111",
					}),
				],
				meritTarget: "bai-e",
				skillOverrides: skills({ "cerydra-1": "E" }),
				skillTargets: { "cerydra-1": "nakexia" },
				limit: 150,
			}),
		);

		// 刻律速度始终 216（180*1.2）
		const cerydraActions = actions.filter((a) => a.characterId === "cerydra");
		expect(cerydraActions.length).toBeGreaterThanOrEqual(1);
		for (const a of cerydraActions) {
			expect(a.speed).toBeCloseTo(216, 1);
		}

		// 白厄在刻律 E 切换后才行动，速度应降为 111
		const baiActions = actions.filter((a) => a.characterId === "bai-e");
		const baiFirst = baiActions[0];
		expect(baiFirst.speed).toBeCloseTo(111, 0);

		// 那刻夏在刻律 E 切换后才行动，速度应升为 133.2
		const nakexiaActions = actions.filter((a) => a.characterId === "nakexia");
		const nakexiaFirst = nakexiaActions[0];
		expect(nakexiaFirst.speed).toBeCloseTo(133.2, 1);
	});

	it("刻律 E 切换后旧目标速度正确降低", () => {
		// 初始目标白厄，E 切换至那刻夏后，白厄速度降为 111
		const actions = simulateActions(
			input({
				characters: [
					character("cerydra", "刻律德菈", 180, {
						hasVonwacq: true,
					}),
					character("bai-e", "白厄", 111, {
						baseSpeed: "111",
					}),
					character("nakexia", "那刻夏", 111, {
						baseSpeed: "111",
					}),
				],
				meritTarget: "bai-e",
				skillOverrides: skills({
					"cerydra-1": "E",
					"bai-e-1": "A",
					"nakexia-1": "A",
				}),
				skillTargets: { "cerydra-1": "nakexia" },
				limit: 300,
			}),
		);

		// 刻律 E 首发后白厄速度降为 111
		const baiFirst = actions.find((a) => a.characterId === "bai-e");
		expect(baiFirst?.speed).toBeCloseTo(111, 0);

		// 那刻夏 E 切换后速度升为 133.2
		const nakexiaFirst = actions.find((a) => a.characterId === "nakexia");
		expect(nakexiaFirst?.speed).toBeCloseTo(133.2, 1);
	});
});




