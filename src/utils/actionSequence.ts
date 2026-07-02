import {
	hasSemanticFlag as characterHasSemanticFlag,
	getDefaultEffectRule,
	getEffectRule,
	hasSkillEffect,
	normalizeName,
	validSkillChars,
} from "../data/characters";

export {
	getCharacterCid,
	getCharacterDisplayName,
	getCharacterPath,
	getDefaultEffectRule,
	getEffectRule,
	getSkillEffectOwnerNames,
	getSpecialActionHint,
	hasPassive,
	hasSemanticFlag,
	hasSkillEffect,
	isQFrontCombo,
	normalizeName,
} from "../data/characters";

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
	hasCastoriceTechnique?: boolean;
	hasAglaeaTechnique?: boolean;
	eidolon: number;
	superimpose: number;
	lc_id: number;
};

export function hasEidolon1(c: CharacterConfig): boolean {
	return c.eidolon >= 1;
}
export function hasEidolon2(c: CharacterConfig): boolean {
	return c.eidolon >= 2;
}
export function hasEidolon4(c: CharacterConfig): boolean {
	return c.eidolon >= 4;
}

export function getDomainBaseSpeed(
	superimpose: number,
	lc_id?: number,
): number {
	if (lc_id === 23044) {
		return superimpose > 0 ? 104 + 2 * superimpose : 94;
	}
	return 94;
}

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
	isEpicTriggeredMemosprite?: boolean; // 记忆主史诗触发的德谬歌额外 Q
	isPolluxAction?: boolean; // 遐蝶死龙行动
	isIcaAction?: boolean; // 风堇小伊卡额外回合
	isExtraAha?: boolean;
	isSparxieExtraAction?: boolean;
};

export type SpeedAdjustment = {
	value: string;
	mode: SpeedChangeMode;
};

export type UltInterrupt = {
	casterId: string;
	timing: "before" | "after";
};

export type OdeSelection = {
	odeCode: string;
	targetId: string;
};

