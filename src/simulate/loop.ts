import type { GeneratedAction } from "../utils/action-sequence";
import { createActionContext } from "./context";
import { runActionLifecycle } from "./lifecycle";
import type { SimulationCallbacks, SimulationRuntime } from "./runtime";
import { selectNextAction } from "./scheduler";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

export type SimulationLoopCallbacks = SimulationCallbacks;

/** 保护模拟器不因非法状态或无限拉条进入不可控循环。 */
export const MAX_SIMULATION_ITERATIONS = 2000;

export class SimulationLoopLimitError extends Error {
	readonly iterations: number;
	readonly lastActionKey: string | undefined;

	constructor(iterations: number, lastActionKey: string | undefined) {
		super(
			`模拟器超过最大行动数 ${iterations}，最近行动为 ${lastActionKey ?? "无"}；请检查行动值、拉条或召唤循环`,
		);
		this.name = "SimulationLoopLimitError";
		this.iterations = iterations;
		this.lastActionKey = lastActionKey;
	}
}

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
	const { input, states, actions } = runtime;

	let guard = 0;

	while (states.length > 0 && guard < MAX_SIMULATION_ITERATIONS) {
		guard += 1;

		// 选择下一次行动。
		const next = selectNextAction(states, input);
		if (!next) break;
		if (next.actionValue > input.limit) break;

		const context = createActionContext(states, next);

		runActionLifecycle(runtime, context);
	}

	if (guard >= MAX_SIMULATION_ITERATIONS && states.length > 0) {
		const next = selectNextAction(states, input);
		if (next && next.actionValue <= input.limit) {
			throw new SimulationLoopLimitError(
				MAX_SIMULATION_ITERATIONS,
				actions[actions.length - 1]?.key,
			);
		}
	}

	return actions;
}
