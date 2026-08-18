import { toNonNegativeNumber } from "./effects";
import type { ActionState, SimulateActionsInput } from "./types";

export type ActionCandidate = {
	stateIndex: number;
	key: string;
	actionValue: number;
};

/** 用于避免浮点误差改变同 AV 行动顺序。 */
export const ACTION_VALUE_EPSILON = 1e-9;

export function compareActionCandidates(
	a: ActionCandidate,
	b: ActionCandidate,
	states: ActionState[],
): number {
	const difference = a.actionValue - b.actionValue;
	if (Math.abs(difference) > ACTION_VALUE_EPSILON) return difference;

	const aState = states[a.stateIndex];
	const bState = states[b.stateIndex];
	if (aState.character.id === "@av0") return -1;
	if (bState.character.id === "@av0") return 1;
	const aPriority = aState.sameActionPriority ?? 0;
	const bPriority = bState.sameActionPriority ?? 0;
	if (aPriority !== bPriority) return aPriority - bPriority;
	if (
		Boolean(aState.isImmediatePolluxSummon) !==
		Boolean(bState.isImmediatePolluxSummon)
	) {
		return aState.isImmediatePolluxSummon ? -1 : 1;
	}
	return a.stateIndex - b.stateIndex;
}

/** 构建候选行动并按行动值和同值优先级选择下一动。 */
export function selectNextAction(
	states: ActionState[],
	input: SimulateActionsInput,
): ActionCandidate | undefined {
	const candidates: ActionCandidate[] = [];
	for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
		const state = states[stateIndex];
		// Fever 中的 SP Robin 无自身回合，不作为候选。
		if (state.spRobinInFever) continue;
		const key =
			state.isMemeState && state.memeAdvanceSourceKey
				? `${state.memeAdvanceSourceKey}-meme`
				: state.isGarmentmakerState && state.garmentmakerGeneration
					? `${state.character.id}-g${state.garmentmakerGeneration}-${state.actionNo}`
					: state.isEveyAction &&
							state.eveyGeneration &&
							state.eveyGeneration > 1
						? `${state.character.id}-${state.actionNo}-g${state.eveyGeneration}`
						: state.isPolluxAction &&
								state.polluxGeneration &&
								state.polluxGeneration > 1
							? `${state.character.id}-${state.actionNo}-g${state.polluxGeneration}`
							: `${state.character.id}-${state.actionNo}`;
		candidates.push({
			stateIndex,
			key,
			actionValue: toNonNegativeNumber(
				input.overrides[key],
				state.nextActionValue,
			),
		});
	}
	candidates.sort((a, b) => compareActionCandidates(a, b, states));
	return candidates[0];
}
