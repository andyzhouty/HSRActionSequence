import type { ActionState } from "./types";
import type { ActionCandidate } from "./scheduler";

/** 当前候选行动的稳定快照。 */
export type ActionContext = ActionCandidate & {
	character: ActionState["character"];
	actionNo: number;
	shouldClearAdvanceBlock: boolean;
};

export function createActionContext(
	states: ActionState[],
	candidate: ActionCandidate,
): ActionContext {
	const state = states[candidate.stateIndex];
	state.lastActionValue = candidate.actionValue;
	state.sameActionPriority = 0;
	return {
		...candidate,
		character: state.character,
		actionNo: state.actionNo,
		shouldClearAdvanceBlock: state.blockNextAdvance,
	};
}
