import type { AglaeaActionState } from "../mechanics/aglaeaGarmentmaker";
import type { PhainonDomainState } from "../mechanics/phainonDomain";
import type {
	CharacterConfig,
	OdeRule,
	OdeSelection,
	SkillCode,
	SpeedAdjustment,
	UltInterrupt,
} from "../utils/actionSequence";

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
	resourceValues?: Record<string, Record<string, string>>;
	fireflyBreakCounters?: Record<string, boolean>;
	godmodeExtraActions?: Record<string, boolean>;
	killToggles?: Record<string, boolean>;
	castoriceKillToggles?: Record<string, boolean>;
	icaKillToggles?: Record<string, boolean>;
	memeKillToggles?: Record<string, boolean>;
	evernightSelfDestructToggles?: Record<string, boolean>;
	evernightThresholdBurstToggles?: Record<string, boolean>;
	hyacineE2Active?: boolean;
	meritTarget?: string;
	dancePartner?: string;
	bondmateTarget?: string;
	attackDisabled?: Record<string, boolean>;
	fuaToggles?: Record<string, boolean>;
	sameAVOrder?: Record<string, number>;
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

	// 遐蝶死龙
	polluxOnField?: boolean;
	polluxCount?: number;
	polluxGeneration?: number;
	polluxSummonGeneration?: number;
	isPolluxAction?: boolean;
	// A freshly summoned Pollux must win ties against existing memosprite turns.
	isImmediatePolluxSummon?: boolean;
	e2SavedActionSkill?: SkillCode;

	// 风堇小伊卡
	icaOnField?: boolean;
	afterRain?: number;
	hyacineE2SpeedBonus?: number;

	// 长夜月长夜
	eveyOnField?: boolean;
	eveyGeneration?: number;
	eveySummonGeneration?: number;
	isEveyAction?: boolean;
	evernightNextTurnSpeedBonus?: number;

	// 同 AV 的细粒度排序/拉条判定
	sameActionPriority?: number;
	lastActionValue?: number;
	isSouldragonAction?: boolean;
	souldragonOwnerId?: string;
}

export type ActiveOdeState = {
	ode: OdeRule;
	remainingTurns?: number;
	remainingAttacks?: number;
	stacks?: number;
	romanceCharged?: boolean;
};
