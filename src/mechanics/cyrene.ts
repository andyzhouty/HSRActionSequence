import {
	emitCyreneMemospriteAction,
	handleCyrenePostUltimate,
} from "../simulate/effects";
import type { SimulationRuntime } from "../simulate/runtime";
import type { CharacterConfig } from "../utils/actionSequence";

type CyreneUltimateParams = {
	runtime: SimulationRuntime;
	stateIndex: number;
	key: string;
	character: CharacterConfig;
	actionValue: number;
};

/** 昔涟正常 Q 后生成德谬歌行动，并结算昔涟自身后效。 */
export function handleCyreneNormalUltimate({
	runtime,
	stateIndex,
	key,
	character,
	actionValue,
}: CyreneUltimateParams) {
	const { input, actions, states, activeOdes } = runtime;
	emitCyreneMemospriteAction({
		input,
		actions,
		states,
		activeOdes,
		cyrene: character,
		sourceKey: key,
		actionValue,
	});
	handleCyrenePostUltimate({
		states,
		casterIndex: stateIndex,
		character,
		actions,
		actionValue,
		activeOdes,
	});
}
