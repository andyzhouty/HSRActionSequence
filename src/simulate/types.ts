import type { AglaeaActionState } from "../mechanics/aglaea";
import type { PhainonDomainState } from "../mechanics/phainon";
import type {
	CharacterConfig,
	OdeRule,
	OdeSelection,
	SkillCode,
	SpeedAdjustment,
	UltInterrupt,
} from "../utils/action-sequence";

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
	saberAdvanceToggles?: Record<string, boolean>;
	evanesciaFuaToggles?: Record<string, boolean>;
	ashveilFuaToggles?: Record<string, boolean>;
	kafkaFuaToggles?: Record<string, boolean>;
	spBladeExtraTurnToggles?: Record<string, boolean>;
	mydeiVendettaToggles?: Record<string, boolean>;
	mydeiGodslayerToggles?: Record<string, boolean>;
	spRobinFeverToggles?: Record<string, boolean>;
	sameAVOrder?: Record<string, number>;
};

// ── 内部状态类型 ──

/** 调度器始终需要的最小状态。 */
export type SimulationCoreState = Pick<
	AglaeaActionState,
	| "character"
	| "baseSpeed"
	| "currentSpeed"
	| "nextActionValue"
	| "actionNo"
	| "blockNextAdvance"
>;

/** 白厄境界相关状态与通用调度状态分开，避免领域逻辑继续污染角色字段。 */
export type DomainMechanicState = {
	phainonDomainSpeedBonus: number;
	domainState?: PhainonDomainState;
};

/** 阿格莱雅机制自身的状态，基础调度字段不再重复放入 ActionState。 */
export type AglaeaMechanicState = Omit<
	AglaeaActionState,
	keyof SimulationCoreState | "phainonDomainSpeedBonus"
>;

/** 同行动值排序和拉条机制的状态。 */
export type ActionOrderingMechanicState = {
	sameActionPriority?: number;
	lastActionValue?: number;
};

/** 召唤物与跨角色追加行动共享的状态。 */
export type CompanionMechanicState = {
	tribbieUltimateFuaTriggeredBy?: string[];
	ashveilFuaCharge?: number;
	kafkaFuaCharge?: number;
	isSouldragonAction?: boolean;
	souldragonOwnerId?: string;
};

/** SP Blade 的狂热、倒计时和额外行动状态。 */
export type SpBladeMechanicState = {
	spBladeStacks?: number;
	spBladeInfiniteFury?: boolean;
	spBladeCountdownId?: string;
	spBladeCountdownOwnerId?: string;
};

/** 完全燃烧状态及其倒计时信息。 */
export type CombustionMechanicState = {
	isInCompleteCombustion?: boolean;
	combustionOwnerId?: string;
	combustionCountdownId?: string;
	combustionStartAV?: number;
	combustionBreakCount?: number;
	combustionDelayCount?: number;
};

/** 记忆主、昔涟和迷迷的记忆机制状态。 */
export type MemoryMechanicState = {
	isMemeState?: boolean;
	memeOwnerId?: string;
	/** 迷迷被右键提前时，保存触发行动 key 以复用其目标配置。 */
	memeAdvanceSourceKey?: string;
	epic?: number;
	epicPendingA?: boolean;
	Q_counter?: number;
	e2SavedActionSkill?: SkillCode;
};

/** 遐蝶及其死龙忆灵的状态。 */
export type CastoriceMechanicState = {
	polluxOnField?: boolean;
	polluxCount?: number;
	polluxGeneration?: number;
	polluxSummonGeneration?: number;
	isPolluxAction?: boolean;
	/** 新召唤的白厄需要在同 AV 时排在已有忆灵行动之前。 */
	isImmediatePolluxSummon?: boolean;
};

/** 风堇及其小伊卡忆灵的状态。 */
export type HyacineMechanicState = {
	icaOnField?: boolean;
	afterRain?: number;
	hyacineE2SpeedBonus?: number;
};

/** 长夜月及其长夜忆灵的状态。 */
export type EvernightMechanicState = {
	eveyOnField?: boolean;
	eveyGeneration?: number;
	eveySummonGeneration?: number;
	isEveyAction?: boolean;
	evernightNextTurnSpeedBonus?: number;
};

