import { getCharacterCid } from "../data/characters";
import { CHARACTER_IDS } from "../domain/identity";
import type { ActionState } from "../simulate/types";
import {
	type CharacterConfig,
	type GeneratedAction,
	isBasicAttackSkill,
	isNonAttackSkill,
} from "../utils/action-sequence";

// ── 砂金·戏浪（水砂）──
// 欢愉命途。A/E/Q 均视作攻击；固定资源「热意（Fervor）」；
// 队友攻击积累热意，达到阈值立即施放欢愉技；阿哈时刻内热意>=10 时欢愉技强化。

export const SP_AVENTURINE_CID = CHARACTER_IDS.spAventurine;
export const SP_AVENTURINE_BASE_SPEED = 107;
export const FERVOR_ATTACK_GAIN = 1;
export const FERVOR_TALENT_GAIN = 1;
export const FERVOR_E2_ELATION_GAIN = 4;
export const TALENT_MAX_TRIGGERS = 6;
export const AHA_SPEED_BUFF = 25;
/** 水砂自身 E 获得的额外热意。 */
export const SP_AVENTURINE_E_FERVOR_GAIN = 4;
/** 水砂自身 Q 获得的额外热意。 */
export const SP_AVENTURINE_Q_FERVOR_GAIN = 8;
/** 水砂 Q 后自身速度提高比例（基于基础速度）与持续回合数。 */
export const SP_AVENTURINE_Q_SPEED_PCT = 0.3;
export const SP_AVENTURINE_Q_SPEED_TURNS = 4;

export function hasSpAventurine(
	character: CharacterConfig | undefined,
): boolean {
	return getCharacterCid(character?.name ?? "") === SP_AVENTURINE_CID;
}

/** 热意上限：星魂 2+ 为 50，否则 30。 */
export function getSpAventurineFervorCap(eidolon: number): number {
	return eidolon >= 2 ? 50 : 30;
}

export function clampSpAventurineFervor(
	fervor: number,
	eidolon: number,
): number {
	return Math.max(0, Math.min(getSpAventurineFervorCap(eidolon), fervor));
}

/** 热意资源列的合法输入：空串或不超过星魂对应上限的非负整数。 */
export function isValidSpAventurineFervorValue(
	value: string,
	eidolon: number,
): boolean {
	if (value === "") return true;
	if (!/^\d+$/.test(value)) return false;
	return Number(value) <= getSpAventurineFervorCap(eidolon);
}

/** 水砂 Q：自身速度 +30%（基于基础速度）持续 4 回合；重复 Q 只刷新持续时间。 */
export function applySpAventurineQSpeedBuff(
	state: ActionState,
	actionValue: number,
): void {
	const alreadyBuffed = (state.spAventurineSpeedBuffTurns ?? 0) > 0;
	if (!alreadyBuffed) {
		const oldSpeed = state.currentSpeed;
		const nextSpeed = oldSpeed + state.baseSpeed * SP_AVENTURINE_Q_SPEED_PCT;
		if (nextSpeed <= 0) return;
		const remaining = state.nextActionValue - actionValue;
		if (remaining > 0) {
			state.nextActionValue = actionValue + remaining * (oldSpeed / nextSpeed);
		}
		state.currentSpeed = nextSpeed;
	}
	state.spAventurineSpeedBuffTurns = SP_AVENTURINE_Q_SPEED_TURNS;
}

/** 水砂每个正常回合结束后递减；归零时移除 +30% 并重排已排定的下一动。 */
export function consumeSpAventurineSpeedBuff(
	states: ActionState[],
	stateIndex: number,
	actionValue: number,
): void {
	const state = states[stateIndex];
	// 本行动施放过 Q：应用 +30% 速度（或刷新持续时间），本正常回合不计入 4 回合。
	if (state.spAventurineQBuffPending) {
		state.spAventurineQBuffPending = false;
		applySpAventurineQSpeedBuff(state, actionValue);
		return;
	}
	if ((state.spAventurineSpeedBuffTurns ?? 0) <= 0) return;
	state.spAventurineSpeedBuffTurns =
		(state.spAventurineSpeedBuffTurns ?? 0) - 1;
	if (state.spAventurineSpeedBuffTurns > 0) return;
	const oldSpeed = state.currentSpeed;
	const nextSpeed = Math.max(
		0.001,
		state.currentSpeed - state.baseSpeed * SP_AVENTURINE_Q_SPEED_PCT,
	);
	state.currentSpeed = nextSpeed;
	if (oldSpeed > 0 && state.nextActionValue > actionValue) {
		const remainingDistance = (state.nextActionValue - actionValue) * oldSpeed;
		state.nextActionValue = actionValue + remainingDistance / nextSpeed;
	} else {
		state.nextActionValue = actionValue + 10000 / nextSpeed;
	}
}

