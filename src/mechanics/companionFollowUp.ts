import type { ActionState } from "../simulate/types";
import {
	type CharacterConfig,
	type GeneratedAction,
	getCharacterCid,
} from "../utils/actionSequence";

export function hasAshveil(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === "1504";
}

export function hasKafka(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === "1005";
}

export function clampAshveilFuaCharge(value: number): number {
	return Math.max(0, Math.min(3, Math.floor(value)));
}

export function clampKafkaFuaCharge(value: number): number {
	return Math.max(0, Math.min(2, Math.floor(value)));
}

export function emitCompanionFollowUp(params: {
	owner: ActionState;
	source: GeneratedAction;
	actions: GeneratedAction[];
	charge: "ashveil" | "kafka";
	cancelled: boolean;
}): boolean {
	const { owner, source, actions, charge, cancelled } = params;
	const current =
		charge === "ashveil"
			? (owner.ashveilFuaCharge ?? 0)
			: (owner.kafkaFuaCharge ?? 0);
	if (current <= 0 || cancelled) return false;
	const next = current - 1;
	if (charge === "ashveil") owner.ashveilFuaCharge = next;
	else owner.kafkaFuaCharge = next;
	actions.push({
		key: `${source.key}-${charge}-fua`,
		characterId: owner.character.id,
		displayName: charge === "ashveil" ? "不死途" : "卡芙卡",
		actionNo: 0,
		actionValue: source.actionValue,
		skill: "Z",
		speed: owner.currentSpeed,
		isFuaAction: true,
		isAshveilFua: charge === "ashveil",
		isKafkaFua: charge === "kafka",
		lockedSkill: true,
	});
	return true;
}
