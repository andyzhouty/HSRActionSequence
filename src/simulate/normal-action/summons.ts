/**
 * 召唤与忆灵处理：迷迷、长夜、衣匠的召唤。
 * 从 normalAction.ts 提取。龙灵同袍切换因依赖运行时可变状态保留在原文件。
 */
import { hasSkillEffect } from "../../data/characters";
import { handleAglaeaSkillEffects } from "../../mechanics/aglaeaGarmentmaker";
import { hasEvernightEvey, summonEveyState } from "../../mechanics/evernightEvey";
import { isCharacterTarget, type SkillCode } from "../../utils/actionSequence";
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

	// Memory Trailblazer E/Q: summon Meme as a 130-speed memosprite.
	if (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "E", "summonMeme") &&
		(resolvedSkill.includes("E") || normalUsesUltimate)
	) {
		summonMemeState(states, character, actionValue);
	}

	// Evernight E/Q: summon Evey
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

	// Aglaea E: summon Garmentmaker (Q case handled by unified function)
	if (!normalUsesUltimate) {
		handleAglaeaSkillEffects(states, stateIndex, resolvedSkill, actionValue);
	}
}
