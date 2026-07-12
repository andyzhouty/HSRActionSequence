import { hasHyacineIca, killIca } from "../mechanics/hyacineIca";
import type { ActionContext } from "./context";
import { killMeme } from "./effects";
import type { SimulationRuntime } from "./runtime";

/** 执行所有行动开始前的全局死亡与清理检查。 */
export function runPreActionChecks(
	runtime: SimulationRuntime,
	context: ActionContext,
): void {
	const { input, states } = runtime;
	const { stateIndex, key, actionValue, character, actionNo } = context;
	if (
		input.icaKillToggles?.[key] &&
		character.id !== "@av0" &&
		!(hasHyacineIca(character.name) && actionNo > 0) &&
		!character.id.endsWith("-ica")
	) {
		killIca(states, actionValue);
	}
	if (
		input.memeKillToggles?.[key] &&
		character.id !== "@av0" &&
		!states[stateIndex].isMemeState
	) {
		killMeme(states, actionValue);
	}
}
