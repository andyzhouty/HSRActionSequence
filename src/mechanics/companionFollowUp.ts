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

/** 记录一条已生成行动后的不死途/卡芙卡追击结算（手动覆盖、触发判定、回充与展示）。 */
export function handleCompanionFollowUpRecordedAction(params: {
	actions: GeneratedAction[];
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	input: SimulateActionsInput;
	isForcedAttack: boolean;
	ashveilState: ActionState | undefined;
	kafkaState: ActionState | undefined;
}): void {
	const {
		actions,
		action,
		attacker,
		input,
		isForcedAttack,
		ashveilState,
		kafkaState,
	} = params;
	const ashveilManualCharge = Number.parseFloat(
		input.resourceValues?.[action.key]?.[ashveilFuaResourceName] ?? "",
	);
	if (ashveilState && Number.isFinite(ashveilManualCharge)) {
		ashveilState.ashveilFuaCharge = clampAshveilFuaCharge(ashveilManualCharge);
	}
	const kafkaManualCharge = Number.parseFloat(
		input.resourceValues?.[action.key]?.[kafkaFuaResourceName] ?? "",
	);
	if (kafkaState && Number.isFinite(kafkaManualCharge)) {
		kafkaState.kafkaFuaCharge = clampKafkaFuaCharge(kafkaManualCharge);
	}
	const isCompanionFollowUpTrigger =
		attacker?.kind === "角色" &&
		!action.isFuaAction &&
		!action.isDomainAction &&
		!action.isSpBladeFuryActivation &&
		(isForcedAttack || input.attackDisabled?.[action.key] !== true) &&
		(isForcedAttack || !isNonAttackSkill(attacker, action.skill));
	if (
		ashveilState &&
		isCompanionFollowUpTrigger &&
		action.characterId !== ashveilState.character.id
	) {
		emitCompanionFollowUp({
			owner: ashveilState,
			source: action,
			actions,
			charge: "ashveil",
			cancelled: input.ashveilFuaToggles?.[action.key] === false,
		});
	}
	if (
		kafkaState &&
		isCompanionFollowUpTrigger &&
		action.characterId !== kafkaState.character.id
	) {
		emitCompanionFollowUp({
			owner: kafkaState,
			source: action,
			actions,
			charge: "kafka",
			cancelled: input.kafkaFuaToggles?.[action.key] === false,
		});
	}
	if (
		ashveilState &&
		action.characterId === ashveilState.character.id &&
		action.skill === "Q"
	) {
		ashveilState.ashveilFuaCharge = clampAshveilFuaCharge(
			(ashveilState.ashveilFuaCharge ?? 0) + 3,
		);
	}
	if (kafkaState && action.characterId === kafkaState.character.id) {
		const isNormalKafkaAction = action.actionNo > 0 && !action.isFuaAction;
		const isKafkaUltimate = action.skill === "Q";
		if (isNormalKafkaAction || isKafkaUltimate) {
			kafkaState.kafkaFuaCharge = clampKafkaFuaCharge(
				(kafkaState.kafkaFuaCharge ?? 0) + 1,
			);
		}
	}
	if (ashveilState) action.ashveilFuaCharge = ashveilState.ashveilFuaCharge;
	if (kafkaState) action.kafkaFuaCharge = kafkaState.kafkaFuaCharge;
}

import type { SimulateActionsInput } from "../simulate/types";
import {
	ashveilFuaResourceName,
	isNonAttackSkill,
	kafkaFuaResourceName,
} from "../utils/action-sequence";
