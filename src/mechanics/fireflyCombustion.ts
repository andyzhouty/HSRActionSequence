import { hasSkillEffect } from "../data/characters";
import type {
	CharacterConfig,
	GeneratedAction,
	SkillCode,
} from "../utils/actionSequence";
import { getFireflyCombustionRule, isCharacterTarget } from "../utils/actionSequence";
import { findHimekoNovaAssistState } from "../simulate/effects";
import type { ActionState, SimulateActionsInput } from "../simulate/types";

// ── Firefly Complete Combustion ──
// Character-specific numbers live in characters.json; this module keeps only
// the action scheduling mechanics.

type FireflyActionState = {
	character: CharacterConfig;
	currentSpeed: number;
	actionNo: number;
	nextActionValue: number;
	isInCompleteCombustion?: boolean;
	combustionBreakCount?: number;
	combustionDelayCount?: number;
	combustionCountdownId?: string;
	combustionStartAV?: number;
	combustionOwnerId?: string;
};

function getCombustionOwnerState(
	states: FireflyActionState[],
	stateIndex: number,
) {
	const state = states[stateIndex];
	if (!state.combustionOwnerId) return state;
	return states.find((s) => s.character.id === state.combustionOwnerId);
}

function applyCountdownDelay(states: FireflyActionState[], stateIndex: number) {
	const rule = getFireflyCombustionRule(states[stateIndex].character.name);
	const totalBreaks = states[stateIndex].combustionDelayCount ?? 0;
	const startAV = states[stateIndex].combustionStartAV ?? 0;
	const countdown = states.find(
		(s) => s.character.id === states[stateIndex].combustionCountdownId,
	);
	if (countdown) {
		const delayPerBreak =
			(10000 / rule.countdownSpeed) * (rule.breakDelayPercent / 100);
		countdown.nextActionValue =
			startAV +
			10000 / rule.countdownSpeed +
			delayPerBreak * Math.min(rule.maxBreakDelayTriggers, totalBreaks);
	}
}

function registerCombustionBreakDelay(
	states: FireflyActionState[],
	stateIndex: number,
) {
	const rule = getFireflyCombustionRule(states[stateIndex].character.name);
	if (
		(states[stateIndex].combustionDelayCount ?? 0) >= rule.maxBreakDelayTriggers
	)
		return;
	states[stateIndex].combustionDelayCount =
		(states[stateIndex].combustionDelayCount ?? 0) + 1;
	applyCountdownDelay(states, stateIndex);
}

// 处理一次击破触发：
// 正常回合 → E2 时生成一个行动值相同紧邻的额外回合
// 额外回合 → 仅延后倒计时，不再次生成额外回合
function handleSingleBreakTrigger(
	states: FireflyActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	actionKey: string,
	character: CharacterConfig,
	actionNo: number,
	actionValue: number,
	input: SimulateActionsInput,
) {
	const isBreakExtra = actionKey.includes("-break-extra-");

	// 累计击破次数，延后倒计时
	registerCombustionBreakDelay(states, stateIndex);

	if (!isBreakExtra && character.eidolon >= 2) {
		// E2：正常回合触发击破 → 获得一个额外回合
		states[stateIndex].combustionBreakCount =
			(states[stateIndex].combustionBreakCount ?? 0) + 1;
		const breakExtraKey = `${actionKey}-break-extra-${states[stateIndex].combustionBreakCount}`;
		const extraOverride =
			(input.skillOverrides[breakExtraKey] as string | undefined) ?? "A";
		const extraSkill = (extraOverride || "A") as SkillCode;

		// 若额外回合使用了 F，触发 sp 姬子助战
		const extraHasF = extraSkill.includes("F");
		const assistUseCount = extraHasF ? (extraSkill.match(/F/g)?.length ?? 0) : 0;
		const himekoAssist =
			extraHasF
				? findHimekoNovaAssistState(states as ActionState[], character.id)
				: undefined;

		const strippedSkill = extraSkill.replace(/F/g, "") as SkillCode;

		// 生成 sp 姬子助战 F 行动（在额外回合之前）
		if (himekoAssist) {
			for (let ai = 1; ai <= Math.min(assistUseCount, 2); ai++) {
				const assistKey =
					ai === 1
						? `${breakExtraKey}-assist-F`
						: `${breakExtraKey}-assist-F-${ai}`;
				actions.push({
					key: assistKey,
					characterId: himekoAssist.character.id,
					actionNo: 0,
					actionValue,
					skill: "F" as SkillCode,
					speed: himekoAssist.currentSpeed,
					isAssistAction: true,
					assistSourceKey: breakExtraKey,
					assistIndex: ai,
				});
			}
		}

		// E0/E1 sp姬子 任意 F → 额外回合消失
		// E2 sp姬子 FF → 额外回合消失；单 F 保留额外回合
		const himekoEidolon = himekoAssist?.character.eidolon ?? 0;
		const skipBreakExtra =
			himekoAssist !== undefined &&
			(himekoEidolon < 2 || assistUseCount >= 2);

		if (!skipBreakExtra) {
			actions.push({
				key: breakExtraKey,
				characterId: character.id,
				isCombustionAction: true,
				actionNo,
				actionValue,
				skill: strippedSkill || ("A" as SkillCode),
				speed: states[stateIndex].currentSpeed,
				isAssistFollowUp: himekoAssist !== undefined,
			});
		}

		// 额外回合的击破也计入累计次数，延后倒计时
		if (input.fireflyBreakCounters?.[breakExtraKey] === true) {
			registerCombustionBreakDelay(states, stateIndex);
		}
	}
}

