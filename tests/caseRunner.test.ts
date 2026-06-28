import { describe, expect, it } from "vitest";
import { type CharacterConfig, type SkillCode, type UltInterrupt } from "../src/utils/actionSequence";
import { simulateActions } from "../src/utils/simulateActions";

/** Helper: 创建角色配置 */
function char(
	id: string,
	name: string,
	speed: number,
	opts: {
		baseSpeed?: number;
		eidolon?: number;
		vonwacq?: boolean;
		windSet?: boolean;
		dance?: boolean;
	} = {},
): CharacterConfig {
	return {
		id, kind: "角色", name,
		speed: String(speed),
		baseSpeed: String(opts.baseSpeed ?? speed),
		hasVonwacq: opts.vonwacq ?? false,
		hasWindSet: opts.windSet ?? false,
		hasDance: opts.dance ?? false,
		hasEidolon1: (opts.eidolon ?? 0) >= 1,
		hasEidolon2: (opts.eidolon ?? 0) >= 2,
		hasEidolon4: (opts.eidolon ?? 0) >= 4,
	};
}

/** Helper: 技能覆盖 */
function skillOverrides(entries: Record<string, string>): Record<string, SkillCode> {
	return entries as Record<string, SkillCode>;
}

/** Helper: 插队配置 */
function interrupts(entries: Record<string, UltInterrupt[]>): Record<string, UltInterrupt[]> {
	return entries;
}

/** Helper: 按轴步骤执行并校验 */
function runWithSteps(
	desc: string,
	steps: {
		characters: CharacterConfig[];
		skillOverrides: Record<string, SkillCode>;
		ultInterrupts?: Record<string, UltInterrupt[]>;
		skillTargets?: Record<string, string>;
		fireflyBreakCounters?: Record<string, boolean>;
		limit?: number;
		/** [actionKey, expectedAV][] — 断言指定行动的 actionValue */
		assertActionAV?: [string, number][];
		/** 断言某角色速度 */
		assertSpeed?: Record<string, number>;
		/** 断言完全燃烧倒计时 actionValue */
		assertCountdownAV?: number;
		/** 断言境界总动数 */
		assertDomainCount?: number;
		/** 断言境界两动间隔范围 */
		assertDomainInterval?: { min?: number; max?: number };
	},
): void {
	it(desc, () => {
		const actions = simulateActions({
			characters: steps.characters,
			limit: steps.limit ?? 500,
			overrides: {},
			skillOverrides: steps.skillOverrides,
			domainEndOverrides: {},
			legacyUltOverrides: {},
			speedAdjustments: {},
			skillTargets: steps.skillTargets ?? {},
			defaultSkillTargets: {},
			odeSelections: {},
			memeSelections: {},
			ultInterrupts: steps.ultInterrupts ?? {},
			fireflyBreakCounters: steps.fireflyBreakCounters ?? {},
		});
		expect(actions.length).toBeGreaterThan(0);

		if (steps.assertActionAV) {
			for (const [key, expectedAV] of steps.assertActionAV) {
				const action = actions.find((a) => a.key === key);
				expect(action, `未找到 key=${key}`).toBeDefined();
				expect(action!.actionValue).toBeCloseTo(expectedAV, 2);
			}
		}

		if (steps.assertSpeed) {
			for (const [charName, spd] of Object.entries(steps.assertSpeed)) {
				const charActions = actions.filter((a) => a.characterId === charName);
				expect(charActions.length).toBeGreaterThan(0);
				expect(charActions.some((a) => a.speed === spd)).toBe(true);
			}
		}

		if (steps.assertCountdownAV !== undefined) {
			const countdown = actions.find((a) => a.displayName === "完全燃烧倒计时");
			expect(countdown).toBeDefined();
			expect(countdown!.actionValue).toBeCloseTo(steps.assertCountdownAV, 2);
		}

		if (steps.assertDomainCount !== undefined) {
			expect(actions.filter((a) => a.isDomainAction).length).toBe(steps.assertDomainCount);
		}

		if (steps.assertDomainInterval) {
			const ds = actions.filter((a) => a.isDomainAction);
			for (let i = 1; i < ds.length; i++) {
				const interval = ds[i].actionValue - ds[i - 1].actionValue;
				if (steps.assertDomainInterval.min !== undefined) {
					expect(interval).toBeGreaterThan(steps.assertDomainInterval.min);
				}
				if (steps.assertDomainInterval.max !== undefined) {
					expect(interval).toBeLessThan(steps.assertDomainInterval.max);
				}
			}
		}
	});
}

// ───────────── 白花鸭鸟（白厄境界测试） ─────────────

describe("白花鸭鸟", () => {
	runWithSteps("白厄境界轴", {
		characters: [
			char("花火", "花火", 164, { vonwacq: true, windSet: true }),
			char("鸭鸭", "鸭鸭", 163, { vonwacq: true, windSet: true }),
			char("白厄", "白厄", 111, { baseSpeed: 106, eidolon: 1 }),
			char("知更鸟", "知更鸟", 120, { vonwacq: true }),
		],
		skillOverrides: skillOverrides({
			"知更鸟-1": "E",
			"花火-1": "E",
			"鸭鸭-1": "E",
			"白厄-1": "E",
			"花火-2": "E",
			"白厄-2": "E",
			"鸭鸭-2": "E",
			"白厄-3": "E",
		}),
		skillTargets: { "花火-1": "白厄", "花火-2": "白厄", "鸭鸭-1": "白厄", "鸭鸭-2": "白厄" },
		ultInterrupts: interrupts({
			"白厄-1": [{ casterId: "知更鸟", timing: "after" }],
			"白厄-3": [
				{ casterId: "鸭鸭", timing: "before" },
				{ casterId: "花火", timing: "before" },
				{ casterId: "白厄", timing: "after" },
			],
		}),
		limit: 500,
		assertActionAV: [["鸭鸭-2", 36.81]],
		assertDomainCount: 8,
		assertDomainInterval: { min: 20, max: 21 },
	});
});

// ───────────── 流萤E2击破 ─────────────

describe("流萤E2击破", () => {
	runWithSteps("E2击破额外回合", {
		characters: [
			char("流萤", "流萤", 160, { baseSpeed: 104, eidolon: 2 }),
			char("大丽花", "大丽花", 150, { eidolon: 1, windSet: true, vonwacq: true }),
			char("忘归人", "忘归人", 150, { eidolon: 2, windSet: true, vonwacq: true }),
			char("同谐主", "同谐主", 160, { eidolon: 6, dance: true, vonwacq: true }),
		],
		skillOverrides: skillOverrides({
			"同谐主-1": "E",
			"大丽花-1": "E",
			"忘归人-1": "E",
			"流萤-1": "E",
			"流萤-2": "E",
		}),
		skillTargets: { "忘归人-1": "流萤" },
		ultInterrupts: interrupts({
			"忘归人-1": [{ casterId: "忘归人", timing: "after" }],
			"流萤-1": [{ casterId: "流萤", timing: "after" }],
		}),
		fireflyBreakCounters: { "流萤-2": true, "流萤-2-break-extra-1": true },
		assertActionAV: [["流萤-2-break-extra-1", 47.50]],
		assertCountdownAV: 218.93,
		assertSpeed: { "流萤": 220 },
	});
});
