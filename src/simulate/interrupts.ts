import {
	getCharacterParticipantId,
	hasPassive,
	hasSkillEffect,
} from "../data/characters";
import { handleEveyAction } from "../mechanics/evernightEvey";
import {
	createIcaAction,
	handleHyacineQ,
	hasHyacineIca,
} from "../mechanics/hyacineIca";
import {
	applyMydeiVendettaToggle,
	emitMydeiGodslayerExtraAction,
} from "../mechanics/mydei";
import {
	expirePhainonDomainSpeedBonus,
	freezeAlliesForDomain,
	getPhainonDomainEndIndex,
	getPhainonDomainInterval,
} from "../mechanics/phainonDomain";
import {
	hasSilverWolfGodmode,
	isInGodmode,
} from "../mechanics/silverWolfGodmode";
import {
	type GeneratedAction,
	getCharacterCid,
	getCounterWDomainRule,
	isCharacterTarget,
	type SkillCode,
} from "../utils/actionSequence";
import {
	canBeAdvancedByDance,
	consumeActionOdes,
	emitCyreneMemospriteAction,
	emitMemeAdvanceAction,
	findHimekoNovaAssistState,
	getActiveOdeLabels,
	getTeamAdvanceOnUltimate,
	handleCyrenePostUltimate,
	hasActiveOdeEffect,
	isAllyTarget,
	toNonNegativeNumber,
} from "./effects";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";
import { handlePostUltimateEffects } from "./ultimateEffects";

export function emitGodmodeExtraAction(
	sourceKey: string,
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
	input: SimulateActionsInput,
): void {
	const godmodeExtraActions = input.godmodeExtraActions ?? {};
	if (!godmodeExtraActions[sourceKey]) return;
	const swIndex = states.findIndex(
		(s) => hasSilverWolfGodmode(s.character.name) && isInGodmode(s),
	);
	if (swIndex === -1) return;
	const sw = states[swIndex];
	const extraKey = `${sourceKey}-godmode-A`;
	actions.push({
		key: extraKey,
		characterId: sw.character.id,
		displayName: "银狼E2",
		actionNo: 0,
		actionValue,
		skill: "A" as SkillCode,
		speed: sw.currentSpeed,
		lockedSkill: true,
	});
	emitGodmodeExtraAction(extraKey, actionValue, states, actions, input);
}

export function emitExtraAhaAction(
	sourceKey: string,
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
	input: SimulateActionsInput,
	activeOdes: Map<string, ActiveOdeState[]>,
	calcAhaSpeed: () => number,
	emitSparxieExtraActionFn: (sourceKey: string, actionValue: number) => void,
): void {
	const extraAhaKey = `${sourceKey}-extra-aha`;
	const extraAhaInterrupts = input.ultInterrupts[extraAhaKey] ?? [];
	const extraAhaSpeed = calcAhaSpeed();

	// 递归调用时保持简洁的回调签名。
	const emitExtraAhaSimple: (sk: string, av: number) => void = (sk, av) => {
		emitExtraAhaAction(
			sk,
			av,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitSparxieExtraActionFn,
		);
	};

	for (let ai = 0; ai < extraAhaInterrupts.length; ai++) {
		const int = extraAhaInterrupts[ai];
		if (int.timing !== "before") continue;
		emitSpecialInterruptAction(
			`${extraAhaKey}-interrupt-${ai}`,
			int,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaSimple,
			emitSparxieExtraActionFn,
		);
	}

	actions.push({
		key: extraAhaKey,
		characterId: "@aha",
		displayName: "阿哈时刻",
		actionNo: 0,
		actionValue,
		skill: "" as SkillCode,
		speed: extraAhaSpeed,
		isAhaInstant: true,
		isExtraAha: true,
		hasElationSkills: true,
	});
	// 额外阿哈时刻与常规阿哈时刻相同，依次触发全部欢愉技。
	emitElationSkills(extraAhaKey, actionValue, states, actions);

	for (let ai = 0; ai < extraAhaInterrupts.length; ai++) {
		const int = extraAhaInterrupts[ai];
		if (int.timing !== "after") continue;
		emitSpecialInterruptAction(
			`${extraAhaKey}-interrupt-${ai}`,
			int,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaSimple,
			emitSparxieExtraActionFn,
		);
	}

	emitGodmodeExtraAction(extraAhaKey, actionValue, states, actions, input);
	emitMemeAdvanceAction({
		input,
		actions,
		states,
		sourceKey: extraAhaKey,
		actionValue,
		activeOdes,
	});
	emitSparxieExtraActionFn(extraAhaKey, actionValue);
}

