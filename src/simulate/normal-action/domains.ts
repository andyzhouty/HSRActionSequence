/**
 * 领域与状态处理：白厄领域建立/结束、速度冻结。
 * 从 normalAction.ts 提取，保持原始顺序和逻辑不变。
 */
import { hasSkillEffect } from "../../data/characters";
import {
	freezeAlliesForDomain,
	getPhainonDomainEndIndex,
	getPhainonDomainInterval,
} from "../../mechanics/phainonDomain";
import {
	getCounterWDomainRule,
	isCharacterTarget,
} from "../../utils/actionSequence";
import { hasActiveOdeEffect } from "../effects";
import type { ActiveOdeState, ActionState, SimulateActionsInput } from "../types";
import type { NormalActionResult } from "./index";

export interface PhainonDomainParams {
	character: ActionState["character"];
	normalUsesUltimate: boolean;
	actionSpeed: number;
	actionValue: number;
	key: string;
	stateIndex: number;
	states: ActionState[];
	input: SimulateActionsInput;
	activeOdes: Map<string, ActiveOdeState[]>;
	skipAssistFollowUp: boolean;
	beforeInterruptIndices: number[];
	afterInterruptIndices: number[];
	clearAdvanceBlockAfterAction: boolean;
}

/**
 * 检查是否为白厄 Q 境界建立，若是则设置领域状态并返回 ActionResult。
 * 返回 null 表示未触发领域建立，调用方应继续正常流程。
 */
export function handlePhainonDomain(
	params: PhainonDomainParams,
): NormalActionResult | null {
	const {
		character,
		normalUsesUltimate,
		actionSpeed,
		actionValue,
		key,
		stateIndex,
		states,
		input,
		activeOdes,
		skipAssistFollowUp,
		beforeInterruptIndices,
		afterInterruptIndices,
		clearAdvanceBlockAfterAction,
	} = params;

	if (
		!isCharacterTarget(character) ||
		!hasSkillEffect(character.name, "W", "counterW") ||
		!normalUsesUltimate
	) {
		return null;
	}

	const domainRule = getCounterWDomainRule(character.name);
	const domainInterval = getPhainonDomainInterval(character, actionSpeed);
	const startAV = actionValue;
	const isEndlessDomain = hasActiveOdeEffect(
		activeOdes,
		character.id,
		"endlessCounterWDomain",
	);
	const maxDomainActionIndex = isEndlessDomain
		? Math.max(0, Math.ceil((input.limit - startAV) / domainInterval))
		: Math.max(0, domainRule.extraActionCount - 1);
	const domainEndIndex = getPhainonDomainEndIndex(
		key,
		input.domainEndOverrides,
		maxDomainActionIndex,
	);

	if (domainEndIndex >= 0) {
		states[stateIndex].domainState = {
			keyPrefix: key,
			startAV,
			interval: domainInterval,
			currentIndex: 0,
			maxIndex: domainEndIndex,
			rule: domainRule,
		};
		freezeAlliesForDomain(states, stateIndex, startAV);
		states[stateIndex].nextActionValue = startAV;
	}

	return {
		skipAssistFollowUp,
		beforeInterruptIndices,
		afterInterruptIndices,
		skippedMainAction: false,
		clearAdvanceBlockAfterAction,
	};
}
