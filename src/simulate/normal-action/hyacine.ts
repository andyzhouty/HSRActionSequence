import {
	createIcaAction,
	handleHyacineQ,
	hasHyacineIca,
	summonIca,
	triggerIcaExtraTurn,
} from "../../mechanics/hyacineIca";
import {
	type CharacterConfig,
	isCharacterTarget,
	type SkillCode,
} from "../../utils/actionSequence";
import type { SimulationRuntime } from "../runtime";

type Params = {
	runtime: SimulationRuntime;
	stateIndex: number;
	key: string;
	character: CharacterConfig;
	actionValue: number;
	resolvedSkill: SkillCode;
	normalUsesUltimate: boolean;
	usesUltimate: boolean;
	qIsFront: boolean;
};

/** 风堇的 Ica 召唤、雨幕与额外行动均在主行动后按固定顺序结算。 */
export function handleHyacineNormalAction({
	runtime,
	stateIndex,
	key,
	character,
	actionValue,
	resolvedSkill,
	normalUsesUltimate,
	usesUltimate,
	qIsFront,
}: Params) {
	if (!isCharacterTarget(character) || !hasHyacineIca(character.name)) return;
	const { input, states, actions } = runtime;
	const emitIcaAction = (sourceKey: string, parentKey: string) => {
		const configured = input.ultInterrupts[sourceKey] ?? [];
		for (let index = 0; index < configured.length; index++) {
			const interrupt = configured[index];
			if (interrupt.timing === "before")
				runtime.callbacks.emitSpecialInterruptAction(
					`${sourceKey}-interrupt-${index}`,
					interrupt,
					actionValue,
				);
		}
		actions.push(createIcaAction(character.id, parentKey, actionValue));
		for (let index = 0; index < configured.length; index++) {
			const interrupt = configured[index];
			if (interrupt.timing === "after")
				runtime.callbacks.emitSpecialInterruptAction(
					`${sourceKey}-interrupt-${index}`,
					interrupt,
					actionValue,
				);
		}
	};
	if (normalUsesUltimate) {
		handleHyacineQ(states, character.id);
		emitIcaAction(`${key}-q-ica`, `${key}-q`);
	}
	if (resolvedSkill.includes("E") && !states[stateIndex].icaOnField)
		summonIca(states[stateIndex]);
	if (
		(resolvedSkill === "" ||
			resolvedSkill === "A" ||
			resolvedSkill.includes("E")) &&
		(!usesUltimate || qIsFront)
	) {
		const beforeRain = states[stateIndex].afterRain ?? 0;
		triggerIcaExtraTurn(states, character.id);
		if ((states[stateIndex].afterRain ?? 0) < beforeRain)
			emitIcaAction(`${key}-ica`, key);
	}
}
