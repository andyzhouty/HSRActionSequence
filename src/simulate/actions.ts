import {
	advanceSouldragon,
	emitImmediateSouldragonAction,
} from "../mechanics/danHengPermansor";
import { hasSilverWolfGodmode, isInGodmode } from "../mechanics/silverWolf";
import type { GeneratedAction } from "../utils/action-sequence";
import { getCharacterPath, isNonAttackSkill } from "../utils/action-sequence";
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
import {
	findRegisteredCharacterState,
	isRegisteredCharacterMechanic,
	runRecordedActionMechanics,
} from "./mechanics/registry";
import type { ActiveOdeState, SimulateActionsInput } from "./types";

// --- 主模拟流程 ---

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
	const gilgameshState = findRegisteredCharacterState(states, "gilgamesh");
	const archerState = findRegisteredCharacterState(states, "archer");
	const ashveilState = findRegisteredCharacterState(states, "ashveil");
	const kafkaState = findRegisteredCharacterState(states, "kafka");
	const spBladeState = findRegisteredCharacterState(states, "spBlade");
	const theHertaState = findRegisteredCharacterState(states, "theHerta");
	const gilgameshAndSaber =
		gilgameshState !== undefined &&
		states.some((state) =>
			isRegisteredCharacterMechanic(state.character, "saber"),
		);
	let actions: GeneratedAction[];
	const { calcAhaSpeed, refreshAhaSchedule } = setupAhaMoment(states);
	const spAventurineState = findRegisteredCharacterState(
		states,
		"spAventurine",
	);
	const elationCharacters = input.characters.filter(
		(character) =>
			character.kind === "角色" &&
			getCharacterPath(character.name) === "Elation",
	);
	const isSoleElation =
		elationCharacters.length === 1 &&
		isRegisteredCharacterMechanic(elationCharacters[0], "spAventurine");
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
		const attackerState = initialStateByCharacterId.get(action.characterId);
		const { isForcedAttack, isSilverWolfNonAttack } =
			runRecordedActionMechanics({
				action,
				attacker,
				attackerState,
				states,
				actions,
				input,
				archerState,
				spBladeState,
				theHertaState,
				spAventurineState,
				gilgameshState,
				hasSaberInTeam: gilgameshAndSaber,
				ashveilState,
				kafkaState,
				isSoleElation,
				initialStateByCharacterId,
				refreshAhaSchedule,
				emitImmediateElation: emitSpAventurineImmediateElation,
			});

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
