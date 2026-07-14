import type { CharacterConfig, SkillCode } from "../../utils/actionSequence";
import { archerMaxConsecutiveEs } from "../../mechanics/archer";
import {
	emitCyreneMemospriteAction,
	findHimekoNovaAssistState,
	handleCyrenePostUltimate,
} from "../effects";
import { emitHimekoNovaAssists } from "../assist";
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

/** 生成 Archer 数字 E 的额外箭；额外箭可改 A，并可在箭后触发姬子 F 刷新新箭段。 */
export function emitArcherExtraEs({
	runtime,
	stateIndex,
	key,
	character,
	actionValue,
	actionSpeed,
	count,
}: ArcherExtraEParams) {
	const { input, actions, states, activeOdes } = runtime;
	const emitAssist = (sourceKey: string, count: number) => {
		const assist = findHimekoNovaAssistState(states, character.id);
		if (!assist || assist.character.eidolon < 2) return false;
		emitHimekoNovaAssists({
			assist,
			assistUseCount: count,
			key: sourceKey,
			actionValue,
			states,
			actions,
			activeOdes,
			input,
			emitFuaAction: runtime.callbacks.emitFuaAction,
		});
		return true;
	};
	const emitResetTurn = (sourceKey: string): void => {
		const resetKey = `${sourceKey}-reset`;
		const configured = input.skillOverrides[resetKey] ?? "E";
		if (configured === "FF") {
			if (emitAssist(resetKey, 2)) return;
		}
		if (configured === "F") {
			if (emitAssist(resetKey, 1)) {
				emitResetTurn(resetKey);
				return;
			}
		}
		const match = /^(\d*)E$/.exec(configured);
		const arrowCount = match
			? Math.max(
					1,
					Math.min(
						archerMaxConsecutiveEs,
						match[1] ? Number.parseInt(match[1], 10) : 1,
					),
				)
			: 1;
		const skill = configured === "A" ? ("A" as SkillCode) : ("E" as SkillCode);
		actions.push({
			key: resetKey,
			characterId: character.id,
			actionNo: 0,
			actionValue,
			skill,
			speed: actionSpeed,
			isArcherExtraE: true,
			archerExtraEIndex: 1,
			archerExtraEParentKey: key,
			archerFuaCharge: states[stateIndex].archerFuaCharge,
		});
		if (skill === "E" && arrowCount > 1) emitSegment(resetKey, 2, arrowCount);
	};
	const emitSegment = (prefix: string, start: number, end: number) => {
		for (let index = start; index <= end; index++) {
			const extraKey = `${prefix}-ea${index}`;
			const configured = input.skillOverrides[extraKey];
			const isDoubleAssist = configured === "FF";
			if (isDoubleAssist) {
				if (emitAssist(extraKey, 2)) return;
			}
			if (configured === "F") {
				if (emitAssist(extraKey, 1)) {
					emitResetTurn(extraKey);
					return;
				}
			}
		const arrowSkill = configured === "A" ? ("A" as SkillCode) : ("E" as SkillCode);
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
			skill: arrowSkill,
			speed: actionSpeed,
			isArcherExtraE: true,
			archerExtraEIndex: index,
			archerExtraEParentKey: key,
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
			runtime.callbacks.emitFuaAction(extraKey, actionValue);
			if (arrowSkill === "A") return;
	}
	};
	emitSegment(key, 2, count);
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
