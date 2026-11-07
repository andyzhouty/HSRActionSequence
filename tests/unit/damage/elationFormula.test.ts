import { expect, it } from "vitest";
import { calculateElationDamage } from "../../../src/damage/elationFormula";
import { defaultPhainonTrialConfig } from "../../../src/damage/types";

it("uses the supplied 7535.107 formula and excludes ordinary damage bonus", () => {
	const f = {
		...defaultPhainonTrialConfig,
		enemyLevel: 80,
		critRate: 1,
		critDamage: 1,
		damageBonus: 100,
		resistance: 0.2,
		defenseIgnore: 0,
	};
	// 40 jokes -> 12/7, 100% elation -> 2, multiplier 2, 50% merrymaking -> 1.5,
	// vulnerability 20%, guaranteed crit x2, resistance x0.8, defense x0.5.
	const d = calculateElationDamage(2, 1, 40, 0.5, { ...f, vulnerability: 0.2 });
	expect(d.expected).toBeCloseTo(
		7535.107 * 2 * 2 * 1.5 * 1.2 * (12 / 7) * 2 * 0.8 * 0.5,
	);
	expect(
		calculateElationDamage(2, 1, 40, 0.5, {
			...f,
			vulnerability: 0.2,
			damageBonus: 0,
		}).expected,
	).toBe(d.expected);
	expect(() =>
		calculateElationDamage(1, 0, 0, 0, { ...f, attackerLevel: 70 }),
	).toThrow();
});
