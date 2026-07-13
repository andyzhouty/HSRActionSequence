import { toNonNegativeNumber } from "./effects";
import type { ActionState, SimulateActionsInput } from "./types";

export type ActionCandidate = {
	stateIndex: number;
	key: string;
	actionValue: number;
};

/** 构建候选行动并按行动值和同值优先级选择下一动。 */
export function selectNextAction(
	states: ActionState[],
	input: SimulateActionsInput,
): ActionCandidate | undefined {
	const candidates = states.map((state, stateIndex) => {
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
		return {
			stateIndex,
			key,
			actionValue: toNonNegativeNumber(
				input.overrides[key],
				state.nextActionValue,
			),
		};
	});
	candidates.sort((a, b) => {
		if (a.actionValue !== b.actionValue) return a.actionValue - b.actionValue;
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
	});
	return candidates[0];
}
