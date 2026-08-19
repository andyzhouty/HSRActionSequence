import type { SkillCode } from "../../utils/action-sequence";
import { getGarmentmakerRule } from "../../utils/action-sequence";
import { getActionSkill } from "../effects";
import type { ActionState, SimulateActionsInput } from "../types";

/** 普通行动入口需要的行动者配置。 */
export type NormalActionProfile = {
	skill: SkillCode;
	isMemospriteAction: boolean;
	memospriteOwnerId?: string;
	lockedSkill: boolean;
	isGarmentmakerAction: boolean;
	usesSpeedAdjustment: boolean;
};

/**
 * 为普通角色或衣匠忆灵解析本次行动的基础技能。
 *
 * 普通角色的技能来自保存数据覆盖；衣匠没有可编辑技能，必须使用规则中的固定技能。
 */
export function resolveNormalActionProfile({
	states,
	stateIndex,
	character,
	actionNo,
	key,
	input,
}: {
	states: ActionState[];
	stateIndex: number;
	character: ActionState["character"];
	actionNo: number;
	key: string;
	input: SimulateActionsInput;
}): NormalActionProfile {
	const state = states[stateIndex];
	if (!state.isGarmentmakerState) {
		return {
			skill: getActionSkill(
				character,
				actionNo,
				key,
				input.skillOverrides,
				input.legacyUltOverrides,
			),
			isMemospriteAction: Boolean(state.isMemeState),
			memospriteOwnerId: state.memeOwnerId,
			lockedSkill: false,
			isGarmentmakerAction: false,
			usesSpeedAdjustment: true,
		};
	}

	const ownerId = state.memospriteOwnerId ?? state.garmentmakerOwnerId;
	const owner = ownerId
		? states.find((candidate) => candidate.character.id === ownerId)
		: undefined;
	const rule = getGarmentmakerRule(owner?.character.name ?? "");
	return {
		skill: rule.memospriteSkill,
		isMemospriteAction: true,
		memospriteOwnerId: ownerId,
		lockedSkill: true,
		isGarmentmakerAction: true,
		usesSpeedAdjustment: false,
	};
}
