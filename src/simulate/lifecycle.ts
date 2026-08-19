import { emitMydeiGodslayerExtraAction } from "../mechanics/mydei";
import { advanceSaberAfterAction } from "../mechanics/saber";
import type { ActionContext } from "./context";
import { handleDomainAction } from "./domain";
import { handleNormalAction } from "./normal-action";
import { runPostActionCleanup } from "./postAction";
import { runPreActionChecks } from "./preAction";
import type { SimulationRuntime } from "./runtime";
import { handleSpecialAction } from "./specialActions";

/** 一次行动的固定生命周期；新增阶段必须在此处登记顺序。 */
export const ACTION_LIFECYCLE_PHASES = [
	"preActionChecks",
	"specialAction",
	"domainAction",
	"normalAction",
	"postActionCleanup",
] as const;

export type ActionLifecyclePhase = (typeof ACTION_LIFECYCLE_PHASES)[number];

export type ActionLifecycleResult = {
	status: "skipped" | "completed";
	completedPhase: ActionLifecyclePhase;
};

function finishSpecialAction(
	runtime: SimulationRuntime,
	context: ActionContext,
): void {
	const { key, actionValue } = context;
	emitMydeiGodslayerExtraAction(
		key,
		actionValue,
		runtime.states,
		runtime.actions,
		runtime.input,
	);
	advanceSaberAfterAction(
		runtime.states,
		runtime.input.saberAdvanceToggles,
		key,
		actionValue,
	);
}

/** 执行一个候选行动，不负责选择下一行动或循环上限。 */
export function runActionLifecycle(
	runtime: SimulationRuntime,
	context: ActionContext,
): ActionLifecycleResult {
	const { input, states, actions, activeOdes, callbacks } = runtime;
	const { stateIndex, key, actionValue, character, actionNo } = context;

	runPreActionChecks(runtime, context);

	// Fever 中的 SP Robin 不产生自己的正常行动，但仍会消耗调度位置。
	if (states[stateIndex].spRobinInFever) {
		return { status: "skipped", completedPhase: "preActionChecks" };
	}

	if (
		handleSpecialAction({
			input,
			states,
			actions,
			activeOdes,
			stateIndex,
			key,
			actionValue,
			character,
			actionNo,
			calcAhaSpeed: runtime.calcAhaSpeed,
			callbacks,
		})
	) {
		finishSpecialAction(runtime, context);
		return { status: "completed", completedPhase: "specialAction" };
	}

	if (
		handleDomainAction(
			states,
			stateIndex,
			actions,
			character,
			activeOdes,
			input,
		)
	) {
		finishSpecialAction(runtime, context);
		return { status: "completed", completedPhase: "domainAction" };
	}

	const normalResult = handleNormalAction(runtime, context);
	const keyInterrupts = input.ultInterrupts[key] ?? [];
	const afterInterrupts = keyInterrupts.filter(
		(item) => item.timing === "after",
	);
	runPostActionCleanup(runtime, context, {
		skipAssistFollowUp: normalResult.skipAssistFollowUp,
		clearAdvanceBlockAfterAction: normalResult.clearAdvanceBlockAfterAction,
		afterInterrupts,
		emitInterrupt: (interrupt) => {
			const index = keyInterrupts.indexOf(interrupt);
			if (index >= 0) {
				callbacks.emitSpecialInterruptAction(
					`${key}-interrupt-${index}`,
					interrupt,
					actionValue,
				);
			}
		},
	});

	return { status: "completed", completedPhase: "postActionCleanup" };
}
