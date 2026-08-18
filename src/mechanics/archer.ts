import { hasSkillEffect } from "../data/characters";
import { emitHimekoNovaAssists } from "../simulate/assist";
import { findHimekoNovaAssistState } from "../simulate/effects";
import type { SimulationRuntime } from "../simulate/runtime";
import type { ActionState, SimulateActionsInput } from "../simulate/types";
import { isNonAttackSkill } from "../utils/action-sequence";
import type {
	CharacterConfig,
	GeneratedAction,
	SkillCode,
} from "../utils/actionSequence";

export const archerFuaResourceName = "红A追击";
export const archerMaxFuaCharge = 4;
export const archerMaxConsecutiveEs = 5;

export function hasArcher(character: CharacterConfig | undefined): boolean {
	return Boolean(
		character && hasSkillEffect(character.name, "Q", "archerUltimate"),
	);
}

export function clampArcherFuaCharge(value: number): number {
	return Math.max(0, Math.min(archerMaxFuaCharge, Math.floor(value)));
}

/** 记录一条已生成行动后的红A追击充能结算（Q 回充、手动覆盖、紧邻 Z 追击）。 */
export function handleArcherRecordedAction(params: {
	state: ActionState;
	action: GeneratedAction;
	attacker: CharacterConfig | undefined;
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	isForcedAttack: boolean;
	isSilverWolfNonAttack: boolean;
}): void {
	const {
		state,
		action,
		attacker,
		actions,
		input,
		isForcedAttack,
		isSilverWolfNonAttack,
	} = params;
	if (action.characterId === state.character.id && action.skill === "Q") {
		state.archerFuaCharge = clampArcherFuaCharge(
			(state.archerFuaCharge ?? 0) + 2,
		);
	}
	const manualCharge = Number.parseFloat(
		input.resourceValues?.[action.key]?.[archerFuaResourceName] ?? "",
	);
	if (Number.isFinite(manualCharge)) {
		state.archerFuaCharge = clampArcherFuaCharge(manualCharge);
	}
	action.archerFuaCharge = state.archerFuaCharge;
	if (
		!action.isArcherFua &&
		!action.isDomainAction &&
		!action.isSpBladeFuryActivation &&
		(isForcedAttack || input.attackDisabled?.[action.key] !== true)
	) {
		if (
			attacker?.kind === "角色" &&
			action.characterId !== state.character.id &&
			(isForcedAttack || !isNonAttackSkill(attacker, action.skill)) &&
			!isSilverWolfNonAttack &&
			(state.archerFuaCharge ?? 0) > 0
		) {
			state.archerFuaCharge = clampArcherFuaCharge(
				(state.archerFuaCharge ?? 0) - 1,
			);
			action.archerFuaCharge = state.archerFuaCharge;
			actions.push({
				key: `${action.key}-archer-fua`,
				characterId: state.character.id,
				displayName: "红A",
				actionNo: 0,
				actionValue: action.actionValue,
				skill: "Z",
				speed: state.currentSpeed,
				isFuaAction: true,
				isArcherFua: true,
				lockedSkill: true,
				archerFuaCharge: state.archerFuaCharge,
			});
		}
	}
}

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
			emitEvanesciaFuaAction: runtime.callbacks.emitEvanesciaFuaAction,
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
			const arrowSkill =
				configured === "A" ? ("A" as SkillCode) : ("E" as SkillCode);
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
			runtime.callbacks.emitEvanesciaFuaAction(extraKey, actionValue);
			if (arrowSkill === "A") return;
		}
	};
	emitSegment(key, 2, count);
}
