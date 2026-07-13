/**
 * 统一的 Q 大招后效处理——消除 normalAction 与 interrupts 之间的重复逻辑。
 */

import {
	getCharacterPath,
	hasPassive,
	hasSkillEffect,
} from "../data/characters";
import { handleAglaeaSkillEffects } from "../mechanics/aglaeaGarmentmaker";
import {
	applyCastoriceE2Pull,
	hasCastoriceSummon,
	summonPollux,
} from "../mechanics/castoricePollux";
import { hasEvernightEvey, summonEveyState } from "../mechanics/evernightEvey";
import {
	activateCombustion,
	shouldActivateCombustion,
} from "../mechanics/fireflyCombustion";
import { hasSaber } from "../mechanics/saber";
import {
	activateGodmode,
	hasSilverWolfGodmode,
} from "../mechanics/silverWolfGodmode";
import type { GeneratedAction } from "../utils/actionSequence";
import { isCharacterTarget } from "../utils/actionSequence";
import {
	handleMemoryTrailblazerQ,
	isAllyTarget,
	summonMemeState,
} from "./effects";
import { emitSingleElationSkill } from "./interrupts";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

interface PostUltimateParams {
	states: ActionState[];
	casterIndex: number;
	actions: GeneratedAction[];
	actionValue: number;
	input: SimulateActionsInput;
	activeOdes: Map<string, ActiveOdeState[]>;
	/** 用于 Ica 额外回合等附属 action 的 key 前缀 */
	sourceKey: string;
	/** Q 是否在技能最前面（QA/QE），此时部分效果（如自拉条）不适用 */
	qIsFront?: boolean;
}

/**
 * 所有 Q 大招触发后必须共享的后效处理。
 * normalAction 和 interrupts 都应该调用此函数。
 */
export function handlePostUltimateEffects(params: PostUltimateParams): void {
	const {
		states,
		casterIndex,
		actions,
		actionValue,
		input,
		sourceKey,
		qIsFront = false,
	} = params;
	const caster = states[casterIndex];
	const character = caster.character;
	if (hasSaber(character)) caster.saberForceBasicAttack = true;

	// 1. 阿格莱雅至高之姿
	handleAglaeaSkillEffects(states, casterIndex, "Q", actionValue);

	// 2. 流萤完全燃烧
	if (
		shouldActivateCombustion(
			character,
			true,
			Boolean(caster.isInCompleteCombustion),
		)
	) {
		activateCombustion(states, casterIndex, character, actionValue);
	}

	// 3. 知更鸟全队顶轴
	if (hasSkillEffect(character.name, "Q", "robinUltimate")) {
		caster.currentSpeed = 90;
		caster.nextActionValue = actionValue + 10000 / caster.currentSpeed;
		caster.blockNextAdvance = true;
		const allyOrder = states
			.map((s, i) => ({ index: i, value: s.nextActionValue }))
			.filter(
				({ index }) =>
					index !== casterIndex && isAllyTarget(states[index].character.kind),
			)
			.sort((a, b) =>
				a.value !== b.value ? a.value - b.value : a.index - b.index,
			);
		for (let rank = 0; rank < allyOrder.length; rank++) {
			states[allyOrder[rank].index].nextActionValue =
				actionValue + rank * 0.0001;
		}
	}

	// 4. 银狼 LV.999 自拉条 + 无敌玩家（Q 在前时不适用）"
	if (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "Q", "selfAdvance100")
	) {
		if (hasSilverWolfGodmode(character.name)) {
			activateGodmode(states, casterIndex);
		}
		if (!qIsFront) caster.nextActionValue = actionValue;
	}

	// 5. 记忆主 E/Q: 召唤迷迷
	if (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "E", "summonMeme")
	) {
		summonMemeState(states, character, actionValue);
		handleMemoryTrailblazerQ(states[casterIndex]);
	}

	// 6. 长夜月 E/Q: 重召长夜
	if (
		isCharacterTarget(character) &&
		hasEvernightEvey(character.name) &&
		!caster.eveyOnField
	) {
		summonEveyState(states, character, actionValue, {
			immediate: true,
			sameActionPriority: -2,
		});
	}

	// 7. 遐蝶 Q: 召唤死龙
	if (
		isCharacterTarget(character) &&
		hasCastoriceSummon(character.name) &&
		!caster.polluxOnField
	) {
		summonPollux(states, character, actionValue, { sameActionPriority: -1 });
		if (character.eidolon >= 2) {
			applyCastoriceE2Pull(states, casterIndex, actionValue, {
				queuePolluxAtCurrentAction: true,
			});
		}
	}

	// 8. 欢愉主 Q：非欢愉目标 → 50% 拉条；欢愉目标 → 立即释放欢愉技
	if (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "Q", "elationTrailblazerUltimate")
	) {
		const targetId = input.skillTargets[sourceKey];
		if (targetId) {
			const targetState = states.find(
				(s) => s.character.id === targetId && isAllyTarget(s.character.kind),
			);
			if (targetState) {
				const isElationTarget =
					getCharacterPath(targetState.character.name) === "Elation";
				if (isElationTarget) {
					emitSingleElationSkill(targetState, sourceKey, actionValue, actions);
				} else {
					const advance = targetState.nextActionValue * 0.5;
					if (!targetState.blockNextAdvance) {
						targetState.nextActionValue = Math.max(
							actionValue,
							targetState.nextActionValue - advance,
						);
					}
				}
			}
		}
	}

	// 9. 丹恒 Q 击杀立即行动
	if (
		isCharacterTarget(character) &&
		hasPassive(character.name, "killReset") &&
		input.killToggles?.[sourceKey]
	) {
		caster.nextActionValue = actionValue;
	}
}
