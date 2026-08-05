import { canBeAdvancedByDance } from "./effects";
import type { ActionState } from "./types";

/** 将单个状态提前指定的行动值，且不越过当前行动。 */
export function advanceNotPastCurrent(
	state: ActionState,
	currentActionValue: number,
	advance: number,
): void {
	// Fever 中的 SP Robin 无自身回合，被拉条时累计"被行动提前的量"，Fever 结束时结算。
	if (state.spRobinInFever) {
		state.spRobinFeverAdvancedDistance =
			(state.spRobinFeverAdvancedDistance ?? 0) + advance * state.currentSpeed;
		return;
	}
	if (state.blockNextAdvance) return;
	state.nextActionValue = Math.max(
		currentActionValue,
		state.nextActionValue - advance,
	);
}

/** 将目标直接拉至当前行动值。 */
export function pullToCurrentAction(
	state: ActionState,
	currentActionValue: number,
): void {
	if (state.spRobinInFever) {
		state.spRobinFeverAdvancedDistance =
			state.spRobinFeverRemainingDistance ?? 0;
		return;
	}
	if (!state.blockNextAdvance) state.nextActionValue = currentActionValue;
}

/** 对可被舞舞舞类效果影响的实体执行按速度折算的拉条。 */
export function advanceTeamByUltimate(
	states: ActionState[],
	currentActionValue: number,
	teamAdvance: number,
): void {
	for (const state of states) {
		if (!canBeAdvancedByDance(state.character.kind)) continue;
		advanceNotPastCurrent(
			state,
			currentActionValue,
			teamAdvance / state.currentSpeed,
		);
	}
}