/** 立即施放普通欢愉技的热意阈值：E0 10；E1 10/20/30；E2+ 10/20/30/40/50。 */
export function getFervorThresholds(eidolon: number): number[] {
	if (eidolon >= 2) return [10, 20, 30, 40, 50];
	if (eidolon >= 1) return [10, 20, 30];
	return [10];
}

/** 水砂本次欢愉技是否强化：E6 全强化；否则仅阿哈时刻内且热意 >= 10。 */
export function isSpAventurineElationEnhanced(
	state: ActionState,
	inAhaMoment: boolean,
): boolean {
	if (state.spAventurineAllEnhanced) return true;
	return inAhaMoment && (state.spAventurineFervor ?? 0) >= 10;
}

/** 阿哈时刻速度 +25：仅队伍只有水砂一名欢愉角色且增益已触发时生效。 */
export function applySpAventurineAhaSpeedBonus(
	elationStates: ActionState[],
	baseSpeed: number,
): number {
	if (elationStates.length !== 1) return baseSpeed;
	const only = elationStates[0];
	if (!hasSpAventurine(only.character)) return baseSpeed;
	if (!only.spAventurineAhaSpeedBuff) return baseSpeed;
	return baseSpeed + AHA_SPEED_BUFF;
}

/** 阿哈时刻结束后解除水砂的 +25 阿哈加速，可由后续队友攻击重新触发。 */
export function clearSpAventurineAhaSpeedBuff(states: ActionState[]): void {
	for (const state of states) {
		if (hasSpAventurine(state.character)) {
			state.spAventurineAhaSpeedBuff = false;
		}
	}
}

// ── 热意结算（纯函数，便于测试）──

export type SpAventurineGainParams = {
	/** 触发行动。 */
	action: GeneratedAction;
	/** 行动者配置（可能是忆灵/非忆灵）。 */
	attacker: CharacterConfig | undefined;
	/** 是否被既有攻击规则视为强制攻击。 */
	isForcedAttack: boolean;
	/** 该行动是否被 attackDisabled 关闭。 */
	attackDisabled: boolean;
	/** 剩余天赋触发次数。 */
	talentTriggersLeft: number;
	/** 行动者是否就是水砂本人。 */
	isSelf: boolean;
};

export type SpAventurineGainResult = {
	/** 本次应增加的热意（不含手动覆盖与 E2 欢愉技 +4）。 */
	gain: number;
	/** 本次是否消耗了一次天赋触发次数。 */
	talentUsed: boolean;
	/** 是否构成队友攻击（用于阿哈加速判定）。 */
	isTeammateAttack: boolean;
};

/** 结算一条已记录行动对水砂的热意贡献。 */
export function computeSpAventurineFervorGain(
	params: SpAventurineGainParams,
): SpAventurineGainResult {
	const {
		action,
		attacker,
		isForcedAttack,
		attackDisabled,
		talentTriggersLeft,
		isSelf,
	} = params;
	if (isSelf || !attacker) {
		return { gain: 0, talentUsed: false, isTeammateAttack: false };
	}
	const allyKind =
		attacker.kind === "角色" ||
		attacker.kind === "忆灵" ||
		attacker.kind === "非忆灵";
	if (!allyKind) {
		return { gain: 0, talentUsed: false, isTeammateAttack: false };
	}
	if (action.characterId === "@av0" || action.isAhaInstant) {
		return { gain: 0, talentUsed: false, isTeammateAttack: false };
	}
	// 迷迷拉条、晴空乐手倒计时等非攻击特殊行动不计热意。
	if (
		action.isMemeAction ||
		action.isMemeAdvanceAction ||
		action.isSpRobinFeverCountdownAction
	) {
		return { gain: 0, talentUsed: false, isTeammateAttack: false };
	}
	const isAttack =
		isForcedAttack ||
		(!attackDisabled && !isNonAttackSkill(attacker, action.skill));
	const isSpBladeExtraE = action.isSpBladeExtraAction === true;
	// 天赋：队友（角色）施放普攻/战技/追加攻击/终结技后额外 +1。
	// 忆灵技、欢愉技不计入天赋范围；sp刃额外战技同时视为追加攻击，但只计 1 点。
	let gain = 0;
	let talentUsed = false;
	let talentMatch = false;
	if (attacker.kind === "角色" && !action.isElationSkill) {
		talentMatch =
			talentTriggersLeft > 0 &&
			(isBasicAttackSkill(action.skill) ||
				action.skill.includes("E") ||
				action.skill.includes("Q") ||
				action.isFuaAction === true);
	}
	if (isAttack) gain += FERVOR_ATTACK_GAIN;
	if (talentMatch) {
		gain += FERVOR_TALENT_GAIN;
		talentUsed = true;
	}
	if (isSpBladeExtraE && talentMatch) gain = FERVOR_TALENT_GAIN;
	return { gain, talentUsed, isTeammateAttack: isAttack };
}

