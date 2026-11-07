import { describe, expect, it } from "vitest";
import { calculateDamage } from "../../../src/damage/formula";
import { calculatePhainonTrial } from "../../../src/damage/phainonTrial";
import {
	defaultPhainonTrialConfig as baseConfig,
	normalizePhainonTrialConfig,
} from "../../../src/damage/types";

const defaultPhainonTrialConfig = {
	...baseConfig,
	enemyCount: 3,
	targetIndex: 1,
};

import {
	createTarget,
	type GeneratedAction,
} from "../../../src/utils/action-sequence";

const character = (id: string, name: string, eidolon = 0) => ({
	...createTarget(id, 0),
	name,
	speed: "100",
	techniqueOn: false,
	eidolon,
});
function required<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("Missing expected row");
	return value;
}
const action = (
	key: string,
	characterId: string,
	skill: string,
	domain = false,
	index = 1,
): GeneratedAction => ({
	key,
	characterId,
	skill,
	actionNo: index,
	actionValue: index * 10,
	speed: 100,
	isDomainAction: domain,
});

describe("damage areas", () => {
	it("keeps vulnerability separate from damage bonus and applies the supplied defense formula", () => {
		const damage = calculateDamage(1000, {
			...defaultPhainonTrialConfig,
			attackerLevel: 80,
			enemyLevel: 100,
			damageBonus: 0.5,
			vulnerability: 0.3,
			critRate: 0.5,
			critDamage: 2,
			toughnessBroken: true,
		});
		expect(damage.expected).toBeCloseTo(1000 * 1.5 * 1.3 * (100 / 220) * 2);
		expect(damage.crit).toBeCloseTo(damage.nonCrit * 3);
	});
	it("caps resistance, defense and crit rate, and respects the minimum reduction area", () => {
		const damage = calculateDamage(1000, {
			...defaultPhainonTrialConfig,
			damageBonus: 0,
			resistance: -2,
			defenseIgnore: 1.2,
			critRate: 2,
			critDamage: 1,
			damageReduction: 1,
			toughnessBroken: true,
		});
		expect(damage.expected).toBeCloseTo(40);
		expect(() => calculateDamage(NaN, defaultPhainonTrialConfig)).toThrow();
	});
	it("accepts negative resistance but rejects corrupt imported configuration", () => {
		expect(normalizePhainonTrialConfig({ resistance: -0.2 })?.resistance).toBe(
			-0.2,
		);
		expect(() => normalizePhainonTrialConfig({ basicLevel: 10 })).toThrow();
		expect(() =>
			normalizePhainonTrialConfig({ enemyCount: 1, targetIndex: 3 }),
		).toThrow();
	});
});

