import { hasPassive, hasSkillEffect } from "../data/characters";
import {
	type GeneratedAction,
	getCharacterCid,
	getCounterWDomainRule,
	isCharacterTarget,
	type SkillCode,
} from "../utils/actionSequence";
import {
	activateCombustion,
	shouldActivateCombustion,
} from "../mechanics/fireflyCombustion";
import {
	handleAglaeaSkillEffects,
} from "../mechanics/aglaeaGarmentmaker";
import {
	hasCastoriceSummon,
	summonPollux,
	applyCastoriceE2Pull,
} from "../mechanics/castoricePollux";
import {
	type GodmodeState,
	activateGodmode,
	hasSilverWolfGodmode,
	isInGodmode,
} from "../mechanics/silverWolfGodmode";
import {
	canBeAdvancedByDance,
	consumeActionOdes,
	emitCyreneMemospriteAction,
	emitMemeAdvanceAction,
	findHimekoNovaAssistState,
	getActiveOdeLabels,
	hasActiveOdeEffect,
	getTeamAdvanceOnUltimate,
	isAllyTarget,
	summonMemeState,
	toNonNegativeNumber,
	handleMemoryTrailblazerQ,
	handleCyrenePostUltimate,
} from "./effects";
import {
	hasHyacineIca,
	createIcaAction,
	handleHyacineQ,
} from "../mechanics/hyacineIca";
import {
	hasEvernightEvey,
	handleEveyAction,
	summonEveyState,
} from "../mechanics/evernightEvey";
import {
	expirePhainonDomainSpeedBonus,
	freezeAlliesForDomain,
	getPhainonDomainEndIndex,
	getPhainonDomainInterval,
} from "../mechanics/phainonDomain";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

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
	emitSparxieExtraActionFn: (
		sourceKey: string,
		actionValue: number,
	) => void,
): void {
	const extraAhaKey = `${sourceKey}-extra-aha`;
	const extraAhaInterrupts = input.ultInterrupts[extraAhaKey] ?? [];
	const extraAhaSpeed = calcAhaSpeed();

	// 递归调用时保持简洁的回调签名。
	const emitExtraAhaSimple: (sk: string, av: number) => void = (sk, av) => {
		emitExtraAhaAction(sk, av, states, actions, input, activeOdes, calcAhaSpeed, emitSparxieExtraActionFn);
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
	});

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
	emitMemeAdvanceAction({ input, actions, states, sourceKey: extraAhaKey, actionValue, activeOdes });
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
	emitExtraAhaActionFn: (
		sourceKey: string,
		actionValue: number,
	) => void,
	emitSparxieExtraActionFn: (
		sourceKey: string,
		actionValue: number,
	) => void,
): void {
	void calcAhaSpeed;
	void emitSparxieExtraActionFn;
	const casterIndex = states.findIndex(
		(s) => s.character.id === int.casterId,
	);
	if (casterIndex === -1) return;
	const caster = states[casterIndex];
	const casterSpeed = caster.currentSpeed;
	caster.lastActionValue = actionValue;
	actions.push({
		key: interruptKey,
		characterId: caster.character.id,
		actionNo: 0,
		actionValue,
		skill: "Q" as SkillCode,
		speed: casterSpeed,
		activeOdeLabels: getActiveOdeLabels(activeOdes, caster.character.id),
	});
	emitMemeAdvanceAction({ input, actions, states, sourceKey: interruptKey, actionValue, activeOdes });
	consumeActionOdes(activeOdes, caster.character.id, "Q", false);
	if (hasSkillEffect(caster.character.name, "Q", "cyreneUltimate")) {
		emitCyreneMemospriteAction({
			input, actions, states, activeOdes, cyrene: caster.character,
			sourceKey: interruptKey, actionValue,
		});
		handleCyrenePostUltimate({
			states, casterIndex, character: caster.character, actions,
			actionValue, activeOdes, isInterrupt: true,
		});
	}
	if (hasSkillEffect(caster.character.name, "Q", "extraAhaAfterUltimate")) {
		emitExtraAhaActionFn(interruptKey, actionValue);
	}
	if (
		isCharacterTarget(caster.character) &&
		hasSkillEffect(caster.character.name, "E", "summonMeme")
	) {
		summonMemeState(states, caster.character, actionValue);
		handleMemoryTrailblazerQ(states[casterIndex]);
	}
	if (
		isCharacterTarget(caster.character) &&
		hasEvernightEvey(caster.character.name) &&
		!caster.eveyOnField
	) {
		summonEveyState(states, caster.character, actionValue, {
			immediate: true,
			sameActionPriority: -2,
		});
	}
	const teamAdvance = getTeamAdvanceOnUltimate(caster.character);
	if (teamAdvance > 0) {
		for (let teammateIndex = 0; teammateIndex < states.length; teammateIndex++) {
			const teammate = states[teammateIndex];
			if (!canBeAdvancedByDance(teammate.character.kind)) continue;
			if (teammate.blockNextAdvance) continue;
			const adv = teamAdvance / teammate.currentSpeed;
			teammate.nextActionValue = Math.max(actionValue, teammate.nextActionValue - adv);
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
	if (hasSkillEffect(caster.character.name, "Q", "robinUltimate")) {
		caster.currentSpeed = 90;
		caster.nextActionValue = actionValue + 10000 / caster.currentSpeed;
		caster.blockNextAdvance = true;
		const allyOrder = states
			.map((s, i) => ({ index: i, value: s.nextActionValue }))
			.filter(({ index }) => index !== casterIndex && isAllyTarget(states[index].character.kind))
			.sort((a, b) => (a.value !== b.value ? a.value - b.value : a.index - b.index));
		for (let rank = 0; rank < allyOrder.length; rank++) {
			states[allyOrder[rank].index].nextActionValue = actionValue + rank * 0.0001;
		}
	}
	if (isCharacterTarget(caster.character) && hasSkillEffect(caster.character.name, "Q", "selfAdvance100")) {
		if (hasSilverWolfGodmode(caster.character.name)) {
			activateGodmode(states as GodmodeState[], casterIndex);
		}
		caster.nextActionValue = actionValue;
	}
	if (shouldActivateCombustion(caster.character, true, Boolean(caster.isInCompleteCombustion))) {
		activateCombustion(states, casterIndex, caster.character, actionValue);
	}
	handleAglaeaSkillEffects(states, casterIndex, "Q", actionValue);
	if (hasSkillEffect(caster.character.name, "W", "counterW")) {
		const domainRule = getCounterWDomainRule(caster.character.name);
		const domainInterval = getPhainonDomainInterval(caster.character, casterSpeed);
		const isEndlessDomain = hasActiveOdeEffect(activeOdes, caster.character.id, "endlessCounterWDomain");
		const maxDomainActionIndex = isEndlessDomain
			? Math.max(0, Math.ceil((input.limit - actionValue) / domainInterval))
			: Math.max(0, domainRule.extraActionCount - 1);
		const domainEndIndex = getPhainonDomainEndIndex(interruptKey, input.domainEndOverrides, maxDomainActionIndex);
		if (domainEndIndex >= 0) {
			caster.domainState = {
				keyPrefix: interruptKey, startAV: actionValue, interval: domainInterval,
				currentIndex: 0, maxIndex: domainEndIndex, rule: domainRule,
			};
			freezeAlliesForDomain(states, casterIndex, actionValue);
			caster.nextActionValue = actionValue;
		}
	}
	if (isCharacterTarget(caster.character) && hasHyacineIca(caster.character.name)) {
		handleHyacineQ(states, caster.character.id);
		actions.push(createIcaAction(caster.character.id, interruptKey, actionValue));
	}
	if (
		isCharacterTarget(caster.character) &&
		hasCastoriceSummon(caster.character.name) &&
		!caster.polluxOnField
	) {
		summonPollux(states, caster.character, actionValue, { sameActionPriority: -1 });
		if (caster.character.eidolon >= 2) {
			applyCastoriceE2Pull(states, casterIndex, actionValue);
		}
	}
	emitGodmodeExtraAction(interruptKey, actionValue, states, actions, input);
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
		(s) => isCharacterTarget(s.character) && hasPassive(s.character.name, "ahaExtraTurnAtE2") && s.character.eidolon >= 2,
	);
	if (!sparxieState) return;

	const sparxieKey = `${sourceKey}-sparxie-extra`;
	const sparxieInterrupts = input.ultInterrupts[sparxieKey] ?? [];
	const rawSkill = (input.skillOverrides[sparxieKey] ?? "") as SkillCode;
	const himekoNovaAssist =
		rawSkill.includes("F") && !hasSkillEffect(sparxieState.character.name, "F", "himekoNovaAssist")
			? findHimekoNovaAssistState(states, sparxieState.character.id)
			: undefined;
	const assistUseCount = rawSkill.match(/F/g)?.length ?? 0;
	const himekoNovaLowEidolon = himekoNovaAssist !== undefined && himekoNovaAssist.character.eidolon < 2;
	const novaFFCidWhitelist = new Set(["1002", "1414", "1001", "1224", "1413", "1004", "8002", "8004", "8006", "8008", "8010", "1313", "1003"]);
	const sparxieCid = getCharacterCid(sparxieState.character.name);
	const isNovaFFWhitelisted = sparxieCid !== undefined && novaFFCidWhitelist.has(sparxieCid);
	const skipAssistFollowUp = himekoNovaAssist !== undefined && (assistUseCount >= 2 || (himekoNovaLowEidolon && !isNovaFFWhitelisted));
	const hasSelfQ = rawSkill.includes("Q") && rawSkill.length > 1;
	const qIsFront = hasSelfQ && rawSkill.startsWith("Q");
	const resolvedSkill = (hasSelfQ ? rawSkill.replace(/Q/g, "") || "" : rawSkill) as SkillCode;
	const strippedSkill = resolvedSkill.replace(/F/g, "") as SkillCode;

	for (let ai = 0; ai < sparxieInterrupts.length; ai++) {
		const int = sparxieInterrupts[ai];
		if (int.timing !== "before") continue;
		emitSpecialInterruptAction(`${sparxieKey}-interrupt-${ai}`, int, actionValue, states, actions, input, activeOdes, calcAhaSpeed, emitExtraAhaActionFn, (sk: string, av: number) => emitSparxieExtraAction(sk, av, states, actions, input, activeOdes, calcAhaSpeed, emitExtraAhaActionFn));
	}

	if (himekoNovaAssist) {
		for (let ai = 1; ai <= Math.min(assistUseCount, 2); ai++) {
			const assistKey = ai === 1 ? `${sparxieKey}-assist-F` : `${sparxieKey}-assist-F-${ai}`;
			actions.push({
				key: assistKey, characterId: himekoNovaAssist.character.id, actionNo: 0, actionValue,
				skill: "F" as SkillCode, speed: himekoNovaAssist.currentSpeed, isAssistAction: true,
				assistSourceKey: sparxieKey, assistIndex: ai,
				activeOdeLabels: getActiveOdeLabels(activeOdes, himekoNovaAssist.character.id),
			});
		}
	}

	if (hasSelfQ && qIsFront) {
		actions.push({ key: `${sparxieKey}-q`, characterId: sparxieState.character.id, actionNo: 0, actionValue, skill: "Q" as SkillCode, speed: sparxieState.currentSpeed });
	}

	if (!skipAssistFollowUp) {
		actions.push({
			key: sparxieKey, characterId: sparxieState.character.id, actionNo: 0, actionValue,
			skill: strippedSkill, speed: sparxieState.currentSpeed, isSparxieExtraAction: true,
			isAssistFollowUp: himekoNovaAssist !== undefined,
			activeOdeLabels: getActiveOdeLabels(activeOdes, sparxieState.character.id),
		});
	}

	if (hasSelfQ && !qIsFront) {
		actions.push({ key: `${sparxieKey}-q`, characterId: sparxieState.character.id, actionNo: 0, actionValue, skill: "Q" as SkillCode, speed: sparxieState.currentSpeed });
	}

	for (let ai = 0; ai < sparxieInterrupts.length; ai++) {
		const int = sparxieInterrupts[ai];
		if (int.timing !== "after") continue;
		emitSpecialInterruptAction(`${sparxieKey}-interrupt-${ai}`, int, actionValue, states, actions, input, activeOdes, calcAhaSpeed, emitExtraAhaActionFn, (sk: string, av: number) => emitSparxieExtraAction(sk, av, states, actions, input, activeOdes, calcAhaSpeed, emitExtraAhaActionFn));
	}

	if ((input.godmodeExtraActions ?? {})[`${sparxieKey}-q`] && !(input.godmodeExtraActions ?? {})[sparxieKey]) {
		const swIndex = states.findIndex((s) => hasSilverWolfGodmode(s.character.name) && isInGodmode(s));
		if (swIndex !== -1) {
			const sw = states[swIndex];
			actions.push({ key: `${sparxieKey}-godmode-A`, characterId: sw.character.id, displayName: "银狼E2", actionNo: 0, actionValue, skill: "A" as SkillCode, speed: sw.currentSpeed, lockedSkill: true });
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
	const sourceResourceValue = input.resourceValues?.[sourceKey]?.["忆质"];
	const parsed = Number.parseFloat(sourceResourceValue ?? "");
	const hasNumericValue = (sourceResourceValue ?? "").trim() !== "" && Number.isFinite(parsed);
	const isAutoThresholdBurst = hasNumericValue && parsed >= 16;
	const isBlockedByInsufficient = hasNumericValue && parsed < 16;
	const isManualSelfDestruct = !hasNumericValue && input.evernightSelfDestructToggles?.[sourceKey] === true;
	if (isBlockedByInsufficient) return;
	if (!isAutoThresholdBurst && !isManualSelfDestruct) return;

	const key = eveyState.eveyGeneration && eveyState.eveyGeneration > 1
		? `${eveyState.character.id}-${eveyState.actionNo}-g${eveyState.eveyGeneration}`
		: `${eveyState.character.id}-${eveyState.actionNo}`;
	const resolvedActionValue = toNonNegativeNumber(input.overrides[key], actionValue);
	const interrupts = input.ultInterrupts[key] ?? [];
	for (let ai = 0; ai < interrupts.length; ai++) {
		const int = interrupts[ai];
		if (int.timing !== "before") continue;
		emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, resolvedActionValue, states, actions, input, activeOdes, calcAhaSpeed, emitExtraAhaActionFn, emitSparxieExtraActionFn);
	}
	eveyState.nextActionValue = resolvedActionValue;
	handleEveyAction(states, eveyIndex, actions, key, resolvedActionValue, "E" as SkillCode, {
		lockedSkill: true,
		selfDestruct: !isAutoThresholdBurst,
		thresholdBurst: isAutoThresholdBurst,
		resourceValue: sourceResourceValue,
	});
	for (let ai = 0; ai < interrupts.length; ai++) {
		const int = interrupts[ai];
		if (int.timing !== "after") continue;
		emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, resolvedActionValue, states, actions, input, activeOdes, calcAhaSpeed, emitExtraAhaActionFn, emitSparxieExtraActionFn);
	}
}



