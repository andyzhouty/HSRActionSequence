import { getCharacterPath, hasSkillEffect } from "../data/characters";
import {
	type CharacterConfig,
	canUseSkillCode,
	type GeneratedAction,
	getCharacterCid,
	getCyreneUltimateRule,
	getGarmentmakerRule,
	getMemeAdvanceRule,
	getOdeRuleForTarget,
	isCharacterTarget,
	normalizeActionValue,
	type OdeSelection,
	type SkillCode,
	type SpeedAdjustment,
	shouldRememberSkillTarget,
	toSignedNumber,
} from "../utils/actionSequence";
import {
	findGarmentmakerState,
	getAglaeaStackLimit,
	syncGarmentmakerStacksToAglaea,
} from "../mechanics/aglaeaGarmentmaker";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

// --- Internal helpers ---

export function toNonNegativeNumber(
	value: string | undefined,
	fallback: number,
): number {
	const normalizedFallback = normalizeActionValue(fallback);
	if (value === undefined || value === "") return normalizedFallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) && parsed >= 0
		? normalizeActionValue(parsed)
		: normalizedFallback;
}

export function canBeAdvancedByDance(kind: string): boolean {
	return kind === "角色" || kind === "忆灵";
}

export function isAllyTarget(kind: string): boolean {
	return kind === "角色" || kind === "忆灵";
}

/**
 * 返回 Q 后全队拉条的提前量（百分之一为单位，如 2400 = 24%）。
 * 舞舞舞 = (14 + 2 × 叠影数)%，忘归人 2 魂固定 24%，其余返回 0。
 */
export function getTeamAdvanceOnUltimate(character: CharacterConfig): number {
	if (!isCharacterTarget(character)) return 0;
	if (
		(character.hasDance || character.lc_id === 21018) &&
		getCharacterPath(character.name) === "Harmony"
	) {
		return 1400 + 200 * character.superimpose;
	}
	if (
		character.eidolon >= 2 &&
		hasSkillEffect(character.name, "Q", "teamAdvance24")
	) {
		return 2400;
	}
	return 0;
}

export function getDefaultSkill(
	_character: CharacterConfig,
	_actionNo: number,
): string {
	return "";
}

export function getActionSkill(
	character: CharacterConfig,
	actionNo: number,
	key: string,
	skillOverrides: Record<string, string>,
	legacyUltOverrides: Record<string, boolean>,
): string {
	const override = skillOverrides[key];
	if (override !== undefined) {
		if (!canUseSkillCode(character, override)) return "";
		return override;
	}

	if (legacyUltOverrides[key] !== undefined) {
		return legacyUltOverrides[key] ? "Q" : "";
	}

	return getDefaultSkill(character, actionNo);
}

export function getNextSpeed(
	currentSpeed: number,
	baseSpeed: number,
	adjustment: SpeedAdjustment | undefined,
): number {
	if (!adjustment) return currentSpeed;
	const value = toSignedNumber(adjustment.value, 0);
	const nextSpeed =
		adjustment.mode === "relative"
			? currentSpeed + (baseSpeed * value) / 100
			: currentSpeed + value;
	return nextSpeed > 0 ? nextSpeed : currentSpeed;
}

export function getSkillTarget(
	input: SimulateActionsInput,
	actionKey: string,
	character: CharacterConfig,
) {
	return (
		input.skillTargets[actionKey] ??
		(shouldRememberSkillTarget(character.name)
			? input.defaultSkillTargets[character.id]
			: undefined)
	);
}

export function findHimekoNovaAssistState(
	states: ActionState[],
	sourceCharacterId: string,
) {
	return states.find(
		(state) =>
			state.character.id !== sourceCharacterId &&
			isAllyTarget(state.character.kind) &&
			hasSkillEffect(state.character.name, "F", "himekoNovaAssist"),
	);
}

// ── 记忆主【史诗】系统 ──

/** 检查目标是否拥有指定 code 的颂诗 */
export function hasActiveOde(
	activeOdes: Map<string, ActiveOdeState[]>,
	characterId: string,
	odeCode: string,
) {
	return (
		activeOdes
			.get(characterId)
			?.some((activeOde) => activeOde.ode.code === odeCode) ?? false
	);
}

