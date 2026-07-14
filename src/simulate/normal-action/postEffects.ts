/**
 * 终结后效处理：流萤击破、迷迷死亡、记忆主史诗、统一 Q 后效。
 * 从 normalAction.ts 提取，保持原始顺序和逻辑不变。
 */
import { hasSkillEffect } from "../../data/characters";
import {
	activateCombustion,
	checkBreakTrigger,
	shouldActivateCombustion,
	shouldCheckBreakTrigger,
} from "../../mechanics/fireflyCombustion";
import {
	getCyreneUltimateRule,
	isCharacterTarget,
	type GeneratedAction,
	type SkillCode,
} from "../../utils/actionSequence";
import {
	consumeMemoryTrailblazerEpic,
	findCyreneState,
	hasActiveOde,
	killMeme,
} from "../effects";
import type { ActionState, ActiveOdeState, SimulateActionsInput } from "../types";

// ── 流萤完全燃烧 ──

export interface CombustionActivationParams {
	character: ActionState["character"];
	normalUsesUltimate: boolean;
	stateIndex: number;
	states: ActionState[];
	actionValue: number;
}

/**
 * 检查并激活流萤完全燃烧。返回本次是否激活了燃烧，
 * 调用方需要据此判断是否跳过正常的下一动间隔计算。
 */
export function tryActivateCombustion(
	params: CombustionActivationParams,
): boolean {
	const { character, normalUsesUltimate, stateIndex, states, actionValue } =
		params;

	if (
		shouldActivateCombustion(
			character,
			normalUsesUltimate,
			Boolean(states[stateIndex].isInCompleteCombustion),
		)
	) {
		activateCombustion(states, stateIndex, character, actionValue);
		return true;
	}
	return false;
}

// ── 流萤击破触发 ──

export interface FireflyBreakCheckParams {
	stateIndex: number;
	normalUsesUltimate: boolean;
	states: ActionState[];
	actions: GeneratedAction[];
	key: string;
	character: ActionState["character"];
	actionNo: number;
	actionValue: number;
	input: SimulateActionsInput;
}

export function handleFireflyBreakCheck(params: FireflyBreakCheckParams): void {
	const {
		stateIndex,
		normalUsesUltimate,
		states,
		actions,
		key,
		character,
		actionNo,
		actionValue,
		input,
	} = params;

	if (
		shouldCheckBreakTrigger(
			states[stateIndex].isInCompleteCombustion,
			normalUsesUltimate,
		)
	) {
		checkBreakTrigger(
			states,
			stateIndex,
			actions,
			key,
			character,
			actionNo,
			actionValue,
			input,
		);
	}
}

// ── 迷迷死亡 ──

export interface MemeDeathCheckParams {
	key: string;
	stateIndex: number;
	states: ActionState[];
	actionValue: number;
	input: SimulateActionsInput;
}

export function handleMemeDeathCheck(params: MemeDeathCheckParams): void {
	const { key, stateIndex, states, actionValue, input } = params;

	if (input.memeKillToggles?.[key] && states[stateIndex]?.isMemeState) {
		killMeme(states, actionValue);
	}
}

// ── 记忆主 A 消耗史诗并触发德谬歌额外 Q ──

export interface MemoryTrailblazerEpicParams {
	character: ActionState["character"];
	resolvedSkill: SkillCode;
	usesUltimate: boolean;
	qIsFront: boolean;
	stateIndex: number;
	states: ActionState[];
	actions: GeneratedAction[];
	actionValue: number;
	activeOdes: Map<string, ActiveOdeState[]>;
	key: string;
}

export function handleMemoryTrailblazerEpicConsumption(
	params: MemoryTrailblazerEpicParams,
): void {
	const {
		character,
		resolvedSkill,
		usesUltimate,
		qIsFront,
		stateIndex,
		states,
		actions,
		actionValue,
		activeOdes,
		key,
	} = params;

	if (
		!isCharacterTarget(character) ||
		!hasSkillEffect(character.name, "E", "summonMeme") ||
		!states[stateIndex].epicPendingA ||
		(states[stateIndex].epic ?? 0) <= 0 ||
		(resolvedSkill !== "" && resolvedSkill !== "A") ||
		(usesUltimate && !qIsFront)
	) {
		return;
	}

	const consumed = consumeMemoryTrailblazerEpic(states[stateIndex]);
	if (!consumed) return;

	const cyreneState = findCyreneState(states);
	if (!cyreneState || !hasActiveOde(activeOdes, character.id, "genesis")) return;

	const cyreneRule = getCyreneUltimateRule(cyreneState.character.name);
	actions.push({
		key: `${key}-epic-memosprite`,
		characterId: `${cyreneState.character.id}-memosprite`,
		displayName: cyreneRule.memospriteName,
		targetKind: "忆灵",
		actionNo: 0,
		actionValue,
		skill: "Q" as SkillCode,
		speed: 0,
		isMemospriteAction: true,
		memospriteOwnerId: cyreneState.character.id,
		isEpicTriggeredMemosprite: true,
		lockedSkill: true,
	});
}
