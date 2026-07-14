import { type Dispatch, type SetStateAction, useEffect, useMemo } from "react";
import type { SimulateActionsInput } from "../../simulate/actions";
import { simulateActions } from "../../simulate/actions";
import {
	type CharacterConfig,
	type GeneratedAction,
	getCyreneUltimateRule,
	getErrorMessage,
	getEveyRule,
	getGarmentmakerRule,
	getMemeAdvanceRule,
	getPolluxRule,
	getTargetDefaultName,
	hasSkillEffect,
} from "../../utils/actionSequence";
import type { NormalizedSavedData } from "./savedData";
import { pruneRecord } from "./savedData";

type UseGeneratedActionsParams = {
	savedData: NormalizedSavedData;
	displayedActionLimit: number;
	setMessage: (message: string) => void;
	updateSavedData: (
		updater: (prev: NormalizedSavedData) => NormalizedSavedData,
	) => void;
	setSelectedActionKeys: Dispatch<SetStateAction<Set<string>>>;
};

function buildSimulationConfig(
	savedData: NormalizedSavedData,
	displayedActionLimit: number,
): SimulateActionsInput {
	return {
		characters: savedData.characters,
		limit: displayedActionLimit,
		overrides: savedData.overrides,
		skillOverrides: savedData.skillOverrides,
		domainEndOverrides: savedData.domainEndOverrides,
		legacyUltOverrides: savedData.ultOverrides,
		speedAdjustments: savedData.speedAdjustments,
		skillTargets: savedData.skillTargets,
		defaultSkillTargets: savedData.defaultSkillTargets,
		odeSelections: savedData.odeSelections,
		memeSelections: savedData.memeSelections,
		ultInterrupts: savedData.ultInterrupts,
		resourceValues: savedData.resourceValues,
		fireflyBreakCounters: savedData.fireflyBreakCounters,
		godmodeExtraActions: savedData.godmodeExtraActions,
		castoriceKillToggles: savedData.castoriceKillToggles,
		icaKillToggles: savedData.icaKillToggles,
		memeKillToggles: savedData.memeKillToggles,
		evernightSelfDestructToggles: savedData.evernightSelfDestructToggles,
		evernightThresholdBurstToggles: savedData.evernightThresholdBurstToggles,
		hyacineE2Active: savedData.hyacineE2Active,
		meritTarget: savedData.meritTarget,
		dancePartner: savedData.dancePartner,
		bondmateTarget: savedData.bondmateTarget,
		attackDisabled: savedData.attackDisabled,
		saberAdvanceToggles: savedData.saberAdvanceToggles,
		evanesciaFuaToggles: savedData.evanesciaFuaToggles,
		sameAVOrder: savedData.sameAVOrder,
	};
}

