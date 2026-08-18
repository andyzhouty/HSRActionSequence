import { handleArcherRecordedAction, hasArcher } from "../../mechanics/archer";
import {
	handleCompanionFollowUpRecordedAction,
	hasAshveil,
	hasKafka,
} from "../../mechanics/companionFollowUp";
import {
	handleGilgameshRecordedAction,
	hasGilgamesh,
} from "../../mechanics/gilgamesh";
import {
	applyElationLightconeSpeedBuff,
	ELATION_LIGHTCONE_ID,
} from "../../mechanics/lightconeEffects";
import { hasSaber } from "../../mechanics/saber";
import { hasSilverWolfGodmode, isInGodmode } from "../../mechanics/silverWolf";
import {
	handleSpAventurineRecordedAction,
	hasSpAventurine,
} from "../../mechanics/spAventurine";
import {
	handleSpBladeRecordedAction,
	hasSpBlade,
	maybeActivateSpBladeFury,
} from "../../mechanics/spBlade";
import {
	handleTheHertaRecordedAction,
	hasTheHerta,
} from "../../mechanics/theHerta";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../../utils/action-sequence";
import { isBasicAttackSkill } from "../../utils/action-sequence";
import type { ActionState, SimulateActionsInput } from "../types";

export type RecordedActionMechanicContext = {
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	attackerState: ActionState | undefined;
	states: ActionState[];
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	archerState: ActionState | undefined;
	spBladeState: ActionState | undefined;
	theHertaState: ActionState | undefined;
	spAventurineState: ActionState | undefined;
	gilgameshState: ActionState | undefined;
	hasSaberInTeam: boolean;
	ashveilState: ActionState | undefined;
	kafkaState: ActionState | undefined;
	isSoleElation: boolean;
	initialStateByCharacterId: Map<string, ActionState>;
	refreshAhaSchedule: (actionValue: number) => void;
	emitImmediateElation: (
		parentKey: string,
		actionValue: number,
		threshold: number,
	) => void;
};

export type RecordedActionFlags = {
	isForcedAttack: boolean;
	isSilverWolfNonAttack: boolean;
};

export type RegisteredCharacterMechanic =
	| "archer"
	| "ashveil"
	| "gilgamesh"
	| "kafka"
	| "saber"
	| "silverWolf"
	| "spAventurine"
	| "spBlade"
	| "theHerta";

const characterMechanicPredicates: Record<
	RegisteredCharacterMechanic,
	(character: SimulateActionsInput["characters"][number]) => boolean
> = {
	archer: hasArcher,
	ashveil: hasAshveil,
	gilgamesh: hasGilgamesh,
	kafka: hasKafka,
	saber: hasSaber,
	silverWolf: (character) => hasSilverWolfGodmode(character.name),
	spAventurine: hasSpAventurine,
	spBlade: hasSpBlade,
	theHerta: hasTheHerta,
};

type RecordedActionMechanic = {
	name: string;
	enabled: (context: RecordedActionMechanicContext) => boolean;
	run: (
		context: RecordedActionMechanicContext,
		flags: RecordedActionFlags,
	) => void;
};