/** 找到记忆主状态 */
export function findMemoryTrailblazerState(states: ActionState[]) {
	return states.find(
		(state) =>
			isCharacterTarget(state.character) &&
			hasSkillEffect(state.character.name, "E", "summonMeme"),
	);
}

/** 记忆主 Q 后增加史诗层数（上限2），标记等待下一次 A */
export function handleMemoryTrailblazerQ(state: ActionState) {
	state.epic = Math.min((state.epic ?? 0) + 1, 2);
	state.epicPendingA = true;
}

/** 记忆主 A 时消耗一层史诗，返回是否消耗成功 */
export function consumeMemoryTrailblazerEpic(
	state: ActionState,
): boolean {
	if (!state.epicPendingA) return false;
	if ((state.epic ?? 0) <= 0) {
		state.epicPendingA = false;
		return false;
	}
	state.epic = (state.epic ?? 1) - 1;
	state.epicPendingA = false;
	return true;
}

// ── 昔涟 Q_counter 系统 ──

/** 找到昔涟状态 */
export function findCyreneState(states: ActionState[]) {
	return states.find(
		(state) =>
			isCharacterTarget(state.character) &&
			hasSkillEffect(state.character.name, "Q", "cyreneUltimate"),
	);
}

/** 昔涟 Q 后增加 Q_counter，返回新的计数值 */
export function incrementCyreneQCounter(state: ActionState): number {
	state.Q_counter = (state.Q_counter ?? 0) + 1;
	return state.Q_counter;
}

/** 判断 Q_counter 是否满足 3n+2（n≥0），触发强化 Q */
export function shouldTriggerEnhancedQ(Q_counter: number): boolean {
	if (Q_counter <= 0) return false;
	// 3n+2 → Q_counter = 2, 5, 8, 11, ...
	return (Q_counter - 2) % 3 === 0;
}

/** 判断 Q_counter 是否满足 3k+2（k>0），触发 E6 24% 拉条（排除首次即 Q_counter=2） */
export function shouldTriggerE6TeamAdvance24(Q_counter: number): boolean {
	if (Q_counter <= 0) return false;
	// 3k+2 where k>0 → Q_counter = 5, 8, 11, ...
	return Q_counter > 2 && (Q_counter - 2) % 3 === 0;
}

// ── 昔涟 E6 拉条 ──

/** 昔涟/德谬歌 Q 后的完整处理：Q_counter + 强化 Q + E6。
 * QE/QA 的 Q 已发生在自身正常行动之前，因此不能再拉自身；其他 Q 均参与全队排序。 */
export function handleCyrenePostUltimate({
	states,
	casterIndex,
	character,
	actions,
	actionValue,
	activeOdes,
	excludeSelf = false,
}: {
	states: ActionState[];
	casterIndex: number;
	character: CharacterConfig;
	actions: GeneratedAction[];
	actionValue: number;
	activeOdes: Map<string, ActiveOdeState[]>;
	excludeSelf?: boolean;
}) {
	void activeOdes;
	const cyreneRule = getCyreneUltimateRule(character.name);
	const qCounter = incrementCyreneQCounter(states[casterIndex]);

	// 强化 Q：Q_counter = 3n+2 时德谬歌获得额外回合
	if (shouldTriggerEnhancedQ(qCounter)) {
		const enhancedKey = `${character.id}-enhancedQ-${qCounter}`;
		actions.push({
			key: enhancedKey,
			characterId: `${character.id}-memosprite`,
			displayName: cyreneRule.memospriteName,
			targetKind: "忆灵",
			actionNo: 0,
			actionValue,
			skill: "Q" as SkillCode,
			speed: 0,
			isMemospriteAction: true,
			memospriteOwnerId: character.id,
			isCyreneEnhancedQ: true,
			lockedSkill: true,
		});
		// E6：强化 Q 结束后 24% 全队拉条（Q_counter = 3k+2, k>0）
		if (
			character.eidolon >= 6 &&
			shouldTriggerE6TeamAdvance24(qCounter)
		) {
			applyCyreneE6EnhancedQPull(states, actionValue);
		}
	}
	// E6 首次大：全队 100% 拉条（Q_counter = 1 时）
	if (character.eidolon >= 6 && qCounter === 1) {
		const shouldExcludeSelf = excludeSelf;
		applyCyreneE6FirstUltimatePull(
			states,
			casterIndex,
			actionValue,
			shouldExcludeSelf,
		);
	}
}

