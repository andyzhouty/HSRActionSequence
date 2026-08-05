import type { ActionState, SimulateActionsInput } from "../simulate/types";
import {
	type CharacterConfig,
	type GeneratedAction,
	getCharacterCid,
	isBasicAttackSkill,
	isNonAttackSkill,
} from "../utils/actionSequence";

export const spBladeStackResourceName = "sp刃叠层";
const countdownSpeed = 70;

export function hasSpBlade(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === "1507";
}

export function getSpBladeExtraTurnThreshold(eidolon: number): number {
	return eidolon >= 2 ? 7 : 9;
}

export function clampSpBladeStacks(value: number): number {
	return Math.max(0, Math.floor(value));
}

export function activateSpBladeInfiniteFury(
	states: ActionState[],
	owner: ActionState,
	actionValue: number,
): void {
	if (owner.spBladeInfiniteFury) return;
	owner.spBladeInfiniteFury = true;
	const countdownId = `${owner.character.id}-infinite-fury-countdown`;
	owner.spBladeCountdownId = countdownId;
	states.push({
		character: {
			id: countdownId,
			kind: "倒计时",
			name: "无量忿怒",
			speed: String(countdownSpeed),
			baseSpeed: String(countdownSpeed),
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		},
		baseSpeed: countdownSpeed,
		currentSpeed: countdownSpeed,
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: actionValue + 10000 / countdownSpeed,
		blockNextAdvance: false,
		spBladeCountdownOwnerId: owner.character.id,
	});
}

export function endSpBladeInfiniteFury(
	states: ActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	actionValue: number,
): void {
	const countdown = states[stateIndex];
	const owner = states.find(
		(state) => state.character.id === countdown.spBladeCountdownOwnerId,
	);
	if (owner) {
		owner.spBladeInfiniteFury = false;
		owner.spBladeCountdownId = undefined;
	}
	actions.push({
		key,
		characterId: countdown.character.id,
		displayName: "无量忿怒",
		targetKind: "倒计时",
		actionNo: countdown.actionNo,
		actionValue,
		skill: "",
		speed: countdownSpeed,
		isSpBladeCountdownAction: true,
		lockedSkill: true,
	});
	states.splice(stateIndex, 1);
}

export function isSpBladeCountdown(state: ActionState): boolean {
	return state.spBladeCountdownOwnerId !== undefined;
}

export function isSpBladeAttack(params: {
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	attackDisabled: Record<string, boolean> | undefined;
}): boolean {
	const { action, attacker, attackDisabled } = params;
	if (action.isSpBladeFuryActivation || action.isSpBladeCountdownAction)
		return false;
	if (attacker?.kind === "敌人" || action.targetKind === "敌人") return true;
	const isArcherFixedAttack =
		getCharacterCid(attacker?.name ?? "") === "1301" &&
		["A", "E", "Q"].includes(action.skill);
	const forced =
		isBasicAttackSkill(action.skill) ||
		action.isAssistAction === true ||
		action.isGilgameshTechniqueAction === true ||
		isArcherFixedAttack;
	if (!forced && attackDisabled?.[action.key] === true) return false;
	if (forced) return true;
	if (attacker) return !isNonAttackSkill(attacker, action.skill);
	return action.isFuaAction === true || action.skill === "Z";
}

export function emitSpBladeExtraTurn(params: {
	owner: ActionState;
	source: GeneratedAction;
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	states: ActionState[];
}): boolean {
	const { owner, source, actions, input, states } = params;
	const threshold = getSpBladeExtraTurnThreshold(owner.character.eidolon);
	if (
		!owner.spBladeInfiniteFury ||
		(owner.spBladeStacks ?? 0) < threshold ||
		input.spBladeExtraTurnToggles?.[source.key] === false
	)
		return false;
	owner.spBladeStacks = (owner.spBladeStacks ?? 0) - threshold;
	if (owner.character.eidolon >= 1 && owner.spBladeCountdownId) {
		const countdown = states.find(
			(state) => state.character.id === owner.spBladeCountdownId,
		);
		if (countdown) countdown.nextActionValue += (10000 / countdownSpeed) * 0.15;
	}
	actions.push({
		key: `${source.key}-sp-blade-extra`,
		characterId: owner.character.id,
		displayName: "千冶·刃",
		actionNo: 0,
		actionValue: source.actionValue,
		skill: "E",
		speed: owner.currentSpeed,
		isSpBladeExtraAction: true,
		lockedSkill: true,
	});
	return true;
}

/** sp刃 Q 激活无量忿怒（需在其它角色结算前先打标记）。 */
export function maybeActivateSpBladeFury(
	state: ActionState,
	action: GeneratedAction,
	states: ActionState[],
): void {
	if (
		action.characterId === state.character.id &&
		action.skill === "Q" &&
		!state.spBladeInfiniteFury
	) {
		action.isSpBladeFuryActivation = true;
		activateSpBladeInfiniteFury(states, state, action.actionValue);
	}
}

/** 记录一条已生成行动后的 sp刃叠层结算（手动覆盖、叠层来源、阈值额外战技）。 */
export function handleSpBladeRecordedAction(params: {
	state: ActionState;
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	states: ActionState[];
	actions: GeneratedAction[];
	input: SimulateActionsInput;
}): void {
	const { state, action, attacker, states, actions, input } = params;
	const manualStacks = Number.parseFloat(
		input.resourceValues?.[action.key]?.[spBladeStackResourceName] ?? "",
	);
	if (Number.isFinite(manualStacks)) {
		state.spBladeStacks = clampSpBladeStacks(manualStacks);
	}
	let stacks = state.spBladeStacks ?? 0;
	if (
		isSpBladeAttack({
			action,
			attacker,
			attackDisabled: input.attackDisabled,
		})
	)
		stacks += 1;
	if (action.isDomainAction && (action.skill === "EA" || action.skill === "EW"))
		stacks += 1;
	if (
		getCharacterCid(attacker?.name ?? "") === "1407" &&
		action.skill === "E" &&
		states.some((s) => s.polluxOnField)
	)
		stacks += 1;
	const memoryTrailblazer = getCharacterCid(attacker?.name ?? "") === "8008";
	const memoryState = states.find((s) => s.character.id === action.characterId);
	if (
		memoryTrailblazer &&
		isBasicAttackSkill(action.skill) &&
		(memoryState?.epic ?? 0) > 0 &&
		memoryState?.epicPendingA
	)
		stacks += 1;
	state.spBladeStacks = stacks;
	action.spBladeStacks = state.spBladeStacks;
	action.spBladeInfiniteFury = state.spBladeInfiniteFury;
	emitSpBladeExtraTurn({
		owner: state,
		source: action,
		actions,
		input: states.some((s) => s.domainState !== undefined)
			? { ...input, spBladeExtraTurnToggles: { [action.key]: false } }
			: input,
		states,
	});
}