const recordedActionMechanics: RecordedActionMechanic[] = [
	{
		name: "spBladeFury",
		enabled: ({ spBladeState }) => spBladeState !== undefined,
		run: ({ spBladeState, action, states }) => {
			if (spBladeState) maybeActivateSpBladeFury(spBladeState, action, states);
		},
	},
	{
		name: "theHerta",
		enabled: ({ theHertaState }) => theHertaState !== undefined,
		run: ({ theHertaState, action }) => {
			if (theHertaState)
				handleTheHertaRecordedAction({ state: theHertaState, action });
		},
	},
	{
		name: "gilgamesh",
		enabled: ({ gilgameshState }) => gilgameshState !== undefined,
		run: (context) => {
			if (context.gilgameshState) {
				handleGilgameshRecordedAction({
					state: context.gilgameshState,
					action: context.action,
					attacker: context.attacker,
					states: context.states,
					actions: context.actions,
					input: context.input,
					hasSaberInTeam: context.hasSaberInTeam,
				});
			}
		},
	},
	{
		name: "archer",
		enabled: ({ archerState }) => archerState !== undefined,
		run: (context, flags) => {
			if (context.archerState) {
				handleArcherRecordedAction({
					state: context.archerState,
					action: context.action,
					attacker: context.attacker,
					actions: context.actions,
					input: context.input,
					isForcedAttack: flags.isForcedAttack,
					isSilverWolfNonAttack: flags.isSilverWolfNonAttack,
				});
			}
		},
	},
	{
		name: "companionFollowUp",
		enabled: () => true,
		run: (context, flags) => {
			handleCompanionFollowUpRecordedAction({
				actions: context.actions,
				action: context.action,
				attacker: context.attacker,
				input: context.input,
				isForcedAttack: flags.isForcedAttack,
				ashveilState: context.ashveilState,
				kafkaState: context.kafkaState,
			});
		},
	},
	{
		name: "spBlade",
		enabled: ({ spBladeState }) => spBladeState !== undefined,
		run: (context, flags) => {
			if (context.spBladeState) {
				handleSpBladeRecordedAction({
					state: context.spBladeState,
					action: context.action,
					attacker: context.attacker,
					states: context.states,
					actions: context.actions,
					input: context.input,
					isForcedAttack: flags.isForcedAttack,
				});
			}
		},
	},
	{
		name: "spAventurine",
		enabled: ({ spAventurineState }) => spAventurineState !== undefined,
		run: (context, flags) => {
			if (context.spAventurineState) {
				handleSpAventurineRecordedAction({
					state: context.spAventurineState,
					action: context.action,
					attacker: context.attacker,
					actions: context.actions,
					input: context.input,
					isForcedAttack: flags.isForcedAttack,
					resolveAttackerState: (characterId: string) =>
						context.initialStateByCharacterId.get(characterId),
					isSoleElation: context.isSoleElation,
					refreshAhaSchedule: context.refreshAhaSchedule,
					emitImmediateElation: context.emitImmediateElation,
				});
			}
		},
	},
	{
		name: "elationLightcone",
		enabled: ({ action, attacker }) =>
			action.isElationSkill === true &&
			attacker?.lc_id === ELATION_LIGHTCONE_ID,
		run: (context) => {
			const casterState = context.initialStateByCharacterId.get(
				context.action.characterId,
			);
			if (casterState) {
				applyElationLightconeSpeedBuff(casterState, context.action.actionValue);
			}
		},
	},
];

export function runRecordedActionMechanics(
	context: RecordedActionMechanicContext,
): RecordedActionFlags {
	const isSilverWolfNonAttack = Boolean(
		hasSilverWolfGodmode(context.attacker?.name ?? "") &&
			(context.action.skill === "Q" ||
				(context.action.isElationSkill &&
					(!context.attackerState || !isInGodmode(context.attackerState)))),
	);
	const isArcherFixedAttack =
		hasArcher(context.attacker) &&
		["A", "E", "Q"].includes(context.action.skill);
	const isSpAventurineFixedAttack =
		hasSpAventurine(context.attacker) &&
		["A", "E", "Q"].includes(context.action.skill);
	const flags = {
		isForcedAttack:
			isBasicAttackSkill(context.action.skill) ||
			context.action.isAssistAction === true ||
			context.action.isGilgameshTechniqueAction === true ||
			isArcherFixedAttack ||
			isSpAventurineFixedAttack,
		isSilverWolfNonAttack,
	};

	for (const mechanic of recordedActionMechanics) {
		if (mechanic.enabled(context)) mechanic.run(context, flags);
	}
	return flags;
}

export function hasRegisteredCharacterMechanic(
	character: SimulateActionsInput["characters"][number],
): boolean {
	return Object.values(characterMechanicPredicates).some((predicate) =>
		predicate(character),
	);
}

export function isRegisteredCharacterMechanic(
	character: SimulateActionsInput["characters"][number],
	mechanic: RegisteredCharacterMechanic,
): boolean {
	return characterMechanicPredicates[mechanic](character);
}

export function findRegisteredCharacterState(
	states: ActionState[],
	mechanic: RegisteredCharacterMechanic,
): ActionState | undefined {
	return states.find((state) =>
		isRegisteredCharacterMechanic(state.character, mechanic),
	);
}