export function emitSpecialInterruptAction(
	interruptKey: string,
	int: { casterId: string; timing: "before" | "after" },
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
	input: SimulateActionsInput,
	activeOdes: Map<string, ActiveOdeState[]>,
	calcAhaSpeed: () => number,
	emitExtraAhaActionFn: (sourceKey: string, actionValue: number) => void,
	emitSparxieExtraActionFn: (sourceKey: string, actionValue: number) => void,
	qIsFront?: boolean,
	effectSourceKey = interruptKey,
): void {
	void calcAhaSpeed;
	void emitSparxieExtraActionFn;
	const casterIndex = states.findIndex((s) => s.character.id === int.casterId);
	if (casterIndex === -1) return;
	const caster = states[casterIndex];
	applyMydeiVendettaToggle(states, input, interruptKey, actionValue);
	const casterSpeed = caster.currentSpeed;
	caster.lastActionValue = actionValue;
	actions.push({
		key: interruptKey,
		characterId: caster.character.id,
		actionNo: 0,
		actionValue,
		skill: "Q" as SkillCode,
		speed: casterSpeed,
		interruptTiming: int.timing,
		activeOdeLabels: getActiveOdeLabels(activeOdes, caster.character.id),
	});
	emitMemeAdvanceAction({
		input,
		actions,
		states,
		sourceKey: interruptKey,
		actionValue,
		activeOdes,
	});
	consumeActionOdes(activeOdes, caster.character.id, "Q", false);
	if (hasSkillEffect(caster.character.name, "Q", "cyreneUltimate")) {
		emitCyreneMemospriteAction({
			input,
			actions,
			states,
			activeOdes,
			cyrene: caster.character,
			sourceKey: effectSourceKey,
			actionValue,
		});
		handleCyrenePostUltimate({
			states,
			casterIndex,
			character: caster.character,
			actions,
			actionValue,
			activeOdes,
			excludeSelf: qIsFront,
			sortSelfByOriginalActionOrder: effectSourceKey === interruptKey,
		});
	}
	if (hasSkillEffect(caster.character.name, "Q", "extraAhaAfterUltimate")) {
		emitExtraAhaActionFn(interruptKey, actionValue);
	}

	// ── 统一 Q 后效处理（与 normalAction 共享同一逻辑） ──
	handlePostUltimateEffects({
		states,
		casterIndex,
		actions,
		actionValue,
		input,
		activeOdes,
		sourceKey: effectSourceKey,
		qIsFront,
	});

	// 舞舞舞 / 忘归人 全队拉条 + 风套（独立处理，因 qIsFront 语义不同）
	const teamAdvance = getTeamAdvanceOnUltimate(caster.character);
	if (teamAdvance > 0) {
		for (
			let teammateIndex = 0;
			teammateIndex < states.length;
			teammateIndex++
		) {
			const teammate = states[teammateIndex];
			if (!canBeAdvancedByDance(teammate.character.kind)) continue;
			if (teammate.blockNextAdvance) continue;
			const adv = teamAdvance / teammate.currentSpeed;
			teammate.nextActionValue = Math.max(
				actionValue,
				teammate.nextActionValue - adv,
			);
		}
	}
	if (isCharacterTarget(caster.character) && caster.character.hasWindSet) {
		const windAdvance = 2500 / casterSpeed;
		if (!caster.blockNextAdvance) {
			caster.nextActionValue = Math.max(
				actionValue,
				caster.nextActionValue - windAdvance,
			);
		}
	}
	if (isAllyTarget(caster.character.kind)) {
		expirePhainonDomainSpeedBonus(states, actionValue);
	}

	// 风堇 interrupt Q
	if (
		isCharacterTarget(caster.character) &&
		hasHyacineIca(caster.character.name)
	) {
		handleHyacineQ(states, caster.character.id);
		const icaKey = `${interruptKey}-ica`;
		const icaInterrupts = input.ultInterrupts[icaKey] ?? [];
		for (let index = 0; index < icaInterrupts.length; index++) {
			const icaInterrupt = icaInterrupts[index];
			if (icaInterrupt.timing !== "before") continue;
			emitSpecialInterruptAction(
				`${icaKey}-interrupt-${index}`,
				icaInterrupt,
				actionValue,
				states,
				actions,
				input,
				activeOdes,
				calcAhaSpeed,
				emitExtraAhaActionFn,
				emitSparxieExtraActionFn,
			);
		}
		actions.push(
			createIcaAction(caster.character.id, interruptKey, actionValue),
		);
		for (let index = 0; index < icaInterrupts.length; index++) {
			const icaInterrupt = icaInterrupts[index];
			if (icaInterrupt.timing !== "after") continue;
			emitSpecialInterruptAction(
				`${icaKey}-interrupt-${index}`,
				icaInterrupt,
				actionValue,
				states,
				actions,
				input,
				activeOdes,
				calcAhaSpeed,
				emitExtraAhaActionFn,
				emitSparxieExtraActionFn,
			);
		}
	}

	if (hasSkillEffect(caster.character.name, "W", "counterW")) {
		const domainRule = getCounterWDomainRule(caster.character.name);
		const domainInterval = getPhainonDomainInterval(
			caster.character,
			casterSpeed,
		);
		const isEndlessDomain = hasActiveOdeEffect(
			activeOdes,
			caster.character.id,
			"endlessCounterWDomain",
		);
		const maxDomainActionIndex = isEndlessDomain
			? Math.max(0, Math.ceil((input.limit - actionValue) / domainInterval))
			: Math.max(0, domainRule.extraActionCount - 1);
		const domainEndIndex = getPhainonDomainEndIndex(
			effectSourceKey,
			input.domainEndOverrides,
			maxDomainActionIndex,
		);
		if (domainEndIndex >= 0) {
			caster.domainState = {
				keyPrefix: effectSourceKey,
				startAV: actionValue,
				interval: domainInterval,
				currentIndex: 0,
				maxIndex: domainEndIndex,
				rule: domainRule,
			};
			freezeAlliesForDomain(states, casterIndex, actionValue);
			caster.nextActionValue = actionValue;
		}
	}
	emitGodmodeExtraAction(interruptKey, actionValue, states, actions, input);
	// 手动插队 Q 不经过普通行动收尾，需在此补发绯英追击。
	emitFuaAction(interruptKey, actionValue, states, actions, input);
	emitMydeiGodslayerExtraAction(
		interruptKey,
		actionValue,
		states,
		actions,
		input,
	);
}

