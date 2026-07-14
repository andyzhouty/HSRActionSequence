import { getCharacterCid } from "../data/characters";
import type { CharacterConfig } from "../utils/actionSequence";

export const theHertaMaxInspiration = 4;
const theHertaCid = "1401";

export function hasTheHerta(character: CharacterConfig | undefined): boolean {
	return (
		character !== undefined && getCharacterCid(character.name) === theHertaCid
	);
}

export function getTheHertaInitialInspiration(
	character: CharacterConfig,
): number {
	return character.eidolon >= 2 ? 1 : 0;
}

export function getTheHertaUltimateInspirationGain(
	character: CharacterConfig,
): number {
	return character.eidolon >= 2 ? 2 : 1;
}

export function clampTheHertaInspiration(value: number): number {
	return Math.max(0, Math.min(theHertaMaxInspiration, Math.trunc(value)));
}
