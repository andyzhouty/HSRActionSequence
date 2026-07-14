import { getEffectiveCharacterBaseSpeed } from "../../mechanics/baseSpeed";
import type { CharacterConfig } from "../../utils/actionSequence";
import {
	formatEditableNumber,
	type GeneratedAction,
	getCounterWDomainRule,
	type SpeedAdjustment,
	type SpeedChangeMode,
} from "../../utils/actionSequence";

type CharacterLookup = Record<string, CharacterConfig>;

function getPhainonDomainEquivalentSpeed(
	action: GeneratedAction,
	character: CharacterConfig | undefined,
) {
	if (!character) return action.speed;
	const domainRule = getCounterWDomainRule(character.name);
	const baseSpeed =
		getEffectiveCharacterBaseSpeed(character) || domainRule.defaultBaseSpeed;
	const coeff =
		character.eidolon >= 1
			? domainRule.eidolon1EquivalentSpeedCoefficient
			: domainRule.normalEquivalentSpeedCoefficient;
	return baseSpeed * coeff;
}

function getPreviousDomainActionValue(
	action: GeneratedAction,
	actions: GeneratedAction[],
) {
	const match = action.key.match(/^(.*-domain-)(\d+)$/);
	if (!match) return action.actionValue;
	const previousIndex = Number.parseInt(match[2], 10) - 1;
	if (!Number.isFinite(previousIndex) || previousIndex < 0) {
		return action.actionValue;
	}
	const previousAction = actions.find(
		(candidate) => candidate.key === `${match[1]}${previousIndex}`,
	);
	return previousAction?.actionValue ?? action.actionValue;
}

function getAdvancedActionValue(
	action: GeneratedAction,
	value: number,
	actionSpeed: number,
	actions: GeneratedAction[],
) {
	if (action.isDomainAction && value > 0) {
		const lowerBound = getPreviousDomainActionValue(action, actions);
		const remainingActionValue = Math.max(0, action.actionValue - lowerBound);
		const shifted =
			action.actionValue - (remainingActionValue * Math.min(value, 100)) / 100;
		return Math.max(lowerBound, shifted);
	}
	if (value > 0) {
		return action.actionValue * (1 - value / 100);
	}
	return action.actionValue - (value * 100) / actionSpeed;
}

export function buildAdvanceOverrides(params: {
	actions: GeneratedAction[];
	charactersById: CharacterLookup;
	displayedActionLimit: number;
	prevOverrides: Record<string, string>;
	selectedActions: GeneratedAction[];
	value: number;
	ceilingAV: number;
}) {
	const {
		actions,
		charactersById,
		displayedActionLimit,
		prevOverrides,
		selectedActions,
		value,
		ceilingAV,
	} = params;
	const next = { ...prevOverrides };
	for (const action of selectedActions) {
		if (action.isDomainAction && value <= 0) continue;
		const actionSpeed = action.isDomainAction
			? getPhainonDomainEquivalentSpeed(
					action,
					charactersById[action.characterId],
				)
			: action.speed;
		next[action.key] = formatEditableNumber(
			Math.min(
				displayedActionLimit,
				Math.max(
					ceilingAV,
					getAdvancedActionValue(action, value, actionSpeed, actions),
				),
			),
		);
	}
	return next;
}

export function hasMissingRelativeBaseSpeed(params: {
	charactersById: CharacterLookup;
	operationSpeedMode: SpeedChangeMode;
	selectedActions: GeneratedAction[];
}) {
	const { charactersById, operationSpeedMode, selectedActions } = params;
	return selectedActions.some((action) => {
		const character = charactersById[action.characterId];
		return (
			operationSpeedMode === "relative" &&
			character !== undefined &&
			getEffectiveCharacterBaseSpeed(character) <= 0
		);
	});
}

export function buildSpeedAdjustments(params: {
	operationSpeedMode: SpeedChangeMode;
	operationValue: string;
	prevAdjustments: Record<string, SpeedAdjustment>;
	selectedActions: GeneratedAction[];
}) {
	const {
		operationSpeedMode,
		operationValue,
		prevAdjustments,
		selectedActions,
	} = params;
	const next = { ...prevAdjustments };
	for (const action of selectedActions) {
		next[action.key] = {
			value: operationValue,
			mode: operationSpeedMode,
		};
	}
	return next;
}
