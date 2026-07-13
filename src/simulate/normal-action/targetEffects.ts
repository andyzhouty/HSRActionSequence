/**
 * 目标拉条效果处理：布洛妮娅/星期日 E 拉条、花火 E 拉条。
 * 从 normalAction.ts 提取，保持原始顺序和逻辑不变。
 */
import { hasSkillEffect } from "../../data/characters";
import {
	getCharacterPath,
	isCharacterTarget,
	type SkillCode,
} from "../../utils/actionSequence";
import { advanceNotPastCurrent, pullToCurrentAction } from "../advance";
import { getSkillTarget } from "../effects";
import type { ActionState, SimulateActionsInput } from "../types";

export interface TargetEffectsParams {
	character: ActionState["character"];
	skill: SkillCode;
	states: ActionState[];
	actionValue: number;
	input: SimulateActionsInput;
	key: string;
}

export function handleTargetEffects(params: TargetEffectsParams): void {
	const { character, skill, states, actionValue, input, key } = params;

	// Bronya/Sunday E: pull target to current action value
	if (
		isCharacterTarget(character) &&
		skill.includes("E") &&
		(hasSkillEffect(character.name, "E", "allyPullToCurrent") ||
			hasSkillEffect(character.name, "E", "sundayPullWithMemosprite"))
	) {
		const targetId = getSkillTarget(input, key, character);
		if (targetId) {
			const targetState = states.find(
				(state) => state.character.id === targetId,
			);
			const isSundayInvalidDirectMemospriteTarget =
				hasSkillEffect(character.name, "E", "sundayPullWithMemosprite") &&
				targetState !== undefined &&
				!isCharacterTarget(targetState.character);
			if (!isSundayInvalidDirectMemospriteTarget) {
				const isSundayAndHarmonyTarget =
					hasSkillEffect(character.name, "E", "sundayPullWithMemosprite") &&
					getCharacterPath(
						states.find((s) => s.character.id === targetId)?.character.name ??
							"",
					) === "Harmony";
				if (!isSundayAndHarmonyTarget) {
					for (const teammate of states) {
						if (
							teammate.character.id === targetId &&
							!teammate.blockNextAdvance
						) {
							pullToCurrentAction(teammate, actionValue);
						}
					}
				}
				// Sunday additionally pulls the target's owned summons
				if (hasSkillEffect(character.name, "E", "sundayPullWithMemosprite")) {
					for (const entity of states) {
						const isOwnedSummon =
							entity.character.id !== targetId &&
							((entity.isGarmentmakerState &&
								entity.garmentmakerOwnerId === targetId) ||
								(entity.isMemeState && entity.memeOwnerId === targetId) ||
								(entity.isEveyAction &&
									entity.character.id === `${targetId}-evey`) ||
								(entity.isPolluxAction &&
									entity.character.id === `${targetId}-pollux`) ||
								(entity.isSouldragonAction &&
									entity.souldragonOwnerId === targetId));
						if (isOwnedSummon && !entity.blockNextAdvance) {
							pullToCurrentAction(entity, actionValue);
						}
					}
				}
			}
		}
	}

	// Sparkle E: 50% advance, not past current action value
	if (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "E", "allyAdvance50NotPast") &&
		skill.includes("E")
	) {
		const targetId = getSkillTarget(input, key, character);
		if (targetId) {
			for (const teammate of states) {
				if (
					teammate.character.id === targetId &&
					!teammate.blockNextAdvance
				) {
					const advance = teammate.nextActionValue * 0.5;
					advanceNotPastCurrent(teammate, actionValue, advance);
				}
			}
		}
	}
}
