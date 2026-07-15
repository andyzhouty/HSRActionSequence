import type { ActionState } from "../simulate/types";
import { type GeneratedAction, getCharacterCid } from "../utils/actionSequence";

export function hasTribbie(name: string): boolean {
	return getCharacterCid(name) === "1403";
}

/** 缇宝大招后的追加攻击：每名其他角色每轮一次；缇宝 Q 重置次数，E6 可触发自身。 */
export function emitTribbieUltimateFollowUp(params: {
	states: ActionState[];
	actions: GeneratedAction[];
	caster: ActionState;
	sourceKey: string;
	actionValue: number;
}): void {
	const { states, actions, caster, sourceKey, actionValue } = params;
	const tribbie = states.find((state) => hasTribbie(state.character.name));
	if (!tribbie) return;
	const casterIsTribbie = caster.character.id === tribbie.character.id;
	if (casterIsTribbie) {
		tribbie.tribbieUltimateFuaTriggeredBy = [];
		if (tribbie.character.eidolon < 6) return;
	} else {
		if (caster.character.kind !== "角色") return;
		const triggeredBy = tribbie.tribbieUltimateFuaTriggeredBy ?? [];
		if (triggeredBy.includes(caster.character.id)) return;
		tribbie.tribbieUltimateFuaTriggeredBy = [
			...triggeredBy,
			caster.character.id,
		];
	}
	actions.push({
		key: `${sourceKey}-tribbie-fua`,
		characterId: tribbie.character.id,
		displayName: "缇宝",
		actionNo: 0,
		actionValue,
		skill: "Z",
		speed: tribbie.currentSpeed,
		isFuaAction: true,
		isTribbieFuaAction: true,
		lockedSkill: true,
	});
}
