import type { CharacterConfig, SkillCode } from "../../utils/actionSequence";
import {
	emitCyreneMemospriteAction,
	handleCyrenePostUltimate,
} from "../effects";
import type { SimulationRuntime } from "../runtime";

type ArcherExtraEParams = {
	runtime: SimulationRuntime;
	stateIndex: number;
	key: string;
	character: CharacterConfig;
	actionValue: number;
	actionSpeed: number;
	count: number;
};

/** 生成 Archer 数字 E 中除首箭外的锁定额外行动。 */
export function emitArcherExtraEs({
	runtime,
	stateIndex,
	key,
	character,
	actionValue,
	actionSpeed,
	count,
}: ArcherExtraEParams) {
	const { input, actions, states } = runtime;
	for (let index = 2; index <= count; index++) {
		const extraKey = `${key}-ea${index}`;
		const interrupts = input.ultInterrupts[extraKey] ?? [];
		for (
			let interruptIndex = 0;
			interruptIndex < interrupts.length;
			interruptIndex++
		) {
			const interrupt = interrupts[interruptIndex];
			if (interrupt.timing === "before")
				runtime.callbacks.emitSpecialInterruptAction(
					`${extraKey}-interrupt-${interruptIndex}`,
					interrupt,
					actionValue,
				);
		}
		actions.push({
			key: extraKey,
			characterId: character.id,
			actionNo: 0,
			actionValue,
			skill: "E" as SkillCode,
			speed: actionSpeed,
			isArcherExtraE: true,
			archerExtraEIndex: index,
			archerExtraEParentKey: key,
			lockedSkill: true,
			archerFuaCharge: states[stateIndex].archerFuaCharge,
		});
		for (
			let interruptIndex = 0;
			interruptIndex < interrupts.length;
			interruptIndex++
		) {
			const interrupt = interrupts[interruptIndex];
			if (interrupt.timing === "after")
				runtime.callbacks.emitSpecialInterruptAction(
					`${extraKey}-interrupt-${interruptIndex}`,
					interrupt,
					actionValue,
				);
		}
	}
}

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