export function emitSparxieExtraAction(
	sourceKey: string,
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
	input: SimulateActionsInput,
	activeOdes: Map<string, ActiveOdeState[]>,
	calcAhaSpeed: () => number,
	emitExtraAhaActionFn: (sourceKey: string, actionValue: number) => void,
): void {
	const sparxieState = states.find(
		(s) =>
			isCharacterTarget(s.character) &&
			hasPassive(s.character.name, "ahaExtraTurnAtE2") &&
			s.character.eidolon >= 2,
	);
	if (!sparxieState) return;

	const sparxieKey = `${sourceKey}-sparxie-extra`;
	const sparxieInterrupts = input.ultInterrupts[sparxieKey] ?? [];
	const rawSkill = (input.skillOverrides[sparxieKey] ?? "") as SkillCode;
	const himekoNovaAssist =
		rawSkill.includes("F") &&
		!hasSkillEffect(sparxieState.character.name, "F", "himekoNovaAssist")
			? findHimekoNovaAssistState(states, sparxieState.character.id)
			: undefined;
	const assistUseCount = rawSkill.match(/F/g)?.length ?? 0;
	const himekoNovaLowEidolon =
		himekoNovaAssist !== undefined && himekoNovaAssist.character.eidolon < 2;
	const novaFFCidWhitelist = new Set([
		"1002",
		"1414",
		"1001",
		"1224",
		"1413",
		"1004",
		"8002",
		"8004",
		"8006",
		"8008",
		"8010",
		"1313",
		"1003",
	]);
	const sparxieCid = getCharacterCid(sparxieState.character.name);
	const isNovaFFWhitelisted =
		sparxieCid !== undefined && novaFFCidWhitelist.has(sparxieCid);
	const skipAssistFollowUp =
		himekoNovaAssist !== undefined &&
		(assistUseCount >= 2 || (himekoNovaLowEidolon && !isNovaFFWhitelisted));
	const hasSelfQ = rawSkill.includes("Q") && rawSkill.length > 1;
	const qIsFront = hasSelfQ && rawSkill.startsWith("Q");
	const resolvedSkill = (
		hasSelfQ ? rawSkill.replace(/Q/g, "") || "" : rawSkill
	) as SkillCode;
	const strippedSkill = resolvedSkill.replace(/F/g, "") as SkillCode;

	for (let ai = 0; ai < sparxieInterrupts.length; ai++) {
		const int = sparxieInterrupts[ai];
		if (int.timing !== "before") continue;
		emitSpecialInterruptAction(
			`${sparxieKey}-interrupt-${ai}`,
			int,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaActionFn,
			(sk: string, av: number) =>
				emitSparxieExtraAction(
					sk,
					av,
					states,
					actions,
					input,
					activeOdes,
					calcAhaSpeed,
					emitExtraAhaActionFn,
				),
		);
	}

	if (himekoNovaAssist) {
		for (let ai = 1; ai <= Math.min(assistUseCount, 2); ai++) {
			const assistKey =
				ai === 1 ? `${sparxieKey}-assist-F` : `${sparxieKey}-assist-F-${ai}`;
			actions.push({
				key: assistKey,
				characterId: himekoNovaAssist.character.id,
				actionNo: 0,
				actionValue,
				skill: "F" as SkillCode,
				speed: himekoNovaAssist.currentSpeed,
				isAssistAction: true,
				assistSourceKey: sparxieKey,
				assistIndex: ai,
				activeOdeLabels: getActiveOdeLabels(
					activeOdes,
					himekoNovaAssist.character.id,
				),
			});
		}
	}

	if (hasSelfQ && qIsFront) {
		actions.push({
			key: `${sparxieKey}-q`,
			characterId: sparxieState.character.id,
			actionNo: 0,
			actionValue,
			skill: "Q" as SkillCode,
			speed: sparxieState.currentSpeed,
		});
	}

	if (!skipAssistFollowUp) {
		actions.push({
			key: sparxieKey,
			characterId: sparxieState.character.id,
			actionNo: 0,
			actionValue,
			skill: strippedSkill,
			speed: sparxieState.currentSpeed,
			isSparxieExtraAction: true,
			isAssistFollowUp: himekoNovaAssist !== undefined,
			activeOdeLabels: getActiveOdeLabels(
				activeOdes,
				sparxieState.character.id,
			),
		});
	}

	if (hasSelfQ && !qIsFront) {
		actions.push({
			key: `${sparxieKey}-q`,
			characterId: sparxieState.character.id,
			actionNo: 0,
			actionValue,
			skill: "Q" as SkillCode,
			speed: sparxieState.currentSpeed,
		});
	}

	for (let ai = 0; ai < sparxieInterrupts.length; ai++) {
		const int = sparxieInterrupts[ai];
		if (int.timing !== "after") continue;
		emitSpecialInterruptAction(
			`${sparxieKey}-interrupt-${ai}`,
			int,
			actionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaActionFn,
			(sk: string, av: number) =>
				emitSparxieExtraAction(
					sk,
					av,
					states,
					actions,
					input,
					activeOdes,
					calcAhaSpeed,
					emitExtraAhaActionFn,
				),
		);
	}

	if (
		input.godmodeExtraActions?.[`${sparxieKey}-q`] &&
		!input.godmodeExtraActions?.[sparxieKey]
	) {
		const swIndex = states.findIndex(
			(s) => hasSilverWolfGodmode(s.character.name) && isInGodmode(s),
		);
		if (swIndex !== -1) {
			const sw = states[swIndex];
			actions.push({
				key: `${sparxieKey}-godmode-A`,
				characterId: sw.character.id,
				displayName: "银狼E2",
				actionNo: 0,
				actionValue,
				skill: "A" as SkillCode,
				speed: sw.currentSpeed,
				lockedSkill: true,
			});
		}
	} else {
		emitGodmodeExtraAction(sparxieKey, actionValue, states, actions, input);
	}
}