// ── 公开接口 ──

export function isFireflyCountdownAction(state: {
	combustionOwnerId?: string;
}): boolean {
	return state.combustionOwnerId !== undefined;
}

export function handleFireflyCountdownAction(
	states: FireflyActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	character: CharacterConfig,
	actionNo: number,
	actionValue: number,
) {
	const fireflyState = getCombustionOwnerState(states, stateIndex);
	if (fireflyState) {
		const rule = getFireflyCombustionRule(fireflyState.character.name);
		fireflyState.isInCompleteCombustion = false;
		fireflyState.currentSpeed -= rule.speedBonus;
		fireflyState.combustionCountdownId = undefined;
		fireflyState.combustionStartAV = undefined;
		fireflyState.combustionBreakCount = undefined;
		fireflyState.combustionDelayCount = undefined;
	}
	actions.push({
		key,
		characterId: character.id,
		displayName: character.name,
		targetKind: "倒计时",
		actionNo,
		actionValue,
		skill: "" as SkillCode,
		speed: states[stateIndex].currentSpeed,
		isCombustionAction: true,
	});
	states.splice(stateIndex, 1);
}

export function shouldActivateCombustion(
	character: CharacterConfig,
	usesUltimate: boolean,
	alreadyInCombustion: boolean,
): boolean {
	return (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "Q", "fireflyCombustion") &&
		usesUltimate &&
		!alreadyInCombustion
	);
}

export function activateCombustion(
	states: FireflyActionState[],
	stateIndex: number,
	character: CharacterConfig,
	actionValue: number,
) {
	const rule = getFireflyCombustionRule(character.name);
	// 激活完全燃烧
	states[stateIndex].isInCompleteCombustion = true;
	states[stateIndex].combustionBreakCount = 0;
	states[stateIndex].combustionDelayCount = 0;
	states[stateIndex].combustionStartAV = actionValue;

	const countdownId = `${character.id}-combustion-countdown`;
	const countdownState = {
		character: {
			id: countdownId,
			kind: "倒计时" as const,
			name: rule.countdownName,
			speed: String(rule.countdownSpeed),
			baseSpeed: "",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		},
		baseSpeed: rule.countdownSpeed,
		currentSpeed: rule.countdownSpeed,
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: actionValue + 10000 / rule.countdownSpeed,
		blockNextAdvance: false,
		combustionOwnerId: character.id,
	};
	states.push(countdownState);
	states[stateIndex].combustionCountdownId = countdownId;

	states[stateIndex].currentSpeed += rule.speedBonus;

	// 立即行动：下一动与 Q 同 AV（100% 行动提前），由主循环正常处理
	states[stateIndex].nextActionValue = actionValue;
}

export function hasCombustionExtraTurn(character: CharacterConfig): boolean {
	return character.eidolon >= 2;
}

export function shouldCheckBreakTrigger(
	combustionActive: boolean | undefined,
	usesUltimate: boolean,
): boolean {
	return combustionActive === true && !usesUltimate;
}

export function checkBreakTrigger(
	states: FireflyActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	character: CharacterConfig,
	actionNo: number,
	actionValue: number,
	input: SimulateActionsInput,
) {
	const breakTriggered = input.fireflyBreakCounters?.[key] === true;
	if (!breakTriggered) return;

	handleSingleBreakTrigger(
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




