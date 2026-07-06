import type { GeneratedAction } from "./actionSequence";

const DISPLAY_ACTION_VALUE_STEP = 0.0001;

function getActionValueBucket(actionValue: number): number {
	return Math.round(actionValue / DISPLAY_ACTION_VALUE_STEP);
}

export function getDisplayOrderedActions(
	actions: readonly GeneratedAction[],
): GeneratedAction[] {
	return actions
		.map((action, index) => ({
			action,
			index,
			bucket: getActionValueBucket(action.actionValue),
		}))
		.sort((left, right) => {
			if (left.bucket !== right.bucket) {
				return left.bucket - right.bucket;
			}
			if (left.action.actionValue !== right.action.actionValue) {
				return left.action.actionValue - right.action.actionValue;
			}
			return left.index - right.index;
		})
		.map(({ action }) => action);
}
