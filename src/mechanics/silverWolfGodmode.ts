import { getCharacterCid } from "../data/characters";
import { type SkillCode } from "../utils/actionSequence";

export type GodmodeState = {
	isInGodmode?: boolean;
	godmodeActionCount?: number;
};

export function hasSilverWolfGodmode(characterName: string): boolean {
	return getCharacterCid(characterName) === "1506";
}

export function isInGodmode(state: { isInGodmode?: boolean }): boolean {
	return state.isInGodmode ?? false;
}

/** 银狼 LV.999 开大后进入无敌玩家状态。接下来三次正常行动锁定为 A。 */
export function activateGodmode(states: GodmodeState[], stateIndex: number) {
	states[stateIndex].isInGodmode = true;
	states[stateIndex].godmodeActionCount = 0;
}

/** 银狼执行一次正常行动，消耗一次层数。满 3 次后退出无敌玩家。 */
export function consumeGodmodeAction(
	states: GodmodeState[],
	stateIndex: number,
): boolean {
	if (!isInGodmode(states[stateIndex])) return false;
	const current = states[stateIndex].godmodeActionCount ?? 0;
	if (current >= 3) return false;
	const next = current + 1;
	states[stateIndex].godmodeActionCount = next;
	if (next >= 3) {
		states[stateIndex].isInGodmode = false;
		states[stateIndex].godmodeActionCount = undefined;
	}
	return true;
}

/** 无敌玩家状态下，银狼的技能强制锁定为 A。 */
export function getGodmodeSkill(
	state: { isInGodmode?: boolean },
	override: string | undefined,
): SkillCode {
	if (!isInGodmode(state)) return (override ?? "") as SkillCode;
	return "A" as SkillCode;
}

