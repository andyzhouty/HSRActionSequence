import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	defaultResources,
	formatEditableNumber,
	getCounterWDomainRule,
	getCharacterCid,
	getCyreneUltimateRule,
	hasSkillEffect,
	maxResources,
	type OdeSelection,
	type SavedData,
	type SkillCode,
	type SpeedAdjustment,
	toPositiveNumber,
	type UltInterrupt,
} from "../../utils/actionSequence";
import type { CharacterConfig } from "../../utils/actionSequence";
import {
	createDefaultSavedData,
	type NormalizedSavedData,
	toExportSavedData,
	toNormalizedSavedData,
} from "./savedData";

type SavedDataFieldSetters = {
	setCharacters: Dispatch<SetStateAction<CharacterConfig[]>>;
	setLimitPreset: Dispatch<SetStateAction<string>>;
	setCustomLimit: Dispatch<SetStateAction<string>>;
	setDisplayedLimit: Dispatch<SetStateAction<string>>;
	setResources: Dispatch<SetStateAction<string[]>>;
	setOverrides: Dispatch<SetStateAction<Record<string, string>>>;
	setUltOverrides: Dispatch<SetStateAction<Record<string, boolean>>>;
	setSkillOverrides: Dispatch<SetStateAction<Record<string, SkillCode>>>;
	setDomainEndOverrides: Dispatch<SetStateAction<Record<string, boolean>>>;
	setSpeedAdjustments: Dispatch<
		SetStateAction<Record<string, SpeedAdjustment>>
	>;
	setSkillTargets: Dispatch<SetStateAction<Record<string, string>>>;
	setDefaultSkillTargets: Dispatch<SetStateAction<Record<string, string>>>;
	setOdeSelections: Dispatch<SetStateAction<Record<string, OdeSelection>>>;
	setMemeSelections: Dispatch<SetStateAction<Record<string, string>>>;
	setUltInterrupts: Dispatch<
		SetStateAction<Record<string, UltInterrupt[]>>
	>;
	setResourceValues: Dispatch<
		SetStateAction<Record<string, Record<string, string>>>
	>;
	setFireflyBreakCounters: Dispatch<
		SetStateAction<Record<string, boolean>>
	>;
	setGodmodeExtraActions: Dispatch<
		SetStateAction<Record<string, boolean>>
	>;
	setCastoriceKillToggles: Dispatch<
		SetStateAction<Record<string, boolean>>
	>;
	setIcaKillToggles: Dispatch<SetStateAction<Record<string, boolean>>>;
	setMemeKillToggles: Dispatch<SetStateAction<Record<string, boolean>>>;
	setHyacineE2Active: Dispatch<SetStateAction<boolean>>;
	setMeritTarget: Dispatch<SetStateAction<string | undefined>>;
	setDancePartner: Dispatch<SetStateAction<string | undefined>>;
};

