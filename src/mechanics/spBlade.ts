import { areEquivalentCharacterCids, CHARACTER_IDS } from "../domain/identity";
import type { ActionState, SimulateActionsInput } from "../simulate/types";
import {
	type CharacterConfig,
	type GeneratedAction,
	getCharacterCid,
	isBasicAttackSkill,
	isNonAttackSkill,
} from "../utils/action-sequence";

export const spBladeStackResourceName = "sp刃叠层";
const SP_BLADE_CID = CHARACTER_IDS.spBlade;
const CASTORICE_CID = CHARACTER_IDS.castorice;
const MEMORY_TRAILBLAZER_CID = CHARACTER_IDS.memoryTrailblazer;
const countdownSpeed = 70;

export function hasSpBlade(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === SP_BLADE_CID;
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
	isForcedAttack: boolean;
	isSilverWolfNonAttack?: boolean;
}): boolean {
	const {
		action,
		attacker,
		attackDisabled,
		isForcedAttack,
		isSilverWolfNonAttack,
	} = params;
	if (action.isSpBladeFuryActivation || action.isSpBladeCountdownAction)
		return false;
	if (action.isAhaInstant && isBasicAttackSkill(action.skill)) return false;
	if (isSilverWolfNonAttack) return false;
	if (attacker?.kind === "敌人" || action.targetKind === "敌人") return true;
	const forced =
		isForcedAttack ||
		isBasicAttackSkill(action.skill) ||
		action.isAssistAction === true ||
		action.isGilgameshTechniqueAction === true;
	if (!forced && attackDisabled?.[action.key] === true) return false;
	if (forced) return true;
	if (attacker) return !isNonAttackSkill(attacker, action.skill);
	return action.isFuaAction === true || action.skill === "Z";
}

export function emitSpBladeExtraTurn(params: {
	owner: ActionState;
	source: Pick<GeneratedAction, "key" | "actionValue">;
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

export function deferSpBladeExtraTurn(
	owner: ActionState,
	source: Pick<GeneratedAction, "key" | "actionValue">,
): void {
	if (owner.spBladePendingExtraTurn) return;
	owner.spBladePendingExtraTurn = {
		sourceKey: source.key,
		actionValue: source.actionValue,
	};
}

export function flushSpBladeExtraTurn(params: {
	owner: ActionState;
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	states: ActionState[];
}): void {
	const { owner, actions, input, states } = params;
	const pending = owner.spBladePendingExtraTurn;
	if (!pending) return;
	owner.spBladePendingExtraTurn = undefined;
	emitSpBladeExtraTurn({
		owner,
		source: {
			key: pending.sourceKey,
			actionValue: pending.actionValue,
		},
		actions,
		input,
		states,
	});
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
	isForcedAttack: boolean;
	isSilverWolfNonAttack?: boolean;
}): void {
	const {
		state,
		action,
		attacker,
		states,
		actions,
		input,
		isForcedAttack,
		isSilverWolfNonAttack,
	} = params;
	const manualStacks = Number.parseFloat(
		input.resourceValues?.[action.key]?.[spBladeStackResourceName] ?? "",
	);
	let stacks = state.spBladeStacks ?? 0;
	// 只有无量忿怒期间的有效攻击及其特殊加层才会自动增加叠层；
	// 非无量忿怒期间不会自动增加叠层。
	if (state.spBladeInfiniteFury) {
		if (
			isSpBladeAttack({
				action,
				attacker,
				attackDisabled: input.attackDisabled,
				isForcedAttack,
				isSilverWolfNonAttack,
			})
		)
			stacks += 1;
		if (
			action.isDomainAction &&
			(action.skill === "EA" || action.skill === "EW")
		)
			stacks += 1;
		if (
			getCharacterCid(attacker?.name ?? "") === CASTORICE_CID &&
			action.skill === "E" &&
			states.some((s) => s.polluxOnField)
		)
			stacks += 1;
		const memoryTrailblazer = areEquivalentCharacterCids(
			getCharacterCid(attacker?.name ?? ""),
			MEMORY_TRAILBLAZER_CID,
		);
		const memoryState = states.find(
			(s) => s.character.id === action.characterId,
		);
		if (
			memoryTrailblazer &&
			isBasicAttackSkill(action.skill) &&
			(memoryState?.epic ?? 0) > 0 &&
			memoryState?.epicPendingA
		)
			stacks += 1;
	}
	// 手动输入值表示当前行动结算后的最终层数，覆盖本次行动的自动结算结果。
	if (Number.isFinite(manualStacks)) stacks = clampSpBladeStacks(manualStacks);
	state.spBladeStacks = stacks;
	action.spBladeStacks = state.spBladeStacks;
	action.spBladeInfiniteFury = state.spBladeInfiniteFury;
	const isAhaElationSkill =
		action.isElationSkill === true &&
		action.elationSkillParentKey !== undefined &&
		actions.some(
			(candidate) =>
				candidate.key === action.elationSkillParentKey &&
				candidate.isAhaInstant === true,
		);
	const hasActiveDomain = states.some((s) => s.domainState !== undefined);
	const extraTurnInput = hasActiveDomain
		? { ...input, spBladeExtraTurnToggles: { [action.key]: false } }
		: input;
	if (
		isAhaElationSkill &&
		!hasActiveDomain &&
		(state.spBladeStacks ?? 0) >=
			getSpBladeExtraTurnThreshold(state.character.eidolon) &&
		input.spBladeExtraTurnToggles?.[action.key] !== false
	) {
		deferSpBladeExtraTurn(state, action);
	} else {
		emitSpBladeExtraTurn({
			owner: state,
			source: action,
			actions,
			input: extraTurnInput,
			states,
		});
	}
}
