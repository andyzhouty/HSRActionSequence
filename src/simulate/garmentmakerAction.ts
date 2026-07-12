import { handleGarmentmakerAction } from "../mechanics/aglaeaGarmentmaker";
import type { ActionContext } from "./context";
import { emitMemeAdvanceAction } from "./effects";
import type { SimulationRuntime } from "./runtime";

/** 执行衣匠行动及其前后插队大招。 */
export function handleGarmentmakerActionTurn(
	runtime: SimulationRuntime,
	context: ActionContext,
): boolean {
	const { input, states, actions, activeOdes, callbacks } = runtime;
	const { stateIndex, key, actionValue, character, actionNo } = context;
	if (!states[stateIndex].isGarmentmakerState) return false;

	const interrupts = input.ultInterrupts[key] ?? [];
	for (let index = 0; index < interrupts.length; index++) {
		const interrupt = interrupts[index];
		if (interrupt.timing !== "before") continue;
		callbacks.emitSpecialInterruptAction(
			`${key}-interrupt-${index}`,
			interrupt,
			actionValue,
		);
	}

	handleGarmentmakerAction(
		states,
		stateIndex,
		actions,
		key,
		character,
		actionNo,
		actionValue,
	);
	emitMemeAdvanceAction({
		input,
		actions,
		states,
		sourceKey: key,
		actionValue,
		activeOdes,
	});

	for (let index = 0; index < interrupts.length; index++) {
		const interrupt = interrupts[index];
		if (interrupt.timing !== "after") continue;
		callbacks.emitSpecialInterruptAction(
			`${key}-interrupt-${index}`,
			interrupt,
			actionValue,
		);
	}
	callbacks.emitEvernightSelfDestructAction(key, actionValue);
	return true;
}
