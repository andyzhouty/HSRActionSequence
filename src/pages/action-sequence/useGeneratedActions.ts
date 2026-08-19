import { type Dispatch, type SetStateAction, useEffect, useMemo } from "react";
import {
	buildCharacterSelectors,
	buildMemospriteTargets,
} from "../../contexts/actionSequenceSelectors";
import { simulateActions } from "../../simulate/actions";
import type { SimulateActionsInput } from "../../simulate/types";
import {
	type GeneratedAction,
	getErrorMessage,
} from "../../utils/action-sequence";
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
		ashveilFuaToggles: savedData.ashveilFuaToggles,
		kafkaFuaToggles: savedData.kafkaFuaToggles,
		spBladeExtraTurnToggles: savedData.spBladeExtraTurnToggles,
		mydeiVendettaToggles: savedData.mydeiVendettaToggles,
		mydeiGodslayerToggles: savedData.mydeiGodslayerToggles,
		spRobinFeverToggles: savedData.spRobinFeverToggles,
		sameAVOrder: savedData.sameAVOrder,
	};
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
			const nextEvanesciaFuaToggles = pruneToggleMap(prev.evanesciaFuaToggles);
			const nextAshveilFuaToggles = pruneToggleMap(prev.ashveilFuaToggles);
			const nextKafkaFuaToggles = pruneToggleMap(prev.kafkaFuaToggles);
			const nextSpBladeExtraTurnToggles = pruneToggleMap(
				prev.spBladeExtraTurnToggles,
			);
			const nextMydeiVendettaToggles = pruneToggleMap(
				prev.mydeiVendettaToggles,
			);
			const nextMydeiGodslayerToggles = pruneToggleMap(
				prev.mydeiGodslayerToggles,
			);
			const nextSpRobinFeverToggles = pruneToggleMap(prev.spRobinFeverToggles);
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
				nextAshveilFuaToggles !== prev.ashveilFuaToggles ||
				nextKafkaFuaToggles !== prev.kafkaFuaToggles ||
				nextSpBladeExtraTurnToggles !== prev.spBladeExtraTurnToggles ||
				nextMydeiVendettaToggles !== prev.mydeiVendettaToggles ||
				nextMydeiGodslayerToggles !== prev.mydeiGodslayerToggles ||
				nextSpRobinFeverToggles !== prev.spRobinFeverToggles ||
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
				ashveilFuaToggles: nextAshveilFuaToggles,
				kafkaFuaToggles: nextKafkaFuaToggles,
				spBladeExtraTurnToggles: nextSpBladeExtraTurnToggles,
				mydeiVendettaToggles: nextMydeiVendettaToggles,
				mydeiGodslayerToggles: nextMydeiGodslayerToggles,
				spRobinFeverToggles: nextSpRobinFeverToggles,
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

	const memospriteTargets = useMemo(
		() => buildMemospriteTargets(savedData.characters),
		[savedData.characters],
	);

	const { characterNames, characterKinds, charactersById } = useMemo(
		() =>
			buildCharacterSelectors(
				savedData.characters,
				memospriteTargets,
				actionsResult.actions,
			),
		[savedData.characters, memospriteTargets, actionsResult.actions],
	);

	return {
		actions: actionsResult.actions,
		characterNames,
		memospriteTargets,
		characterKinds,
		charactersById,
	};
}
