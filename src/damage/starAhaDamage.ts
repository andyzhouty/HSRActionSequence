import { skillParameters } from "./metadata";

export const starAhaAscension = (eidolon: number) =>
	skillParameters("1511", "29", eidolon >= 2 ? 2 : 1);
export const pathAscension = (cid: string, eidolon: number) =>
	skillParameters(cid, "29", eidolon >= 2 ? 2 : 1);

export type AhaDebtState = { maxHp: number; currentHp: number; debt: number };
/** Debt occupies maximum HP; it is not an extra 25% damage multiplier. Damage happens first. */
export function applyAhaDebt(
	state: AhaDebtState,
	damage: number,
	ratio: number,
	capRatio: number,
	floorRatio = 0,
) {
	if (
		![
			state.maxHp,
			state.currentHp,
			state.debt,
			damage,
			ratio,
			capRatio,
			floorRatio,
		].every(Number.isFinite) ||
		state.maxHp <= 0 ||
		damage < 0 ||
		state.currentHp < 0 ||
		state.currentHp > state.maxHp ||
		state.debt < 0 ||
		ratio < 0 ||
		capRatio < 0 ||
		capRatio > 1 ||
		floorRatio < 0 ||
		floorRatio > 1
	)
		throw new Error("欢愉负债参数无效");
	const hpAfterDamage = Math.max(0, state.currentHp - damage);
	const debt = Math.max(
		state.maxHp * floorRatio,
		Math.min(state.maxHp * capRatio, state.debt + damage * ratio),
	);
	const currentHp = Math.min(hpAfterDamage, state.maxHp - debt);
	return {
		state: { maxHp: state.maxHp, currentHp, debt },
		hpLoss: hpAfterDamage - currentHp,
	};
}