describe("Phainon skill replay", () => {
	it("starts with one seed and returns three plus the banked overflow after the final hit", () => {
		const enemy = {
			...createTarget("enemy", 0, "敌人"),
			name: "验证敌人",
			speed: "200",
		};
		const result = calculatePhainonTrial({
			characters: [character("p", "白厄"), enemy],
			config: { ...defaultPhainonTrialConfig, characterId: "p" },
			actions: [
				action("initial", "p", "A"),
				...Array.from({ length: 14 }, (_, index) =>
					action(`enemy-${index}`, "enemy", ""),
				),
				{ ...action("q", "p", "Q"), actionNo: 0 },
				action("a", "p", "A", true),
				{ ...action("final", "p", "Q", true, 8), isDomainFinalAction: true },
			],
		});
		expect(
			required(result.rows.find((row) => row.key === "initial")).seeds,
		).toBe(1);
		const opening = required(result.rows.find((row) => row.key === "q"));
		expect(opening.seeds).toBe(0);
		expect(opening.seedOverflow).toBe(3);
		const final = required(result.rows.find((row) => row.key === "final"));
		expect(final.seeds).toBe(6);
		expect(final.seedOverflow).toBe(0);
	});
	it("rejects ultimate re-entry and off-field support casts during the domain", () => {
		const result = calculatePhainonTrial({
			characters: [character("p", "白厄", 2), character("r", "知更鸟")],
			config: { ...defaultPhainonTrialConfig, characterId: "p" },
			actions: [
				action("q", "p", "Q"),
				action("a", "p", "A", true),
				{ ...action("bad", "p", "Q"), actionNo: 0 },
				{ ...action("rq", "r", "Q"), actionNo: 0 },
			],
		});
		expect(
			required(result.rows.find((row) => row.key === "bad")).warnings.join(),
		).toContain("境界内不能");
		expect(
			required(result.rows.find((row) => row.key === "rq")).warnings.join(),
		).toContain("队友离场");
	});
	it("does not revive a one-turn Bronya buff when Q is inserted after a later enemy turn", () => {
		const enemy = {
			...createTarget("enemy", 0, "敌人"),
			name: "验证敌人",
			speed: "200",
		};
		const result = calculatePhainonTrial({
			characters: [character("p", "白厄"), character("b", "布洛妮娅"), enemy],
			config: { ...defaultPhainonTrialConfig, characterId: "p" },
			defaultSkillTargets: { b: "p" },
			actions: [
				action("be", "b", "E"),
				action("pe", "p", "E"),
				action("enemy1", "enemy", ""),
				{ ...action("pq", "p", "Q"), actionNo: 0 },
				action("d0", "p", "A", true),
			],
		});
		expect(
			required(result.rows.find((row) => row.key === "pe")).buffs,
		).toContain("作战再部署");
		expect(
			required(result.rows.find((row) => row.key === "pq")).buffs,
		).not.toContain("作战再部署");
		expect(
			required(result.rows.find((row) => row.key === "d0")).buffs,
		).not.toContain("作战再部署");
	});
	it("keeps the in-game duration rule: a 2-turn buff applied after Phainon's turn starts covers three actions", () => {
		// 实战口径：增益在目标回合开始（回合开始扣减之后）生效时不吃当回合那一层。
		// 所以鸭E之后放只覆盖2次，白厄回合内、他E之前放会覆盖3次。
		const cast = (key: string, timing: "before" | "after", av: number) => ({
			key,
			characterId: "b",
			skill: "Q",
			actionNo: 0,
			actionValue: av,
			speed: 100,
			interruptTiming: timing,
		});
		const run = (mode: "after" | "before") =>
			calculatePhainonTrial({
				characters: [character("p", "白厄", 2), character("b", "布洛妮娅", 4)],
				config: {
					...defaultPhainonTrialConfig,
					characterId: "p",
					bronyaCritDamage: 1.73144,
				},
				defaultSkillTargets: { b: "p" },
				actions: [
					action("be", "b", "E"),
					action("pe1", "p", "E", false, 1),
					...(mode === "after" ? [cast("pe1-interrupt-0", "after", 20)] : []),
					...(mode === "before" ? [cast("pe2-interrupt-0", "before", 30)] : []),
					action("pe2", "p", "E", false, 2),
					action("pe3", "p", "E", false, 3),
					action("pe4", "p", "E", false, 4),
				],
			});
		const coverage = (mode: "after" | "before", key: string) =>
			required(run(mode).rows.find((row) => row.key === key)).buffs.includes(
				"布洛妮娅终结技",
			);
		expect(coverage("after", "pe2")).toBe(true);
		expect(coverage("after", "pe3")).toBe(true);
		expect(coverage("after", "pe4")).toBe(false);
		expect(coverage("before", "pe2")).toBe(true);
		expect(coverage("before", "pe3")).toBe(true);
		expect(coverage("before", "pe4")).toBe(true);
	});
	it("does not treat Robin E/Q as targeting Phainon for seeds, talent or captain stacks", () => {
		const result = calculatePhainonTrial({
			characters: [character("p", "白厄"), character("r", "知更鸟", 1)],
			config: {
				...defaultPhainonTrialConfig,
				characterId: "p",
				gear: {
					p: {
						sets: { "126": 4 },
						enhanced: false,
						skillLevel: 10,
						ultimateLevel: 10,
						talentLevel: 10,
						breakEffect: 0,
					},
				},
			},
			actions: [
				action("re", "r", "E"),
				action("rq", "r", "Q"),
				action("pq", "p", "Q"),
			],
		});
		expect(result.rows[0].seeds).toBe(1);
		expect(result.rows[1].seeds).toBe(1);
		expect(result.rows[1].critDamage).toBeCloseTo(
			defaultPhainonTrialConfig.critDamage + 0.2,
		);
		expect(result.rows[1].buffs).not.toContain("此身为炬·暴伤");
		expect(result.rows[2].buffs).not.toContain("船长·助力");
		expect(result.rows[1].buffs).toContain("知更鸟战技");
		expect(result.rows[1].buffs).toContain("协奏攻击力（实时）");
	});
	it("gives one seed per enemy AoE outside the domain and none inside", () => {
		const enemy = {
			...createTarget("enemy", 0, "敌人"),
			name: "验证敌人",
			speed: "200",
		};
		const result = calculatePhainonTrial({
			characters: [character("p", "白厄"), enemy],
			config: { ...defaultPhainonTrialConfig, characterId: "p" },
			actions: [
				action("enemy1", "enemy", ""),
				action("q", "p", "Q"),
				action("w", "p", "W", true),
				action("forced-enemy", "enemy", ""),
				action("enemy2", "enemy", ""),
				{ ...action("final", "p", "Q", true, 8), isDomainFinalAction: true },
				action("enemy3", "enemy", ""),
			],
		});
		expect(result.rows.find((row) => row.key === "enemy1")?.seeds).toBe(2);
		expect(result.rows.find((row) => row.key === "forced-enemy")?.seeds).toBe(
			0,
		);
		expect(result.rows.find((row) => row.key === "enemy2")?.seeds).toBe(0);
		expect(result.rows.find((row) => row.key === "enemy3")?.seeds).toBe(4);
	});
	it("uses level 6 for A and splits an E2 extra turn without spending another domain slot", () => {
		const result = calculatePhainonTrial({
			characters: [character("p", "白厄", 2)],
			config: { ...defaultPhainonTrialConfig, characterId: "p" },
			actions: [
				action("q", "p", "Q"),
				action("d0", "p", "EA", true),
				action("d1", "p", "EW", true, 2),
			],
		});
		const firstE = required(
			result.rows.find((row) => row.key === "d0-damage-E"),
		);
		const extraA = required(
			result.rows.find((row) => row.key === "d0-damage-extra-A"),
		);
		expect(
			firstE.multipliers.reduce((sum, value) => sum + value, 0),
		).toBeCloseTo(11.7);
		expect(extraA.multipliers).toEqual([0.75, 2.5, 0.75]);
		expect(extraA.ruin).toBe(2);
		expect(firstE.factors.resistancePenetration).toBeCloseTo(0.2);
		expect(firstE.critDamage).toBeCloseTo(2.3);
		expect(
			result.rows.find((row) => row.key === "d1-damage-E")?.warnings.join(),
		).toContain("未消耗4毁伤");
		expect(result.rows.some((row) => row.key === "d1-damage-extra-W")).toBe(
			false,
		);
	});
	it("retains excess ruin, applies a single divided final hit, and adds post-domain seeds", () => {
		const final = {
			...action("final", "p", "Q", true, 8),
			isDomainFinalAction: true,
		};
		const result = calculatePhainonTrial({
			characters: [character("p", "白厄")],
			config: {
				...defaultPhainonTrialConfig,
				characterId: "p",
				actionOverrides: { e: { ruin: 7 } },
			},
			actions: [
				action("q", "p", "Q"),
				action("e", "p", "E", true),
				final,
				action("after", "p", "A", false, 2),
			],
		});
		expect(result.rows.find((row) => row.key === "e")?.ruin).toBe(3);
		expect(result.rows.find((row) => row.key === "final")?.multipliers).toEqual(
			[3.1999999999999997, 3.1999999999999997, 3.1999999999999997],
		);
		expect(result.rows.find((row) => row.key === "after")?.seeds).toBe(3);
	});
	it("puts enhanced Sparkle's effect into vulnerability and keeps support buffs in the domain", () => {
		const characters = [
			character("p", "白厄", 2),
			character("s", "花火"),
			character("b", "布洛妮娅", 4),
			character("r", "知更鸟", 1),
		];
		const gear = {
			sets: {},
			enhanced: false,
			skillLevel: 10,
			ultimateLevel: 10,
			talentLevel: 10,
			breakEffect: 0,
		};
		const result = calculatePhainonTrial({
			characters,
			defaultSkillTargets: { b: "p", s: "p" },
			config: {
				...defaultPhainonTrialConfig,
				characterId: "p",
				gear: {
					s: { ...gear, enhanced: true },
					b: { ...gear, ultimateLevel: 12, talentLevel: 12 },
				},
			},
			actions: [
				action("sq", "s", "Q"),
				action("se", "s", "E"),
				action("bq", "b", "Q"),
				action("be", "b", "E"),
				action("re", "r", "E"),
				action("rq", "r", "Q"),
				action("pq", "p", "Q"),
				action("d0", "p", "A", true),
				action("d6", "p", "A", true, 7),
			],
		});
		const first = required(result.rows.find((row) => row.key === "d0"));
		const last = required(result.rows.find((row) => row.key === "d6"));
		expect(first.factors.vulnerability).toBeCloseTo(0.3);
		expect(first.factors.resistancePenetration).toBeCloseTo(0.54);
		expect(first.damageBonus).toBeCloseTo(0.388 + 0.1 + 0.66 + 0.5);
		expect(last.attack).toBe(first.attack);
		expect(last.critDamage).toBe(first.critDamage);
	});
});
