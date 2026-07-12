import type { GeneratedAction } from "../utils/actionSequence";
import { createActionContext } from "./context";
import { handleDomainAction } from "./domain";
import { handleGarmentmakerActionTurn } from "./garmentmakerAction";
import { handleNormalAction, type NormalActionResult } from "./normalAction";
import { runPostActionCleanup } from "./postAction";
import { runPreActionChecks } from "./preAction";
import type { SimulationCallbacks, SimulationRuntime } from "./runtime";
import { selectNextAction } from "./scheduler";
import { handleSpecialAction } from "./specialActions";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

export type SimulationLoopCallbacks = SimulationCallbacks;

/** 执行行动值调度主循环。 */
export function runSimulationLoop(params: {
	input: SimulateActionsInput;
	states: ActionState[];
	actions: GeneratedAction[];
	activeOdes: Map<string, ActiveOdeState[]>;
	souldragonOwner: ActionState | undefined;
	currentBondmateTarget: { value: string | null };
	calcAhaSpeed: () => number;
	refreshAhaSchedule: (actionValue: number) => void;
	callbacks: SimulationLoopCallbacks;
}): GeneratedAction[] {
	const runtime: SimulationRuntime = {
		...params,
		currentMeritTarget: params.input.meritTarget ?? null,
		currentBondmateTarget: params.currentBondmateTarget as {
			value: string | null;
		},
	};
	const { input, states, actions, activeOdes } = runtime;
	const { emitSpecialInterruptAction } = runtime.callbacks;

	let guard = 0;

	while (states.length > 0 && guard < 2000) {
		guard += 1;

		// 选择下一次行动。
		const next = selectNextAction(states, input);
		if (!next) break;
		if (next.actionValue > input.limit) break;

		const context = createActionContext(states, next);
		const { stateIndex, key, actionValue, character, actionNo } = context;

		runPreActionChecks(runtime, context);

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
				callbacks: runtime.callbacks,
			})
		) {
			continue;
		}

		if (handleGarmentmakerActionTurn(runtime, context)) {
			continue;
		}

		// ── 境界内连动 ──
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
			continue;
		}

		// ── 普通行动处理（含境界激活） ──
		const normalResult: NormalActionResult = handleNormalAction(
			runtime,
			context,
		);
		const { skipAssistFollowUp, clearAdvanceBlockAfterAction } = normalResult;

		// ── 行动后收尾 ──
		const keyInterrupts = input.ultInterrupts[key] ?? [];
		const afterInterrupts = keyInterrupts.filter((i) => i.timing === "after");
		runPostActionCleanup(runtime, context, {
			skipAssistFollowUp,
			clearAdvanceBlockAfterAction,
			afterInterrupts,
			emitInterrupt: (interrupt) => {
				const idx = keyInterrupts.indexOf(interrupt);
				if (idx >= 0) {
					emitSpecialInterruptAction(
						`${key}-interrupt-${idx}`,
						interrupt,
						actionValue,
					);
				}
			},
		});
	}

	return actions;
}
