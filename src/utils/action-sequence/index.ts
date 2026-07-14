import {
	hasSemanticFlag as characterHasSemanticFlag,
	getCharacterCid,
	getDefaultEffectRule,
	getEffectRule,
	hasSkillEffect,
	normalizeName,
	validSkillChars,
} from "../../data/characters";
import { archerMaxConsecutiveEs } from "../../mechanics/archer";
import { hasGilgamesh } from "../../mechanics/gilgamesh";
import type {
	CharacterConfig,
	CyreneUltimateRule,
	DomainRule,
	EveyRule,
	FireflyCombustionRule,
	GarmentmakerRule,
	MemeAdvanceRule,
	PolluxRule,
	SkillCode,
	TargetKind,
} from "./types";

export {
	getCharacterCid,
	getCharacterBaseSpeed,
	getCharacterDisplayName,
	getCharacterParticipantId,
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
} from "../../data/characters";
export type {
	CharacterConfig,
	CyreneUltimateRule,
	DomainRule,
	EveyRule,
	FireflyCombustionRule,
	GarmentmakerRule,
	GeneratedAction,
	MemeAdvanceRule,
	OdeRule,
	OdeSelection,
	PolluxRule,
	SavedData,
	SkillCode,
	SpeedAdjustment,
	SpeedChangeMode,
	TargetKind,
	UltInterrupt,
} from "./types";

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
		maxActions: effectRule?.maxActions ?? defaultPolluxRule.maxActions,
		keepSkill: effectRule?.keepSkill ?? defaultPolluxRule.keepSkill,
		dismissSkill: effectRule?.dismissSkill ?? defaultPolluxRule.dismissSkill,
	};
}

const defaultEveyRule: EveyRule =
	// biome-ignore lint/style/noNonNullAssertion: defaults in characters.json
	getDefaultEffectRule<EveyRule>("summonEvey")!;

export function getEveyRule(characterName: string): EveyRule {
	const effectRule = getEffectRule<Partial<EveyRule>>(
		characterName,
		"summonEvey",
	);
	return {
		...defaultEveyRule,
		...(effectRule ?? {}),
		memospriteName:
			effectRule?.memospriteName ?? defaultEveyRule.memospriteName,
		memospriteSpeed:
			effectRule?.memospriteSpeed ?? defaultEveyRule.memospriteSpeed,
		keepSkill: effectRule?.keepSkill ?? defaultEveyRule.keepSkill,
		dismissSkill: effectRule?.dismissSkill ?? defaultEveyRule.dismissSkill,
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
	targetCid: string | undefined,
) {
	return (
		rule.odes.find((ode) => ode.targetCid === targetCid) ?? rule.genericOde
	);
}

export function characterNameMatchesAliases(
	characterName: string,
	aliases: string[],
) {
	const normalizedName = normalizeName(characterName);
	return aliases.some((alias) => normalizeName(alias) === normalizedName);
}

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
export const evernightResourceName = "忆质";
export const archerFuaResourceName = "红A追击";
export const gilgameshInterestResourceName = "兴致";
export const CURRENT_SAVEDATA_VERSION = 1;

export function isCharacterTarget(character: CharacterConfig) {
	return character.kind === "角色";
}

export function hasEvernightCharacter(characters: CharacterConfig[]) {
	return characters.some(
		(character) =>
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "E", "summonEvey"),
	);
}

export function hasArcherCharacter(characters: CharacterConfig[]) {
	return characters.some(
		(character) =>
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "Q", "archerUltimate"),
	);
}

export function hasGilgameshCharacter(characters: CharacterConfig[]) {
	return characters.some(
		(character) => isCharacterTarget(character) && hasGilgamesh(character),
	);
}

export function normalizeResourcesForCharacters(
	resources: string[],
	characters: CharacterConfig[],
) {
	const hasEvernight = hasEvernightCharacter(characters);
	const hasArcher = hasArcherCharacter(characters);
	const hasGilgamesh = hasGilgameshCharacter(characters);
	const filtered = resources.filter(
		(resource) =>
			resource !== evernightResourceName &&
			resource !== archerFuaResourceName &&
			resource !== gilgameshInterestResourceName &&
			(!hasArcher || resource !== defaultResources[0]),
	);
	const locked = [
		...(hasGilgamesh ? [gilgameshInterestResourceName] : []),
		...(hasArcher ? [defaultResources[0], archerFuaResourceName] : []),
		...(hasEvernight ? [evernightResourceName] : []),
	];
	return [...locked, ...filtered].slice(0, maxResources);
}

