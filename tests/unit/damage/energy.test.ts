import { describe, expect, it } from "vitest";
import { createEnergyTracker } from "../../../src/damage/energy";
import { defaultPhainonTrialConfig } from "../../../src/damage/types";
import { createTarget } from "../../../src/utils/action-sequence";

describe("energy accounting", () => {
	const bronya = {
		...createTarget("b", 0),
		name: "布洛妮娅",
		techniqueOn: false,
	};
	const config = {
		...defaultPhainonTrialConfig,
		gear: {
			b: {
				sets: { "308": 2 },
				enhanced: false,
				skillLevel: 10,
				ultimateLevel: 10,
				talentLevel: 10,
				breakEffect: 0,
				energyRegen: 0.244394,
				initialEnergy: 0,
				ultimateCost: 120,
			},
		},
	};
	it("scales base A20, E30 and enemy AoE10 with exact regeneration", () => {
		const energy = createEnergyTracker([bronya], config);
		energy.onSkill(bronya, "A", []);
		expect(energy.snapshot().b.current).toBeCloseTo(24.88788);
		energy.onSkill(bronya, "E", []);
		expect(energy.snapshot().b.current).toBeCloseTo(62.2197);
		energy.onEnemyAoe(false);
		expect(energy.snapshot().b.current).toBeCloseTo(74.66364);
		energy.onEnemyAoe(true);
		expect(energy.snapshot().b.current).toBeCloseTo(74.66364);
	});
	it("keeps explicit fixed energy unscaled and rejects an uncharged ultimate", () => {
		const energy = createEnergyTracker([bronya], config);
		energy.gain("b", 10, "固定回能", true);
		expect(energy.snapshot().b.current).toBe(10);
		const notes: string[] = [];
		energy.onSkill(bronya, "Q", notes);
		expect(notes[0]).toContain("能量不足");
		expect(energy.snapshot().b.current).toBeCloseTo(5 * 1.244394);
	});
});
