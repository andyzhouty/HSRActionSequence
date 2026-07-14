import { getCharacterCid } from "../data/characters";
import type { CharacterConfig } from "../utils/actionSequence";
import { getEffectiveCharacterBaseSpeed } from "./baseSpeed";

export const gilgameshInterestResourceName = "兴致";

export function hasGilgamesh(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === "1509";
}

export function getGilgameshBaseSpeed(character: CharacterConfig): number {
	return getEffectiveCharacterBaseSpeed(character);
}