export function emitEvernightSelfDestructAction(
	sourceKey: string,
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
	input: SimulateActionsInput,
	activeOdes: Map<string, ActiveOdeState[]>,
	calcAhaSpeed: () => number,
	emitExtraAhaActionFn: (sourceKey: string, actionValue: number) => void,
	emitSparxieExtraActionFn: (sourceKey: string, actionValue: number) => void,
): void {
	const eveyIndex = states.findIndex((state) => state.isEveyAction);
	if (eveyIndex === -1) return;
	const eveyState = states[eveyIndex];
	const ownerId = eveyState.character.id.replace("-evey", "");
	const ownerState = states.find((state) => state.character.id === ownerId);
	if (!ownerState?.eveyOnField) return;
	const sourceResourceValue = input.resourceValues?.[sourceKey]?.忆质;
	const parsed = Number.parseFloat(sourceResourceValue ?? "");
	const hasNumericValue =
		(sourceResourceValue ?? "").trim() !== "" && Number.isFinite(parsed);
	const isAutoThresholdBurst = hasNumericValue && parsed >= 16;
	const isBlockedByInsufficient = hasNumericValue && parsed < 16;
	const isManualSelfDestruct =
		!hasNumericValue &&
		input.evernightSelfDestructToggles?.[sourceKey] === true;
	if (isBlockedByInsufficient) return;
	if (!isAutoThresholdBurst && !isManualSelfDestruct) return;

	const key =
		eveyState.eveyGeneration && eveyState.eveyGeneration > 1
			? `${eveyState.character.id}-${eveyState.actionNo}-g${eveyState.eveyGeneration}`
			: `${eveyState.character.id}-${eveyState.actionNo}`;
	const resolvedActionValue = toNonNegativeNumber(
		input.overrides[key],
		actionValue,
	);
	const interrupts = input.ultInterrupts[key] ?? [];
	for (let ai = 0; ai < interrupts.length; ai++) {
		const int = interrupts[ai];
		if (int.timing !== "before") continue;
		emitSpecialInterruptAction(
			`${key}-interrupt-${ai}`,
			int,
			resolvedActionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaActionFn,
			emitSparxieExtraActionFn,
		);
	}
	eveyState.nextActionValue = resolvedActionValue;
	handleEveyAction(
		states,
		eveyIndex,
		actions,
		key,
		resolvedActionValue,
		"E" as SkillCode,
		{
			lockedSkill: true,
			selfDestruct: !isAutoThresholdBurst,
			thresholdBurst: isAutoThresholdBurst,
			resourceValue: sourceResourceValue,
		},
	);
	for (let ai = 0; ai < interrupts.length; ai++) {
		const int = interrupts[ai];
		if (int.timing !== "after") continue;
		emitSpecialInterruptAction(
			`${key}-interrupt-${ai}`,
			int,
			resolvedActionValue,
			states,
			actions,
			input,
			activeOdes,
			calcAhaSpeed,
			emitExtraAhaActionFn,
			emitSparxieExtraActionFn,
		);
	}
}