export function isLockedResourceNameForCharacters(
	resourceName: string,
	characters: CharacterConfig[],
) {
	return (
		(hasEvernightCharacter(characters) &&
			resourceName === evernightResourceName) ||
		(hasGilgameshCharacter(characters) &&
			resourceName === gilgameshInterestResourceName) ||
		(hasArcherCharacter(characters) &&
			(resourceName === defaultResources[0] ||
				resourceName === archerFuaResourceName))
	);
}

export function isAllyTarget(kind: TargetKind | undefined) {
	return kind === "角色" || kind === "忆灵";
}

export function canSelectSkillTargetForAction(
	character: CharacterConfig,
	target: CharacterConfig,
) {
	if (character.id === target.id) return false;
	if (!isAllyTarget(target.kind)) return false;
	if (
		hasSkillEffect(character.name, "E", "sundayPullWithMemosprite") &&
		target.kind === "忆灵"
	) {
		return false;
	}
	return true;
}

/** 返回技能本身是否支持选择我方角色或忆灵作为目标。 */
export function canSelectAllyForSkill(
	character: CharacterConfig,
	skill: SkillCode,
): boolean {
	if (!isCharacterTarget(character)) return false;
	const targetsWithE =
		skill === "E" &&
		(hasSkillEffect(character.name, "E", "allyPullToCurrent") ||
			hasSkillEffect(character.name, "E", "sundayPullWithMemosprite") ||
			hasSkillEffect(character.name, "E", "allyAdvance50NotPast") ||
			hasSkillEffect(character.name, "E", "allyTargetSelectable"));
	const targetsWithQ =
		skill === "Q" &&
		(hasSkillEffect(character.name, "Q", "allyTargetSelectable") ||
			hasSkillEffect(character.name, "Q", "elationTrailblazerUltimate"));
	return targetsWithE || targetsWithQ;
}

export function isBasicAttackSkill(skill: SkillCode): boolean {
	return skill === "" || skill === "A";
}

/** 可选我方目标的技能、知更鸟/阮梅 E/Q 和藿藿 E 都不计为攻击。 */
export function isNonAttackSkill(
	character: CharacterConfig,
	skill: SkillCode,
): boolean {
	const cid = getCharacterCid(character.name);
	// Saber 的 A/E/Q 均固定视为攻击。
	if (cid === "1014" && (skill === "A" || skill === "E" || skill === "Q")) {
		return false;
	}
	return (
		canSelectAllyForSkill(character, skill) ||
		((cid === "1303" || cid === "1309") && (skill === "E" || skill === "Q")) ||
		(cid === "1408" && skill === "Q") ||
		(cid === "1217" && skill === "E")
	);
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

	// 红A {n}E 支持：数字前缀 + E（如 5E、1E、E），最多连续 5 箭
	if (
		hasSkillEffect(character.name, "Q", "archerUltimate") &&
		/^\d*E$/.test(skill) &&
		(skill === "E" ||
			(Number.parseInt(skill, 10) >= 1 &&
				Number.parseInt(skill, 10) <= archerMaxConsecutiveEs))
	)
		return true;

	const chars = [...skill];
	for (const c of chars) {
		if (!validSkillChars.includes(c)) return false;
		if (c === "W" && !hasSkillEffect(character.name, "W", "counterW"))
			return false;
	}

	// AE/EA 不能组合（白厄 E2 以上境界内允许 EA/EW）
	if (skill.includes("A") && skill.includes("E")) return false;

	// 非 E2 白厄境界外不可输入 EA/EW（E2 以上允许，引擎自动降级处理）
	if (
		characterHasSemanticFlag(character.name, "wOnlyInDomain") &&
		character.eidolon < 2 &&
		(skill === "EA" || skill === "EW")
	) {
		return false;
	}

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
		techniqueOn: true,
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
	return normalized.toFixed(2);
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
