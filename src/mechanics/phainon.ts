import type { ActionState } from "../simulate/types";
import {
	type CharacterConfig,
	type DomainRule,
	getCounterWDomainRule,
	type SkillCode,
} from "../utils/actionSequence";
import { getEffectiveCharacterBaseSpeed } from "./lightconeEffects";
import { hasSpRobin, recordSpRobinPercentBuff } from "./spRobin";

export type PhainonDomainState = {
	keyPrefix: string;
	startAV: number;
	interval: number;
	currentIndex: number;
	maxIndex: number;
	rule: DomainRule;
};

type PhainonMutableState = {
	character: CharacterConfig;
	baseSpeed: number;
	currentSpeed: number;
	phainonDomainSpeedBonus: number;
	nextActionValue: number;
	blockNextAdvance?: boolean;
	phainonDomainFrozenDistance?: number;
	spBladeCountdownOwnerId?: string;
	/** 晴空乐手忆灵：速度由 SP Robin 的百分比 buff 比例派生，不直接吃全队百分比加速。 */
	isSongbirdsAction?: boolean;
	spRobinMemospritePercentBuff?: number;
	/** Fever减半倒计时：境界冻结期间同步停滞，避免 Fever 在境界内结束。 */
	spRobinFeverCountdownOwnerId?: string;
};

function isAllyTarget(kind: string): boolean {
	return kind === "角色" || kind === "忆灵";
}

export function expirePhainonDomainSpeedBonus(
	states: PhainonMutableState[],
	actionValue: number,
) {
	for (const state of states) {
		if (state.phainonDomainSpeedBonus <= 0) continue;
		const remainingActionDistance =
			Math.max(0, state.nextActionValue - actionValue) * state.currentSpeed;
		const nextSpeed = state.currentSpeed - state.phainonDomainSpeedBonus;

		state.phainonDomainSpeedBonus = 0;
		state.currentSpeed = nextSpeed > 0 ? nextSpeed : state.currentSpeed;
		state.nextActionValue =
			actionValue + remainingActionDistance / state.currentSpeed;
	}
}

export function applyPhainonDomainPauseAndSpeedBonus(
	states: PhainonMutableState[],
	casterIndex: number,
	startActionValue: number,
	domainEndActionValue: number,
	speedBonusBaseSpeedRatio: number,
) {
	for (let index = 0; index < states.length; index++) {
		const state = states[index];
		if (state.spBladeCountdownOwnerId) {
			const remainingDistance =
				state.phainonDomainFrozenDistance ??
				Math.max(0, state.nextActionValue - startActionValue) *
					state.currentSpeed;
			state.phainonDomainFrozenDistance = undefined;
			state.nextActionValue =
				domainEndActionValue + remainingDistance / state.currentSpeed;
			continue;
		}
		// Fever减半倒计时：境界冻结期间同步停滞，境界结束后继续走完剩余距离。
		if (state.spRobinFeverCountdownOwnerId) {
			const remainingDistance =
				state.phainonDomainFrozenDistance ??
				Math.max(0, state.nextActionValue - startActionValue) *
					state.currentSpeed;
			state.phainonDomainFrozenDistance = undefined;
			state.nextActionValue =
				domainEndActionValue + remainingDistance / state.currentSpeed;
			continue;
		}
		// 晴空乐手忆灵：速度由 SP Robin 的百分比 buff 比例派生，境界结束加速由其主人同步。
		if (state.isSongbirdsAction) {
			const remainingDistance =
				state.phainonDomainFrozenDistance ??
				Math.max(0, state.nextActionValue - startActionValue) *
					state.currentSpeed;
			state.phainonDomainFrozenDistance = undefined;
			state.nextActionValue =
				domainEndActionValue + remainingDistance / state.currentSpeed;
			continue;
		}
		if (!isAllyTarget(state.character.kind)) continue;

		// 不受加速/拉条影响的角色（如知更鸟大招期间）跳过速度 buff，纯平移 AV
		if (state.blockNextAdvance) {
			state.nextActionValue =
				domainEndActionValue +
				Math.max(0, state.nextActionValue - startActionValue);
			continue;
		}

		// 使用冻结时保存的距离，否则现场计算
		const remainingActionDistance =
			state.phainonDomainFrozenDistance ??
			Math.max(
				0,
				state.nextActionValue -
					(index === casterIndex ? domainEndActionValue : startActionValue),
			) * state.currentSpeed;
		state.phainonDomainFrozenDistance = undefined;

		if (state.phainonDomainSpeedBonus <= 0) {
			const baseSpeed = state.baseSpeed > 0 ? state.baseSpeed : 100;
			const speedBonus = baseSpeed * speedBonusBaseSpeedRatio;
			state.phainonDomainSpeedBonus = speedBonus;
			state.currentSpeed += speedBonus;
			// SP Robin 忆灵速度公式：同步记录百分比 buff 比例。
			if (hasSpRobin(state.character)) {
				recordSpRobinPercentBuff(
					states as unknown as ActionState[],
					state.character.id,
					speedBonusBaseSpeedRatio,
					domainEndActionValue,
				);
			}
		}
		state.nextActionValue =
			domainEndActionValue + remainingActionDistance / state.currentSpeed;
	}
}