/** 释放昔涟 E6 首次大 100% 全队拉条（同知更鸟顶轴机制，但昔涟自身也可被拉条）
 *  @param excludeSelf - 若为 true（插队情况），不拉昔涟自身 */
export function applyCyreneE6FirstUltimatePull(
	states: ActionState[],
	cyreneIndex: number,
	actionValue: number,
	excludeSelf = false,
) {
	// 普通首次 Q 时，昔涟自身已经完成本次行动，必须占据拉条后的第一动。
	// 不把自身混入旧 AV 排序，否则同 AV 的其他状态可能占用 rank 0。
	if (!excludeSelf) {
		const cyrene = states[cyreneIndex];
		if (cyrene && !cyrene.blockNextAdvance) {
			cyrene.nextActionValue = actionValue;
		}
	}

	// 其余队友（角色+忆灵）按拉条前的相对 AV 排列。
	const allyOrder = states
		.map((s, i) => ({ index: i, value: s.nextActionValue }))
		.filter(
			({ index }) =>
				isAllyTarget(states[index].character.kind) &&
				index !== cyreneIndex &&
				!(excludeSelf && index === cyreneIndex),
		)
		.sort((a, b) => {
			if (a.value !== b.value) return a.value - b.value;
			return a.index - b.index;
		});

	for (let rank = 0; rank < allyOrder.length; rank++) {
		const target = states[allyOrder[rank].index];
		if (target.blockNextAdvance) continue;
		const rankOffset = excludeSelf ? 0 : 1;
		target.nextActionValue = actionValue + (rank + rankOffset) * 0.0001;
	}
}

/** 触发 E6 24% 全队拉条（强化 Q 结束后），但不得越过德谬歌强化 Q 的 AV */
export function applyCyreneE6EnhancedQPull(
	states: ActionState[],
	actionValue: number,
) {
	for (const teammate of states) {
		if (!isAllyTarget(teammate.character.kind)) continue;
		if (teammate.blockNextAdvance) continue;
		const advance = 2400 / teammate.currentSpeed;
		teammate.nextActionValue = Math.max(
			actionValue,
			teammate.nextActionValue - advance,
		);
	}
}

export function findMemeAdvanceOwnerState(states: ActionState[]) {
	return states.find(
		(state) =>
			isCharacterTarget(state.character) &&
			hasSkillEffect(state.character.name, "M", "memeAdvance"),
	);
}

export function findMemeState(states: ActionState[], ownerId: string) {
	return states.find(
		(state) => state.isMemeState && state.memeOwnerId === ownerId,
	);
}

export function summonMemeState(
	states: ActionState[],
	owner: CharacterConfig,
	actionValue: number,
) {
	if (findMemeState(states, owner.id)) return;
	const rule = getMemeAdvanceRule(owner.name);
	const speed = rule.memospriteSpeed > 0 ? rule.memospriteSpeed : 130;
	states.push({
		character: {
			...owner,
			id: `${owner.id}-meme`,
			kind: "忆灵",
			name: rule.memospriteName,
			speed: String(speed),
			baseSpeed: String(speed),
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
		},
		baseSpeed: speed,
		currentSpeed: speed,
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: actionValue + 10000 / speed,
		blockNextAdvance: false,
		isMemeState: true,
		memeOwnerId: owner.id,
	});
}

export function killMeme(states: ActionState[], actionValue: number) {
	const memeIndex = states.findIndex((state) => state.isMemeState);
	if (memeIndex === -1) return;

	const ownerId = states[memeIndex].memeOwnerId;
	states.splice(memeIndex, 1);
	if (!ownerId) return;

	const owner = states.find((state) => state.character.id === ownerId);
	if (!owner || owner.blockNextAdvance) return;
	const advance = 2500 / owner.currentSpeed;
	owner.nextActionValue = Math.max(actionValue, owner.nextActionValue - advance);
}

// --- Internal state ---

