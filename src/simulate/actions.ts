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
	gilgameshInterestResourceName,
	hasGilgamesh,
} from "../mechanics/gilgamesh";
import { hasSaber } from "../mechanics/saber";
import {
	hasSilverWolfGodmode,
	isInGodmode,
} from "../mechanics/silverWolfGodmode";
import {
	clampTheHertaInspiration,
	getTheHertaUltimateInspirationGain,
	hasTheHerta,
} from "../mechanics/theHerta";
import type { GeneratedAction } from "../utils/actionSequence";
import {
	getCharacterPath,
	isBasicAttackSkill,
	isNonAttackSkill,
	toPositiveNumber,
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
	// 每条已记录行动都会查询行动者；角色配置与其主状态在整场模拟中稳定，
	// 预建索引避免高密度行动轴反复线性扫描。
	const characterById = new Map(
		input.characters.map((character) => [character.id, character]),
	);
	const initialStateByCharacterId = new Map(
		states.map((state) => [state.character.id, state]),
	);
	const gilgameshState = states.find((state) => hasGilgamesh(state.character));
	const archerState = states.find((state) => hasArcher(state.character));
	const theHertaState = states.find((state) => hasTheHerta(state.character));
	const gilgameshAndSaber =
		gilgameshState !== undefined &&
		states.some((state) => hasSaber(state.character));
	let actions: GeneratedAction[];
	const handleRecordedAction = (action: GeneratedAction) => {
		const attacker = characterById.get(action.characterId);
		const attackerState = initialStateByCharacterId.get(action.characterId);
		const isSilverWolfNonAttack =
			hasSilverWolfGodmode(attacker?.name ?? "") &&
			(action.skill === "Q" ||
				(action.isElationSkill &&
					(!attackerState || !isInGodmode(attackerState))));
		if (theHertaState) {
			const isTheHertaAction =
				action.characterId === theHertaState.character.id;
			let inspiration = theHertaState.theHertaInspiration ?? 0;
			if (isTheHertaAction && action.skill === "Q") {
				inspiration = clampTheHertaInspiration(
					inspiration +
						getTheHertaUltimateInspirationGain(theHertaState.character),
				);
			}
			if (isTheHertaAction && action.skill === "E" && inspiration > 0) {
				action.isTheHertaEnhancedE = true;
				if (theHertaState.character.eidolon >= 2) inspiration -= 1;
			}
			theHertaState.theHertaInspiration = inspiration;
			action.theHertaInspiration = inspiration;
		}
		if (gilgameshState) {
			const isGilgameshAction =
				action.characterId === gilgameshState.character.id;
			const isAhaAction = action.isAhaInstant === true;
			const isAhaActionDuringPhainonDomain =
				isAhaAction && states.some((state) => state.domainState !== undefined);
			const actorIsCounted =
				attacker?.kind === "角色" ||
				attacker?.kind === "忆灵" ||
				attacker?.kind === "非忆灵";
			const isPhainonEaOrEw =
				action.isDomainAction &&
				(action.skill === "EA" || action.skill === "EW");
			const isCharacterUltimate =
				attacker?.kind === "角色" && action.skill === "Q";
			// 白厄的境界退场 Q 只是一段普通行动，不享受 Q 的额外兴致。
			const hasUltimateInterestBonus =
				isCharacterUltimate && action.isDomainFinalAction !== true;
			let interest = gilgameshState.gilgameshInterest ?? 0;
			if (action.characterId === "@av0") {
				const initial = Number.parseFloat(
					input.resourceValues?.[action.key]?.[gilgameshInterestResourceName] ??
						"",
				);
				if (Number.isFinite(initial)) interest = Math.max(0, initial);
			} else if (!action.isGilgameshComboAction) {
				if (isGilgameshAction) {
					if (action.skill === "E") interest = 0;
				} else if (isAhaAction && !isAhaActionDuringPhainonDomain) {
					interest += input.characters.filter(
						(character) => getCharacterPath(character.name) === "Elation",
					).length;
				} else if (actorIsCounted && !action.isElationSkill)
					interest += isPhainonEaOrEw ? 2 : 1;
				if (hasUltimateInterestBonus) {
					interest += 2;
					if (isGilgameshAction && gilgameshState.character.eidolon >= 2)
						interest += 5;
				}
				const manual = Number.parseFloat(
					input.resourceValues?.[action.key]?.[gilgameshInterestResourceName] ??
						"",
				);
				if (Number.isFinite(manual)) interest = Math.max(0, manual);
			}
			gilgameshState.gilgameshInterest = interest;
			if (interest >= 10) gilgameshState.gilgameshEUnlocked = true;
			action.gilgameshInterest = interest;

			const oldGilgameshSpeed = gilgameshState.currentSpeed;
			const nextGilgameshSpeed =
				toPositiveNumber(
					gilgameshState.character.speed,
					gilgameshState.baseSpeed,
				) +
				gilgameshState.baseSpeed * 0.1 * interest;
			if (nextGilgameshSpeed > 0) {
				const remaining = gilgameshState.nextActionValue - action.actionValue;
				if (!isGilgameshAction && remaining > 0)
					gilgameshState.nextActionValue =
						action.actionValue +
						remaining * (oldGilgameshSpeed / nextGilgameshSpeed);
				gilgameshState.currentSpeed = nextGilgameshSpeed;
			}

			const pairAttack =
				(hasGilgamesh(attacker) || hasSaber(attacker)) &&
				(action.isFuaAction === true ||
					action.isAssistAction === true ||
					isBasicAttackSkill(action.skill) ||
					(attacker !== undefined &&
						!isNonAttackSkill(attacker, action.skill) &&
						input.attackDisabled?.[action.key] !== true));
			if (pairAttack && gilgameshAndSaber) {
				const count = (gilgameshState.gilgameshAttackCount ?? 0) + 1;
				gilgameshState.gilgameshAttackCount = count;
				if (count % 8 === 0) {
					const speedBeforeComboBonus = gilgameshState.currentSpeed;
					gilgameshState.gilgameshInterest += 3;
					const speedAfterComboBonus =
						toPositiveNumber(
							gilgameshState.character.speed,
							gilgameshState.baseSpeed,
						) +
						gilgameshState.baseSpeed * 0.1 * gilgameshState.gilgameshInterest;
					const remaining = gilgameshState.nextActionValue - action.actionValue;
					if (!isGilgameshAction && remaining > 0)
						gilgameshState.nextActionValue =
							action.actionValue +
							remaining * (speedBeforeComboBonus / speedAfterComboBonus);
					gilgameshState.currentSpeed = speedAfterComboBonus;
					action.gilgameshInterest = gilgameshState.gilgameshInterest;
					actions.push({
						key: `${action.key}-gilgamesh-combo-fua`,
						characterId: gilgameshState.character.id,
						displayName: "吉尔伽美什",
						actionNo: 0,
						actionValue: action.actionValue,
						skill: "Z",
						speed: gilgameshState.currentSpeed,
						isFuaAction: true,
						isGilgameshComboAction: true,
						lockedSkill: true,
						gilgameshInterest: gilgameshState.gilgameshInterest,
					});
				}
			}
		}
		if (
			archerState &&
			action.characterId === archerState.character.id &&
			action.skill === "Q"
		) {
			archerState.archerFuaCharge = clampArcherFuaCharge(
				(archerState.archerFuaCharge ?? 0) + 2,
			);
		}
		const manualCharge = Number.parseFloat(
			input.resourceValues?.[action.key]?.[archerFuaResourceName] ?? "",
		);
		if (archerState && Number.isFinite(manualCharge)) {
			archerState.archerFuaCharge = clampArcherFuaCharge(manualCharge);
		}
		if (archerState) action.archerFuaCharge = archerState.archerFuaCharge;
		const isArcherFixedAttack =
			hasArcher(attacker) && ["A", "E", "Q"].includes(action.skill);
		const isForcedAttack =
			isBasicAttackSkill(action.skill) ||
			action.isAssistAction === true ||
			action.isGilgameshTechniqueAction === true ||
			isArcherFixedAttack;
		if (
			archerState &&
			!action.isArcherFua &&
			!action.isDomainAction &&
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
