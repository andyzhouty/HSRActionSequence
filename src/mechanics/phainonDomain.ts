import {
	type CharacterConfig,
	type DomainRule,
	getCounterWDomainRule,
	type SkillCode,
	toPositiveNumber,
} from "../utils/actionSequence";

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
		}
		state.nextActionValue =
			domainEndActionValue + remainingActionDistance / state.currentSpeed;
	}
}

/** 境界开始时：冻结友方行动（保存剩余距离，推向远处以防被选中） */
export function freezeAlliesForDomain(
	states: PhainonMutableState[],
	casterIndex: number,
	startActionValue: number,
) {
	for (let index = 0; index < states.length; index++) {
		if (index === casterIndex) continue;
		const state = states[index];
		if (!isAllyTarget(state.character.kind)) continue;
		if (state.blockNextAdvance) continue;

		const remainingDistance =
			Math.max(0, state.nextActionValue - startActionValue) * state.currentSpeed;
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
		toPositiveNumber(character.baseSpeed, 0) > 0
			? toPositiveNumber(character.baseSpeed, actionSpeed)
			: domainRule.defaultBaseSpeed;
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

