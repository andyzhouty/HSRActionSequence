import { hasSkillEffect } from "../data/characters";
import type { CharacterConfig } from "../utils/actionSequence";

export const archerFuaResourceName = "红A追击";
export const archerMaxFuaCharge = 4;
export const archerMaxConsecutiveEs = 5;

export function hasArcher(character: CharacterConfig | undefined): boolean {
	return Boolean(
		character && hasSkillEffect(character.name, "Q", "archerUltimate"),
	);
}

export function clampArcherFuaCharge(value: number): number {
	return Math.max(0, Math.min(archerMaxFuaCharge, Math.floor(value)));
}
