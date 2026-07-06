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
	castoriceKillToggles?: Record<string, boolean>;
	icaKillToggles?: Record<string, boolean>;
	memeKillToggles?: Record<string, boolean>;
	hyacineE2Active?: boolean;
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

	// 记忆主【史诗】
	epic?: number;
	epicPendingA?: boolean; // 标记开 Q 后在等待下一次 A

	// 昔涟 Q_counter
	Q_counter?: number;

	// E6 首次大已被拉条标记（防止后续正常 nextAV 覆盖）
	e6FirstUltimatePulled?: boolean;

	// 遐蝶死龙
	polluxOnField?: boolean;
	polluxCount?: number;
	polluxGeneration?: number;
	polluxSummonGeneration?: number;
	isPolluxAction?: boolean;
	e2SavedActionSkill?: SkillCode;

	// 风堇小伊卡
	icaOnField?: boolean;
	afterRain?: number;
	hyacineE2SpeedBonus?: number;
}

export type ActiveOdeState = {
	ode: OdeRule;
	remainingTurns?: number;
	remainingAttacks?: number;
	stacks?: number;
	romanceCharged?: boolean;
};
