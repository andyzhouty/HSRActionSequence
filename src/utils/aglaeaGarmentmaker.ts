import { hasSkillEffect } from "../data/characters";
import {
	type CharacterConfig,
	type GarmentmakerRule,
	type GeneratedAction,
	getGarmentmakerRule,
	isCharacterTarget,
	type SkillCode,
} from "./actionSequence";

export type AglaeaActionState = {
	character: CharacterConfig;
	baseSpeed: number;
	currentSpeed: number;
	phainonDomainSpeedBonus: number;
	actionNo: number;
	nextActionValue: number;
	blockNextAdvance: boolean;
	isGarmentmakerState?: boolean;
	garmentmakerOwnerId?: string;
	garmentmakerStacks?: number;
	garmentmakerBaseSpeed?: number;
	garmentmakerGeneration?: number;
	aglaeaSupremeActive?: boolean;
	aglaeaCountdownId?: string;
	aglaeaOwnerId?: string;
	aglaeaPreSupremeSpeed?: number;
};

export function hasAglaeaGarmentmaker(characterName: string) {
	return hasSkillEffect(characterName, "E", "summonGarmentmaker");
}

export function hasAglaeaSupreme(characterName: string) {
	return hasSkillEffect(characterName, "Q", "aglaeaSupreme");
}

export function isAglaeaCountdownAction(state: {
	aglaeaOwnerId?: string;
}): boolean {
	return state.aglaeaOwnerId !== undefined;
}

export function isAglaeaAttackSkill(skill: string) {
	return skill.includes("A") || skill.includes("Q");
}

export function getAglaeaBaseSpeed(state: AglaeaActionState) {
	return state.baseSpeed > 0 ? state.baseSpeed : state.currentSpeed;
}

export function getAglaeaStackLimit(character: CharacterConfig) {
	const rule = getGarmentmakerRule(character.name);
	return character.eidolon >= 4 ? rule.eidolon4MaxStacks : rule.maxStacks;
}

function getGarmentmakerId(owner: CharacterConfig) {
	return `${owner.id}-garmentmaker`;
}

function getCountdownId(owner: CharacterConfig) {
	return `${owner.id}-aglaea-countdown`;
}

export function findGarmentmakerState(
	states: AglaeaActionState[],
	ownerId: string,
) {
	return states.find(
		(state) =>
			state.isGarmentmakerState && state.garmentmakerOwnerId === ownerId,
	);
}

function findAglaeaState(states: AglaeaActionState[], ownerId: string) {
	return states.find((state) => state.character.id === ownerId);
}

function findAglaeaCountdownState(
	states: AglaeaActionState[],
	ownerId: string,
) {
	return states.find((state) => state.aglaeaOwnerId === ownerId);
}

export function getGarmentmakerStacks(
	states: AglaeaActionState[],
	ownerId: string,
) {
	const garmentmaker = findGarmentmakerState(states, ownerId);
	if (garmentmaker) return garmentmaker.garmentmakerStacks ?? 0;
	return findAglaeaState(states, ownerId)?.garmentmakerStacks ?? 0;
}

function getGarmentmakerSpeed(rule: GarmentmakerRule, stacks: number, aglaeaSpeed: number) {
	return aglaeaSpeed * (rule.memospriteSpeed / 100) + rule.stackSpeedBonus * stacks;
}

function setSpeedPreservingActionDistance(
	state: AglaeaActionState,
	nextSpeed: number,
	actionValue?: number,
) {
	if (
		actionValue !== undefined &&
		state.currentSpeed > 0 &&
		nextSpeed > 0 &&
		state.nextActionValue > actionValue
	) {
		const remainingActionDistance =
			(state.nextActionValue - actionValue) * state.currentSpeed;
		state.nextActionValue = actionValue + remainingActionDistance / nextSpeed;
	}
	state.currentSpeed = nextSpeed;
}

export function refreshAglaeaSupremeSpeed(
	state: AglaeaActionState,
	actionValue?: number,
) {
	if (!state.aglaeaSupremeActive) return;
	const rule = getGarmentmakerRule(state.character.name);
	const stacks = state.garmentmakerStacks ?? 0;
	const preSpeed = state.aglaeaPreSupremeSpeed ?? state.currentSpeed;
	const nextSpeed =
		preSpeed +
		getAglaeaBaseSpeed(state) * rule.aglaeaSpeedBonusRatioPerStack * stacks;
	setSpeedPreservingActionDistance(state, nextSpeed, actionValue);
}

