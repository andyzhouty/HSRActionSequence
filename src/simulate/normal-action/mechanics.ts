import { applyGarmentmakerActionEffects } from "../../mechanics/aglaea";
import {
	archerMaxConsecutiveEs,
	emitArcherExtraEs,
} from "../../mechanics/archer";
import { handleCyreneNormalUltimate } from "../../mechanics/cyrene";
import { handleHyacineNormalAction } from "../../mechanics/hyacine";
import type { CharacterConfig, SkillCode } from "../../utils/action-sequence";
import { hasSkillEffect, isCharacterTarget } from "../../utils/action-sequence";
import type { SimulationRuntime } from "../runtime";

export type NormalActionMechanicPhase = "actionGenerated" | "postSummonEffects";

export type NormalActionMechanicContext = {
	runtime: SimulationRuntime;
	stateIndex: number;
	key: string;
	character: CharacterConfig;
	actionValue: number;
	actionSpeed: number;
	resolvedSkill: SkillCode;
	normalUsesUltimate: boolean;
	usesUltimate: boolean;
	hasSelfQ: boolean;
	qIsFront: boolean;
	isArcherMultiE: boolean;
	archerECount: number;
};

type NormalActionMechanic = {
	name: string;
	phase: NormalActionMechanicPhase;
	enabled: (context: NormalActionMechanicContext) => boolean;
	run: (context: NormalActionMechanicContext) => void;
};

const normalActionMechanics: NormalActionMechanic[] = [
	{
		name: "aglaeaGarmentmaker",
		phase: "actionGenerated",
		enabled: ({ runtime, stateIndex }) =>
			Boolean(runtime.states[stateIndex].isGarmentmakerState),
		run: ({ runtime, stateIndex, actionValue }) => {
			applyGarmentmakerActionEffects(runtime.states, stateIndex, actionValue);
		},
	},
	{
		name: "archerExtraE",
		phase: "actionGenerated",
		enabled: ({ isArcherMultiE, archerECount }) =>
			isArcherMultiE && archerECount > 1,
		run: ({
			runtime,
			stateIndex,
			key,
			character,
			actionValue,
			actionSpeed,
			archerECount,
		}) => {
			const actions = runtime.actions;
			actions[actions.length - 1].hasArcherExtraEs = true;
			emitArcherExtraEs({
				runtime,
				stateIndex,
				key,
				character,
				actionValue,
				actionSpeed,
				count: Math.min(archerECount, archerMaxConsecutiveEs),
			});
		},
	},
	{
		name: "cyreneUltimate",
		phase: "actionGenerated",
		enabled: ({ character, usesUltimate, hasSelfQ }) =>
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "Q", "cyreneUltimate") &&
			usesUltimate &&
			!hasSelfQ,
		run: ({ runtime, stateIndex, key, character, actionValue }) => {
			handleCyreneNormalUltimate({
				runtime,
				stateIndex,
				key,
				character,
				actionValue,
			});
		},
	},
	{
		name: "hyacine",
		phase: "postSummonEffects",
		enabled: () => true,
		run: (context) => {
			handleHyacineNormalAction(context);
		},
	},
];

export function runNormalActionMechanics(
	phase: NormalActionMechanicPhase,
	context: NormalActionMechanicContext,
): void {
	for (const mechanic of normalActionMechanics) {
		if (mechanic.phase === phase && mechanic.enabled(context)) {
			mechanic.run(context);
		}
	}
}

export function getNormalActionMechanicNames(): readonly string[] {
	return normalActionMechanics.map((mechanic) => mechanic.name);
}