export function getActiveOdeLabels(
	activeOdes: Map<string, ActiveOdeState[]>,
	characterId: string,
) {
	const labels = activeOdes.get(characterId)?.map((effect) => effect.ode.label);
	return labels && labels.length > 0 ? labels : undefined;
}

export function hasActiveOdeEffect(
	activeOdes: Map<string, ActiveOdeState[]>,
	characterId: string,
	effect: string,
) {
	return (
		activeOdes
			.get(characterId)
			?.some((activeOde) => activeOde.ode.effects?.includes(effect)) ?? false
	);
}

export function consumeActionOdes(
	activeOdes: Map<string, ActiveOdeState[]>,
	characterId: string,
	skill: string,
	countTurn: boolean,
) {
	const effects = activeOdes.get(characterId);
	if (!effects) return;
	const nextEffects: ActiveOdeState[] = [];
	for (const effect of effects) {
		if (countTurn && effect.remainingTurns !== undefined) {
			effect.remainingTurns -= 1;
		}
		if (
			effect.remainingAttacks !== undefined &&
			(skill.includes("A") || skill.includes("E") || skill.includes("Q"))
		) {
			effect.remainingAttacks -= 1;
		}
		if (
			effect.ode.code === "sky" &&
			effect.stacks !== undefined &&
			(skill.includes("E") || skill.includes("Q"))
		) {
			effect.stacks -= 1;
		}
		if (effect.remainingTurns !== undefined && effect.remainingTurns <= 0)
			continue;
		if (effect.remainingAttacks !== undefined && effect.remainingAttacks <= 0)
			continue;
		if (effect.stacks !== undefined && effect.stacks <= 0) continue;
		nextEffects.push(effect);
	}
	if (nextEffects.length === 0) activeOdes.delete(characterId);
	else activeOdes.set(characterId, nextEffects);
}

export function findTargetStateById(states: ActionState[], targetId: string) {
	return states.find((state) => state.character.id === targetId);
}

export function applyOdeSelection(
	selection: OdeSelection | undefined,
	cyrene: CharacterConfig,
	states: ActionState[],
	activeOdes: Map<string, ActiveOdeState[]>,
	actionValue: number,
) {
	if (!selection || selection.targetId === cyrene.id) return;
	const rule = getCyreneUltimateRule(cyrene.name);
	const target = findTargetStateById(states, selection.targetId);
	if (!target) return;
	const ode =
		rule.odes.find((candidate) => candidate.code === selection.odeCode) ??
		getOdeRuleForTarget(rule, getCharacterCid(target.character.name));
	if (
		ode.targetCid !== undefined &&
		ode.targetCid !== getCharacterCid(target.character.name)
	) {
		return;
	}

	const effect: ActiveOdeState = { ode };
	if (ode.duration === "nextTurn") effect.remainingTurns = 1;
	if (ode.duration === "turns") effect.remainingTurns = ode.turns ?? 2;
	if (ode.duration === "nextAttack") effect.remainingAttacks = 1;
	if (ode.duration === "stacks") effect.stacks = ode.stacks ?? 1;
	// 浪漫之诗：每次德谬歌 Q 重置充能
	if (ode.effects?.includes("odeToRomance")) {
		effect.romanceCharged = true;
	}
	if (ode.duration !== "extraTurn") {
		// 替换旧的同名 ode（刷新浪漫之诗充能等）
		const existingList = activeOdes.get(selection.targetId) ?? [];
		const filtered = existingList.filter((e) => e.ode.code !== ode.code);
		activeOdes.set(selection.targetId, [...filtered, effect]);
	}

	if (ode.effects?.includes("immediateTurn") && !target.blockNextAdvance) {
		target.nextActionValue = actionValue;
	}
	// 浪漫之诗：使阿格莱雅衣匠层数立刻达到上限
	if (ode.effects?.includes("odeToRomance") && target) {
		const stackLimit = getAglaeaStackLimit(target.character);
		if (stackLimit > 0) {
			syncGarmentmakerStacksToAglaea(states, target.character.id, stackLimit, actionValue);
			const gm = findGarmentmakerState(states, target.character.id);
			if (gm) {
				gm.garmentmakerStacks = stackLimit;
				const rule = getGarmentmakerRule(target.character.name);
				gm.currentSpeed =
					target.currentSpeed * (rule.memospriteSpeed / 100) +
					rule.stackSpeedBonus * stackLimit;
			}
		}
	}
}

