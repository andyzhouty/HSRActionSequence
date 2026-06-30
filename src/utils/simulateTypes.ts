import type {
	CharacterConfig,
	OdeRule,
	OdeSelection,
	SkillCode,
	SpeedAdjustment,
	UltInterrupt,
} from "./actionSequence";
import type { AglaeaActionState } from "./aglaeaGarmentmaker";
import type { PhainonDomainState } from "./phainonDomain";

// ── 输入类型 ──

export type SimulateActionsInput = {
	characters: CharacterConfig[];
	limit: number;
	overrides: Record<string, string>;
	skillOverrides: Record<string, SkillCode>;
	domainEndOverrides: Record<string, boolean>;
	legacyUltOverrides: Record<string, boolean>;
	speedAdjustments: Record<string, SpeedAdjustment>;
	skillTargets: Record<string, string>;
	defaultSkillTargets: Record<string, string>;
	odeSelections: Record<string, OdeSelection>;
	memeSelections: Record<string, string>;
	ultInterrupts: Record<string, UltInterrupt[]>;
	fireflyBreakCounters?: Record<string, boolean>;
	godmodeExtraActions?: Record<string, boolean>;
	killToggles?: Record<string, boolean>;
	meritTarget?: string;
	dancePartner?: string;
};

// ── 内部状态类型 ──

export interface ActionState extends AglaeaActionState {
	character: CharacterConfig;
	baseSpeed: number;
	currentSpeed: number;
	phainonDomainSpeedBonus: number;
	nextActionValue: number;
	actionNo: number;
	blockNextAdvance: boolean;
	isInCompleteCombustion?: boolean;
	isMemeState?: boolean;
	isGarmentmakerState?: boolean;
	combustionOwnerId?: string;
	combustionCountdownId?: string;
	combustionStartAV?: number;
	combustionBreakCount?: number;
	combustionDelayCount?: number;
	domainState?: PhainonDomainState;
	memeOwnerId?: string;
	aglaeaSupremeActive?: boolean;
	isInGodmode?: boolean;
	godmodeActionCount?: number;
}

export type ActiveOdeState = {
	ode: OdeRule;
	remainingTurns?: number;
	remainingAttacks?: number;
	stacks?: number;
	romanceCharged?: boolean;
};