/** 获取队伍中所有欢愉命途角色，按参演编号从小到大排序。 */
export function getElationParticipants(states: ActionState[]): ActionState[] {
	return states
		.filter(
			(s) =>
				s.character.kind === "角色" &&
				getCharacterParticipantId(s.character.name) !== undefined,
		)
		.sort((a, b) => {
			const aId = getCharacterParticipantId(a.character.name) ?? 999;
			const bId = getCharacterParticipantId(b.character.name) ?? 999;
			return aId - bId;
		});
}

/** 发射单个欢愉角色的欢愉技（ES）行动。 */
export function emitSingleElationSkill(
	elationState: ActionState,
	parentKey: string,
	actionValue: number,
	actions: GeneratedAction[],
): void {
	actions.push({
		key: `${parentKey}-elation-${elationState.character.id}`,
		characterId: elationState.character.id,
		actionNo: 0,
		actionValue,
		skill: "ES" as SkillCode,
		speed: 0,
		isElationSkill: true,
		elationSkillParentKey: parentKey,
		lockedSkill: true,
	});
}

/** 发射所有欢愉角色的欢愉技（按参演编号顺序），用于阿哈时刻。 */
export function emitElationSkills(
	parentKey: string,
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
): void {
	const elationChars = getElationParticipants(states);
	for (const elationState of elationChars) {
		emitSingleElationSkill(elationState, parentKey, actionValue, actions);
	}
}

/** 发射绯英追击（Z），由右键菜单 evanesciaFuaToggles 控制。E1+ 追加一次欢愉技。 */
export function emitFuaAction(
	sourceKey: string,
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
	input: SimulateActionsInput,
): void {
	if (!input.evanesciaFuaToggles?.[sourceKey]) return;
	const evanescia = states.find(
		(s) =>
			s.character.kind === "角色" &&
			getCharacterCid(s.character.name) === "1505",
	);
	if (!evanescia) return;
	const fuaKey = `${sourceKey}-fua`;
	actions.push({
		key: fuaKey,
		characterId: evanescia.character.id,
		displayName: "绯英",
		actionNo: 0,
		actionValue,
		skill: "Z" as SkillCode,
		speed: 0,
		isFuaAction: true,
		lockedSkill: true,
	});
	// E1+ 追加欢愉技
	if (evanescia.character.eidolon >= 1) {
		emitSingleElationSkill(evanescia, fuaKey, actionValue, actions);
	}
}
