import {
	getCharacterCid,
	getCharacterPath,
	hasSkillEffect,
} from "../data/characters";
import { CHARACTER_IDS } from "../domain/identity";
import { advanceNotPastCurrent } from "../simulate/advance";
import type { ActionState } from "../simulate/types";
import {
	type GeneratedAction,
	isCharacterTarget,
} from "../utils/action-sequence";

const PEARL_ULTIMATE_EFFECT = "pearlUltimate";

export function hasPearl(characterName: string): boolean {
	return getCharacterCid(characterName) === CHARACTER_IDS.pearl;
}

function isElationCharacter(state: ActionState): boolean {
	return (
		isCharacterTarget(state.character) &&
		getCharacterPath(state.character.name) === "Elation"
	);
}

export function getPearlElationCount(states: ActionState[]): number {
	return states.filter(isElationCharacter).length;
}

export function getPearlAdvancePercent(elationCount: number): number {
	if (elationCount <= 0) return 0;
	if (elationCount === 1) return 0.1;
	if (elationCount === 2) return 0.15;
	return 0.3;
}

export function applyPearlUltimate(params: {
	states: ActionState[];
	casterIndex: number;
	targetId: string | undefined;
	actionValue: number;
	actions: GeneratedAction[];
	sourceKey: string;
}): void {
	const { states, casterIndex, targetId, actionValue, actions, sourceKey } =
		params;
	const caster = states[casterIndex];
	if (
		!caster ||
		!isCharacterTarget(caster.character) ||
		!hasSkillEffect(caster.character.name, "Q", PEARL_ULTIMATE_EFFECT)
	) {
		return;
	}

	const target = states.find(
		(state) =>
			state.character.id === targetId &&
			isCharacterTarget(state.character) &&
			state.character.id !== caster.character.id,
	);
	if (!target) return;

	const elationCount = getPearlElationCount(states);
	const advancePercent = getPearlAdvancePercent(elationCount);
	advanceCharacterByPercent(target, actionValue, advancePercent);

	if (elationCount >= 4) {
		actions.push({
			key: `${sourceKey}-pearl-extra-${target.character.id}`,
			characterId: target.character.id,
			actionNo: 0,
			actionValue,
			skill: "A",
			speed: target.currentSpeed,
			isPearlExtraAction: true,
		});
	}

	if (caster.character.eidolon < 2) return;
	for (const state of states) {
		if (
			state.character.id === caster.character.id ||
			state.character.id === target.character.id ||
			!isElationCharacter(state)
		) {
			continue;
		}
		advanceCharacterByPercent(state, actionValue, advancePercent);
	}
}

function advanceCharacterByPercent(
	state: ActionState,
	actionValue: number,
	percent: number,
): void {
	if (percent <= 0 || state.currentSpeed <= 0) return;
	advanceNotPastCurrent(
		state,
		actionValue,
		(10000 * percent) / state.currentSpeed,
	);
}
