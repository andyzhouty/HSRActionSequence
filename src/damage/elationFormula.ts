import { calculateDamage, type DamageFactors } from "./formula";
/** User-provided level-80 formula. Ordinary damage bonus and toughness area are absent. */
export function calculateElationDamage(
	multiplier: number,
	elation: number,
	jokes: number,
	merrymaking: number,
	factors: DamageFactors,
) {
	if (
		[multiplier, elation, jokes, merrymaking].some(
			(n) => !Number.isFinite(n) || n < 0,
		)
	)
		throw new Error("欢愉伤害参数无效");
	if (factors.attackerLevel !== 80)
		throw new Error("当前欢愉等级基础值仅核对了80级");
	const jokeArea = 1 + (5 * jokes) / (jokes + 240);
	const base =
		7535.107 * (1 + elation) * multiplier * (1 + merrymaking) * jokeArea;
	return {
		...calculateDamage(base, {
			...factors,
			damageBonus: 0,
			toughnessBroken: true,
		}),
		base,
		jokeArea,
	};
}
