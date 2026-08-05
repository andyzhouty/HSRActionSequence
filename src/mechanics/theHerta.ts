import { getCharacterCid } from "../data/characters";
import type { ActionState } from "../simulate/types";
import type { GeneratedAction } from "../utils/action-sequence";
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

export function handleTheHertaRecordedAction(params: {
	state: ActionState;
	action: GeneratedAction;
}): void {
	const { state, action } = params;
	const isTheHertaAction = action.characterId === state.character.id;
	let inspiration = state.theHertaInspiration ?? 0;
	if (isTheHertaAction && action.skill === "Q") {
		inspiration = clampTheHertaInspiration(
			inspiration + getTheHertaUltimateInspirationGain(state.character),
		);
	}
	if (isTheHertaAction && action.skill === "E" && inspiration > 0) {
		action.isTheHertaEnhancedE = true;
		if (state.character.eidolon >= 2) inspiration -= 1;
	}
	state.theHertaInspiration = inspiration;
	action.theHertaInspiration = inspiration;
}
