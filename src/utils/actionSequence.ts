import {
    getEffectRule,
    hasSemanticFlag as characterHasSemanticFlag,
    hasSkillEffect,
    normalizeName,
    validSkillChars,
} from "../data/characters";

export {
    getCharacterDisplayName,
    getCharacterPath,
    getEffectRule,
    getSpecialActionHint,
    getSkillEffectOwnerNames,
    hasPassive,
    hasSemanticFlag,
    hasSkillEffect,
    isQFrontCombo,
    normalizeName,
} from "../data/characters";

export type TargetKind = "角色" | "忆灵" | "非忆灵" | "敌人";

export type CharacterConfig = {
    id: string;
    kind: TargetKind;
    name: string;
    speed: string;
    baseSpeed: string;
    hasVonwacq: boolean;
    hasWindSet: boolean;
    hasDance: boolean;
    hasEidolon1: boolean;
    hasEidolon2: boolean;
    hasEidolon4: boolean;
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
    memeOwnerId?: string;
    isOdeExtraAction?: boolean;
    isCombustionAction?: boolean;
    isAglaeaSupremeAction?: boolean;
    isAglaeaCountdownAction?: boolean;
    isAglaeaGarmentmakerAction?: boolean;
    lockedSkill?: boolean;
    activeOdeLabels?: string[];
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
        "battle" | "nextTurn" | "turns" | "extraTurn" | "nextAttack" | "stacks";
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
    allowedSupremeSkills: SkillCode[];
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

const defaultCounterWDomainRule: DomainRule = {
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
            domainRule.defaultResources ??
            defaultCounterWDomainRule.defaultResources,
        allowedSkills:
            domainRule.allowedSkills ?? defaultCounterWDomainRule.allowedSkills,
        finalSkill:
            domainRule.finalSkill ?? defaultCounterWDomainRule.finalSkill,
        enemyTriggerSkills:
            (domainRule as { enemyTriggerSkills?: SkillCode[] })
                ?.enemyTriggerSkills ??
            defaultCounterWDomainRule.enemyTriggerSkills,
    };
}

const defaultCyreneUltimateRule: CyreneUltimateRule = {
    memospriteName: "德谬歌",
    memospriteSkill: "Q",
    defaultResources: ["追忆"],
    genericOde: {
        code: "generic",
        label: "诗篇",
        fullName: "诗篇",
        targetNames: [],
        duration: "turns",
        turns: 2,
    },
    odes: [],
};

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
        genericOde:
            effectRule?.genericOde ?? defaultCyreneUltimateRule.genericOde,
        odes: effectRule?.odes ?? defaultCyreneUltimateRule.odes,
    };
}

const defaultMemeAdvanceRule: MemeAdvanceRule = {
    memospriteName: "迷迷",
    memospriteSkill: "拉条",
    memospriteSpeed: 130,
    advancePercent: 100,
};

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
            effectRule?.memospriteSkill ??
            defaultMemeAdvanceRule.memospriteSkill,
        memospriteSpeed:
            effectRule?.memospriteSpeed ??
            defaultMemeAdvanceRule.memospriteSpeed,
        advancePercent:
            effectRule?.advancePercent ?? defaultMemeAdvanceRule.advancePercent,
    };
}

const defaultGarmentmakerRule: GarmentmakerRule = {
    memospriteName: "衣匠",
    memospriteSkill: "刺纹之陷",
    memospriteSpeed: 35,
    countdownName: "至高之姿倒计时",
    countdownSpeed: 100,
    stackSpeedBonus: 55,
    maxStacks: 6,
    eidolon4MaxStacks: 7,
    aglaeaSpeedBonusRatioPerStack: 0.15,
    retainedStacksAfterDismiss: 1,
    allowedSupremeSkills: ["", "A", "Q"],
};

export function getGarmentmakerRule(characterName: string): GarmentmakerRule {
    const effectRule = getEffectRule<Partial<GarmentmakerRule>>(
        characterName,
        "summonGarmentmaker",
    );
    return {
        ...defaultGarmentmakerRule,
        ...(effectRule ?? {}),
        memospriteName:
            effectRule?.memospriteName ??
            defaultGarmentmakerRule.memospriteName,
        memospriteSkill:
            effectRule?.memospriteSkill ??
            defaultGarmentmakerRule.memospriteSkill,
        memospriteSpeed:
            effectRule?.memospriteSpeed ??
            defaultGarmentmakerRule.memospriteSpeed,
        countdownName:
            effectRule?.countdownName ??
            defaultGarmentmakerRule.countdownName,
        countdownSpeed:
            effectRule?.countdownSpeed ??
            defaultGarmentmakerRule.countdownSpeed,
        stackSpeedBonus:
            effectRule?.stackSpeedBonus ??
            defaultGarmentmakerRule.stackSpeedBonus,
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
        allowedSupremeSkills:
            effectRule?.allowedSupremeSkills ??
            defaultGarmentmakerRule.allowedSupremeSkills,
    };
}

const defaultFireflyCombustionRule: FireflyCombustionRule = {
    countdownName: "完全燃烧倒计时",
    countdownSpeed: 70,
    speedBonus: 60,
    allowedSkills: ["", "A", "E"],
    breakLabel: "击破",
    breakDelayPercent: 10,
    maxBreakDelayTriggers: 3,
    eidolonExtraTurn: 2,
};

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
            effectRule?.countdownName ??
            defaultFireflyCombustionRule.countdownName,
        countdownSpeed:
            effectRule?.countdownSpeed ??
            defaultFireflyCombustionRule.countdownSpeed,
        speedBonus:
            effectRule?.speedBonus ??
            defaultFireflyCombustionRule.speedBonus,
        allowedSkills:
            effectRule?.allowedSkills ??
            defaultFireflyCombustionRule.allowedSkills,
        breakLabel:
            effectRule?.breakLabel ??
            defaultFireflyCombustionRule.breakLabel,
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
};

export const targetKinds: TargetKind[] = ["角色", "忆灵", "非忆灵", "敌人"];
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
        if (
            c === "W" &&
            characterHasSemanticFlag(character.name, "wOnlyInDomain")
        )
            return false;
    }

    // AE/EA 不能组合
    if (skill.includes("A") && skill.includes("E")) return false;

    // F（协战标记）必须在最前面，且最多带含 F 的两个字符
    const firstNonF = [...skill].findIndex((c) => c !== "F");
    const lastF = skill.lastIndexOf("F");
    if (lastF >= 0 && firstNonF >= 0 && lastF > firstNonF) return false;
    if (skill.includes("F") && skill.length > 2) return false;

    return true;
}

export function getTargetDefaultName(kind: TargetKind, index: number) {
    if (kind === "非忆灵") return `召唤物 ${index + 1}`;
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
        hasEidolon1: false,
        hasEidolon2: false,
        hasEidolon4: false,
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
        hasEidolon1: false,
        hasEidolon2: false,
        hasEidolon4: false,
    };
}

export const defaultCharacters: CharacterConfig[] = Array.from(
    { length: 4 },
    (_, index) => createTarget(`c${index + 1}`, index),
);

export function ensureFileExtension(path: string, extension: string) {
    return path.toLowerCase().endsWith(extension)
        ? path
        : `${path}${extension}`;
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