/** 记录一条已生成行动后的水砂热意结算（手动覆盖、天赋、阈值触发与阿哈加速）。 */
export function handleSpAventurineRecordedAction(params: {
	state: ActionState;
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	isForcedAttack: boolean;
	resolveAttackerState: (characterId: string) => ActionState | undefined;
	isSoleElation: boolean;
	refreshAhaSchedule: (actionValue: number) => void;
	emitImmediateElation: (
		parentKey: string,
		actionValue: number,
		threshold: number,
	) => void;
}): void {
	const {
		state,
		action,
		attacker,
		actions,
		input,
		isForcedAttack,
		resolveAttackerState,
		isSoleElation,
		refreshAhaSchedule,
		emitImmediateElation,
	} = params;
	const eidolon = state.character.eidolon;
	const isSpAventurineSelf = action.characterId === state.character.id;
	// 手动资源覆盖（热意列填写值成为该行基准，同 sp刃叠层口径）。
	const manualFervor = Number.parseFloat(
		input.resourceValues?.[action.key]?.[spAventurineFervorResourceName] ?? "",
	);
	const prevFervor = Number.isFinite(manualFervor)
		? clampSpAventurineFervor(manualFervor, eidolon)
		: (state.spAventurineFervor ?? 0);
	// 水砂施放战技时重置天赋可触发次数（精确匹配 E，欢愉技 ES 不触发）。
	if (isSpAventurineSelf && action.skill === "E") {
		state.spAventurineTalentTriggersLeft = TALENT_MAX_TRIGGERS;
	}
	const gainResult = computeSpAventurineFervorGain({
		action,
		// 忆灵/非忆灵等运行时实体不在 input.characters 中，从状态回退解析。
		attacker: attacker ?? resolveAttackerState(action.characterId)?.character,
		isForcedAttack,
		attackDisabled: input.attackDisabled?.[action.key] !== true,
		talentTriggersLeft: state.spAventurineTalentTriggersLeft ?? 0,
		isSelf: isSpAventurineSelf,
	});
	if (gainResult.talentUsed) {
		state.spAventurineTalentTriggersLeft =
			(state.spAventurineTalentTriggersLeft ?? 0) - 1;
	}
	// 阿哈时刻速度 +25：仅水砂为唯一欢愉角色时，队友攻击触发一次。
	if (
		isSoleElation &&
		gainResult.isTeammateAttack &&
		!state.spAventurineAhaSpeedBuff
	) {
		state.spAventurineAhaSpeedBuff = true;
		refreshAhaSchedule(action.actionValue);
	}
	let fervor = clampSpAventurineFervor(prevFervor + gainResult.gain, eidolon);
	// 水砂自身 E/Q 获得额外热意；Q 同时触发自身 +30% 速度。
	if (isSpAventurineSelf) {
		if (action.skill === "E") {
			fervor = clampSpAventurineFervor(
				fervor + SP_AVENTURINE_E_FERVOR_GAIN,
				eidolon,
			);
		}
		if (action.skill === "Q") {
			fervor = clampSpAventurineFervor(
				fervor + SP_AVENTURINE_Q_FERVOR_GAIN,
				eidolon,
			);
			// Q 不是正常回合：标记待应用，收尾时施加但不消耗本回合。
			state.spAventurineQBuffPending = true;
		}
	}
	// 水砂自身施放普通/强化欢愉技：E6 累计、强化清空热意、E2 额外 +4。
	if (isSpAventurineSelf && action.isElationSkill) {
		const count = (state.spAventurineElationSkillCount ?? 0) + 1;
		state.spAventurineElationSkillCount = count;
		if (count >= 2) state.spAventurineAllEnhanced = true;
		const parentAction = actions.find(
			(a) => a.key === action.elationSkillParentKey,
		);
		const inAhaMoment = parentAction?.isAhaInstant === true;
		if (action.isEnhancedElationSkill) {
			// E6：阿哈时刻外施放强化欢愉技不消耗热意。
			const e6NoConsume = eidolon >= 6 && !inAhaMoment;
			if (!e6NoConsume) fervor = 0;
		}
		if (eidolon >= 2) {
			fervor = clampSpAventurineFervor(
				fervor + FERVOR_E2_ELATION_GAIN,
				eidolon,
			);
		}
	}
	state.spAventurineFervor = fervor;
	action.spAventurineFervor = fervor;
	// 热意达到阈值：立即施放一次普通欢愉技。
	for (const threshold of getFervorThresholds(eidolon)) {
		if (prevFervor < threshold && fervor >= threshold) {
			emitImmediateElation(action.key, action.actionValue, threshold);
		}
	}
}

import type { SimulateActionsInput } from "../simulate/types";
import { spAventurineFervorResourceName } from "../utils/action-sequence";
