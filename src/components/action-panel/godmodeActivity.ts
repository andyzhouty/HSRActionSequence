import type { GeneratedAction } from "../../utils/actionSequence";

/** 根据已生成行动还原 SP 银狼在指定行动时是否处于无敌玩家状态。 */
export function isGodmodeActiveAtAction(
	actions: readonly GeneratedAction[],
	selectedActionKey: string,
	silverWolfId: string,
): boolean {
	let isActive = false;
	let consumedActions = 0;
	for (const action of actions) {
		if (action.characterId === silverWolfId) {
			if (action.skill.includes("Q")) {
				isActive = true;
				consumedActions = 0;
			} else if (isActive && action.actionNo > 0) {
				consumedActions += 1;
				if (consumedActions >= 3) isActive = false;
			} else if (action.lockedSkill) {
				isActive = true;
			}
		}
		if (action.key === selectedActionKey) return isActive;
	}
	return false;
}
