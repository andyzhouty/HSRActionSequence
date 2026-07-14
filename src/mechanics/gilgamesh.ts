import { getCharacterCid } from "../data/characters";
import type { CharacterConfig } from "../utils/actionSequence";

export const gilgameshInterestResourceName = "兴致";

export function hasGilgamesh(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === "1509";
}

export function getGilgameshBaseSpeed(character: CharacterConfig): number {
	return character.lc_id === 23044
		? 107 + 2 * Math.max(0, character.superimpose)
		: 97;
}
