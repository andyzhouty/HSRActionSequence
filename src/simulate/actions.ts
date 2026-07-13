import {
	archerFuaResourceName,
	clampArcherFuaCharge,
	hasArcher,
} from "../mechanics/archer";
import {
	advanceSouldragon,
	emitImmediateSouldragonAction,
} from "../mechanics/danHengSouldragon";
import {
	hasSilverWolfGodmode,
	isInGodmode,
} from "../mechanics/silverWolfGodmode";
import type { GeneratedAction } from "../utils/actionSequence";
import {
	getCharacterPath,
	isBasicAttackSkill,
	isNonAttackSkill,
} from "../utils/actionSequence";
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
	emitFuaAction as emitFua,
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
		const attacker = input.characters.find(
			(character) => character.id === action.characterId,
		);
		const attackerState = states.find(
			(state) => state.character.id === action.characterId,
		);
		const isSilverWolfNonAttack =
			hasSilverWolfGodmode(attacker?.name ?? "") &&
			(action.skill === "Q" ||
				(action.isElationSkill &&
					(!attackerState || !isInGodmode(attackerState))));
		const archerState = states.find((state) => hasArcher(state.character));
		const manualCharge = Number.parseFloat(
			input.resourceValues?.[action.key]?.[archerFuaResourceName] ?? "",
		);
		if (archerState && Number.isFinite(manualCharge)) {
			archerState.archerFuaCharge = clampArcherFuaCharge(manualCharge);
		}
		if (archerState) action.archerFuaCharge = archerState.archerFuaCharge;
		const isForcedAttack = isBasicAttackSkill(action.skill);
		if (
			archerState &&
			!action.isArcherFua &&
			!action.isAssistAction &&
			(isForcedAttack || input.attackDisabled?.[action.key] !== true)
		) {
			if (
				attacker?.kind === "角色" &&
				action.characterId !== archerState.character.id &&
				(isForcedAttack || !isNonAttackSkill(attacker, action.skill)) &&
				!isSilverWolfNonAttack &&
				(archerState.archerFuaCharge ?? 0) > 0
			) {
				archerState.archerFuaCharge = clampArcherFuaCharge(
					(archerState.archerFuaCharge ?? 0) - 1,
				);
				action.archerFuaCharge = archerState.archerFuaCharge;
				actions.push({
					key: `${action.key}-archer-fua`,
					characterId: archerState.character.id,
					displayName: "红A",
					actionNo: 0,
					actionValue: action.actionValue,
					skill: "Z",
					speed: archerState.currentSpeed,
					isFuaAction: true,
					isArcherFua: true,
					lockedSkill: true,
					archerFuaCharge: archerState.archerFuaCharge,
				});
			}
		}
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

		const isForcedNonAttack =
			(attacker !== undefined && isNonAttackSkill(attacker, action.skill)) ||
			(action.characterId === souldragonOwner.character.id &&
				action.skill === "E");
		if (
			attacker?.kind === "角色" &&
			action.characterId === currentBondmateTarget.value &&
			(isForcedAttack || !isForcedNonAttack) &&
			(isForcedAttack || input.attackDisabled?.[action.key] !== true) &&
			!isSilverWolfNonAttack
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
		// SP 银狼特殊规则：若同袍为 SP 银狼且未处于无敌玩家状态，则不触发龙灵提前
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
					const isSilverWolf = hasSilverWolfGodmode(bondmateChar.name);
					let skipForSilverWolf = false;
					if (isSilverWolf) {
						const swState = states.find(
							(s) => s.character.id === currentBondmateTarget.value,
						);
						skipForSilverWolf = !swState || !isInGodmode(swState);
					}
					if (!skipForSilverWolf) {
						advanceSouldragon(
							states,
							souldragonOwner.character.id,
							action.actionValue,
							0.15,
						);
					}
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
	const emitFuaAction = (sourceKey: string, actionValue: number) => {
		emitFua(sourceKey, actionValue, states, actions, input);
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
			emitFuaAction,
		},
	});
}
