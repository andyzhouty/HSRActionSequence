import { describe, expect, it } from "vitest";
import {
	type AxisEvaluation,
	axisPolicy,
	type SearchStats,
	searchDimensions,
	searchElationAxis,
} from "../../../src/damage/elationSearch";
import { evaluateAxis } from "../../../src/damage/elationSearchEvaluation";
import { simulateElationTeam } from "../../../src/damage/elationTeam";
import { defaultElationTeamConfig } from "../../../src/damage/elationTypes";
import type { EquipmentProfile } from "../../../src/damage/equipment";
import { createTarget } from "../../../src/utils/action-sequence";

function config() {
	const names = ["银狼LV.999", "爻光", "星神★阿哈", "真珠"];
	const profiles: EquipmentProfile[] = names.map((name, i) => ({
		character: {
			...createTarget(String(i), i),
			name,
			eidolon: 2,
			lc_id: [23057, 21064, 23065, 23055][i],
			superimpose: 1,
			techniqueOn: true,
		},
		level: 80,
		hp: 5000,
		defense: 3600,
		baseDefense: 1000,
		elation: 0.4,
		effectRes: 0,
		damageBonuses: {},
		baseAttack: 1000,
		attack: 2000,
		speed: 150,
		critRate: 0.5,
		critDamage: 1,
		physicalBonus: 0,
		windBonus: 0,
		gear: {
			sets: {},
			enhanced: false,
			skillLevel: 10,
			ultimateLevel: 10,
			talentLevel: 10,
			breakEffect: 0,
			energyRegen: 0.2,
			initialEnergy: 0,
			ultimateCost: [60, 180, 200, 140][i],
		},
	}));
	return { ...defaultElationTeamConfig, enabled: true, profiles };
}
const stats = (mean: number, samples: number): SearchStats => ({
	mean,
	min: mean,
	max: mean,
	p10: mean,
	p90: mean,
	samples,
});
describe("browser axis search", () => {
	it("converges, deduplicates training jobs, holds out validation seeds and preserves equipment/assumptions", async () => {
		const base = config(),
			before = JSON.stringify(base);
		const seen = new Set<string>();
		const evals = async (jobs: AxisEvaluation[]) =>
			jobs.map((j) => {
				const key = JSON.stringify(j);
				expect(seen.has(key)).toBe(false);
				seen.add(key);
				expect(j.policy).not.toHaveProperty("boxCountsAsAttack");
				const score =
					10000 -
					Math.abs(j.policy.wolfUltMinScore - 560) -
					Math.abs(j.policy.wolfUltRushWindow - 20) -
					Math.abs(j.policy.pearlSkillEvery - 4) * 10;
				return stats(score, j.samples);
			});
		const result = await searchElationAxis(base, "quick", evals);
		expect(result.candidates[0].policy.wolfUltMinScore).toBe(560);
		expect(result.candidates[0].policy.pearlSkillEvery).toBe(4);
		expect(result.candidates.some((c) => c.baseline)).toBe(true);
		expect(result.candidates[0].stats.mean).toBeGreaterThan(
			result.baseline.mean,
		);
		expect(result.validationSeed).not.toBe(result.trainingSeed);
		expect(result.validationSamples).toBe(32);
		expect(JSON.stringify(base)).toBe(before);
		expect(result.evaluated).toBe(seen.size);
	});
	it("searches only present allies, including nonstandard profile IDs", () => {
		const base = config();
		const dims = searchDimensions(base);
		expect(dims.some((d) => d.key === "huoSkillEvery")).toBe(false);
		expect(dims.find((d) => d.key === "pearlBlueprintId")?.values).toEqual([
			"",
			"0",
			"1",
			"2",
		]);
		expect(dims.find((d) => d.key === "starEnvoyId")?.values).toContain("3");
	});
	it("matches full simulator totals across seeds without changing the input", () => {
		const base = { ...config(), limit: 100 },
			before = JSON.stringify(base);
		const policy = axisPolicy(base),
			seed = 123;
		const expected = [0, 1].map(
			(i) => simulateElationTeam({ ...base, ...policy, seed: seed + i }).total,
		);
		const result = evaluateAxis(base, { policy, seed, samples: 2 });
		expect(result.mean).toBe((expected[0] + expected[1]) / 2);
		expect(result.min).toBe(Math.min(...expected));
		expect(JSON.stringify(base)).toBe(before);
	});
	it("stops after cancellation and propagates evaluator failures", async () => {
		let stopped = false,
			calls = 0;
		await expect(
			searchElationAxis(
				config(),
				"quick",
				async (jobs) => {
					calls++;
					stopped = true;
					return jobs.map((j) => stats(1, j.samples));
				},
				undefined,
				() => stopped,
			),
		).rejects.toThrow("取消");
		expect(calls).toBe(1);
		await expect(
			searchElationAxis(config(), "quick", async () => {
				throw new Error("worker broken");
			}),
		).rejects.toThrow("worker broken");
	});
});