/** 红 A、吉尔伽美什和黑塔的资源型机制状态。 */
export type ResourceMechanicState = {
	archerFuaCharge?: number;
	gilgameshInterest?: number;
	gilgameshEUnlocked?: boolean;
	gilgameshAttackCount?: number;
	theHertaInspiration?: number;
};

/** 银狼和 Saber 的特殊行动状态。 */
export type SpecialCharacterMechanicState = {
	isInGodmode?: boolean;
	godmodeActionCount?: number;
	/** Saber 释放 Q 后，下一次正常行动固定为 A。 */
	saberForceBasicAttack?: boolean;
	mydeiVendettaActive?: boolean;
};

/** 知更鸟·晴歌（SP Robin）及其忆灵的状态。 */
export type SpRobinMechanicState = {
	spRobinInFever?: boolean;
	/** 已处理过的狂热开关 key（狂热结束后同一 key 不再重复触发）。 */
	spRobinFeverAppliedKeys?: Set<string>;
	spRobinFeverRemainingDistance?: number;
	spRobinFeverAdvancedDistance?: number;
	spRobinFeverCountdownId?: string;
	/** 狂热倒计时状态：标记所属的 SP Robin 角色 id。 */
	spRobinFeverCountdownOwnerId?: string;
	/** SP Robin Q 施加：目标在 2 个正常回合内无法使其他我方目标行动提前。 */
	allyAdvanceBlockTurns?: number;
	/** SP Robin 忆灵速度公式中「95 × 局内百分比速度增益」的增益比例之和。 */
	spRobinMemospritePercentBuff?: number;
	songbirdsOnField?: boolean;
	/** 是否为晴空乐手忆灵状态。 */
	isSongbirdsAction?: boolean;
	songbirdsOwnerId?: string;
};

/** 水砂与欢愉技相关的机制状态。 */
export type SpAventurineMechanicState = {
	/** 热意当前值。 */
	spAventurineFervor?: number;
	/** 天赋剩余可触发次数（战技重置为 6）。 */
	spAventurineTalentTriggersLeft?: number;
	/** 累计施放欢愉技次数（E6 判定全强化）。 */
	spAventurineElationSkillCount?: number;
	/** E6：累计两次后所有欢愉技均为强化版。 */
	spAventurineAllEnhanced?: boolean;
	/** 阿哈时刻 +25 加速是否已触发（仅水砂为唯一欢愉角色时有效）。 */
	spAventurineAhaSpeedBuff?: boolean;
	/** 水砂 Q 后自身 +30% 速度的剩余正常回合数。 */
	spAventurineSpeedBuffTurns?: number;
	/** 水砂本行动施放过 Q：应用速度增益但本正常回合不消耗回合数。 */
	spAventurineQBuffPending?: boolean;
};

/** 光锥对忆灵和全队速度的附加状态。 */
export type LightconeMechanicState = {
	/** 光锥 23063 全队加速的剩余回合数（每个目标各自计时）。 */
	entrySpeedBuffTurns?: number;
	/** 光锥 23064：装备者已获得施放欢愉技的按叠影速度加成。 */
	elationLightconeSpeedBuffed?: boolean;
};

/**
 * 运行时状态的组合根。
 * 新机制应归入对应的状态分组，不能直接向此类型添加无归属字段。
 */
export type ActionState = SimulationCoreState &
	DomainMechanicState &
	AglaeaMechanicState &
	ActionOrderingMechanicState &
	CompanionMechanicState &
	SpBladeMechanicState &
	CombustionMechanicState &
	MemoryMechanicState &
	CastoriceMechanicState &
	HyacineMechanicState &
	EvernightMechanicState &
	ResourceMechanicState &
	SpecialCharacterMechanicState &
	SpRobinMechanicState &
	SpAventurineMechanicState &
	LightconeMechanicState;

export type ActiveOdeState = {
	ode: OdeRule;
	remainingTurns?: number;
	remainingAttacks?: number;
	stacks?: number;
	romanceCharged?: boolean;
};
