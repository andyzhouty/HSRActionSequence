import type { ActionState } from "../simulate/types";

function changeSpeed(state: ActionState, delta: number, av: number) {
	const old = state.currentSpeed;
	state.currentSpeed = Math.max(0.001, old + delta);
	if (state.nextActionValue > av)
		state.nextActionValue =
			av + ((state.nextActionValue - av) * old) / state.currentSpeed;
	else state.nextActionValue = av + 10000 / state.currentSpeed;
}
/** The trace grants a flat 20 speed for each recipient's own three turns. */
export function applyCerydraSpeed(
	states: ActionState[],
	owner: string,
	target: string,
	av: number,
	duringOwnerTurn = true,
) {
	for (const state of states) {
		if (state.character.id !== owner && state.character.id !== target) continue;
		if (!(state.cerydraSpeedTurns && state.cerydraSpeedTurns > 0))
			changeSpeed(state, 20, av);
		state.cerydraSpeedTurns = 3;
		state.cerydraSpeedPending = duringOwnerTurn && state.character.id === owner;
	}
}
export function consumeCerydraSpeed(state: ActionState, av: number) {
	if (state.cerydraSpeedPending) {
		state.cerydraSpeedPending = false;
		return;
	}
	if (!state.cerydraSpeedTurns) return;
	state.cerydraSpeedTurns -= 1;
	if (!state.cerydraSpeedTurns) changeSpeed(state, -20, av);
}