export type OdeRule = {
	code: string;
	label: string;
	fullName: string;
	targetNames: string[];
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

const defaultCounterWDomainRule: DomainRule = getDefaultEffectRule<{
	domain: DomainRule;
}>("counterW")?.domain ?? {
	defaultBaseSpeed: 106.0,
	normalEquivalentSpeedCoefficient: 0.6,
	eidolon1EquivalentSpeedCoefficient: 0.66,
	extraActionCount: 8,
	endSpeedBonusBaseSpeedRatio: 0.15,
	defaultResources: ["火种", "毁伤"],
	allowedSkills: ["", "E", "EW", "EA", "A", "W"],
	finalSkill: "Q",
	enemyTriggerSkills: ["W", "EW"],
};

export function getCounterWDomainRule(characterName: string): DomainRule {
	const effectRule = getEffectRule<{ domain?: Partial<DomainRule> }>(
		characterName,
		"counterW",
	);
	const domainRule = effectRule?.domain ?? {};
	return {
		...defaultCounterWDomainRule,
		...domainRule,
		defaultResources:
			domainRule.defaultResources ?? defaultCounterWDomainRule.defaultResources,
		allowedSkills:
			domainRule.allowedSkills ?? defaultCounterWDomainRule.allowedSkills,
		finalSkill: domainRule.finalSkill ?? defaultCounterWDomainRule.finalSkill,
		enemyTriggerSkills:
			(domainRule as { enemyTriggerSkills?: SkillCode[] })
				?.enemyTriggerSkills ?? defaultCounterWDomainRule.enemyTriggerSkills,
	};
}

const defaultCyreneUltimateRule: CyreneUltimateRule =
	// biome-ignore lint/style/noNonNullAssertion: defaults in characters.json
	getDefaultEffectRule<CyreneUltimateRule>("cyreneUltimate")!;

export function getCyreneUltimateRule(
	characterName: string,
): CyreneUltimateRule {
	const effectRule = getEffectRule<Partial<CyreneUltimateRule>>(
		characterName,
		"cyreneUltimate",
	);
	return {
		...defaultCyreneUltimateRule,
		...(effectRule ?? {}),
		defaultResources:
			effectRule?.defaultResources ??
			defaultCyreneUltimateRule.defaultResources,
		genericOde: effectRule?.genericOde ?? defaultCyreneUltimateRule.genericOde,
		odes: effectRule?.odes ?? defaultCyreneUltimateRule.odes,
	};
}

const defaultMemeAdvanceRule: MemeAdvanceRule =
	// biome-ignore lint/style/noNonNullAssertion: defaults in characters.json
	getDefaultEffectRule<MemeAdvanceRule>("memeAdvance")!;

export function getMemeAdvanceRule(characterName: string): MemeAdvanceRule {
	const effectRule = getEffectRule<Partial<MemeAdvanceRule>>(
		characterName,
		"memeAdvance",
	);
	return {
		...defaultMemeAdvanceRule,
		...(effectRule ?? {}),
		memospriteName:
			effectRule?.memospriteName ?? defaultMemeAdvanceRule.memospriteName,
		memospriteSkill:
			effectRule?.memospriteSkill ?? defaultMemeAdvanceRule.memospriteSkill,
		memospriteSpeed:
			effectRule?.memospriteSpeed ?? defaultMemeAdvanceRule.memospriteSpeed,
		advancePercent:
			effectRule?.advancePercent ?? defaultMemeAdvanceRule.advancePercent,
	};
}

const defaultPolluxRule: PolluxRule =
	// biome-ignore lint/style/noNonNullAssertion: defaults in characters.json
	getDefaultEffectRule<PolluxRule>("summonPollux")!;

export function getPolluxRule(characterName: string): PolluxRule {
	const effectRule = getEffectRule<Partial<PolluxRule>>(
		characterName,
		"summonPollux",
	);
	return {
		...defaultPolluxRule,
		...(effectRule ?? {}),
		memospriteName:
			effectRule?.memospriteName ?? defaultPolluxRule.memospriteName,
		memospriteSpeed:
			effectRule?.memospriteSpeed ?? defaultPolluxRule.memospriteSpeed,
		maxActions:
			effectRule?.maxActions ?? defaultPolluxRule.maxActions,
		keepSkill:
			effectRule?.keepSkill ?? defaultPolluxRule.keepSkill,
		dismissSkill:
			effectRule?.dismissSkill ?? defaultPolluxRule.dismissSkill,
	};
}

const defaultGarmentmakerRule: GarmentmakerRule =
	// biome-ignore lint/style/noNonNullAssertion: defaults in characters.json
	getDefaultEffectRule<GarmentmakerRule>("summonGarmentmaker")!;

export function getGarmentmakerRule(characterName: string): GarmentmakerRule {
	const effectRule = getEffectRule<Partial<GarmentmakerRule>>(
		characterName,
		"summonGarmentmaker",
	);
	return {
		...defaultGarmentmakerRule,
		...(effectRule ?? {}),
		memospriteName:
			effectRule?.memospriteName ?? defaultGarmentmakerRule.memospriteName,
		memospriteSkill:
			effectRule?.memospriteSkill ?? defaultGarmentmakerRule.memospriteSkill,
		memospriteSpeed:
			effectRule?.memospriteSpeed ?? defaultGarmentmakerRule.memospriteSpeed,
		countdownName:
			effectRule?.countdownName ?? defaultGarmentmakerRule.countdownName,
		countdownSpeed:
			effectRule?.countdownSpeed ?? defaultGarmentmakerRule.countdownSpeed,
		stackSpeedBonus:
			effectRule?.stackSpeedBonus ?? defaultGarmentmakerRule.stackSpeedBonus,
		maxStacks: effectRule?.maxStacks ?? defaultGarmentmakerRule.maxStacks,
		eidolon4MaxStacks:
			effectRule?.eidolon4MaxStacks ??
			defaultGarmentmakerRule.eidolon4MaxStacks,
		aglaeaSpeedBonusRatioPerStack:
			effectRule?.aglaeaSpeedBonusRatioPerStack ??
			defaultGarmentmakerRule.aglaeaSpeedBonusRatioPerStack,
		retainedStacksAfterDismiss:
			effectRule?.retainedStacksAfterDismiss ??
			defaultGarmentmakerRule.retainedStacksAfterDismiss,
	};
}

const defaultFireflyCombustionRule: FireflyCombustionRule =
	// biome-ignore lint/style/noNonNullAssertion: defaults in characters.json
	getDefaultEffectRule<FireflyCombustionRule>("fireflyCombustion")!;

export function getFireflyCombustionRule(
	characterName: string,
): FireflyCombustionRule {
	const effectRule = getEffectRule<Partial<FireflyCombustionRule>>(
		characterName,
		"fireflyCombustion",
	);
	return {
		...defaultFireflyCombustionRule,
		...(effectRule ?? {}),
		countdownName:
			effectRule?.countdownName ?? defaultFireflyCombustionRule.countdownName,
		countdownSpeed:
			effectRule?.countdownSpeed ?? defaultFireflyCombustionRule.countdownSpeed,
		speedBonus:
			effectRule?.speedBonus ?? defaultFireflyCombustionRule.speedBonus,
		allowedSkills:
			effectRule?.allowedSkills ?? defaultFireflyCombustionRule.allowedSkills,
		breakLabel:
			effectRule?.breakLabel ?? defaultFireflyCombustionRule.breakLabel,
		breakDelayPercent:
			effectRule?.breakDelayPercent ??
			defaultFireflyCombustionRule.breakDelayPercent,
		maxBreakDelayTriggers:
			effectRule?.maxBreakDelayTriggers ??
			defaultFireflyCombustionRule.maxBreakDelayTriggers,
		eidolonExtraTurn:
			effectRule?.eidolonExtraTurn ??
			defaultFireflyCombustionRule.eidolonExtraTurn,
	};
}

export function getOdeRuleForTarget(
	rule: CyreneUltimateRule,
	targetName: string,
) {
	return (
		rule.odes.find((ode) =>
			characterNameMatchesAliases(targetName, ode.targetNames),
		) ?? rule.genericOde
	);
}

export function characterNameMatchesAliases(
	characterName: string,
	aliases: string[],
) {
	const normalizedName = normalizeName(characterName);
	return aliases.some((alias) => normalizeName(alias) === normalizedName);
}

export type SavedData = {
	limitPreset: string;
	customLimit: string;
	displayedLimit?: string;
	characters: CharacterConfig[];
	resources: string[];
	overrides: Record<string, string>;
	advanceCeiling?: string;
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
	meritTarget?: string;
	dancePartner?: string;
};

export const targetKinds: TargetKind[] = [
	"角色",
	"忆灵",
	"非忆灵",
	"倒计时",
	"敌人",
	"阿哈",
];
export const limitPresets = ["150", "300", "500", "自定义"];
export const maxResources = 6;
export const defaultResources = ["战技点"];

export function isCharacterTarget(character: CharacterConfig) {
	return character.kind === "角色";
}

export function isAllyTarget(kind: TargetKind | undefined) {
	return kind === "角色" || kind === "忆灵";
}

export function isEnemyTarget(kind: TargetKind | undefined) {
	return kind === "敌人";
}

export function shouldRememberSkillTarget(characterName: string) {
	return !characterHasSemanticFlag(characterName, "noDefaultSkillTarget");
}

export function canUseSkillCode(character: CharacterConfig, skill: SkillCode) {
	if (skill === "") return true;
	if (!isCharacterTarget(character)) return false;

	const chars = [...skill];
	for (const c of chars) {
		if (!validSkillChars.includes(c)) return false;
		if (c === "W" && !hasSkillEffect(character.name, "W", "counterW"))
			return false;
		if (c === "W" && characterHasSemanticFlag(character.name, "wOnlyInDomain"))
			return false;
	}

	// AE/EA 不能组合
	if (skill.includes("A") && skill.includes("E")) return false;

	// Q 不能单独出现（Q 始终是插队，必须与 A 或 E 搭配）
	if (skill === "Q") return false;

	// F（协战标记）必须在最前面，且最多带含 F 的两个字符
	const firstNonF = [...skill].findIndex((c) => c !== "F");
	const lastF = skill.lastIndexOf("F");
	if (lastF >= 0 && firstNonF >= 0 && lastF > firstNonF) return false;
	if (skill.includes("F") && skill.length > 2) return false;

	return true;
}

export function getTargetDefaultName(kind: TargetKind, index: number) {
	if (kind === "非忆灵") return `召唤物 ${index + 1}`;
	if (kind === "倒计时") return "倒计时";
	if (kind === "阿哈") return "阿哈时刻";
	return `${kind} ${index + 1}`;
}

export function createTarget(
	id: string,
	index: number,
	kind: TargetKind = "角色",
) {
	return {
		id,
		kind,
		name: getTargetDefaultName(kind, index),
		speed: "",
		baseSpeed: "",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		hasCastoriceTechnique: false,
		hasAglaeaTechnique: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
	};
}

export function withoutCharacterOnlyEffects(
	character: CharacterConfig,
): CharacterConfig {
	if (isCharacterTarget(character)) return character;
	return {
		...character,
		baseSpeed: "",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		hasCastoriceTechnique: false,
		hasAglaeaTechnique: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
	};
}

export const defaultCharacters: CharacterConfig[] = Array.from(
	{ length: 4 },
	(_, index) => createTarget(`c${index + 1}`, index),
);

export function ensureFileExtension(path: string, extension: string) {
	return path.toLowerCase().endsWith(extension) ? path : `${path}${extension}`;
}

export function getTimestampedFileName(prefix: string, extension: string) {
	return `${prefix}-${Date.now()}${extension}`;
}

export function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement) {
	const dataUrl = canvas.toDataURL("image/png");
	if (!dataUrl.startsWith("data:image/png;base64,")) {
		throw new Error("图片编码失败");
	}
	return dataUrl;
}

export function toPositiveNumber(value: string, fallback = 0) {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function toSignedNumber(value: string | undefined, fallback = 0) {
	if (value === undefined || value === "") return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatActionValue(value: number) {
	const normalized = normalizeActionValue(value);
	return Number.isInteger(normalized)
		? String(normalized)
		: normalized.toFixed(2);
}

export function formatEditableNumber(value: number) {
	const normalized = normalizeActionValue(value);
	return Number.isInteger(normalized)
		? String(normalized)
		: normalized.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function normalizeActionValue(value: number) {
	return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function getDefaultSkill(
	_character: CharacterConfig,
	_actionNo: number,
): SkillCode {
	return "";
}
