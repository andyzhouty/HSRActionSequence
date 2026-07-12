import { hasSkillEffect } from "../data/characters";
import type {
	CharacterConfig,
	GeneratedAction,
	SkillCode,
} from "../utils/actionSequence";
import { getPolluxRule } from "../utils/actionSequence";

// ── 类型 ──

export interface CastoriceActionState {
	character: CharacterConfig;
	currentSpeed: number;
	actionNo: number;
	nextActionValue: number;
	blockNextAdvance: boolean;
	polluxOnField?: boolean;
	polluxCount?: number;
	polluxGeneration?: number;
	polluxSummonGeneration?: number;
	isPolluxAction?: boolean;
	isImmediatePolluxSummon?: boolean;
	sameActionPriority?: number;
}

// ── 判断 ──

export function hasCastoriceSummon(characterName: string): boolean {
	return hasSkillEffect(characterName, "Q", "summonPollux");
}

export function isPolluxState(state: {
	isPolluxAction?: boolean;
}): boolean {
	return state.isPolluxAction ?? false;
}

/** 在 states 中找死龙 */
export function findPolluxState(
	states: CastoriceActionState[],
	ownerId: string,
) {
	return states.find(
		(s) => s.isPolluxAction && s.character.id === `${ownerId}-pollux`,
	);
}

/** 在 states 中找遐蝶 */
export function findCastoriceState(
	states: CastoriceActionState[],
) {
	return states.find((s) => hasCastoriceSummon(s.character.name));
}

// ── 召唤死龙 ──

export function summonPollux(
	states: CastoriceActionState[],
	owner: CharacterConfig,
	actionValue: number,
	options?: {
		sameActionPriority?: number;
	},
) {
	const polluxId = `${owner.id}-pollux`;
	const rule = getPolluxRule(owner.name);
	const speed = rule.memospriteSpeed;

	// 设置遐蝶状态
	const castorice = states.find((s) => s.character.id === owner.id);
	const nextGeneration = (castorice?.polluxSummonGeneration ?? 0) + 1;
	if (castorice) {
		castorice.polluxOnField = true;
		castorice.polluxCount = 0;
		castorice.polluxSummonGeneration = nextGeneration;
	}

	// 创建死龙忆灵
	const polluxChar: CharacterConfig = {
		id: polluxId,
		kind: "忆灵",
		name: rule.memospriteName,
		speed: String(speed),
		baseSpeed: String(speed),
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		hasCastoriceTechnique: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
	};

	states.push({
		character: polluxChar,
		baseSpeed: speed,
		currentSpeed: speed,
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: actionValue,
		blockNextAdvance: false,
		isPolluxAction: true,
		isImmediatePolluxSummon: true,
		polluxOnField: undefined,
		polluxCount: 0,
		polluxGeneration: nextGeneration,
		sameActionPriority: options?.sameActionPriority,
	} as unknown as CastoriceActionState);
}

// ── 处理死龙行动 ──

export function handlePolluxAction(
	states: CastoriceActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	character: CharacterConfig,
	actionNo: number,
	actionValue: number,
	skill: SkillCode,
	killTriggered = false,
) {
	const polluxState = states[stateIndex];
	const currentCount = polluxState.polluxCount ?? 0;
	const nextCount = currentCount + 1;
	const ownerId = character.id.replace("-pollux", "");
	const owner = states.find((s) => s.character.id === ownerId);
	const rule = owner ? getPolluxRule(owner.character.name) : undefined;

	actions.push({
		key,
		characterId: character.id,
		displayName: rule?.memospriteName ?? "死龙",
		targetKind: "忆灵",
		actionNo,
		actionValue,
		skill,
		speed: states[stateIndex].currentSpeed,
		isMemospriteAction: true,
		memospriteOwnerId: ownerId,
		isPolluxAction: true,
	});

	polluxState.sameActionPriority = 0;
	polluxState.isImmediatePolluxSummon = false;

	// 判断是否离场：纯 E（不是 EA）或已达最大回合数
	const isDismissSkill = rule ? skill === rule.dismissSkill : skill === "E";
	const isMaxCount = rule ? nextCount >= rule.maxActions : nextCount >= 3;

	// 达到最大行动次数后必须离场；第三回合即使击杀也不能继续获得第四动。
	if (isMaxCount) {
		const castorice = states.find((s) => s.character.id === ownerId);
		if (castorice) {
			castorice.polluxOnField = false;
			castorice.polluxCount = undefined;
		}
		states.splice(stateIndex, 1);
		return;
	}

	// 击杀：E 后死龙不消失，速度翻倍（基于基础速度）
	if (isDismissSkill && killTriggered) {
		const base = rule?.memospriteSpeed ?? 165;
		states[stateIndex].currentSpeed += base;
		polluxState.polluxCount = nextCount;
		states[stateIndex].actionNo += 1;
		states[stateIndex].nextActionValue =
			actionValue + 10000 / states[stateIndex].currentSpeed;
		states[stateIndex].blockNextAdvance = false;
		return;
	}

	if (isDismissSkill) {
		// 离场
		const castorice = states.find((s) => s.character.id === ownerId);
		if (castorice) {
			castorice.polluxOnField = false;
			castorice.polluxCount = undefined;
		}
		states.splice(stateIndex, 1);
	} else {
		// 驻场
		polluxState.polluxCount = nextCount;
		states[stateIndex].actionNo += 1;
		states[stateIndex].nextActionValue =
			actionValue + 10000 / states[stateIndex].currentSpeed;
		states[stateIndex].blockNextAdvance = false;
	}
}

// ── 遐蝶 E2 自拉条 ──

export function applyCastoriceE2Pull(
	states: CastoriceActionState[],
	castoriceIndex: number,
	actionValue: number,
	options?: {
		queuePolluxAtCurrentAction?: boolean;
	},
) {
	const castorice = states[castoriceIndex];
	castorice.nextActionValue = actionValue;

	const polluxIndex = states.findIndex(
		(s) => s.isPolluxAction && s.character.id.endsWith("-pollux"),
	);
	if (polluxIndex >= 0) {
		if (options?.queuePolluxAtCurrentAction) {
			// A normal Q queues two normal actions at the same AV: Castorice first,
			// then Pollux, before unrelated normal turns.
			castorice.sameActionPriority = -2;
			states[polluxIndex].nextActionValue = actionValue;
			states[polluxIndex].sameActionPriority = -1;
		} else {
			// Technique and interrupt Q keep their existing display offset.
			states[polluxIndex].nextActionValue = actionValue + 0.0001;
		}
	}
}

