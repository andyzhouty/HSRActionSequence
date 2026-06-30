import { getCharacterPath, hasSkillEffect } from "../data/characters";
import {
	type CharacterConfig,
	canUseSkillCode,
	characterNameMatchesAliases,
	type GeneratedAction,
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
} from "./actionSequence";
import {
	findGarmentmakerState,
	getAglaeaStackLimit,
	syncGarmentmakerStacksToAglaea,
} from "./aglaeaGarmentmaker";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./simulateTypes";

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
	if (!selection) return;
	const rule = getCyreneUltimateRule(cyrene.name);
	const target = findTargetStateById(states, selection.targetId);
	if (!target) return;
	const ode =
		rule.odes.find((candidate) => candidate.code === selection.odeCode) ??
		getOdeRuleForTarget(rule, target.character.name);
	if (
		ode.targetNames.length > 0 &&
		!characterNameMatchesAliases(target.character.name, ode.targetNames)
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
	const selectedTarget = selection
		? findTargetStateById(states, selection.targetId)
		: undefined;
	const selectedOde =
		selection && selectedTarget
			? (cyreneRule.odes.find((ode) => ode.code === selection.odeCode) ??
				getOdeRuleForTarget(cyreneRule, selectedTarget.character.name))
			: undefined;
	if (selection && selectedOde?.effects?.includes("immediateEnhancedSkill")) {
		if (
			selectedTarget &&
			characterNameMatchesAliases(
				selectedTarget.character.name,
				selectedOde.targetNames,
			)
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
		isCharacterTarget(target.character) &&
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