/**
 * 境界开始时冻结友方角色与忆灵行动（保存剩余距离，推向远处以防被选中）。
 * 阿哈时刻是独立行动轴，不属于冻结目标，因而会在境界内照常行动。
 */
export function freezeAlliesForDomain(
	states: PhainonMutableState[],
	casterIndex: number,
	startActionValue: number,
) {
	for (let index = 0; index < states.length; index++) {
		if (index === casterIndex) continue;
		const state = states[index];
		if (state.spBladeCountdownOwnerId) {
			state.phainonDomainFrozenDistance =
				Math.max(0, state.nextActionValue - startActionValue) *
				state.currentSpeed;
			state.nextActionValue = startActionValue + 99999;
			continue;
		}
		// Fever减半倒计时：境界期间同步停滞，避免 Fever 在境界内结束。
		if (state.spRobinFeverCountdownOwnerId) {
			state.phainonDomainFrozenDistance =
				Math.max(0, state.nextActionValue - startActionValue) *
				state.currentSpeed;
			state.nextActionValue = startActionValue + 99999;
			continue;
		}
		if (!isAllyTarget(state.character.kind)) continue;
		if (state.blockNextAdvance) continue;

		const remainingDistance =
			Math.max(0, state.nextActionValue - startActionValue) *
			state.currentSpeed;
		state.phainonDomainFrozenDistance = remainingDistance;
		state.nextActionValue = startActionValue + 99999;
	}
}

export function getPhainonDomainInterval(
	character: CharacterConfig,
	actionSpeed: number,
) {
	const domainRule = getCounterWDomainRule(character.name);
	const v0 =
		getEffectiveCharacterBaseSpeed(character) ||
		domainRule.defaultBaseSpeed ||
		actionSpeed;
	const coeff =
		character.eidolon >= 1
			? domainRule.eidolon1EquivalentSpeedCoefficient
			: domainRule.normalEquivalentSpeedCoefficient;
	return 10000 / v0 / coeff / Math.max(1, domainRule.extraActionCount - 1);
}

export function getPhainonDomainEndIndex(
	actionKeyPrefix: string,
	domainEndOverrides: Record<string, boolean>,
	maxDomainActionIndex: number,
) {
	for (let i = 0; i <= maxDomainActionIndex; i++) {
		if (domainEndOverrides[`${actionKeyPrefix}-domain-${i}`]) return i;
	}
	return maxDomainActionIndex;
}

export function hasPhainonEnemyTriggerSkill(
	rule: DomainRule,
	skill: SkillCode,
) {
	return (
		rule.enemyTriggerSkills?.some((trigger) => skill.includes(trigger)) ?? false
	);
}
