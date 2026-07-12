import type { GeneratedAction } from "../utils/actionSequence";
import type { ActionState, ActiveOdeState, SimulateActionsInput } from "./types";

export type SimulationCallbacks = {
	emitExtraAhaAction: (sourceKey: string, actionValue: number) => void;
	emitGodmodeExtraAction: (sourceKey: string, actionValue: number) => void;
	emitSpecialInterruptAction: (
		interruptKey: string,
		interrupt: { casterId: string; timing: "before" | "after" },
		actionValue: number,
		qIsFront?: boolean,
		effectSourceKey?: string,
	) => void;
	emitSparxieExtraAction: (sourceKey: string, actionValue: number) => void;
	emitEvernightSelfDestructAction: (sourceKey: string, actionValue: number) => void;
};

/** 模拟循环共享的可变运行时。 */
export type SimulationRuntime = {
	input: SimulateActionsInput;
	states: ActionState[];
	actions: GeneratedAction[];
	activeOdes: Map<string, ActiveOdeState[]>;
	souldragonOwner: ActionState | undefined;
	currentBondmateTarget: string | null;
	currentMeritTarget: string | null;
	calcAhaSpeed: () => number;
	refreshAhaSchedule: (actionValue: number) => void;
	callbacks: SimulationCallbacks;
};
