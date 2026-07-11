import {
	createTarget,
	defaultCharacters,
	defaultResources,
	formatEditableNumber,
	normalizeResourcesForCharacters,
	limitPresets,
	maxResources,
	type OdeSelection,
	type SavedData,
	type SkillCode,
	type SpeedAdjustment,
	type TargetKind,
	targetKinds,
	toPositiveNumber,
	type UltInterrupt,
	withoutCharacterOnlyEffects,
} from "../../utils/actionSequence";

export function getSavedDisplayedLimitFallback(parsed: Partial<SavedData>) {
	const savedPreset =
		parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
			? parsed.limitPreset
			: "150";
	const savedCustomLimit = String(parsed.customLimit ?? "");
	const savedActionLimit =
		savedPreset === "自定义"
			? toPositiveNumber(savedCustomLimit, 150)
			: toPositiveNumber(savedPreset, 150);
	return formatEditableNumber(savedActionLimit + 100);
}

export function getSavedDisplayedActionLimit(parsed: Partial<SavedData>) {
	const fallback = toPositiveNumber(
		getSavedDisplayedLimitFallback(parsed),
		250,
	);
	const savedDisplayedLimit = toPositiveNumber(
		String(parsed.displayedLimit ?? ""),
		fallback,
	);
	return Math.max(fallback - 100, savedDisplayedLimit);
}

export function clampOverridesToDisplayedLimit(
	overrides: Record<string, string> | undefined,
	displayedLimit: number,
) {
	if (!overrides) return {};
	return Object.fromEntries(
		Object.entries(overrides).map(([key, value]) => {
			const parsed = Number.parseFloat(value);
			if (!Number.isFinite(parsed)) return [key, value];
			return [key, formatEditableNumber(Math.min(parsed, displayedLimit))];
		}),
	);
}

export function pruneRecord<T>(
	record: Record<string, T>,
	shouldPrune: (key: string) => boolean,
) {
	let changed = false;
	const next: Record<string, T> = {};
	for (const [key, value] of Object.entries(record)) {
		if (shouldPrune(key)) {
			changed = true;
			continue;
		}
		next[key] = value;
	}
	return changed ? next : record;
}

export function toNormalizedCharacters(parsed: Partial<SavedData>) {
	if (!Array.isArray(parsed.characters)) return [];
	return parsed.characters.map((character, index) =>
		withoutCharacterOnlyEffects({
			...createTarget(
				String(character.id ?? `target-${index + 1}`),
				index,
				(targetKinds.includes(character.kind as TargetKind)
					? character.kind
					: "角色") as TargetKind,
			),
			...character,
			id: String(character.id ?? `target-${index + 1}`),
			kind: (targetKinds.includes(character.kind as TargetKind)
				? character.kind
				: "角色") as TargetKind,
			name: String(character.name ?? ""),
			speed: String(character.speed ?? ""),
			baseSpeed: String(character.baseSpeed ?? ""),
		}),
	);
}

export type NormalizedSavedData = SavedData & {
	displayedLimit: string;
	ultOverrides: Record<string, boolean>;
	skillOverrides: Record<string, SkillCode>;
	domainEndOverrides: Record<string, boolean>;
	speedAdjustments: Record<string, SpeedAdjustment>;
	skillTargets: Record<string, string>;
	defaultSkillTargets: Record<string, string>;
	odeSelections: Record<string, OdeSelection>;
	memeSelections: Record<string, string>;
	ultInterrupts: Record<string, UltInterrupt[]>;
	fireflyBreakCounters: Record<string, boolean>;
	godmodeExtraActions: Record<string, boolean>;
	castoriceKillToggles: Record<string, boolean>;
	icaKillToggles: Record<string, boolean>;
	memeKillToggles: Record<string, boolean>;
	evernightSelfDestructToggles: Record<string, boolean>;
	evernightThresholdBurstToggles: Record<string, boolean>;
	hyacineE2Active: boolean;
	attackDisabled: Record<string, boolean>;
};

export function toNormalizedSavedData(
	parsed: Partial<SavedData>,
): NormalizedSavedData {
	const savedDisplayedActionLimit = getSavedDisplayedActionLimit(parsed);
	const normalizedCharacters = toNormalizedCharacters(parsed);
	return {
		limitPreset:
			parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
				? parsed.limitPreset
				: "150",
		customLimit: String(parsed.customLimit ?? ""),
		displayedLimit: String(
			parsed.displayedLimit ?? getSavedDisplayedLimitFallback(parsed),
		),
		characters: normalizedCharacters,
		resources: normalizeResourcesForCharacters(
			Array.isArray(parsed.resources)
				? parsed.resources.slice(0, maxResources).map(String)
				: [],
			normalizedCharacters,
		),
		overrides: clampOverridesToDisplayedLimit(
			parsed.overrides,
			savedDisplayedActionLimit,
		),
		ultOverrides: parsed.ultOverrides ?? {},
		skillOverrides: parsed.skillOverrides ?? {},
		domainEndOverrides: parsed.domainEndOverrides ?? {},
		speedAdjustments: parsed.speedAdjustments ?? {},
		skillTargets: parsed.skillTargets ?? {},
		defaultSkillTargets: parsed.defaultSkillTargets ?? {},
		odeSelections: parsed.odeSelections ?? {},
		memeSelections: parsed.memeSelections ?? {},
		ultInterrupts: parsed.ultInterrupts ?? {},
		resourceValues: parsed.resourceValues ?? {},
		fireflyBreakCounters: parsed.fireflyBreakCounters ?? {},
		godmodeExtraActions: parsed.godmodeExtraActions ?? {},
		castoriceKillToggles: parsed.castoriceKillToggles ?? {},
		icaKillToggles: parsed.icaKillToggles ?? {},
		memeKillToggles: parsed.memeKillToggles ?? {},
		evernightSelfDestructToggles: parsed.evernightSelfDestructToggles ?? {},
		evernightThresholdBurstToggles:
			parsed.evernightThresholdBurstToggles ?? {},
		hyacineE2Active: parsed.hyacineE2Active ?? true,
		meritTarget: parsed.meritTarget || undefined,
		dancePartner: parsed.dancePartner || undefined,
		bondmateTarget: parsed.bondmateTarget || undefined,
		attackDisabled: parsed.attackDisabled ?? {},
	};
}

export function createDefaultSavedData(): NormalizedSavedData {
	return toNormalizedSavedData({
		limitPreset: "150",
		customLimit: "",
		displayedLimit: "250",
		characters: defaultCharacters,
		resources: defaultResources,
		overrides: {},
		ultOverrides: {},
		skillOverrides: {},
		domainEndOverrides: {},
		speedAdjustments: {},
		skillTargets: {},
		defaultSkillTargets: {},
		odeSelections: {},
		memeSelections: {},
		ultInterrupts: {},
		resourceValues: {},
		fireflyBreakCounters: {},
		godmodeExtraActions: {},
		castoriceKillToggles: {},
		icaKillToggles: {},
		memeKillToggles: {},
		evernightSelfDestructToggles: {},
		evernightThresholdBurstToggles: {},
		hyacineE2Active: true,
		attackDisabled: {},
	});
}

export function toExportSavedData(data: NormalizedSavedData): SavedData {
	return {
		...data,
		characters: data.characters.map(withoutCharacterOnlyEffects),
	};
}
