import { hasPassive, hasSkillEffect } from "../data/characters";
import {
	type CharacterConfig,
	canUseSkillCode,
	characterNameMatchesAliases,
	type GeneratedAction,
	getCounterWDomainRule,
	getCyreneUltimateRule,
	getMemeAdvanceRule,
	getOdeRuleForTarget,
	isCharacterTarget,
	type SkillCode,
	type SpeedAdjustment,
	toPositiveNumber,
	toSignedNumber,
	type UltInterrupt,
	normalizeActionValue,
	type OdeRule,
	type OdeSelection,
	shouldRememberSkillTarget,
} from "./actionSequence";

export type SimulateActionsInput = {
	characters: CharacterConfig[];
	limit: number;
	overrides: Record<string, string>;
	skillOverrides: Record<string, SkillCode>;
	domainEndOverrides: Record<string, boolean>;
	legacyUltOverrides: Record<string, boolean>;
	speedAdjustments: Record<string, SpeedAdjustment>;
	skillTargets: Record<string, string>;
	defaultSkillTargets: Record<string, string>;
	odeSelections: Record<string, OdeSelection>;
	memeSelections: Record<string, string>;
	ultInterrupts: Record<string, UltInterrupt[]>;
};

// --- Internal helpers ---

function toNonNegativeNumber(
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

function toPositiveInteger(value: string, fallback: number): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function canBeAdvancedByDance(kind: string): boolean {
	return kind === "角色" || kind === "忆灵";
}

function isAllyTarget(kind: string): boolean {
	return kind === "角色" || kind === "忆灵";
}

function isUltimateAction(
	character: CharacterConfig,
	actionNo: number,
): boolean {
	if (!isCharacterTarget(character)) return false;
	const cycle = toPositiveInteger(character.ultCycle, 0);
	const offset = toPositiveInteger(character.ultOffset, cycle || 0);
	if (cycle === 0 || offset === 0 || actionNo < offset) return false;
	return (actionNo - offset) % cycle === 0;
}

function getDefaultSkill(character: CharacterConfig, actionNo: number): string {
	return isUltimateAction(character, actionNo) ? "Q" : "";
}

function getActionSkill(
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

function getNextSpeed(
	currentSpeed: number,
	baseSpeed: number,
	adjustment: SpeedAdjustment | undefined,
): number {
	if (!adjustment) return currentSpeed;
	const value = toSignedNumber(adjustment.value, 0);
	const nextSpeed =
		adjustment.mode === "relative"
			? currentSpeed - (baseSpeed * value) / 100
			: currentSpeed - value;
	return nextSpeed > 0 ? nextSpeed : currentSpeed;
}

function expirePhainonDomainSpeedBonus(
	states: ActionState[],
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

function applyPhainonDomainPauseAndSpeedBonus(
	states: ActionState[],
	casterIndex: number,
	startActionValue: number,
	domainEndActionValue: number,
	speedBonusBaseSpeedRatio: number,
) {
	for (let index = 0; index < states.length; index++) {
		const state = states[index];
		if (!isAllyTarget(state.character.kind)) continue;

		const remainingActionDistance =
			Math.max(
				0,
				state.nextActionValue -
					(index === casterIndex ? domainEndActionValue : startActionValue),
			) * state.currentSpeed;
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

function getPhainonDomainInterval(character: CharacterConfig, actionSpeed: number) {
	const domainRule = getCounterWDomainRule(character.name);
	const v0 =
		toPositiveNumber(character.baseSpeed, 0) > 0
			? toPositiveNumber(character.baseSpeed, actionSpeed)
			: domainRule.defaultBaseSpeed;
	const coeff = character.hasEidolon1
		? domainRule.eidolon1EquivalentSpeedCoefficient
		: domainRule.normalEquivalentSpeedCoefficient;
	return (10000 / v0) / coeff / Math.max(1, domainRule.extraActionCount - 1);
}

function getPhainonDomainEndIndex(
	actionKeyPrefix: string,
	domainEndOverrides: Record<string, boolean>,
	maxDomainActionIndex: number,
) {
	for (let i = 0; i <= maxDomainActionIndex; i++) {
		if (domainEndOverrides[`${actionKeyPrefix}-domain-${i}`]) return i;
	}
	return maxDomainActionIndex;
}

function getSkillTarget(
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

function findHimekoNovaAssistState(
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

function findMemeAdvanceOwnerState(states: ActionState[]) {
	return states.find(
		(state) =>
			isCharacterTarget(state.character) &&
			hasSkillEffect(state.character.name, "M", "memeAdvance"),
	);
}

function findMemeState(states: ActionState[], ownerId: string) {
	return states.find(
		(state) => state.isMemeState && state.memeOwnerId === ownerId,
	);
}

function summonMemeState(
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
			hasEidolon1: false,
			ultCycle: "",
			ultOffset: "",
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

interface ActionState {
	character: CharacterConfig;
	baseSpeed: number;
	currentSpeed: number;
	phainonDomainSpeedBonus: number;
	actionNo: number;
	nextActionValue: number;
	blockNextAdvance: boolean;
	isMemeState?: boolean;
	memeOwnerId?: string;
}

type ActiveOdeState = {
	ode: OdeRule;
	remainingTurns?: number;
	remainingAttacks?: number;
	stacks?: number;
};

function getActiveOdeLabels(
	activeOdes: Map<string, ActiveOdeState[]>,
	characterId: string,
) {
	const labels = activeOdes.get(characterId)?.map((effect) => effect.ode.label);
	return labels && labels.length > 0 ? labels : undefined;
}

function hasActiveOdeEffect(
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

function consumeActionOdes(
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

function findTargetStateById(states: ActionState[], targetId: string) {
	return states.find((state) => state.character.id === targetId);
}

function applyOdeSelection(
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
	if (ode.duration !== "extraTurn") {
		activeOdes.set(selection.targetId, [
			...(activeOdes.get(selection.targetId) ?? []),
			effect,
		]);
	}

	if (ode.effects?.includes("immediateTurn") && !target.blockNextAdvance) {
		target.nextActionValue = actionValue;
	}
}

function emitCyreneMemospriteAction({
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

function emitMemeAdvanceAction({
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
	if (!target || !isCharacterTarget(target.character)) return;

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

	if (!target.blockNextAdvance && target.nextActionValue > actionValue) {
		const remainingActionValue = target.nextActionValue - actionValue;
		target.nextActionValue =
			actionValue +
			(remainingActionValue * Math.max(0, 100 - rule.advancePercent)) / 100;
	}
	meme.actionNo += 1;
	meme.nextActionValue = actionValue + 10000 / meme.currentSpeed;
	meme.blockNextAdvance = false;
}

// --- Main simulation ---

export function simulateActions(
	input: SimulateActionsInput,
): GeneratedAction[] {
	const states: ActionState[] = input.characters
		.filter((c) => toPositiveNumber(c.speed, 0) > 0)
		.map((character) => {
			const speed = toPositiveNumber(character.speed, 0);
			let advancePct = 0;
			if (isCharacterTarget(character) && character.hasVonwacq)
				advancePct += 0.4;
			if (hasPassive(character.name, "firstActionAdvance25"))
				advancePct += 0.25;
			if (hasPassive(character.name, "firstActionAdvance30"))
				advancePct += 0.3;
			const firstActionValue = (10000 * (1 - advancePct)) / speed;

			return {
				character,
				baseSpeed:
				toPositiveNumber(character.baseSpeed, 0) > 0
					? toPositiveNumber(character.baseSpeed, speed)
					: hasSkillEffect(character.name, "W", "counterW")
						? getCounterWDomainRule(character.name).defaultBaseSpeed
						: speed,
				currentSpeed: speed,
				phainonDomainSpeedBonus: 0,
				actionNo: 1,
				nextActionValue: firstActionValue,
				blockNextAdvance: false,
			};
		});

	const actions: GeneratedAction[] = [];
	const activeOdes = new Map<string, ActiveOdeState[]>();
	let guard = 0;

	while (states.length > 0 && guard < 2000) {
		guard += 1;

		// Build candidates
		const candidates = states.map((state, stateIndex) => {
			const key = `${state.character.id}-${state.actionNo}`;
			return {
				stateIndex,
				key,
				actionValue: toNonNegativeNumber(
					input.overrides[key],
					state.nextActionValue,
				),
			};
		});

		// Sort by action value, then by character id
		candidates.sort((a, b) => {
			if (a.actionValue !== b.actionValue) return a.actionValue - b.actionValue;
			return states[a.stateIndex].character.id.localeCompare(
				states[b.stateIndex].character.id,
			);
		});

		const next = candidates[0];
		if (!next) break;
		if (next.actionValue > input.limit) break;

		const stateIndex = next.stateIndex;
		const key = next.key;
		const actionValue = next.actionValue;
		const character = states[stateIndex].character;
		const actionNo = states[stateIndex].actionNo;
		const shouldClearAdvanceBlock = states[stateIndex].blockNextAdvance;

		const rawSkill = getActionSkill(
			character,
			actionNo,
			key,
			input.skillOverrides,
			input.legacyUltOverrides,
		);
		const himekoNovaAssist =
			rawSkill.includes("F") &&
			isAllyTarget(character.kind) &&
			!hasSkillEffect(character.name, "F", "himekoNovaAssist")
				? findHimekoNovaAssistState(states, character.id)
				: undefined;
		const skill = rawSkill.replace(/F/g, "") as SkillCode;
		const assistUseCount = rawSkill.match(/F/g)?.length ?? 0;
		const skipAssistFollowUp =
			himekoNovaAssist !== undefined && assistUseCount >= 2;
		const usesUltimate = skill.includes("Q");
		const qIsFront = skill.length > 1 && skill.startsWith("Q");
		const actionSpeed = states[stateIndex].currentSpeed;

		const interrupts = input.ultInterrupts[key] ?? [];
		let pendingAssistFollowUpAdvance = 0;

		// 插队大招：在目标行动前/后插入多个施法者的大招行动
		const emitInterrupt = (idx: number) => {
			const int = interrupts[idx];
			if (!int) return;
			const casterIndex = states.findIndex(
				(s) => s.character.id === int.casterId,
			);
			if (casterIndex === -1) return;
			const caster = states[casterIndex];
			const casterSpeed = caster.currentSpeed;
			actions.push({
				key: `${key}-interrupt-${idx}`,
				characterId: caster.character.id,
				actionNo: 0,
				actionValue,
				skill: "Q" as SkillCode,
				speed: casterSpeed,
				activeOdeLabels: getActiveOdeLabels(activeOdes, caster.character.id),
			});
			emitMemeAdvanceAction({
				input,
				actions,
				states,
				sourceKey: `${key}-interrupt-${idx}`,
				actionValue,
				activeOdes,
			});
			consumeActionOdes(activeOdes, caster.character.id, "Q", false);
			if (hasSkillEffect(caster.character.name, "Q", "cyreneUltimate")) {
				emitCyreneMemospriteAction({
					input,
					actions,
					states,
					activeOdes,
					cyrene: caster.character,
					sourceKey: `${key}-interrupt-${idx}`,
					actionValue,
				});
			}
			// 插队大招触发舞舞舞
			if (
				isCharacterTarget(caster.character) &&
				caster.character.hasDance &&
				!hasSkillEffect(caster.character.name, "W", "counterW")
			) {
				const adv = 2400 / casterSpeed;
				for (
					let teammateIndex = 0;
					teammateIndex < states.length;
					teammateIndex++
				) {
					const teammate = states[teammateIndex];
					if (!canBeAdvancedByDance(teammate.character.kind)) continue;
					if (teammate.blockNextAdvance) continue;
					if (
						himekoNovaAssist &&
						!skipAssistFollowUp &&
						teammateIndex === stateIndex &&
						teammate.nextActionValue <= actionValue
					) {
						pendingAssistFollowUpAdvance += adv;
						continue;
					}
					teammate.nextActionValue = Math.max(
						actionValue,
						teammate.nextActionValue - adv,
					);
				}
			}
			if (isCharacterTarget(caster.character) && caster.character.hasWindSet) {
				const windAdvance = 2500 / casterSpeed;
				if (
					himekoNovaAssist &&
					!skipAssistFollowUp &&
					casterIndex === stateIndex &&
					caster.nextActionValue <= actionValue
				) {
					pendingAssistFollowUpAdvance += windAdvance;
				} else if (!caster.blockNextAdvance) {
					caster.nextActionValue = Math.max(
						actionValue,
						caster.nextActionValue - windAdvance,
					);
				}
			}
			if (isAllyTarget(caster.character.kind)) {
				expirePhainonDomainSpeedBonus(states, actionValue);
			}
			// 插队大招触发角色 Q 特殊效果（知更鸟全队顶轴）
			if (hasSkillEffect(caster.character.name, "Q", "robinUltimate")) {
				caster.currentSpeed = 90;
				caster.nextActionValue = actionValue + 10000 / caster.currentSpeed;
				caster.blockNextAdvance = true;
				const allyOrder = states
					.map((s, i) => ({ index: i, value: s.nextActionValue }))
					.filter(
						({ index }) =>
							index !== casterIndex &&
							isAllyTarget(states[index].character.kind),
					)
					.sort((a, b) => {
						if (a.value !== b.value) return a.value - b.value;
						return a.index - b.index;
					});
				for (let rank = 0; rank < allyOrder.length; rank++) {
					states[allyOrder[rank].index].nextActionValue =
						actionValue + rank * 0.0001;
				}
			}
			// 插队大招触发白厄境界
			if (hasSkillEffect(caster.character.name, "W", "counterW")) {
				const domainRule = getCounterWDomainRule(caster.character.name);
				const domainInterval = getPhainonDomainInterval(
					caster.character,
					casterSpeed,
				);
				const domainKeyPrefix = `${key}-interrupt-${idx}`;
				const isEndlessDomain = hasActiveOdeEffect(
					activeOdes,
					caster.character.id,
					"endlessCounterWDomain",
				);
				const maxDomainActionIndex = isEndlessDomain
					? Math.max(0, Math.ceil((input.limit - actionValue) / domainInterval))
					: Math.max(0, domainRule.extraActionCount - 1);
				const domainEndIndex = getPhainonDomainEndIndex(
					domainKeyPrefix,
					input.domainEndOverrides,
					maxDomainActionIndex,
				);
				let lastDomainAV = actionValue;
				for (let i = 0; i <= domainEndIndex; i++) {
					const domainKey = `${domainKeyPrefix}-domain-${i}`;
					const domainAV = toNonNegativeNumber(
						input.overrides[domainKey],
						actionValue + domainInterval * i,
					);
					const isDomainFinalAction = i === domainEndIndex;
					if (isDomainFinalAction) lastDomainAV = domainAV;
					actions.push({
						key: domainKey,
						characterId: caster.character.id,
						actionNo: i + 1,
						actionValue: domainAV,
						skill: isDomainFinalAction
							? domainRule.finalSkill
							: ((input.skillOverrides[domainKey] ?? "") as SkillCode),
						speed: casterSpeed,
						isDomainAction: true,
						isDomainFinalAction,
						activeOdeLabels: getActiveOdeLabels(
							activeOdes,
							caster.character.id,
						),
					});
				}
				// 境界结束后白厄下一动
				caster.nextActionValue =
					lastDomainAV + 10000 / caster.currentSpeed;
				caster.actionNo += 1;
				applyPhainonDomainPauseAndSpeedBonus(
					states,
					casterIndex,
					actionValue,
					lastDomainAV,
					domainRule.endSpeedBonusBaseSpeedRatio,
				);
			}
		};

		// 按 timing 分组处理
		const beforeInterrupts = interrupts.filter((i) => i.timing === "before");
		const afterInterrupts = interrupts.filter((i) => i.timing === "after");

		if (himekoNovaAssist) {
			for (let assistIndex = 1; assistIndex <= Math.min(assistUseCount, 2); assistIndex++) {
				const assistKey =
					assistIndex === 1
						? `${key}-assist-F`
						: `${key}-assist-F-${assistIndex}`;
				actions.push({
					key: assistKey,
					characterId: himekoNovaAssist.character.id,
					actionNo: 0,
					actionValue,
					skill: "F" as SkillCode,
					speed: himekoNovaAssist.currentSpeed,
					isAssistAction: true,
					assistSourceKey: key,
					assistIndex,
					activeOdeLabels: getActiveOdeLabels(
						activeOdes,
						himekoNovaAssist.character.id,
					),
				});
				emitMemeAdvanceAction({
					input,
					actions,
					states,
					sourceKey: assistKey,
					actionValue,
					activeOdes,
				});
				expirePhainonDomainSpeedBonus(states, actionValue);
			}
		}

		if (!states[stateIndex].isMemeState) {
			emitMemeAdvanceAction({
				input,
				actions,
				states,
				sourceKey: key,
				actionValue,
				activeOdes,
			});
		}

		// 行动前插队（按添加顺序逐个执行）
		if (!skipAssistFollowUp) {
			for (let i = 0; i < beforeInterrupts.length; i++) {
				emitInterrupt(interrupts.indexOf(beforeInterrupts[i]));
			}
			if (beforeInterrupts.length > 0) {
				states[stateIndex].blockNextAdvance = true;
			}
		}

		if (!skipAssistFollowUp) {
			actions.push({
				key,
				characterId: character.id,
				displayName: states[stateIndex].isMemeState
					? character.name
					: undefined,
				targetKind: states[stateIndex].isMemeState ? "忆灵" : undefined,
				actionNo,
				actionValue,
				skill: skill as SkillCode,
				speed: actionSpeed,
				isAssistFollowUp: himekoNovaAssist !== undefined,
				isMemospriteAction: states[stateIndex].isMemeState,
				memospriteOwnerId: states[stateIndex].memeOwnerId,
				activeOdeLabels: getActiveOdeLabels(activeOdes, character.id),
			});
			consumeActionOdes(activeOdes, character.id, skill, true);
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "Q", "cyreneUltimate") &&
				usesUltimate
			) {
				emitCyreneMemospriteAction({
					input,
					actions,
					states,
					activeOdes,
					cyrene: character,
					sourceKey: key,
					actionValue,
				});
			}
		}

		// Apply speed adjustment
		states[stateIndex].currentSpeed = getNextSpeed(
			states[stateIndex].currentSpeed,
			states[stateIndex].baseSpeed,
			input.speedAdjustments[key],
		);
		if (isAllyTarget(character.kind)) {
			expirePhainonDomainSpeedBonus(states, actionValue);
		}

		// ── 白厄 Q 境界 ──
		if (
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "W", "counterW") &&
			skill.includes("Q")
		) {
			const domainRule = getCounterWDomainRule(character.name);
			const domainInterval = getPhainonDomainInterval(
				character,
				actionSpeed,
			);
			const startAV = actionValue;
			const isEndlessDomain = hasActiveOdeEffect(
				activeOdes,
				character.id,
				"endlessCounterWDomain",
			);
			const maxDomainActionIndex = isEndlessDomain
				? Math.max(0, Math.ceil((input.limit - startAV) / domainInterval))
				: Math.max(0, domainRule.extraActionCount - 1);
			const domainEndIndex = getPhainonDomainEndIndex(
				key,
				input.domainEndOverrides,
				maxDomainActionIndex,
			);

			let lastDomainAV = startAV;
			for (let i = 0; i <= domainEndIndex; i++) {
				const domainKey = `${key}-domain-${i}`;
				const domainAV = toNonNegativeNumber(
					input.overrides[domainKey],
					startAV + domainInterval * i,
				);
				const isDomainFinalAction = i === domainEndIndex;
				if (isDomainFinalAction) lastDomainAV = domainAV;
				actions.push({
					key: domainKey,
					characterId: character.id,
					actionNo: i + 1,
					actionValue: domainAV,
					skill: isDomainFinalAction
						? domainRule.finalSkill
						: ((input.skillOverrides[domainKey] ?? "") as SkillCode),
					speed: states[stateIndex].currentSpeed,
					isDomainAction: true,
					isDomainFinalAction,
					activeOdeLabels: getActiveOdeLabels(activeOdes, character.id),
				});
			}

			// 境界结束后白厄的下一动
			const normalInterval = 10000 / states[stateIndex].currentSpeed;
			states[stateIndex].actionNo += 1;
			states[stateIndex].nextActionValue = lastDomainAV + normalInterval;

			applyPhainonDomainPauseAndSpeedBonus(
				states,
				stateIndex,
				startAV,
				lastDomainAV,
				domainRule.endSpeedBonusBaseSpeedRatio,
			);
		} else {
			// ── 正常下一动间隔 ──
			const nextInterval =
				isCharacterTarget(character) &&
				character.hasWindSet &&
				usesUltimate &&
				!qIsFront
					? 7500 / states[stateIndex].currentSpeed
					: 10000 / states[stateIndex].currentSpeed;
			states[stateIndex].actionNo += 1;
			states[stateIndex].nextActionValue = actionValue + nextInterval;
			if (pendingAssistFollowUpAdvance > 0) {
				states[stateIndex].nextActionValue = Math.max(
					actionValue,
					states[stateIndex].nextActionValue - pendingAssistFollowUpAdvance,
				);
			}

			// Dance Dance Dance
			if (
				isCharacterTarget(character) &&
				character.hasDance &&
				!hasSkillEffect(character.name, "W", "counterW") &&
				usesUltimate &&
				!qIsFront
			) {
				const advance = 2400 / actionSpeed;
				for (const teammate of states) {
					if (!canBeAdvancedByDance(teammate.character.kind)) continue;
					if (teammate.blockNextAdvance) continue;
					teammate.nextActionValue = Math.max(
						actionValue,
						teammate.nextActionValue - advance,
					);
				}
			}

			// Bronya A: self advance 30%
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "A", "selfAdvance30") &&
				skill.includes("A")
			) {
				const advance = 3000 / actionSpeed;
				if (!states[stateIndex].blockNextAdvance) {
					states[stateIndex].nextActionValue = Math.max(
						actionValue,
						states[stateIndex].nextActionValue - advance,
					);
				}
			}

			// Bronya/Sunday E: pull target to current action value
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "E", "allyPullToCurrent") &&
				skill.includes("E")
			) {
				const targetId = getSkillTarget(input, key, character);
				if (targetId) {
					for (const teammate of states) {
						if (
							teammate.character.id === targetId &&
							!teammate.blockNextAdvance
						) {
							teammate.nextActionValue = actionValue;
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
							teammate.nextActionValue = Math.max(
								actionValue,
								teammate.nextActionValue - advance,
							);
						}
					}
				}
			}

			// Memory Trailblazer E: summon Meme as a 130-speed memosprite.
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "E", "summonMeme") &&
				skill.includes("E")
			) {
				summonMemeState(states, character, actionValue);
			}

			// Robin Q: speed to 90, reset allies, block advance
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "Q", "robinUltimate") &&
				usesUltimate
			) {
				states[stateIndex].currentSpeed = 90;
				states[stateIndex].nextActionValue =
					actionValue + 10000 / states[stateIndex].currentSpeed;
				states[stateIndex].blockNextAdvance = true;

				const allyOrder = states
					.map((s, i) => ({ index: i, value: s.nextActionValue }))
					.filter(
						({ index }) =>
							index !== stateIndex &&
							isAllyTarget(states[index].character.kind),
					)
					.sort((a, b) => {
						if (a.value !== b.value) return a.value - b.value;
						return a.index - b.index;
					});

				for (let rank = 0; rank < allyOrder.length; rank++) {
					states[allyOrder[rank].index].nextActionValue =
						actionValue + rank * 0.0001;
				}
			}
		}		// Clear advance block
		if (shouldClearAdvanceBlock) {
			states[stateIndex].blockNextAdvance = false;
		}

		// 行动后插队（按添加顺序逐个执行）
		if (!skipAssistFollowUp) {
			for (let i = 0; i < afterInterrupts.length; i++) {
				emitInterrupt(interrupts.indexOf(afterInterrupts[i]));
			}
		}
	}

	return actions;
}