export function syncGarmentmakerStacksToAglaea(
	states: AglaeaActionState[],
	ownerId: string,
	stacks: number,
	actionValue?: number,
) {
	const aglaea = findAglaeaState(states, ownerId);
	if (!aglaea) return;
	aglaea.garmentmakerStacks = stacks;
	refreshAglaeaSupremeSpeed(aglaea, actionValue);
}

export function increaseGarmentmakerStacks(
	states: AglaeaActionState[],
	ownerId: string,
	actionValue?: number,
) {
	const aglaea = findAglaeaState(states, ownerId);
	if (!aglaea) return;
	const garmentmaker = findGarmentmakerState(states, ownerId);
	if (!garmentmaker) return;

	const rule = getGarmentmakerRule(aglaea.character.name);
	const stackLimit = getAglaeaStackLimit(aglaea.character);
	const nextStacks = Math.min(
		stackLimit,
		(garmentmaker.garmentmakerStacks ?? 0) + 1,
	);
	garmentmaker.garmentmakerStacks = nextStacks;
	garmentmaker.currentSpeed = getGarmentmakerSpeed(rule, nextStacks, aglaea.currentSpeed);
	syncGarmentmakerStacksToAglaea(states, ownerId, nextStacks, actionValue);
}

export function summonGarmentmakerState(
	states: AglaeaActionState[],
	owner: CharacterConfig,
	actionValue: number,
) {
	const rule = getGarmentmakerRule(owner.name);
	const existing = findGarmentmakerState(states, owner.id);
	const ownerState = findAglaeaState(states, owner.id);
	const retainedStacks = ownerState?.garmentmakerStacks ?? 0;
	const initialStacks = Math.min(getAglaeaStackLimit(owner), retainedStacks);
	const aglaeaSpeed = ownerState?.currentSpeed || (Number(owner.speed) || 100);
	const currentSpeed = getGarmentmakerSpeed(rule, initialStacks, aglaeaSpeed);
	const baseGarmentmakerSpeed = aglaeaSpeed * (rule.memospriteSpeed / 100);

	// 递增代次，确保每次召唤的衣匠 key 唯一
	const generation = (ownerState?.garmentmakerGeneration ?? 0) + 1;
	if (ownerState) ownerState.garmentmakerGeneration = generation;

	if (existing) {
		existing.garmentmakerStacks = initialStacks;
		existing.garmentmakerBaseSpeed = baseGarmentmakerSpeed;
		existing.currentSpeed = currentSpeed;
		existing.actionNo = 1;
		existing.garmentmakerGeneration = generation;
		existing.nextActionValue = Math.min(existing.nextActionValue, actionValue);
		return existing;
	}

	const garmentmaker: AglaeaActionState = {
		character: {
			...owner,
			id: getGarmentmakerId(owner),
			kind: "忆灵",
			name: rule.memospriteName,
			speed: String(currentSpeed),
			baseSpeed: String(baseGarmentmakerSpeed),
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
		},
		baseSpeed: baseGarmentmakerSpeed,
		currentSpeed,
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: actionValue,
		blockNextAdvance: false,
		isGarmentmakerState: true,
		garmentmakerOwnerId: owner.id,
		garmentmakerStacks: initialStacks,
		garmentmakerBaseSpeed: baseGarmentmakerSpeed,
		garmentmakerGeneration: generation,
	};
	states.push(garmentmaker);
	syncGarmentmakerStacksToAglaea(states, owner.id, initialStacks, actionValue);
	return garmentmaker;
}

