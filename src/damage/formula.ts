/** Ratios use decimals: 50% = 0.5. Each field corresponds to a separate damage area. */
export type DamageFactors = {
	attackerLevel: number;
	enemyLevel: number;
	damageBonus: number;
	vulnerability: number;
	weaken: number;
	damageReduction: number;
	resistance: number;
	resistancePenetration: number;
	defenseReduction: number;
	defenseIgnore: number;
	critRate: number;
	critDamage: number;
	independentMultiplier: number;
	toughnessBroken: boolean;
};

export const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export function calculateDamage(baseDamage: number, factors: DamageFactors) {
	if (
		!Number.isFinite(baseDamage) ||
		baseDamage < 0 ||
		Object.values(factors).some(
			(value) => typeof value === "number" && !Number.isFinite(value),
		)
	)
		throw new Error("伤害参数必须是有限数值");
	if (
		factors.attackerLevel < 1 ||
		factors.enemyLevel < 1 ||
		factors.critDamage < 0 ||
		factors.independentMultiplier < 0
	)
		throw new Error("伤害参数超出范围");
	const areas = {
		independent: factors.independentMultiplier,
		damageBonus: Math.max(0, 1 + factors.damageBonus),
		vulnerability: Math.max(0, 1 + factors.vulnerability),
		weaken: 1 - clamp(factors.weaken, 0, 1),
		reduction: clamp(1 - factors.damageReduction, 0.01, 1),
		resistance:
			1 - clamp(factors.resistance - factors.resistancePenetration, -1, 0.9),
		defense:
			(factors.attackerLevel + 20) /
			(factors.attackerLevel +
				20 +
				(factors.enemyLevel + 20) *
					(1 - clamp(factors.defenseReduction + factors.defenseIgnore, 0, 1))),
		toughness: factors.toughnessBroken ? 1 : 0.9,
	};
	const nonCrit =
		baseDamage *
		Object.values(areas).reduce((total, factor) => total * factor, 1);
	return {
		nonCrit,
		crit: nonCrit * (1 + factors.critDamage),
		expected:
			nonCrit * (1 + clamp(factors.critRate, 0, 1) * factors.critDamage),
		areas,
	};
}
