import { handleArcherRecordedAction, hasArcher } from "../mechanics/archer";
import {
	handleCompanionFollowUpRecordedAction,
	hasAshveil,
	hasKafka,
} from "../mechanics/companionFollowUp";
import {
	advanceSouldragon,
	emitImmediateSouldragonAction,
} from "../mechanics/danHengPermansor";
import {
	handleGilgameshRecordedAction,
	hasGilgamesh,
} from "../mechanics/gilgamesh";
import {
	applyElationLightconeSpeedBuff,
	ELATION_LIGHTCONE_ID,
} from "../mechanics/lightconeEffects";
import { hasSaber } from "../mechanics/saber";
import { hasSilverWolfGodmode, isInGodmode } from "../mechanics/silverWolf";
import {
	handleSpAventurineRecordedAction,
	hasSpAventurine,
} from "../mechanics/spAventurine";
import {
	handleSpBladeRecordedAction,
	hasSpBlade,
	maybeActivateSpBladeFury,
} from "../mechanics/spBlade";
import {
	handleTheHertaRecordedAction,
	hasTheHerta,
} from "../mechanics/theHerta";
import type { GeneratedAction } from "../utils/action-sequence";
import {
	getCharacterPath,
	isBasicAttackSkill,
	isNonAttackSkill,
} from "../utils/action-sequence";
import {
	applyTeamSpeedBuffs,
	applyTechniqueSummons,
	buildInitialStates,
	createAv0State,
	setupAhaMoment,
	setupSouldragonBondmate,
} from "./init";
import {
	emitEvanesciaFuaAction as emitEvanesciaFua,
	emitEvernightSelfDestructAction as emitEvernightSelfDestruct,
	emitExtraAhaAction as emitExtraAha,
	emitGodmodeExtraAction as emitGodmodeExtra,
	emitSingleElationSkill,
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
	const ashveilState = states.find((state) => hasAshveil(state.character));
	const kafkaState = states.find((state) => hasKafka(state.character));
	const spBladeState = states.find((state) => hasSpBlade(state.character));
	const theHertaState = states.find((state) => hasTheHerta(state.character));
	const gilgameshAndSaber =
		gilgameshState !== undefined &&
		states.some((state) => hasSaber(state.character));
	let actions: GeneratedAction[];
	const { calcAhaSpeed, refreshAhaSchedule } = setupAhaMoment(states);
	const spAventurineState = states.find((state) =>
		hasSpAventurine(state.character),
	);
	const elationCharacters = input.characters.filter(
		(character) =>
			character.kind === "角色" &&
			getCharacterPath(character.name) === "Elation",
	);
	const isSoleElation =
		elationCharacters.length === 1 && hasSpAventurine(elationCharacters[0]);
	const emitSpAventurineImmediateElation = (
		parentKey: string,
		actionValue: number,
		threshold: number,
	) => {
		if (!spAventurineState) return;
		emitSingleElationSkill(spAventurineState, parentKey, actionValue, actions, {
			keySuffix: `-fervor-${threshold}`,
		});
	};
	const handleRecordedAction = (action: GeneratedAction) => {
		const attacker = characterById.get(action.characterId);
		if (spBladeState) maybeActivateSpBladeFury(spBladeState, action, states);
		const attackerState = initialStateByCharacterId.get(action.characterId);
		const isSilverWolfNonAttack = Boolean(
			hasSilverWolfGodmode(attacker?.name ?? "") &&
				(action.skill === "Q" ||
					(action.isElationSkill &&
						(!attackerState || !isInGodmode(attackerState)))),
		);
		if (theHertaState) {
			handleTheHertaRecordedAction({ state: theHertaState, action });
		}
		if (gilgameshState) {
			handleGilgameshRecordedAction({
				state: gilgameshState,
				action,
				attacker,
				states,
				actions,
				input,
				hasSaberInTeam: gilgameshAndSaber,
			});
		}
		const isArcherFixedAttack =
			hasArcher(attacker) && ["A", "E", "Q"].includes(action.skill);
		const isSpAventurineFixedAttack =
			hasSpAventurine(attacker) && ["A", "E", "Q"].includes(action.skill);
		const isForcedAttack =
			isBasicAttackSkill(action.skill) ||
			action.isAssistAction === true ||
			action.isGilgameshTechniqueAction === true ||
			isArcherFixedAttack ||
			isSpAventurineFixedAttack;
		if (archerState) {
			handleArcherRecordedAction({
				state: archerState,
				action,
				attacker,
				actions,
				input,
				isForcedAttack,
				isSilverWolfNonAttack,
			});
		}
		handleCompanionFollowUpRecordedAction({
			actions,
			action,
			attacker,
			input,
			isForcedAttack,
			ashveilState,
			kafkaState,
		});
		if (spBladeState) {
			handleSpBladeRecordedAction({
				state: spBladeState,
				action,
				attacker,
				states,
				actions,
				input,
			});
		}

		// ── 砂金·戏浪：热意积累、天赋、阈值触发与阿哈加速 ──
		if (spAventurineState) {
			handleSpAventurineRecordedAction({
				state: spAventurineState,
				action,
				attacker,
				actions,
				input,
				isForcedAttack,
				resolveAttackerState: (characterId: string) =>
					initialStateByCharacterId.get(characterId),
				isSoleElation,
				refreshAhaSchedule,
				emitImmediateElation: emitSpAventurineImmediateElation,
			});
		}

		// 光锥 23064「向浪花掷下盛夏」：装备者施放欢愉技时速度提高 20%。
		if (action.isElationSkill && attacker?.lc_id === ELATION_LIGHTCONE_ID) {
			const lcCasterState = initialStateByCharacterId.get(action.characterId);
			if (lcCasterState) {
				applyElationLightconeSpeedBuff(lcCasterState, action.actionValue);
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
	const emitEvanesciaFuaAction = (sourceKey: string, actionValue: number) => {
		emitEvanesciaFua(sourceKey, actionValue, states, actions, input);
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
			emitEvanesciaFuaAction,
		},
	});
}
