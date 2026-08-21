import { hasSkillEffect } from "../data/characters";
import type { ActionState } from "../simulate/types";
import {
	type CharacterConfig,
	isAllyTarget,
	isCharacterTarget,
	isNonAttackSkill,
	type TargetKind,
} from "../utils/action-sequence";
import { recordSpRobinPercentBuff } from "./spRobin";

/** 信使套：装备者对我方目标施放终结技时，我方全体速度提高 12%；Q 选择不攻击时也触发。 */
export const MESSENGER_SPEED_PCT = 0.12;
export const MESSENGER_SPEED_BUFF_TURNS = 1;

/** 判断信使套本次终结技是否满足“对我方目标使用”的条件。 */
export function shouldTriggerMessengerUltimate(
	character: CharacterConfig,
	targetKind: TargetKind | undefined,
	attackDisabled = false,
): boolean {
	if (!isCharacterTarget(character) || !character.hasMessengerSet) return false;
	if (attackDisabled) return true;
	// 昔涟的 Q 是否攻击由德谬歌的行动决定，但信使套对昔涟 Q 均触发。
	if (hasSkillEffect(character.name, "Q", "cyreneUltimate")) return true;
	// 非攻击型终结技不需要额外选择目标，直接视为满足条件。
	return isNonAttackSkill(character, "Q") || isAllyTarget(targetKind);
}

function applySpeedBuffToState(state: ActionState, actionValue: number): void {
	const oldSpeed = state.currentSpeed;
	const nextSpeed = oldSpeed + state.baseSpeed * MESSENGER_SPEED_PCT;
	if (nextSpeed <= 0) return;
	if (oldSpeed > 0 && state.nextActionValue > actionValue) {
		const remainingDistance = (state.nextActionValue - actionValue) * oldSpeed;
		state.nextActionValue = actionValue + remainingDistance / nextSpeed;
	}
	state.currentSpeed = nextSpeed;
}

/** 对我方角色与忆灵施加一次不可叠加的信使套速度增益。 */
export function applyMessengerSpeedBuff(
	states: ActionState[],
	casterId: string,
	actionValue: number,
): void {
	for (const state of states) {
		if (!isAllyTarget(state.character.kind) || state.isSongbirdsAction)
			continue;
		const alreadyBuffed = (state.messengerSpeedBuffTurns ?? 0) > 0;
		if (!alreadyBuffed) {
			applySpeedBuffToState(state, actionValue);
			if (state.character.kind === "角色") {
				recordSpRobinPercentBuff(
					states,
					state.character.id,
					MESSENGER_SPEED_PCT,
					actionValue,
				);
			}
		}
		state.messengerSpeedBuffTurns = MESSENGER_SPEED_BUFF_TURNS;
		if (state.character.id === casterId) {
			state.messengerSpeedBuffPending = true;
		}
	}
}

/** 目标完成一次正常行动后消耗信使套的一回合持续时间。 */
export function consumeMessengerSpeedBuff(
	states: ActionState[],
	stateIndex: number,
	actionValue: number,
): void {
	const state = states[stateIndex];
	if (!state) return;
	if (state.messengerSpeedBuffPending) {
		state.messengerSpeedBuffPending = false;
		return;
	}
	if ((state.messengerSpeedBuffTurns ?? 0) <= 0) return;
	state.messengerSpeedBuffTurns = (state.messengerSpeedBuffTurns ?? 0) - 1;
	if (state.messengerSpeedBuffTurns > 0) return;

	const oldSpeed = state.currentSpeed;
	const nextSpeed = Math.max(
		0.001,
		state.currentSpeed - state.baseSpeed * MESSENGER_SPEED_PCT,
	);
	state.currentSpeed = nextSpeed;
	if (oldSpeed > 0 && state.nextActionValue > actionValue) {
		const remainingDistance = (state.nextActionValue - actionValue) * oldSpeed;
		state.nextActionValue = actionValue + remainingDistance / nextSpeed;
	} else {
		state.nextActionValue = actionValue + 10000 / nextSpeed;
	}
	if (state.character.kind === "角色") {
		recordSpRobinPercentBuff(
			states,
			state.character.id,
			-MESSENGER_SPEED_PCT,
			actionValue,
		);
	}
}
