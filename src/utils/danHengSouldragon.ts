import type {
	CharacterConfig,
	GeneratedAction,
	SkillCode,
} from "./actionSequence";
import { getCharacterCid } from "./actionSequence";

export const SOULDRAGON_SPEED = 165;

export interface SouldragonActionState {
	character: CharacterConfig;
	baseSpeed: number;
	currentSpeed: number;
	nextActionValue: number;
	actionNo: number;
	blockNextAdvance: boolean;
	isSouldragonAction?: boolean;
	souldragonOwnerId?: string;
}

export function hasDanHengSouldragon(characterName: string) {
	return getCharacterCid(characterName) === "1414";
}

export function findSouldragonState(
	states: SouldragonActionState[],
	ownerId: string,
) {
	return states.find(
		(state) => state.isSouldragonAction && state.souldragonOwnerId === ownerId,
	);
}

export function summonSouldragonState(
	states: SouldragonActionState[],
	owner: CharacterConfig,
	summonActionValue: number,
) {
	const existing = findSouldragonState(states, owner.id);
	if (existing) return existing;

	const state: SouldragonActionState = {
		character: {
			id: `${owner.id}-souldragon`,
			kind: "非忆灵",
			name: "龙灵",
			speed: String(SOULDRAGON_SPEED),
			baseSpeed: String(SOULDRAGON_SPEED),
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		},
		baseSpeed: SOULDRAGON_SPEED,
		currentSpeed: SOULDRAGON_SPEED,
		nextActionValue: summonActionValue + 10000 / SOULDRAGON_SPEED,
		actionNo: 1,
		blockNextAdvance: false,
		isSouldragonAction: true,
		souldragonOwnerId: owner.id,
	};
	states.push(state);
	return state;
}

export function advanceSouldragon(
	states: SouldragonActionState[],
	ownerId: string,
	actionValue: number,
	advancePercent: number,
) {
	const souldragon = findSouldragonState(states, ownerId);
	if (!souldragon) return;
	const advance = (10000 * advancePercent) / souldragon.currentSpeed;
	souldragon.nextActionValue = Math.max(
		actionValue,
		souldragon.nextActionValue - advance,
	);
}

export function emitSouldragonAction(
	state: SouldragonActionState,
	actions: GeneratedAction[],
	actionValue: number,
	key = `${state.character.id}-${state.actionNo}`,
) {
	actions.push({
		key,
		characterId: state.character.id,
		displayName: "龙灵",
		targetKind: "非忆灵",
		actionNo: state.actionNo,
		actionValue,
		skill: "" as SkillCode,
		speed: state.currentSpeed,
		lockedSkill: true,
		isSouldragonAction: true,
		souldragonOwnerId: state.souldragonOwnerId,
	});
	state.actionNo += 1;
	state.nextActionValue = actionValue + 10000 / state.currentSpeed;
}

export function emitImmediateSouldragonAction(
	states: SouldragonActionState[],
	ownerId: string,
	actions: GeneratedAction[],
	actionValue: number,
	sourceKey: string,
) {
	const state = findSouldragonState(states, ownerId);
	if (!state) return;
	emitSouldragonAction(state, actions, actionValue, `${sourceKey}-souldragon`);
}
