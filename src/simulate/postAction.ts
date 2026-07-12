import { emitMemeAdvanceAction, isAllyTarget } from "./effects";
import type { ActionContext } from "./context";
import type { SimulationRuntime } from "./runtime";

export type PostActionCleanupOptions = {
	skipAssistFollowUp: boolean;
	afterInterrupts: Array<{ casterId: string; timing: "before" | "after" }>;
	emitInterrupt: (interrupt: { casterId: string; timing: "before" | "after" }) => void;
};

/** 执行普通行动后的统一收尾，顺序与主循环历史实现保持一致。 */
export function runPostActionCleanup(
	runtime: SimulationRuntime,
	context: ActionContext,
	options: PostActionCleanupOptions,
): void {
	const { states, activeOdes, callbacks } = runtime;
	const { stateIndex, key, actionValue, character, shouldClearAdvanceBlock } = context;
	const { skipAssistFollowUp, afterInterrupts, emitInterrupt } = options;

	if (shouldClearAdvanceBlock) states[stateIndex].blockNextAdvance = false;
	if (!skipAssistFollowUp) {
		for (const interrupt of afterInterrupts) emitInterrupt(interrupt);
	}
	if (!skipAssistFollowUp && (isAllyTarget(character.kind) || character.id === "@aha")) {
		callbacks.emitGodmodeExtraAction(key, actionValue);
	}
	// 迷迷拉条必须发生在银狼额外行动之后。
	emitMemeAdvanceAction({
		input: runtime.input,
		actions: runtime.actions,
		states,
		sourceKey: key,
		actionValue,
		activeOdes,
	});
	callbacks.emitEvernightSelfDestructAction(key, actionValue);
}