function buildMemospriteTargets(characters: CharacterConfig[]) {
	return characters.flatMap((character) => {
		const memos: CharacterConfig[] = [];
		if (hasSkillEffect(character.name, "E", "summonGarmentmaker")) {
			const rule = getGarmentmakerRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-garmentmaker`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "E", "summonMeme")) {
			const rule = getMemeAdvanceRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-meme`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "Q", "cyreneUltimate")) {
			const rule = getCyreneUltimateRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-memosprite`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: "0",
				baseSpeed: "0",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "Q", "summonPollux")) {
			const rule = getPolluxRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-pollux`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "E", "summonEvey")) {
			const rule = getEveyRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-evey`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "E", "summonIca")) {
			memos.push({
				...character,
				id: `${character.id}-ica`,
				kind: "忆灵",
				name: "小伊卡",
				speed: "0",
				baseSpeed: "0",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		return memos;
	});
}

export function useGeneratedActions({
	savedData,
	displayedActionLimit,
	setMessage,
	updateSavedData,
	setSelectedActionKeys,
}: UseGeneratedActionsParams) {
	const actionsResult = useMemo(() => {
		try {
			return {
				actions: simulateActions(
					buildSimulationConfig(savedData, displayedActionLimit),
				),
				error: null,
			};
		} catch (error) {
			return {
				actions: [] as GeneratedAction[],
				error: `行动轴计算失败：${getErrorMessage(error)}`,
			};
		}
	}, [savedData, displayedActionLimit]);

	useEffect(() => {
		if (actionsResult.error) {
			setMessage(actionsResult.error);
		}
	}, [actionsResult.error, setMessage]);

	useEffect(() => {
		const actionKeys = new Set(
			actionsResult.actions.map((action) => action.key),
		);
		const isStaleAglaeaCountdownKey = (key: string) =>
			key.includes("-aglaea-countdown-") && !actionKeys.has(key);

		updateSavedData((prev) => {
			const nextOverrides = pruneRecord(
				prev.overrides,
				isStaleAglaeaCountdownKey,
			);
			const nextSpeedAdjustments = pruneRecord(
				prev.speedAdjustments,
				isStaleAglaeaCountdownKey,
			);
			const nextResourceValues = pruneRecord(
				prev.resourceValues,
				isStaleAglaeaCountdownKey,
			);
			let changed =
				nextOverrides !== prev.overrides ||
				nextSpeedAdjustments !== prev.speedAdjustments ||
				nextResourceValues !== prev.resourceValues;

			let nextFireflyBreakCounters = prev.fireflyBreakCounters;
			{
				let localChanged = false;
				const next = { ...nextFireflyBreakCounters };
				for (const key of Object.keys(next)) {
					if (!actionKeys.has(key)) {
						delete next[key];
						localChanged = true;
					}
				}
				for (const key of actionKeys) {
					if (/break-extra-\d+$/.test(key) && !(key in next)) {
						next[key] = true;
						localChanged = true;
					}
				}
				if (localChanged) {
					nextFireflyBreakCounters = next;
					changed = true;
				}
			}

			const pruneToggleMap = (record: Record<string, boolean>) => {
				let localChanged = false;
				const next = { ...record };
				for (const key of Object.keys(next)) {
					if (!actionKeys.has(key)) {
						delete next[key];
						localChanged = true;
					}
				}
				return localChanged ? next : record;
			};
			const nextCastoriceKillToggles = pruneToggleMap(
				prev.castoriceKillToggles,
			);
			const nextIcaKillToggles = pruneToggleMap(prev.icaKillToggles);
			const nextMemeKillToggles = pruneToggleMap(prev.memeKillToggles);
			const nextEvernightSelfDestructToggles = pruneToggleMap(
				prev.evernightSelfDestructToggles,
			);
			const nextEvernightThresholdBurstToggles = pruneToggleMap(
				prev.evernightThresholdBurstToggles,
			);
			const nextAttackDisabled = pruneToggleMap(prev.attackDisabled);
			const nextEvanesciaFuaToggles = pruneToggleMap(
				prev.evanesciaFuaToggles,
			);
			const nextSaberAdvanceToggles = pruneToggleMap(prev.saberAdvanceToggles);
			changed =
				changed ||
				nextCastoriceKillToggles !== prev.castoriceKillToggles ||
				nextIcaKillToggles !== prev.icaKillToggles ||
				nextMemeKillToggles !== prev.memeKillToggles ||
				nextEvernightSelfDestructToggles !==
					prev.evernightSelfDestructToggles ||
				nextEvernightThresholdBurstToggles !==
					prev.evernightThresholdBurstToggles ||
				nextAttackDisabled !== prev.attackDisabled ||
				nextEvanesciaFuaToggles !== prev.evanesciaFuaToggles ||
				nextSaberAdvanceToggles !== prev.saberAdvanceToggles;

			if (!changed) return prev;
			return {
				...prev,
				overrides: nextOverrides,
				speedAdjustments: nextSpeedAdjustments,
				resourceValues: nextResourceValues,
				fireflyBreakCounters: nextFireflyBreakCounters,
				castoriceKillToggles: nextCastoriceKillToggles,
				icaKillToggles: nextIcaKillToggles,
				memeKillToggles: nextMemeKillToggles,
				evernightSelfDestructToggles: nextEvernightSelfDestructToggles,
				evernightThresholdBurstToggles: nextEvernightThresholdBurstToggles,
				attackDisabled: nextAttackDisabled,
				evanesciaFuaToggles: nextEvanesciaFuaToggles,
				saberAdvanceToggles: nextSaberAdvanceToggles,
			};
		});
		setSelectedActionKeys((prev) => {
			let changed = false;
			const next = new Set<string>();
			for (const key of prev) {
				if (isStaleAglaeaCountdownKey(key)) {
					changed = true;
					continue;
				}
				next.add(key);
			}
			return changed ? next : prev;
		});
	}, [actionsResult.actions, setSelectedActionKeys, updateSavedData]);

	const characterNames = useMemo(() => {
		const names = Object.fromEntries(
			savedData.characters.map((character, index) => [
				character.id,
				character.name.trim() || getTargetDefaultName(character.kind, index),
			]),
		);
		for (const action of actionsResult.actions) {
			if (action.displayName) names[action.characterId] = action.displayName;
		}
		return names;
	}, [savedData.characters, actionsResult.actions]);

	const memospriteTargets = useMemo(
		() => buildMemospriteTargets(savedData.characters),
		[savedData.characters],
	);

	const characterKinds = useMemo(() => {
		const kinds = Object.fromEntries([
			...savedData.characters.map(
				(character) => [character.id, character.kind] as const,
			),
			...memospriteTargets.map(
				(memosprite) => [memosprite.id, memosprite.kind] as const,
			),
		]);
		for (const action of actionsResult.actions) {
			if (action.targetKind) kinds[action.characterId] = action.targetKind;
		}
		return kinds;
	}, [savedData.characters, memospriteTargets, actionsResult.actions]);

	const charactersById = useMemo(
		() =>
			Object.fromEntries([
				...savedData.characters.map(
					(character) => [character.id, character] as const,
				),
				...memospriteTargets.map(
					(memosprite) => [memosprite.id, memosprite] as const,
				),
			]),
		[savedData.characters, memospriteTargets],
	);

	return {
		actions: actionsResult.actions,
		characterNames,
		memospriteTargets,
		characterKinds,
		charactersById,
	};
}
