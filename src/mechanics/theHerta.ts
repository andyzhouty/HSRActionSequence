import { getCharacterCid } from "../data/characters";
import type { CharacterConfig } from "../utils/actionSequence";

export const theHertaMaxInspiration = 4;
const theHertaCid = "1401";
const anaxaCid = "1405";

/** 大黑塔与那刻夏在速度加成计算中使用的固定基础速度。 */
export function getHertaTeamFixedBaseSpeed(
	character: CharacterConfig,
): number | undefined {
	switch (getCharacterCid(character.name)) {
		case theHertaCid:
			return 99;
		case anaxaCid:
			return 97;
		default:
			return undefined;
	}
}

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
