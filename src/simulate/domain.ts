import {
	applyPhainonDomainPauseAndSpeedBonus,
	hasPhainonEnemyTriggerSkill,
} from "../mechanics/phainon";
import { emitSpBladeExtraTurn, hasSpBlade } from "../mechanics/spBlade";
import type { GeneratedAction, SkillCode } from "../utils/actionSequence";
import { getActiveOdeLabels, toNonNegativeNumber } from "./effects";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

/**
 * Handle a domain-linked action iteration (白厄境界内连动).
 * Returns true if this was a domain action and iteration was handled.
 */
export function handleDomainAction(
	states: ActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	character: ActionState["character"],
	activeOdes: Map<string, ActiveOdeState[]>,
	input: SimulateActionsInput,
): boolean {
	const domainState = states[stateIndex].domainState;
	if (!domainState) return false;

	const ds = domainState;
	const i = ds.currentIndex;
	const domainKey = `${ds.keyPrefix}-domain-${i}`;
	const domainAV = toNonNegativeNumber(
		input.overrides[domainKey],
		ds.startAV + ds.interval * i,
	);
	const isFinalDomainAction = i >= ds.maxIndex;
	const rawDomainSkill = isFinalDomainAction
		? ds.rule.finalSkill
		: ((input.skillOverrides[domainKey] ?? "") as SkillCode);
	const domainSkill =
		!isFinalDomainAction &&
		character.eidolon < 2 &&
		(rawDomainSkill === "EA" || rawDomainSkill === "EW")
			? ("" as SkillCode)
			: rawDomainSkill;

	actions.push({
		key: domainKey,
		characterId: character.id,
		actionNo: i + 1,
		actionValue: domainAV,
		skill: domainSkill,
		speed: states[stateIndex].currentSpeed,
		isDomainAction: true,
		isDomainFinalAction: isFinalDomainAction,
		activeOdeLabels: getActiveOdeLabels(activeOdes, character.id),
	});

	// ── W/EW 敌人立即行动 ──
	if (
		!isFinalDomainAction &&
		hasPhainonEnemyTriggerSkill(ds.rule, domainSkill)
	) {
		for (const enemyState of states) {
			if (enemyState.character.kind !== "敌人") continue;
			actions.push({
				key: `${domainKey}-enemy-${enemyState.character.id}`,
				characterId: enemyState.character.id,
				actionNo: enemyState.actionNo,
				actionValue: domainAV,
				skill: "" as SkillCode,
				speed: enemyState.currentSpeed,
			});
			enemyState.actionNo += 1;
			enemyState.nextActionValue = domainAV + 10000 / enemyState.currentSpeed;
		}
	}

	if (isFinalDomainAction) {
		states[stateIndex].domainState = undefined;
		states[stateIndex].actionNo += 1;
		states[stateIndex].nextActionValue =
			domainAV + 10000 / states[stateIndex].currentSpeed;
		applyPhainonDomainPauseAndSpeedBonus(
			states,
			stateIndex,
			ds.startAV,
			domainAV,
			ds.rule.endSpeedBonusBaseSpeedRatio,
		);
		// SP 刃在境界内只积累叠层。白厄退场 Q 结束后才检查阈值，
		// 额外战技因此固定附在该退场 Q 后。
		const spBlade = states.find((state) => hasSpBlade(state.character));
		const finalAction = actions[actions.length - 1];
		if (spBlade && finalAction) {
			emitSpBladeExtraTurn({
				owner: spBlade,
				source: finalAction,
				actions,
				input,
				states,
			});
		}
	} else {
		ds.currentIndex += 1;
		states[stateIndex].nextActionValue =
			ds.startAV + ds.interval * ds.currentIndex;
	}
	return true;
}
