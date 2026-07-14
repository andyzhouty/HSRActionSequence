/** 共享的行动序列数据模型；不依赖模拟或 UI 实现。 */

export type TargetKind =
	| "角色"
	| "忆灵"
	| "非忆灵"
	| "倒计时"
	| "敌人"
	| "阿哈";

export type CharacterConfig = {
	id: string;
	kind: TargetKind;
	name: string;
	speed: string;
	baseSpeed: string;
	hasVonwacq: boolean;
	hasWindSet: boolean;
	hasDance: boolean;
	/** @deprecated 使用 techniqueOn 替代，保留以兼容旧数据 */
	hasCastoriceTechnique?: boolean;
	/** @deprecated 使用 techniqueOn 替代，保留以兼容旧数据 */
	hasAglaeaTechnique?: boolean;
	/** 通用秘技开关。开启后由引擎根据角色 CID 决定秘技效果。 */
	techniqueOn?: boolean;
	eidolon: number;
	superimpose: number;
	lc_id: number;
};

export type SkillCode = string;
export type SpeedChangeMode = "absolute" | "relative";

export type GeneratedAction = {
	key: string;
	characterId: string;
	displayName?: string;
	targetKind?: TargetKind;
	actionNo: number;
	actionValue: number;
	skill: SkillCode;
	speed: number;
	isDomainAction?: boolean;
	isDomainFinalAction?: boolean;
	isAssistAction?: boolean;
	isAssistFollowUp?: boolean;
	assistSourceKey?: string;
	assistIndex?: number;
	isMemospriteAction?: boolean;
	memospriteOwnerId?: string;
	isMemeAction?: boolean;
	/** 由右键配置提前的迷迷正常行动。 */
	isMemeAdvanceAction?: boolean;
	memeOwnerId?: string;
	isOdeExtraAction?: boolean;
	isCombustionAction?: boolean;
	isAglaeaSupremeAction?: boolean;
	isAglaeaCountdownAction?: boolean;
	isAglaeaGarmentmakerAction?: boolean;
	isAhaInstant?: boolean;
	lockedSkill?: boolean;
	activeOdeLabels?: string[];
	isRomanceAction?: boolean;
	isCyreneEnhancedQ?: boolean;
	isEpicTriggeredMemosprite?: boolean;
	isPolluxAction?: boolean;
	isIcaAction?: boolean;
	isExtraAha?: boolean;
	isSparxieExtraAction?: boolean;
	isEveyAction?: boolean;
	isEveySelfDestructAction?: boolean;
	isEveyThresholdBurstAction?: boolean;
	isSouldragonAction?: boolean;
	souldragonOwnerId?: string;
	isElationSkill?: boolean;
	hasElationSkills?: boolean;
	elationSkillParentKey?: string;
	isFuaAction?: boolean;
	isMydeiGodslayerAction?: boolean;
	interruptTiming?: "before" | "after";
	isArcherExtraE?: boolean;
	archerExtraEIndex?: number;
	hasArcherExtraEs?: boolean;
	archerExtraEParentKey?: string;
	isArcherFua?: boolean;
	archerFuaCharge?: number;
	gilgameshInterest?: number;
	isGilgameshComboAction?: boolean;
	isGilgameshTechniqueAction?: boolean;
	isTheHertaEnhancedE?: boolean;
	theHertaInspiration?: number;
};

export type SpeedAdjustment = { value: string; mode: SpeedChangeMode };
export type UltInterrupt = { casterId: string; timing: "before" | "after" };
export type OdeSelection = { odeCode: string; targetId: string };

export type OdeRule = {
	code: string;
	label: string;
	fullName: string;
	targetCid?: string;
	duration:
		| "battle"
		| "nextTurn"
		| "turns"
		| "extraTurn"
		| "nextAttack"
		| "stacks";
	effects?: string[];
	turns?: number;
	stacks?: number;
};

export type CyreneUltimateRule = {
	memospriteName: string;
	memospriteSkill: SkillCode;
	defaultResources: string[];
	genericOde: OdeRule;
	odes: OdeRule[];
};

export type MemeAdvanceRule = {
	memospriteName: string;
	memospriteSkill: SkillCode;
	memospriteSpeed: number;
	advancePercent: number;
};

export type GarmentmakerRule = {
	memospriteName: string;
	memospriteSkill: SkillCode;
	memospriteSpeed: number;
	countdownName: string;
	countdownSpeed: number;
	stackSpeedBonus: number;
	maxStacks: number;
	eidolon4MaxStacks: number;
	aglaeaSpeedBonusRatioPerStack: number;
	retainedStacksAfterDismiss: number;
};

export type FireflyCombustionRule = {
	countdownName: string;
	countdownSpeed: number;
	speedBonus: number;
	allowedSkills: SkillCode[];
	breakLabel: string;
	breakDelayPercent: number;
	maxBreakDelayTriggers: number;
	eidolonExtraTurn: number;
};

export type PolluxRule = {
	memospriteName: string;
	memospriteSpeed: number;
	maxActions: number;
	keepSkill: SkillCode;
	dismissSkill: SkillCode;
};

export type EveyRule = {
	memospriteName: string;
	memospriteSpeed: number;
	keepSkill: SkillCode;
	dismissSkill: SkillCode;
};

export type DomainRule = {
	defaultBaseSpeed: number;
	normalEquivalentSpeedCoefficient: number;
	eidolon1EquivalentSpeedCoefficient: number;
	extraActionCount: number;
	endSpeedBonusBaseSpeedRatio: number;
	defaultResources: string[];
	allowedSkills: string[];
	finalSkill: SkillCode;
	enemyTriggerSkills?: SkillCode[];
};

export type SavedData = {
	schemaVersion?: number;
	limitPreset: string;
	customLimit: string;
	displayedLimit?: string;
	characters: CharacterConfig[];
	resources: string[];
	overrides: Record<string, string>;
	ultOverrides?: Record<string, boolean>;
	skillOverrides?: Record<string, SkillCode>;
	domainEndOverrides?: Record<string, boolean>;
	speedAdjustments?: Record<string, SpeedAdjustment>;
	skillTargets?: Record<string, string>;
	defaultSkillTargets?: Record<string, string>;
	odeSelections?: Record<string, OdeSelection>;
	memeSelections?: Record<string, string>;
	ultInterrupts?: Record<string, UltInterrupt[]>;
	resourceValues: Record<string, Record<string, string>>;
	fireflyBreakCounters?: Record<string, boolean>;
	godmodeExtraActions?: Record<string, boolean>;
	castoriceKillToggles?: Record<string, boolean>;
	icaKillToggles?: Record<string, boolean>;
	memeKillToggles?: Record<string, boolean>;
	evernightSelfDestructToggles?: Record<string, boolean>;
	evernightThresholdBurstToggles?: Record<string, boolean>;
	evanesciaFuaToggles?: Record<string, boolean>;
	mydeiVendettaToggles?: Record<string, boolean>;
	mydeiGodslayerToggles?: Record<string, boolean>;
	sameAVOrder?: Record<string, number>;
	hyacineE2Active?: boolean;
	meritTarget?: string;
	dancePartner?: string;
	bondmateTarget?: string;
	attackDisabled?: Record<string, boolean>;
	saberAdvanceToggles?: Record<string, boolean>;
};