export function useActionSequenceSavedData() {
	const [savedData, setSavedData] = useState<NormalizedSavedData>(
		createDefaultSavedData,
	);

	const { characters, limitPreset, customLimit, displayedLimit } = savedData;

	const actionLimit = useMemo(() => {
		if (limitPreset === "自定义") {
			return toPositiveNumber(customLimit, 150);
		}
		return toPositiveNumber(limitPreset, 150);
	}, [customLimit, limitPreset]);
	const displayedLimitDefault = actionLimit + 100;
	const displayedActionLimit = Math.max(
		actionLimit,
		toPositiveNumber(displayedLimit, displayedLimitDefault),
	);
	const previousActionLimitRef = useRef(actionLimit);

	const updateSavedData = useCallback(
		(updater: (prev: NormalizedSavedData) => NormalizedSavedData) => {
			setSavedData((prev) => updater(prev));
		},
		[],
	);

	const setSavedField = <K extends keyof NormalizedSavedData>(
		key: K,
		updater: SetStateAction<NormalizedSavedData[K]>,
	) => {
		updateSavedData((prev) => ({
			...prev,
			[key]:
				typeof updater === "function"
					? (updater as (
							value: NormalizedSavedData[K],
						) => NormalizedSavedData[K])(prev[key])
					: updater,
		}));
	};

	const setters: SavedDataFieldSetters = {
		setCharacters: (updater) => setSavedField("characters", updater),
		setLimitPreset: (updater) => setSavedField("limitPreset", updater),
		setCustomLimit: (updater) => setSavedField("customLimit", updater),
		setDisplayedLimit: (updater) => setSavedField("displayedLimit", updater),
		setResources: (updater) => setSavedField("resources", updater),
		setOverrides: (updater) => setSavedField("overrides", updater),
		setUltOverrides: (updater) => setSavedField("ultOverrides", updater),
		setSkillOverrides: (updater) => setSavedField("skillOverrides", updater),
		setDomainEndOverrides: (updater) =>
			setSavedField("domainEndOverrides", updater),
		setSpeedAdjustments: (updater) =>
			setSavedField("speedAdjustments", updater),
		setSkillTargets: (updater) => setSavedField("skillTargets", updater),
		setDefaultSkillTargets: (updater) =>
			setSavedField("defaultSkillTargets", updater),
		setOdeSelections: (updater) => setSavedField("odeSelections", updater),
		setMemeSelections: (updater) => setSavedField("memeSelections", updater),
		setUltInterrupts: (updater) => setSavedField("ultInterrupts", updater),
		setResourceValues: (updater) => setSavedField("resourceValues", updater),
		setFireflyBreakCounters: (updater) =>
			setSavedField("fireflyBreakCounters", updater),
		setGodmodeExtraActions: (updater) =>
			setSavedField("godmodeExtraActions", updater),
		setCastoriceKillToggles: (updater) =>
			setSavedField("castoriceKillToggles", updater),
		setIcaKillToggles: (updater) =>
			setSavedField("icaKillToggles", updater),
		setMemeKillToggles: (updater) =>
			setSavedField("memeKillToggles", updater),
		setHyacineE2Active: (updater) =>
			setSavedField("hyacineE2Active", updater),
		setMeritTarget: (updater) => setSavedField("meritTarget", updater),
		setDancePartner: (updater) => setSavedField("dancePartner", updater),
	};

	useEffect(() => {
		const previousDefault = previousActionLimitRef.current + 100;
		previousActionLimitRef.current = actionLimit;
		setters.setDisplayedLimit((prev) => {
			const parsed = toPositiveNumber(prev, Number.NaN);
			if (prev === "" || parsed === previousDefault) {
				return formatEditableNumber(displayedLimitDefault);
			}
			return prev;
		});
	}, [actionLimit, displayedLimitDefault]);

	useEffect(() => {
		setters.setOverrides((prev) => {
			let changed = false;
			const next = Object.fromEntries(
				Object.entries(prev).map(([key, value]) => {
					const parsed = Number.parseFloat(value);
					if (!Number.isFinite(parsed) || parsed <= displayedActionLimit) {
						return [key, value];
					}
					changed = true;
					return [key, formatEditableNumber(displayedActionLimit)];
				}),
			);
			return changed ? next : prev;
		});
	}, [displayedActionLimit]);

	useEffect(() => {
		updateSavedData((prev) => {
			const counterWCharacter = prev.characters.find((character) =>
				hasSkillEffect(character.name, "W", "counterW"),
			);
			const cyreneCharacter = prev.characters.find((character) =>
				hasSkillEffect(character.name, "Q", "cyreneUltimate"),
			);
			const silverWolfCharacter = prev.characters.find(
				(character) => getCharacterCid(character.name) === "1506",
			);
			const isUsingDefaultResources =
				prev.resources.length === defaultResources.length &&
				prev.resources.every(
					(resource, index) => resource === defaultResources[index],
				);
			const cyreneDefaultResources = cyreneCharacter
				? getCyreneUltimateRule(cyreneCharacter.name).defaultResources
				: [];
			const counterWDefaultResources = counterWCharacter
				? getCounterWDomainRule(counterWCharacter.name).defaultResources
				: [];
			const silverWolfResources = silverWolfCharacter ? ["隐藏"] : [];
			const nextResources = isUsingDefaultResources
				? Array.from(
						new Set([
							...silverWolfResources,
							...cyreneDefaultResources,
							...counterWDefaultResources,
						]),
					)
				: [...prev.resources];
			if (isUsingDefaultResources && nextResources.length === 0) return prev;
			if (silverWolfCharacter) {
				for (const resource of silverWolfResources) {
					if (
						nextResources.length < maxResources &&
						!nextResources.includes(resource)
					) {
						nextResources.push(resource);
					}
				}
			}
			if (cyreneCharacter) {
				for (const resource of cyreneDefaultResources) {
					if (
						nextResources.length < maxResources &&
						!nextResources.includes(resource)
					) {
						nextResources.push(resource);
					}
				}
			}
			if (
				nextResources.length === prev.resources.length &&
				nextResources.every(
					(resource, index) => resource === prev.resources[index],
				)
			) {
				return prev;
			}
			return { ...prev, resources: nextResources };
		});
	}, [characters, updateSavedData]);

	const normalizeAndSetSavedData = useCallback((parsed: Partial<SavedData>) => {
		const normalized = toNormalizedSavedData(parsed);
		setSavedData(normalized);
		return normalized;
	}, []);

	const resetSavedData = useCallback(() => {
		setSavedData(createDefaultSavedData());
	}, []);

	return {
		savedData,
		...savedData,
		setSavedData,
		updateSavedData,
		actionLimit,
		displayedActionLimit,
		exportData: useMemo(() => toExportSavedData(savedData), [savedData]),
		normalizeAndSetSavedData,
		resetSavedData,
		...setters,
	};
}
