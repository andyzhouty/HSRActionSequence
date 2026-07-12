import {
	advanceSouldragon,
	emitImmediateSouldragonAction,
} from "../mechanics/danHengSouldragon";
import type { GeneratedAction } from "../utils/actionSequence";
import { getCharacterPath } from "../utils/actionSequence";
import {
	applyTeamSpeedBuffs,
	applyTechniqueSummons,
	buildInitialStates,
	createAv0State,
	setupAhaMoment,
	setupSouldragonBondmate,
} from "./init";
import {
	emitEvernightSelfDestructAction as emitEvernightSelfDestruct,
	emitExtraAhaAction as emitExtraAha,
	emitGodmodeExtraAction as emitGodmodeExtra,
	emitSparxieExtraAction as emitSparxieExtra,
	emitSpecialInterruptAction as emitSpecialInterrupt,
} from "./interrupts";
import { runSimulationLoop } from "./loop";
import type { ActiveOdeState, SimulateActionsInput } from "./types";

// Re-export for backward compatibility
export type { SimulateActionsInput } from "./types";

// --- Main simulation ---

export function simulateActions(
	input: SimulateActionsInput,
): GeneratedAction[] {
	const states = buildInitialStates(input.characters);
	const { souldragonOwner, currentBondmateTarget: initialBondmateTarget } =
		setupSouldragonBondmate(states, input);
	const currentBondmateTarget = { value: initialBondmateTarget };

	const rawActions: GeneratedAction[] = [];
	let actions: GeneratedAction[];
	const handleRecordedAction = (action: GeneratedAction) => {
		if (!souldragonOwner || action.isSouldragonAction) return;

		if (
			souldragonOwner.character.eidolon >= 2 &&
			action.characterId === souldragonOwner.character.id &&
			action.skill === "Q"
		) {
			advanceSouldragon(
				states,
				souldragonOwner.character.id,
				action.actionValue,
				1,
			);
		}

		const odeSelection = input.odeSelections[action.key];
		if (
			action.isMemospriteAction &&
			odeSelection?.targetId === souldragonOwner.character.id
		) {
			emitImmediateSouldragonAction(
				states,
				souldragonOwner.character.id,
				actions,
				action.actionValue,
				action.key,
			);
		}

		const attacker = input.characters.find(
			(character) => character.id === action.characterId,
		);
		const isForcedNonAttack =
			action.characterId === souldragonOwner.character.id &&
			action.skill === "E";
		if (
			attacker?.kind === "角色" &&
			action.characterId === currentBondmateTarget.value &&
			!isForcedNonAttack &&
			input.attackDisabled?.[action.key] !== true
		) {
			// 境界内双字符技能码（如 EW、EA）视为两次攻击，龙灵提前两次
			const domainDoubleAttack =
				action.isDomainAction && action.skill.length === 2;
			const souldragonAdvance = domainDoubleAttack ? 0.3 : 0.15;
			advanceSouldragon(
				states,
				souldragonOwner.character.id,
				action.actionValue,
				souldragonAdvance,
			);
		}
		// 阿哈时刻：若同袍为欢愉角色，阿哈行动也推进龙灵
		if (
			action.characterId === "@aha" &&
			currentBondmateTarget.value &&
			!isForcedNonAttack
		) {
			const bondmateChar = input.characters.find(
				(c) => c.id === currentBondmateTarget.value,
			);
			if (bondmateChar) {
				const isElation = getCharacterPath(bondmateChar.name) === "Elation";
				if (isElation) {
					advanceSouldragon(
						states,
						souldragonOwner.character.id,
						action.actionValue,
						0.15,
					);
				}
			}
		}
	};
	actions = new Proxy(rawActions, {
		get(target, property, receiver) {
			if (property !== "push") return Reflect.get(target, property, receiver);
			return (...items: GeneratedAction[]) => {
				for (const item of items) {
					Array.prototype.push.call(target, item);
					handleRecordedAction(item);
				}
				return target.length;
			};
		},
	});
	const activeOdes = new Map<string, ActiveOdeState[]>();

	const { calcAhaSpeed, refreshAhaSchedule } = setupAhaMoment(states);

	applyTechniqueSummons(states);

	// ── 0 行动值：固定倒计时目标，仅在 AV=0 行动一次 ──
	states.push(createAv0State());

	applyTeamSpeedBuffs(states, input, refreshAhaSchedule);

	const emitGodmodeExtraAction = (sourceKey: string, actionValue: number) => {
		emitGodmodeExtra(sourceKey, actionValue, states, actions, input);
	};
	const emitExtraAhaAction = (sourceKey: string, actionValue: number) => {
		emitExtraAha(
			sourceKey,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitSparxieExtraAction,
		);
	};
	const emitSpecialInterruptAction = (
		interruptKey: string,
		interrupt: { casterId: string; timing: "before" | "after" },
		actionValue: number,
		qIsFront?: boolean,
		effectSourceKey?: string,
	) => {
		emitSpecialInterrupt(
			interruptKey,
			interrupt,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaAction,
			emitSparxieExtraAction,
			qIsFront,
			effectSourceKey,
		);
	};
	const emitSparxieExtraAction = (sourceKey: string, actionValue: number) => {
		emitSparxieExtra(
			sourceKey,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaAction,
		);
	};
	const emitEvernightSelfDestructAction = (
		sourceKey: string,
		actionValue: number,
	) => {
		emitEvernightSelfDestruct(
			sourceKey,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaAction,
			emitSparxieExtraAction,
		);
	};

	return runSimulationLoop({
		input,
		states,
		actions,
		activeOdes,
		souldragonOwner,
		currentBondmateTarget,
		calcAhaSpeed,
		refreshAhaSchedule,
		callbacks: {
			emitExtraAhaAction,
			emitGodmodeExtraAction,
			emitSpecialInterruptAction,
			emitSparxieExtraAction,
			emitEvernightSelfDestructAction,
		},
	});
}
