import { getCharacterCid } from "../data/characters";
import { CHARACTER_IDS } from "../domain/identity";
import type { ActionState, SimulateActionsInput } from "../simulate/types";
import {
	type CharacterConfig,
	type GeneratedAction,
	getCharacterPath,
	isBasicAttackSkill,
	isNonAttackSkill,
	toPositiveNumber,
} from "../utils/action-sequence";
import { getEffectiveCharacterBaseSpeed } from "./lightconeEffects";
import { hasSaber } from "./saber";

export const gilgameshInterestResourceName = "兴致";

export function hasGilgamesh(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === CHARACTER_IDS.gilgamesh;
}

export function getGilgameshBaseSpeed(character: CharacterConfig): number {
	return getEffectiveCharacterBaseSpeed(character);
}

/** 记录一条已生成行动后的吉尔伽美什兴致结算（兴致/速度/与 Saber 的每 8 次连携 Z）。 */
export function handleGilgameshRecordedAction(params: {
	state: ActionState;
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	states: ActionState[];
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	hasSaberInTeam: boolean;
}): void {
	const { state, action, attacker, states, actions, input, hasSaberInTeam } =
		params;
	const isGilgameshAction = action.characterId === state.character.id;
	const isAhaAction = action.isAhaInstant === true;
	const isAhaActionDuringPhainonDomain =
		isAhaAction && states.some((s) => s.domainState !== undefined);
	const actorIsCounted =
		attacker?.kind === "角色" ||
		attacker?.kind === "忆灵" ||
		attacker?.kind === "非忆灵";
	const isPhainonEaOrEw =
		action.isDomainAction && (action.skill === "EA" || action.skill === "EW");
	const isCharacterUltimate = attacker?.kind === "角色" && action.skill === "Q";
	// 白厄的境界退场 Q 只是一段普通行动，不享受 Q 的额外兴致。
	const hasUltimateInterestBonus =
		isCharacterUltimate && action.isDomainFinalAction !== true;
	const manualInterest = Number.parseFloat(
		input.resourceValues?.[action.key]?.[gilgameshInterestResourceName] ?? "",
	);
	let interest = state.gilgameshInterest ?? 0;
	if (action.characterId === "@av0") {
		const initial = Number.parseFloat(
			input.resourceValues?.[action.key]?.[gilgameshInterestResourceName] ?? "",
		);
		if (Number.isFinite(initial)) interest = Math.max(0, initial);
	} else if (!action.isGilgameshComboAction) {
		if (isGilgameshAction) {
			if (action.skill === "E") interest = 0;
		} else if (isAhaAction && !isAhaActionDuringPhainonDomain) {
			interest += input.characters.filter(
				(character) => getCharacterPath(character.name) === "Elation",
			).length;
		} else if (actorIsCounted && !action.isElationSkill)
			interest += isPhainonEaOrEw ? 2 : 1;
		if (hasUltimateInterestBonus) {
			interest += 2;
			if (isGilgameshAction && state.character.eidolon >= 2) interest += 5;
		}
	}
	state.gilgameshInterest = interest;
	action.gilgameshInterest = interest;

	const oldGilgameshSpeed = state.currentSpeed;
	const nextGilgameshSpeed =
		toPositiveNumber(state.character.speed, state.baseSpeed) +
		state.baseSpeed * 0.1 * interest;
	if (nextGilgameshSpeed > 0) {
		const remaining = state.nextActionValue - action.actionValue;
		if (!isGilgameshAction && remaining > 0)
			state.nextActionValue =
				action.actionValue +
				remaining * (oldGilgameshSpeed / nextGilgameshSpeed);
		state.currentSpeed = nextGilgameshSpeed;
	}

	const pairAttack =
		(hasGilgamesh(attacker) || hasSaber(attacker)) &&
		(action.isFuaAction === true ||
			action.isAssistAction === true ||
			isBasicAttackSkill(action.skill) ||
			(attacker !== undefined &&
				!isNonAttackSkill(attacker, action.skill) &&
				input.attackDisabled?.[action.key] !== true));
	if (pairAttack && hasSaberInTeam) {
		const count = (state.gilgameshAttackCount ?? 0) + 1;
		state.gilgameshAttackCount = count;
		if (count % 8 === 0) {
			const speedBeforeComboBonus = state.currentSpeed;
			state.gilgameshInterest += 3;
			const speedAfterComboBonus =
				toPositiveNumber(state.character.speed, state.baseSpeed) +
				state.baseSpeed * 0.1 * state.gilgameshInterest;
			const remaining = state.nextActionValue - action.actionValue;
			if (!isGilgameshAction && remaining > 0)
				state.nextActionValue =
					action.actionValue +
					remaining * (speedBeforeComboBonus / speedAfterComboBonus);
			state.currentSpeed = speedAfterComboBonus;
			action.gilgameshInterest = state.gilgameshInterest;
			actions.push({
				key: `${action.key}-gilgamesh-combo-fua`,
				characterId: state.character.id,
				displayName: state.character.name,
				actionNo: 0,
				actionValue: action.actionValue,
				skill: "Z",
				speed: state.currentSpeed,
				isFuaAction: true,
				isGilgameshComboAction: true,
				lockedSkill: true,
				gilgameshInterest: state.gilgameshInterest,
			});
		}
	}
	// 手动输入值表示当前行动结算后的最终兴致，覆盖本次行动的自动结算结果。
	if (Number.isFinite(manualInterest)) {
		const nextInterest = Math.max(0, manualInterest);
		const oldSpeed = state.currentSpeed;
		state.gilgameshInterest = nextInterest;
		if (nextInterest >= 10) state.gilgameshEUnlocked = true;
		action.gilgameshInterest = nextInterest;
		const nextSpeed =
			toPositiveNumber(state.character.speed, state.baseSpeed) +
			state.baseSpeed * 0.1 * nextInterest;
		if (nextSpeed > 0) {
			const remaining = state.nextActionValue - action.actionValue;
			if (!isGilgameshAction && remaining > 0)
				state.nextActionValue =
					action.actionValue + remaining * (oldSpeed / nextSpeed);
			state.currentSpeed = nextSpeed;
		}
	}
	if ((state.gilgameshInterest ?? 0) >= 10) {
		state.gilgameshEUnlocked = true;
	}
}
