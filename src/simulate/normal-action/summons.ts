/**
 * 召唤与忆灵处理：迷迷、长夜、衣匠的召唤。
 * 从 normalAction.ts 提取。龙灵同袍切换因依赖运行时可变状态保留在原文件。
 */
import { hasSkillEffect } from "../../data/characters";
import { handleAglaeaSkillEffects } from "../../mechanics/aglaea";
import { hasEvernightEvey, summonEveyState } from "../../mechanics/evernight";
import { hasSpRobin, summonSongbirdsState } from "../../mechanics/spRobin";
import { isCharacterTarget, type SkillCode } from "../../utils/action-sequence";
import { summonMemeState } from "../effects";
import type { ActionState } from "../types";

export interface SummonsParams {
	character: ActionState["character"];
	resolvedSkill: SkillCode;
	normalUsesUltimate: boolean;
	states: ActionState[];
	stateIndex: number;
	actionValue: number;
}

export function handleSummons(params: SummonsParams): void {
	const {
		character,
		resolvedSkill,
		normalUsesUltimate,
		states,
		stateIndex,
		actionValue,
	} = params;

	// 流萤忆灵 E/Q：召唤速度为 130 的 Meme 忆灵。
	if (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "E", "summonMeme") &&
		(resolvedSkill.includes("E") || normalUsesUltimate)
	) {
		summonMemeState(states, character, actionValue);
	}

	// 遐蝶 E/Q：召唤 Evey。
	if (
		isCharacterTarget(character) &&
		hasEvernightEvey(character.name) &&
		(resolvedSkill.includes("E") || normalUsesUltimate) &&
		!states[stateIndex].eveyOnField
	) {
		summonEveyState(states, character, actionValue, {
			immediate: true,
			sameActionPriority: -2,
		});
	}

	// SP 知更鸟 E：召唤 Summer Songbirds。
	if (
		isCharacterTarget(character) &&
		hasSpRobin(character) &&
		resolvedSkill.includes("E") &&
		!states[stateIndex].songbirdsOnField
	) {
		summonSongbirdsState(states, character, actionValue);
	}

	// 阿格莱雅 E：召唤衣匠（Q 的情况由统一函数处理）。
	if (!normalUsesUltimate) {
		handleAglaeaSkillEffects(states, stateIndex, resolvedSkill, actionValue);
	}
}
