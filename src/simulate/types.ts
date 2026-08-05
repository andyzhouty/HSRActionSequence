import type { AglaeaActionState } from "../mechanics/aglaea";
import type { PhainonDomainState } from "../mechanics/phainon";
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

export interface ActionState extends AglaeaActionState {
	character: CharacterConfig;
	baseSpeed: number;
	currentSpeed: number;
	phainonDomainSpeedBonus: number;
	nextActionValue: number;
	actionNo: number;
	blockNextAdvance: boolean;
	mydeiVendettaActive?: boolean;
	tribbieUltimateFuaTriggeredBy?: string[];
	ashveilFuaCharge?: number;
	kafkaFuaCharge?: number;
	spBladeStacks?: number;
	spBladeInfiniteFury?: boolean;
	spBladeCountdownId?: string;
	spBladeCountdownOwnerId?: string;
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
	/** 迷迷被右键提前时，保存触发行动 key 以复用其目标配置。 */
	memeAdvanceSourceKey?: string;
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
	// 红A 追击充能（0-4）
	archerFuaCharge?: number;
	gilgameshInterest?: number;
	gilgameshEUnlocked?: boolean;
	gilgameshAttackCount?: number;
	theHertaInspiration?: number;
	/** Saber 释放 Q 后，下一次正常行动固定为 A。 */
	saberForceBasicAttack?: boolean;

	// 知更鸟·晴歌（SP Robin）
	spRobinInFever?: boolean;
	/** 已处理过的 Fever 开关 key（Fever 结束后同一 key 不再重复触发）。 */
	spRobinFeverAppliedKeys?: Set<string>;
	spRobinFeverRemainingDistance?: number;
	spRobinFeverAdvancedDistance?: number;
	spRobinFeverCountdownId?: string;
	/** Fever 倒计时状态：标记所属的 SP Robin 角色 id。 */
	spRobinFeverCountdownOwnerId?: string;
	/** SP Robin Q 施加：目标在 2 个正常回合内无法使其他我方目标行动提前。 */
	allyAdvanceBlockTurns?: number;
	/** SP Robin 忆灵速度公式中「98 × 局内百分比速度buff」的 buff 比例之和。 */
	spRobinMemospritePercentBuff?: number;
	songbirdsOnField?: boolean;
	/** 是否为晴空乐手忆灵状态。 */
	isSongbirdsAction?: boolean;
	songbirdsOwnerId?: string;
	/** 光锥 23063 全队加速的剩余回合数（每个目标各自计时）。 */
	entrySpeedBuffTurns?: number;

	// 砂金·戏浪（水砂）
	/** 热意（Fervor）当前值。 */
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
	/** 水砂本行动施放过 Q：应用速度 buff 但本正常回合不消耗回合数。 */
	spAventurineQBuffPending?: boolean;
	/** 光锥 23064：装备者已获得施放欢愉技的 +20% 速度。 */
	elationLightconeSpeedBuffed?: boolean;
}

export type ActiveOdeState = {
	ode: OdeRule;
	remainingTurns?: number;
	remainingAttacks?: number;
	stacks?: number;
	romanceCharged?: boolean;
};