export function emitCyreneMemospriteAction({
	input,
	actions,
	states,
	activeOdes,
	cyrene,
	sourceKey,
	actionValue,
}: {
	input: SimulateActionsInput;
	actions: GeneratedAction[];
	states: ActionState[];
	activeOdes: Map<string, ActiveOdeState[]>;
	cyrene: CharacterConfig;
	sourceKey: string;
	actionValue: number;
}) {
	if (!isCharacterTarget(cyrene)) return;
	if (!hasSkillEffect(cyrene.name, "Q", "cyreneUltimate")) return;

	const cyreneRule = getCyreneUltimateRule(cyrene.name);
	const memospriteKey = `${sourceKey}-memosprite-Q`;
	actions.push({
		key: memospriteKey,
		characterId: `${cyrene.id}-memosprite`,
		displayName: cyreneRule.memospriteName,
		targetKind: "忆灵",
		actionNo: 0,
		actionValue,
		skill: cyreneRule.memospriteSkill,
		speed: 0,
		isMemospriteAction: true,
		memospriteOwnerId: cyrene.id,
	});
	applyOdeSelection(
		input.odeSelections[memospriteKey],
		cyrene,
		states,
		activeOdes,
		actionValue,
	);
	const selection = input.odeSelections[memospriteKey];
	const selectedTarget = selection && selection.targetId !== cyrene.id
		? findTargetStateById(states, selection.targetId)
		: undefined;
	const selectedOde =
		selection && selectedTarget
			? (cyreneRule.odes.find((ode) => ode.code === selection.odeCode) ??
				getOdeRuleForTarget(cyreneRule, getCharacterCid(selectedTarget.character.name)))
			: undefined;
	if (selection && selectedOde?.effects?.includes("immediateEnhancedSkill")) {
		if (
			selectedTarget &&
			selectedOde.targetCid === getCharacterCid(selectedTarget.character.name)
		) {
			actions.push({
				key: `${memospriteKey}-ode-${selectedOde.code}`,
				characterId: selectedTarget.character.id,
				actionNo: 0,
				actionValue,
				skill: "E" as SkillCode,
				speed: selectedTarget.currentSpeed,
				isOdeExtraAction: true,
				lockedSkill: true,
				activeOdeLabels: [selectedOde.label],
			});
		}
	}
}

export function emitMemeAdvanceAction({
	input,
	actions,
	states,
	sourceKey,
	actionValue,
	activeOdes,
}: {
	input: SimulateActionsInput;
	actions: GeneratedAction[];
	states: ActionState[];
	sourceKey: string;
	actionValue: number;
	activeOdes: Map<string, ActiveOdeState[]>;
}) {
	const memeKey = `${sourceKey}-meme`;
	const targetId = input.memeSelections[memeKey];
	if (!targetId) return;
	const owner = findMemeAdvanceOwnerState(states);
	if (!owner) return;
	const meme = findMemeState(states, owner.character.id);
	if (!meme) return;
	const target = findTargetStateById(states, targetId);
	if (!target) return;

	const rule = getMemeAdvanceRule(owner.character.name);
	actions.push({
		key: memeKey,
		characterId: meme.character.id,
		displayName: rule.memospriteName,
		targetKind: "忆灵",
		actionNo: meme.actionNo,
		actionValue,
		skill: rule.memospriteSkill,
		speed: meme.currentSpeed,
		isMemospriteAction: true,
		isMemeAction: true,
		memospriteOwnerId: owner.character.id,
		memeOwnerId: owner.character.id,
		activeOdeLabels: getActiveOdeLabels(activeOdes, owner.character.id),
	});

	if (
		target.character.id !== meme.character.id &&
		isAllyTarget(target.character.kind) &&
		!target.blockNextAdvance &&
		target.nextActionValue > actionValue
	) {
		const remainingActionValue = target.nextActionValue - actionValue;
		target.nextActionValue =
			actionValue +
			(remainingActionValue * Math.max(0, 100 - rule.advancePercent)) / 100;
	}
	meme.actionNo += 1;
	meme.nextActionValue = actionValue + 10000 / meme.currentSpeed;
	meme.blockNextAdvance = false;
}



