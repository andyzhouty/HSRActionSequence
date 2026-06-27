import { hasPassive, hasSkillEffect } from "../data/characters";
import {
	type CharacterConfig,
	canUseSkillCode,
	type GeneratedAction,
	isCharacterTarget,
	type SkillCode,
	type SpeedAdjustment,
	toPositiveNumber,
	toSignedNumber,
	type UltInterrupt,
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
	ultInterrupts: Record<string, UltInterrupt[]>;
};

// --- Internal helpers ---

function toNonNegativeNumber(
	value: string | undefined,
	fallback: number,
): number {
	if (value === undefined || value === "") return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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
			const speedBonus = baseSpeed * 0.15;
			state.phainonDomainSpeedBonus = speedBonus;
			state.currentSpeed += speedBonus;
		}
		state.nextActionValue =
			domainEndActionValue + remainingActionDistance / state.currentSpeed;
	}
}

function getPhainonDomainInterval(character: CharacterConfig, actionSpeed: number) {
	const v0 =
		toPositiveNumber(character.baseSpeed, 0) > 0
			? toPositiveNumber(character.baseSpeed, actionSpeed)
			: 106.0;
	const coeff = character.hasEidolon1 ? 0.66 : 0.6;
	return (10000 / v0) / coeff / 7;
}

function getPhainonDomainEndIndex(
	actionKeyPrefix: string,
	domainEndOverrides: Record<string, boolean>,
) {
	for (let i = 0; i < 8; i++) {
		if (domainEndOverrides[`${actionKeyPrefix}-domain-${i}`]) return i;
	}
	return 7;
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
			const firstActionValue = (10000 * (1 - advancePct)) / speed;

			return {
				character,
				baseSpeed:
				toPositiveNumber(character.baseSpeed, 0) > 0
					? toPositiveNumber(character.baseSpeed, speed)
					: hasSkillEffect(character.name, "W", "counterW")
						? 106.0
						: speed,
				currentSpeed: speed,
				phainonDomainSpeedBonus: 0,
				actionNo: 1,
				nextActionValue: firstActionValue,
				blockNextAdvance: false,
			};
		});

	const actions: GeneratedAction[] = [];
	let guard = 0;

	while (states.length > 0 && guard < 400) {
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

		const skill = getActionSkill(
			character,
			actionNo,
			key,
			input.skillOverrides,
			input.legacyUltOverrides,
		);
		const usesUltimate = skill.includes("Q");
		const qIsFront = skill.length > 1 && skill.startsWith("Q");
		const actionSpeed = states[stateIndex].currentSpeed;

		const interrupts = input.ultInterrupts[key] ?? [];

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
			});
			// 插队大招触发舞舞舞
			if (isCharacterTarget(caster.character) && caster.character.hasDance) {
				const adv = 2400 / casterSpeed;
				for (const teammate of states) {
					if (!canBeAdvancedByDance(teammate.character.kind)) continue;
					if (teammate.blockNextAdvance) continue;
					teammate.nextActionValue = Math.max(
						actionValue,
						teammate.nextActionValue - adv,
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
				const domainInterval = getPhainonDomainInterval(
					caster.character,
					casterSpeed,
				);
				const domainKeyPrefix = `${key}-interrupt-${idx}`;
				const domainEndIndex = getPhainonDomainEndIndex(
					domainKeyPrefix,
					input.domainEndOverrides,
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
							? ("Q" as SkillCode)
							: ((input.skillOverrides[domainKey] ?? "") as SkillCode),
						speed: casterSpeed,
						isDomainAction: true,
						isDomainFinalAction,
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
				);
			}
		};

		// 按 timing 分组处理
		const beforeInterrupts = interrupts.filter((i) => i.timing === "before");
		const afterInterrupts = interrupts.filter((i) => i.timing === "after");

		// 行动前插队（按添加顺序逐个执行）
		for (let i = 0; i < beforeInterrupts.length; i++) {
			emitInterrupt(interrupts.indexOf(beforeInterrupts[i]));
		}
		if (beforeInterrupts.length > 0) {
			states[stateIndex].blockNextAdvance = true;
		}

		actions.push({
			key,
			characterId: character.id,
			actionNo,
			actionValue,
			skill: skill as SkillCode,
			speed: actionSpeed,
		});

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
			const domainInterval = getPhainonDomainInterval(
				character,
				actionSpeed,
			);
			const startAV = actionValue;
			const domainEndIndex = getPhainonDomainEndIndex(
				key,
				input.domainEndOverrides,
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
						? ("Q" as SkillCode)
						: ((input.skillOverrides[domainKey] ?? "") as SkillCode),
					speed: states[stateIndex].currentSpeed,
					isDomainAction: true,
					isDomainFinalAction,
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

			// Dance Dance Dance
			if (
				isCharacterTarget(character) &&
				character.hasDance &&
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
				const targetId = input.skillTargets[key];
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
				const targetId = input.skillTargets[key];
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
		for (let i = 0; i < afterInterrupts.length; i++) {
			emitInterrupt(interrupts.indexOf(afterInterrupts[i]));
		}
	}

	return actions;
}
