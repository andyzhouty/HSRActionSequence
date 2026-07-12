import type {
	CharacterConfig,
	SkillCode,
	SpeedAdjustment,
	UltInterrupt,
} from "../../src/utils/actionSequence";
import type { SimulateActionsInput } from "../../src/simulate/actions";

export const stripAv0 = (axs: { characterId: string }[]) =>
	axs.filter((a) => a.characterId !== "@av0");

export function character(
	id: string,
	name: string,
	speed: number,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: String(speed),
		baseSpeed: String(speed),
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...overrides,
	};
}

export function input(
	overrides: Partial<SimulateActionsInput> = {},
): SimulateActionsInput {
	return {
		characters: [],
		limit: 300,
		overrides: {},
		skillOverrides: {},
		domainEndOverrides: {},
		legacyUltOverrides: {},
		speedAdjustments: {},
		skillTargets: {},
		defaultSkillTargets: {},
		odeSelections: {},
		memeSelections: {},
		ultInterrupts: {},
		resourceValues: {},
		fireflyBreakCounters: {},
		...overrides,
	};
}

export function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

export function speedAdjustments(
	entries: Record<string, SpeedAdjustment>,
): Record<string, SpeedAdjustment> {
	return entries;
}

export function interrupts(
	entries: Record<string, UltInterrupt[]>,
): Record<string, UltInterrupt[]> {
	return entries;
}