export function activateAglaeaSupreme(
	states: AglaeaActionState[],
	stateIndex: number,
	actionValue: number,
) {
	const state = states[stateIndex];
	const rule = getGarmentmakerRule(state.character.name);
	const countdownId = getCountdownId(state.character);
	const existingCountdown = findAglaeaCountdownState(
		states,
		state.character.id,
	);

	if (existingCountdown) {
		existingCountdown.nextActionValue =
			actionValue + 10000 / rule.countdownSpeed;
		existingCountdown.actionNo += 1;
	} else {
		states.push({
			character: {
				...state.character,
				id: countdownId,
				kind: "倒计时",
				name: rule.countdownName,
				speed: String(rule.countdownSpeed),
				baseSpeed: String(rule.countdownSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
			},
			baseSpeed: rule.countdownSpeed,
			currentSpeed: rule.countdownSpeed,
			phainonDomainSpeedBonus: 0,
			actionNo: 1,
			nextActionValue: actionValue + 10000 / rule.countdownSpeed,
			blockNextAdvance: false,
			aglaeaOwnerId: state.character.id,
		});
	}

	state.aglaeaSupremeActive = true;
	state.aglaeaCountdownId = countdownId;
	// 记录进至高之姿前的速度，用于计算速度上限（避免层数叠加）
	if (state.aglaeaPreSupremeSpeed === undefined) {
		state.aglaeaPreSupremeSpeed = state.currentSpeed;
	}
	refreshAglaeaSupremeSpeed(state, actionValue);
}

export function handleAglaeaCountdownAction(
	states: AglaeaActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	character: CharacterConfig,
	actionNo: number,
	actionValue: number,
) {
	const ownerId = states[stateIndex].aglaeaOwnerId;
	if (!ownerId) return;
	const aglaea = findAglaeaState(states, ownerId);
	const garmentmakerIndex = states.findIndex(
		(state) =>
			state.isGarmentmakerState && state.garmentmakerOwnerId === ownerId,
	);

	actions.push({
		key,
		characterId: character.id,
		displayName: character.name,
		targetKind: "倒计时",
		actionNo,
		actionValue,
		skill: "" as SkillCode,
		speed: states[stateIndex].currentSpeed,
		isAglaeaCountdownAction: true,
	});

	if (garmentmakerIndex >= 0) {
		states.splice(garmentmakerIndex, 1);
		if (garmentmakerIndex < stateIndex) stateIndex -= 1;
	}
	if (aglaea) {
		const baseSpeed = getAglaeaBaseSpeed(aglaea);
		const restoreSpeed = aglaea.aglaeaPreSupremeSpeed ?? baseSpeed;
		setSpeedPreservingActionDistance(aglaea, restoreSpeed, actionValue);
		aglaea.aglaeaSupremeActive = false;
		aglaea.aglaeaCountdownId = undefined;
		aglaea.aglaeaPreSupremeSpeed = undefined;
		// 退出至高之姿后层数清空
		aglaea.garmentmakerStacks = 0;
	}
	states.splice(stateIndex, 1);
}

export function handleGarmentmakerAction(
	states: AglaeaActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	character: CharacterConfig,
	actionNo: number,
	actionValue: number,
) {
	const ownerId = states[stateIndex].garmentmakerOwnerId;
	const owner = ownerId ? findAglaeaState(states, ownerId) : undefined;
	const rule = owner
		? getGarmentmakerRule(owner.character.name)
		: getGarmentmakerRule("");

	actions.push({
		key,
		characterId: character.id,
		displayName: rule.memospriteName,
		targetKind: "忆灵",
		actionNo,
		actionValue,
		skill: rule.memospriteSkill,
		speed: states[stateIndex].currentSpeed,
		isMemospriteAction: true,
		memospriteOwnerId: ownerId,
		isAglaeaGarmentmakerAction: true,
		lockedSkill: true,
	});

	if (ownerId) increaseGarmentmakerStacks(states, ownerId, actionValue);
	states[stateIndex].actionNo += 1;
	states[stateIndex].nextActionValue =
		actionValue + 10000 / states[stateIndex].currentSpeed;
	states[stateIndex].blockNextAdvance = false;
}

export function handleAglaeaSkillEffects(
	states: AglaeaActionState[],
	stateIndex: number,
	skill: string,
	actionValue: number,
) {
	const state = states[stateIndex];
	if (!isCharacterTarget(state.character)) return;
	if (!hasAglaeaGarmentmaker(state.character.name)) return;

	const usesSkill = skill.includes("E");
	const usesUltimate = skill.includes("Q");

	if (usesSkill && !findGarmentmakerState(states, state.character.id)) {
		summonGarmentmakerState(states, state.character, actionValue);
		state.nextActionValue = actionValue;
	}

	if (usesUltimate) {
		summonGarmentmakerState(states, state.character, actionValue);
		activateAglaeaSupreme(states, stateIndex, actionValue);
		// 仅 QA/QE 这类 Q 在前的组合不补立即行动；纯插队 Q 需要让阿格莱雅拿回当前 AV。
		if (skill === "Q" || !skill.startsWith("Q")) {
			state.nextActionValue = actionValue;
		}
	}

	if (
		isAglaeaAttackSkill(skill) &&
		findGarmentmakerState(states, state.character.id) &&
		state.character.eidolon >= 4
	) {
		increaseGarmentmakerStacks(states, state.character.id, actionValue);
	}
}
