import { hasSkillEffect } from "../data/characters";
import type { CharacterConfig } from "../utils/actionSequence";

export const archerFuaResourceName = "红A追击";
export const archerMaxFuaCharge = 4;
export const archerMaxConsecutiveEs = 5;

export function hasArcher(character: CharacterConfig | undefined): boolean {
	return Boolean(
		character && hasSkillEffect(character.name, "Q", "archerUltimate"),
	);
}

export function clampArcherFuaCharge(value: number): number {
	return Math.max(0, Math.min(archerMaxFuaCharge, Math.floor(value)));
}

/** 记录一条已生成行动后的红A追击充能结算（Q 回充、手动覆盖、紧邻 Z 追击）。 */
export function handleArcherRecordedAction(params: {
	state: ActionState;
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	isForcedAttack: boolean;
	isSilverWolfNonAttack: boolean;
}): void {
	const {
		state,
		action,
		attacker,
		actions,
		input,
		isForcedAttack,
		isSilverWolfNonAttack,
	} = params;
	if (action.characterId === state.character.id && action.skill === "Q") {
		state.archerFuaCharge = clampArcherFuaCharge(
			(state.archerFuaCharge ?? 0) + 2,
		);
	}
	const manualCharge = Number.parseFloat(
		input.resourceValues?.[action.key]?.[archerFuaResourceName] ?? "",
	);
	if (Number.isFinite(manualCharge)) {
		state.archerFuaCharge = clampArcherFuaCharge(manualCharge);
	}
	action.archerFuaCharge = state.archerFuaCharge;
	if (
		!action.isArcherFua &&
		!action.isDomainAction &&
		!action.isSpBladeFuryActivation &&
		(isForcedAttack || input.attackDisabled?.[action.key] !== true)
	) {
		if (
			attacker?.kind === "角色" &&
			action.characterId !== state.character.id &&
			(isForcedAttack || !isNonAttackSkill(attacker, action.skill)) &&
			!isSilverWolfNonAttack &&
			(state.archerFuaCharge ?? 0) > 0
		) {
			state.archerFuaCharge = clampArcherFuaCharge(
				(state.archerFuaCharge ?? 0) - 1,
			);
			action.archerFuaCharge = state.archerFuaCharge;
			actions.push({
				key: `${action.key}-archer-fua`,
				characterId: state.character.id,
				displayName: "红A",
				actionNo: 0,
				actionValue: action.actionValue,
				skill: "Z",
				speed: state.currentSpeed,
				isFuaAction: true,
				isArcherFua: true,
				lockedSkill: true,
				archerFuaCharge: state.archerFuaCharge,
			});
		}
	}
}

import type { ActionState, SimulateActionsInput } from "../simulate/types";
import type { GeneratedAction } from "../utils/action-sequence";
import { isNonAttackSkill } from "../utils/action-sequence";
