import { getCharacterBaseSpeed, getCharacterPath } from "../data/characters";
import type { CharacterConfig } from "../utils/actionSequence";
import { toPositiveNumber } from "../utils/actionSequence";

export const dawnAsBurningFlamesLightConeId = 23044;
export const memoryWeavingGoldenLightConeId = 23036;

/** 角色基础速度，优先使用角色数据；仅未登记的运行时实体回退其自身字段。 */
export function getCharacterBaseSpeedValue(character: CharacterConfig): number {
	const configured = getCharacterBaseSpeed(character.name);
	if (configured !== undefined) return configured;
	return (
		toPositiveNumber(character.baseSpeed, 0) ||
		toPositiveNumber(character.speed, 0)
	);
}

/** 两种指定光锥均提供 10 + 2×叠影 的基础速度。 */
export function getEffectiveCharacterBaseSpeed(
	character: CharacterConfig,
): number {
	const baseSpeed = getCharacterBaseSpeedValue(character);
	const path = getCharacterPath(character.name);
	const bonus = 10 + 2 * Math.max(0, character.superimpose);
	if (
		(character.lc_id === dawnAsBurningFlamesLightConeId &&
			path === "Destruction") ||
		(character.lc_id === memoryWeavingGoldenLightConeId &&
			path === "Remembrance")
	)
		return baseSpeed + bonus;
	return baseSpeed;
}
