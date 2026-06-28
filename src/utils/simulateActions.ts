import {
    getCharacterPath,
    hasPassive,
    hasSkillEffect,
} from "../data/characters";
import {
    handleAglaeaCountdownAction,
    handleAglaeaSkillEffects,
    handleGarmentmakerAction,
    isAglaeaCountdownAction,
    type AglaeaActionState,
} from "./aglaeaGarmentmaker";
import {
    activateCombustion,
    checkBreakTrigger,
    handleFireflyCountdownAction,
    isFireflyCountdownAction,
    shouldActivateCombustion,
    shouldCheckBreakTrigger,
} from "./fireflyCombustion";
import {
    applyPhainonDomainPauseAndSpeedBonus,
    expirePhainonDomainSpeedBonus,
    getPhainonDomainEndIndex,
    getPhainonDomainInterval,
    hasPhainonEnemyTriggerSkill,
    type PhainonDomainState,
} from "./phainonDomain";
import {
    type CharacterConfig,
    canUseSkillCode,
    characterNameMatchesAliases,
    type GeneratedAction,
    getCounterWDomainRule,
    getCyreneUltimateRule,
    getGarmentmakerRule,
    getMemeAdvanceRule,
    getOdeRuleForTarget,
    isCharacterTarget,
    type SkillCode,
    type SpeedAdjustment,
    toPositiveNumber,
    toSignedNumber,
    type UltInterrupt,
    normalizeActionValue,
    type OdeRule,
    type OdeSelection,
    shouldRememberSkillTarget,
} from "./actionSequence";

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
};

// --- Internal helpers ---

function toNonNegativeNumber(
    value: string | undefined,
    fallback: number,
): number {
    const normalizedFallback = normalizeActionValue(fallback);
    if (value === undefined || value === "") return normalizedFallback;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0
        ? normalizeActionValue(parsed)
        : normalizedFallback;
}

function canBeAdvancedByDance(kind: string): boolean {
    return kind === "角色" || kind === "忆灵";
}

function isAllyTarget(kind: string): boolean {
    return kind === "角色" || kind === "忆灵";
}

function hasTeamAdvance24OnUltimate(character: CharacterConfig): boolean {
    if (!isCharacterTarget(character)) return false;
    if (character.hasDance && getCharacterPath(character.name) === "Harmony") {
        return true;
    }
    return (
        character.hasEidolon2 &&
        hasSkillEffect(character.name, "Q", "teamAdvance24")
    );
}

function getDefaultSkill(
    _character: CharacterConfig,
    _actionNo: number,
): string {
    return "";
}

function getActionSkill(
    character: CharacterConfig,
    actionNo: number,
    key: string,
    skillOverrides: Record<string, string>,
    legacyUltOverrides: Record<string, boolean>,
): string {
    const override = skillOverrides[key];
    if (override !== undefined) {
        if (!canUseSkillCode(character, override)) return "";
        return override;
    }

    if (legacyUltOverrides[key] !== undefined) {
        return legacyUltOverrides[key] ? "Q" : "";
    }

    return getDefaultSkill(character, actionNo);
}

function getNextSpeed(
    currentSpeed: number,
    baseSpeed: number,
    adjustment: SpeedAdjustment | undefined,
): number {
    if (!adjustment) return currentSpeed;
    const value = toSignedNumber(adjustment.value, 0);
    const nextSpeed =
        adjustment.mode === "relative"
            ? currentSpeed + (baseSpeed * value) / 100
            : currentSpeed + value;
    return nextSpeed > 0 ? nextSpeed : currentSpeed;
}

function getSkillTarget(
    input: SimulateActionsInput,
    actionKey: string,
    character: CharacterConfig,
) {
    return (
        input.skillTargets[actionKey] ??
        (shouldRememberSkillTarget(character.name)
            ? input.defaultSkillTargets[character.id]
            : undefined)
    );
}

function findHimekoNovaAssistState(
    states: ActionState[],
    sourceCharacterId: string,
) {
    return states.find(
        (state) =>
            state.character.id !== sourceCharacterId &&
            isAllyTarget(state.character.kind) &&
            hasSkillEffect(state.character.name, "F", "himekoNovaAssist"),
    );
}

function findMemeAdvanceOwnerState(states: ActionState[]) {
    return states.find(
        (state) =>
            isCharacterTarget(state.character) &&
            hasSkillEffect(state.character.name, "M", "memeAdvance"),
    );
}

function findMemeState(states: ActionState[], ownerId: string) {
    return states.find(
        (state) => state.isMemeState && state.memeOwnerId === ownerId,
    );
}

function summonMemeState(
    states: ActionState[],
    owner: CharacterConfig,
    actionValue: number,
) {
    if (findMemeState(states, owner.id)) return;
    const rule = getMemeAdvanceRule(owner.name);
    const speed = rule.memospriteSpeed > 0 ? rule.memospriteSpeed : 130;
    states.push({
        character: {
            ...owner,
            id: `${owner.id}-meme`,
            kind: "忆灵",
            name: rule.memospriteName,
            speed: String(speed),
            baseSpeed: String(speed),
            hasVonwacq: false,
            hasWindSet: false,
            hasDance: false,
            hasEidolon1: false,
            hasEidolon2: false,
            hasEidolon4: false,
        },
        baseSpeed: speed,
        currentSpeed: speed,
        phainonDomainSpeedBonus: 0,
        actionNo: 1,
        nextActionValue: actionValue + 10000 / speed,
        blockNextAdvance: false,
        isMemeState: true,
        memeOwnerId: owner.id,
    });
}

// --- Internal state ---

interface ActionState extends AglaeaActionState {
    character: CharacterConfig;
    baseSpeed: number;
    currentSpeed: number;
    phainonDomainSpeedBonus: number;
    actionNo: number;
    nextActionValue: number;
    blockNextAdvance: boolean;
    isMemeState?: boolean;
    memeOwnerId?: string;
    domainState?: PhainonDomainState;
    // Firefly E2 Complete Combustion state
    isInCompleteCombustion?: boolean;
    combustionBreakCount?: number;
    combustionDelayCount?: number;
    combustionCountdownId?: string;
    combustionStartAV?: number;
    // Countdown entity marker
    combustionOwnerId?: string;
}

type ActiveOdeState = {
    ode: OdeRule;
    remainingTurns?: number;
    remainingAttacks?: number;
    stacks?: number;
};

function getActiveOdeLabels(
    activeOdes: Map<string, ActiveOdeState[]>,
    characterId: string,
) {
    const labels = activeOdes
        .get(characterId)
        ?.map((effect) => effect.ode.label);
    return labels && labels.length > 0 ? labels : undefined;
}

function hasActiveOdeEffect(
    activeOdes: Map<string, ActiveOdeState[]>,
    characterId: string,
    effect: string,
) {
    return (
        activeOdes
            .get(characterId)
            ?.some((activeOde) => activeOde.ode.effects?.includes(effect)) ??
        false
    );
}

function consumeActionOdes(
    activeOdes: Map<string, ActiveOdeState[]>,
    characterId: string,
    skill: string,
    countTurn: boolean,
) {
    const effects = activeOdes.get(characterId);
    if (!effects) return;
    const nextEffects: ActiveOdeState[] = [];
    for (const effect of effects) {
        if (countTurn && effect.remainingTurns !== undefined) {
            effect.remainingTurns -= 1;
        }
        if (
            effect.remainingAttacks !== undefined &&
            (skill.includes("A") || skill.includes("E") || skill.includes("Q"))
        ) {
            effect.remainingAttacks -= 1;
        }
        if (
            effect.ode.code === "sky" &&
            effect.stacks !== undefined &&
            (skill.includes("E") || skill.includes("Q"))
        ) {
            effect.stacks -= 1;
        }
        if (effect.remainingTurns !== undefined && effect.remainingTurns <= 0)
            continue;
        if (
            effect.remainingAttacks !== undefined &&
            effect.remainingAttacks <= 0
        )
            continue;
        if (effect.stacks !== undefined && effect.stacks <= 0) continue;
        nextEffects.push(effect);
    }
    if (nextEffects.length === 0) activeOdes.delete(characterId);
    else activeOdes.set(characterId, nextEffects);
}

function findTargetStateById(states: ActionState[], targetId: string) {
    return states.find((state) => state.character.id === targetId);
}

function applyOdeSelection(
    selection: OdeSelection | undefined,
    cyrene: CharacterConfig,
    states: ActionState[],
    activeOdes: Map<string, ActiveOdeState[]>,
    actionValue: number,
) {
    if (!selection) return;
    const rule = getCyreneUltimateRule(cyrene.name);
    const target = findTargetStateById(states, selection.targetId);
    if (!target) return;
    const ode =
        rule.odes.find((candidate) => candidate.code === selection.odeCode) ??
        getOdeRuleForTarget(rule, target.character.name);
    if (
        ode.targetNames.length > 0 &&
        !characterNameMatchesAliases(target.character.name, ode.targetNames)
    ) {
        return;
    }

    const effect: ActiveOdeState = { ode };
    if (ode.duration === "nextTurn") effect.remainingTurns = 1;
    if (ode.duration === "turns") effect.remainingTurns = ode.turns ?? 2;
    if (ode.duration === "nextAttack") effect.remainingAttacks = 1;
    if (ode.duration === "stacks") effect.stacks = ode.stacks ?? 1;
    if (ode.duration !== "extraTurn") {
        activeOdes.set(selection.targetId, [
            ...(activeOdes.get(selection.targetId) ?? []),
            effect,
        ]);
    }

    if (ode.effects?.includes("immediateTurn") && !target.blockNextAdvance) {
        target.nextActionValue = actionValue;
    }
}

function emitCyreneMemospriteAction({
    input,
    actions,
    states,
    activeOdes,
    cyrene,
    sourceKey,
    actionValue,
}: {
    input: SimulateActionsInput;
    actions: GeneratedAction[];
    states: ActionState[];
    activeOdes: Map<string, ActiveOdeState[]>;
    cyrene: CharacterConfig;
    sourceKey: string;
    actionValue: number;
}) {
    if (!isCharacterTarget(cyrene)) return;
    if (!hasSkillEffect(cyrene.name, "Q", "cyreneUltimate")) return;

    const cyreneRule = getCyreneUltimateRule(cyrene.name);
    const memospriteKey = `${sourceKey}-memosprite-Q`;
    actions.push({
        key: memospriteKey,
        characterId: `${cyrene.id}-memosprite`,
        displayName: cyreneRule.memospriteName,
        targetKind: "忆灵",
        actionNo: 0,
        actionValue,
        skill: cyreneRule.memospriteSkill,
        speed: 0,
        isMemospriteAction: true,
        memospriteOwnerId: cyrene.id,
    });
    applyOdeSelection(
        input.odeSelections[memospriteKey],
        cyrene,
        states,
        activeOdes,
        actionValue,
    );
    const selection = input.odeSelections[memospriteKey];
    const selectedTarget = selection
        ? findTargetStateById(states, selection.targetId)
        : undefined;
    const selectedOde =
        selection && selectedTarget
            ? (cyreneRule.odes.find((ode) => ode.code === selection.odeCode) ??
              getOdeRuleForTarget(cyreneRule, selectedTarget.character.name))
            : undefined;
    if (selection && selectedOde?.effects?.includes("immediateEnhancedSkill")) {
        if (
            selectedTarget &&
            characterNameMatchesAliases(
                selectedTarget.character.name,
                selectedOde.targetNames,
            )
        ) {
            actions.push({
                key: `${memospriteKey}-ode-${selectedOde.code}`,
                characterId: selectedTarget.character.id,
                actionNo: 0,
                actionValue,
                skill: "E" as SkillCode,
                speed: selectedTarget.currentSpeed,
                isOdeExtraAction: true,
                lockedSkill: true,
                activeOdeLabels: [selectedOde.label],
            });
        }
    }
}

function emitMemeAdvanceAction({
    input,
    actions,
    states,
    sourceKey,
    actionValue,
    activeOdes,
}: {
    input: SimulateActionsInput;
    actions: GeneratedAction[];
    states: ActionState[];
    sourceKey: string;
    actionValue: number;
    activeOdes: Map<string, ActiveOdeState[]>;
}) {
    const memeKey = `${sourceKey}-meme`;
    const targetId = input.memeSelections[memeKey];
    if (!targetId) return;
    const owner = findMemeAdvanceOwnerState(states);
    if (!owner) return;
    const meme = findMemeState(states, owner.character.id);
    if (!meme) return;
    const target = findTargetStateById(states, targetId);
    if (!target || !isCharacterTarget(target.character)) return;

    const rule = getMemeAdvanceRule(owner.character.name);
    actions.push({
        key: memeKey,
        characterId: meme.character.id,
        displayName: rule.memospriteName,
        targetKind: "忆灵",
        actionNo: meme.actionNo,
        actionValue,
        skill: rule.memospriteSkill,
        speed: meme.currentSpeed,
        isMemospriteAction: true,
        isMemeAction: true,
        memospriteOwnerId: owner.character.id,
        memeOwnerId: owner.character.id,
        activeOdeLabels: getActiveOdeLabels(activeOdes, owner.character.id),
    });

    if (!target.blockNextAdvance && target.nextActionValue > actionValue) {
        const remainingActionValue = target.nextActionValue - actionValue;
        target.nextActionValue =
            actionValue +
            (remainingActionValue * Math.max(0, 100 - rule.advancePercent)) /
                100;
    }
    meme.actionNo += 1;
    meme.nextActionValue = actionValue + 10000 / meme.currentSpeed;
    meme.blockNextAdvance = false;
}

// --- Main simulation ---

export function simulateActions(
    input: SimulateActionsInput,
): GeneratedAction[] {
    const states: ActionState[] = input.characters
        .filter((c) => toPositiveNumber(c.speed, 0) > 0)
        .map((character) => {
            const speed = toPositiveNumber(character.speed, 0);
            let advancePct = 0;
            if (isCharacterTarget(character) && character.hasVonwacq)
                advancePct += 0.4;
            if (hasPassive(character.name, "firstActionAdvance25"))
                advancePct += 0.25;
            if (hasPassive(character.name, "firstActionAdvance30"))
                advancePct += 0.3;
            if (hasPassive(character.name, "firstActionAdvance40"))
                advancePct += 0.4;
            const firstActionValue = (10000 * (1 - advancePct)) / speed;

            return {
                character,
                baseSpeed:
                    toPositiveNumber(character.baseSpeed, 0) > 0
                        ? toPositiveNumber(character.baseSpeed, speed)
                        : hasSkillEffect(character.name, "W", "counterW")
                          ? getCounterWDomainRule(character.name)
                                .defaultBaseSpeed
                          : speed,
                currentSpeed: speed,
                phainonDomainSpeedBonus: 0,
                actionNo: 1,
                nextActionValue: firstActionValue,
                blockNextAdvance: false,
            };
        });

    const actions: GeneratedAction[] = [];
    const activeOdes = new Map<string, ActiveOdeState[]>();
    let guard = 0;

    while (states.length > 0 && guard < 2000) {
        guard += 1;

        // Build candidates
        const candidates = states.map((state, stateIndex) => {
            const key = `${state.character.id}-${state.actionNo}`;
            return {
                stateIndex,
                key,
                actionValue: toNonNegativeNumber(
                    input.overrides[key],
                    state.nextActionValue,
                ),
            };
        });

        // Sort by action value, then by character id
        candidates.sort((a, b) => {
            if (a.actionValue !== b.actionValue)
                return a.actionValue - b.actionValue;
            return states[a.stateIndex].character.id.localeCompare(
                states[b.stateIndex].character.id,
            );
        });

        const next = candidates[0];
        if (!next) break;
        if (next.actionValue > input.limit) break;

        const stateIndex = next.stateIndex;
        const key = next.key;
        const actionValue = next.actionValue;
        const character = states[stateIndex].character;
        const actionNo = states[stateIndex].actionNo;
        const shouldClearAdvanceBlock = states[stateIndex].blockNextAdvance;

        // ── 流萤完全燃烧倒计时行动 ──
        if (isFireflyCountdownAction(states[stateIndex])) {
            handleFireflyCountdownAction(
                states,
                stateIndex,
                actions,
                key,
                character,
                actionNo,
                actionValue,
            );
            continue;
        }

        // ── 阿格莱雅至高之姿倒计时：倒计时行动时衣匠离场 ──
        if (isAglaeaCountdownAction(states[stateIndex])) {
            handleAglaeaCountdownAction(
                states,
                stateIndex,
                actions,
                key,
                character,
                actionNo,
                actionValue,
            );
            continue;
        }

        // ── 衣匠行动：默认攻击处于【间隙织线】的敌方目标并获得层数 ──
        if (states[stateIndex].isGarmentmakerState) {
            handleGarmentmakerAction(
                states,
                stateIndex,
                actions,
                key,
                character,
                actionNo,
                actionValue,
            );
            continue;
        }

        // ── 境界内连动（每循环一次生成一动，让敌人行动可自然穿插） ──
        if (states[stateIndex].domainState) {
            const ds = states[stateIndex].domainState!;
            const i = ds.currentIndex;
            const domainKey = `${ds.keyPrefix}-domain-${i}`;
            const domainAV = toNonNegativeNumber(
                input.overrides[domainKey],
                ds.startAV + ds.interval * i,
            );
            const isFinalDomainAction = i >= ds.maxIndex;
            const domainSkill = isFinalDomainAction
                ? ds.rule.finalSkill
                : ((input.skillOverrides[domainKey] ?? "") as SkillCode);

            actions.push({
                key: domainKey,
                characterId: character.id,
                actionNo: i + 1,
                actionValue: domainAV,
                skill: domainSkill,
                speed: states[stateIndex].currentSpeed,
                isDomainAction: true,
                isDomainFinalAction: isFinalDomainAction,
                activeOdeLabels: getActiveOdeLabels(activeOdes, character.id),
            });

            // ── W/EW 敌人立即行动 ──
            if (
                !isFinalDomainAction &&
                hasPhainonEnemyTriggerSkill(ds.rule, domainSkill)
            ) {
                for (const enemyState of states) {
                    if (enemyState.character.kind !== "敌人") continue;
                    actions.push({
                        key: `${domainKey}-enemy-${enemyState.character.id}`,
                        characterId: enemyState.character.id,
                        actionNo: enemyState.actionNo,
                        actionValue: domainAV,
                        skill: "" as SkillCode,
                        speed: enemyState.currentSpeed,
                    });
                    enemyState.actionNo += 1;
                    enemyState.nextActionValue =
                        domainAV + 10000 / enemyState.currentSpeed;
                }
            }

            if (isFinalDomainAction) {
                // ── 境界结束 ──
                states[stateIndex].domainState = undefined;
                states[stateIndex].actionNo += 1;
                states[stateIndex].nextActionValue =
                    domainAV + 10000 / states[stateIndex].currentSpeed;
                applyPhainonDomainPauseAndSpeedBonus(
                    states,
                    stateIndex,
                    ds.startAV,
                    domainAV,
                    ds.rule.endSpeedBonusBaseSpeedRatio,
                );
            } else {
                ds.currentIndex += 1;
                states[stateIndex].nextActionValue =
                    ds.startAV + ds.interval * ds.currentIndex;
            }
            continue;
        }

        const rawSkill = getActionSkill(
            character,
            actionNo,
            key,
            input.skillOverrides,
            input.legacyUltOverrides,
        );
        const himekoNovaAssist =
            rawSkill.includes("F") &&
            isAllyTarget(character.kind) &&
            !hasSkillEffect(character.name, "F", "himekoNovaAssist")
                ? findHimekoNovaAssistState(states, character.id)
                : undefined;
        const actionSkill = rawSkill.replace(/F/g, "") as SkillCode;
        const skill =
            states[stateIndex].aglaeaSupremeActive &&
            !getGarmentmakerRule(character.name).allowedSupremeSkills.includes(
                actionSkill,
            )
                ? ("" as SkillCode)
                : actionSkill;
        const assistUseCount = rawSkill.match(/F/g)?.length ?? 0;
        const skipAssistFollowUp =
            himekoNovaAssist !== undefined && assistUseCount >= 2;

        // 流萤完全燃烧：EE 拆分为两动 E（多出的 E 在 emit 后生成额外行动）
        const eeSplitCount =
            states[stateIndex].isInCompleteCombustion &&
            skill.length > 1 &&
            [...skill].every((c) => c === "E")
                ? skill.length - 1
                : 0;
        const resolvedSkill = eeSplitCount > 0
            ? ("E" as SkillCode)
            : skill;
        const usesUltimate = skill.includes("Q");
        const qIsFront = skill.length > 1 && skill.startsWith("Q");
        const actionSpeed = states[stateIndex].currentSpeed;

        const interrupts = input.ultInterrupts[key] ?? [];
        let pendingAssistFollowUpAdvance = 0;

        // 插队大招：在目标行动前/后插入多个施法者的大招行动
        const emitInterrupt = (idx: number) => {
            const int = interrupts[idx];
            if (!int) return;
            const casterIndex = states.findIndex(
                (s) => s.character.id === int.casterId,
            );
            if (casterIndex === -1) return;
            const caster = states[casterIndex];
            const casterSpeed = caster.currentSpeed;
            actions.push({
                key: `${key}-interrupt-${idx}`,
                characterId: caster.character.id,
                actionNo: 0,
                actionValue,
                skill: "Q" as SkillCode,
                speed: casterSpeed,
                activeOdeLabels: getActiveOdeLabels(
                    activeOdes,
                    caster.character.id,
                ),
            });
            emitMemeAdvanceAction({
                input,
                actions,
                states,
                sourceKey: `${key}-interrupt-${idx}`,
                actionValue,
                activeOdes,
            });
            consumeActionOdes(activeOdes, caster.character.id, "Q", false);
            if (hasSkillEffect(caster.character.name, "Q", "cyreneUltimate")) {
                emitCyreneMemospriteAction({
                    input,
                    actions,
                    states,
                    activeOdes,
                    cyrene: caster.character,
                    sourceKey: `${key}-interrupt-${idx}`,
                    actionValue,
                });
            }
            // 插队大招触发 24% 全队拉条（舞舞舞、忘归人 2魂等）。
            if (
                hasTeamAdvance24OnUltimate(caster.character)
            ) {
                for (
                    let teammateIndex = 0;
                    teammateIndex < states.length;
                    teammateIndex++
                ) {
                    const teammate = states[teammateIndex];
                    if (!canBeAdvancedByDance(teammate.character.kind))
                        continue;
                    if (teammate.blockNextAdvance) continue;
                    const adv = 2400 / teammate.currentSpeed;
                    if (
                        himekoNovaAssist &&
                        !skipAssistFollowUp &&
                        teammateIndex === stateIndex &&
                        teammate.nextActionValue <= actionValue
                    ) {
                        pendingAssistFollowUpAdvance += adv;
                        continue;
                    }
                    teammate.nextActionValue = Math.max(
                        actionValue,
                        teammate.nextActionValue - adv,
                    );
                }
            }
            if (
                isCharacterTarget(caster.character) &&
                caster.character.hasWindSet
            ) {
                const windAdvance = 2500 / casterSpeed;
                if (
                    himekoNovaAssist &&
                    !skipAssistFollowUp &&
                    casterIndex === stateIndex &&
                    caster.nextActionValue <= actionValue
                ) {
                    pendingAssistFollowUpAdvance += windAdvance;
                } else if (!caster.blockNextAdvance) {
                    caster.nextActionValue = Math.max(
                        actionValue,
                        caster.nextActionValue - windAdvance,
                    );
                }
            }
            if (isAllyTarget(caster.character.kind)) {
                expirePhainonDomainSpeedBonus(states, actionValue);
            }
            // 插队大招触发角色 Q 特殊效果（知更鸟全队顶轴）
            if (hasSkillEffect(caster.character.name, "Q", "robinUltimate")) {
                caster.currentSpeed = 90;
                caster.nextActionValue =
                    actionValue + 10000 / caster.currentSpeed;
                caster.blockNextAdvance = true;
                const allyOrder = states
                    .map((s, i) => ({ index: i, value: s.nextActionValue }))
                    .filter(
                        ({ index }) =>
                            index !== casterIndex &&
                            isAllyTarget(states[index].character.kind),
                    )
                    .sort((a, b) => {
                        if (a.value !== b.value) return a.value - b.value;
                        return a.index - b.index;
                    });
                for (let rank = 0; rank < allyOrder.length; rank++) {
                    states[allyOrder[rank].index].nextActionValue =
                        actionValue + rank * 0.0001;
                }
            }
            // 插队大招触发流萤完全燃烧。
            if (
                shouldActivateCombustion(
                    caster.character,
                    true,
                    Boolean(caster.isInCompleteCombustion),
                )
            ) {
                activateCombustion(
                    states,
                    casterIndex,
                    actions,
                    `${key}-interrupt-${idx}`,
                    caster.character,
                    caster.actionNo,
                    actionValue,
                    input,
                );
            }
            // 插队大招触发阿格莱雅至高之姿，并使自身立即行动。
            handleAglaeaSkillEffects(states, casterIndex, "Q", actionValue);
            // 插队大招触发白厄境界（改为逐动生成）
            if (hasSkillEffect(caster.character.name, "W", "counterW")) {
                const domainRule = getCounterWDomainRule(caster.character.name);
                const domainInterval = getPhainonDomainInterval(
                    caster.character,
                    casterSpeed,
                );
                const domainKeyPrefix = `${key}-interrupt-${idx}`;
                const isEndlessDomain = hasActiveOdeEffect(
                    activeOdes,
                    caster.character.id,
                    "endlessCounterWDomain",
                );
                const maxDomainActionIndex = isEndlessDomain
                    ? Math.max(
                          0,
                          Math.ceil(
                              (input.limit - actionValue) / domainInterval,
                          ),
                      )
                    : Math.max(0, domainRule.extraActionCount - 1);
                const domainEndIndex = getPhainonDomainEndIndex(
                    domainKeyPrefix,
                    input.domainEndOverrides,
                    maxDomainActionIndex,
                );

                if (domainEndIndex >= 0) {
                    // 设置境界状态，由上层循环逐一生成境界内行动
                    caster.domainState = {
                        keyPrefix: domainKeyPrefix,
                        startAV: actionValue,
                        interval: domainInterval,
                        currentIndex: 0,
                        maxIndex: domainEndIndex,
                        rule: domainRule,
                    };
                    // 插队大招后境界第一动与插队大招同 AV
                    caster.nextActionValue = actionValue;
                }
            }
        };

        // 按 timing 分组处理
        const beforeInterrupts = interrupts.filter(
            (i) => i.timing === "before",
        );
        const afterInterrupts = interrupts.filter((i) => i.timing === "after");

        if (himekoNovaAssist) {
            for (
                let assistIndex = 1;
                assistIndex <= Math.min(assistUseCount, 2);
                assistIndex++
            ) {
                const assistKey =
                    assistIndex === 1
                        ? `${key}-assist-F`
                        : `${key}-assist-F-${assistIndex}`;
                actions.push({
                    key: assistKey,
                    characterId: himekoNovaAssist.character.id,
                    actionNo: 0,
                    actionValue,
                    skill: "F" as SkillCode,
                    speed: himekoNovaAssist.currentSpeed,
                    isAssistAction: true,
                    assistSourceKey: key,
                    assistIndex,
                    activeOdeLabels: getActiveOdeLabels(
                        activeOdes,
                        himekoNovaAssist.character.id,
                    ),
                });
                emitMemeAdvanceAction({
                    input,
                    actions,
                    states,
                    sourceKey: assistKey,
                    actionValue,
                    activeOdes,
                });
                expirePhainonDomainSpeedBonus(states, actionValue);
            }
        }

        // 行动前插队（按添加顺序逐个执行）
        if (!skipAssistFollowUp) {
            for (let i = 0; i < beforeInterrupts.length; i++) {
                emitInterrupt(interrupts.indexOf(beforeInterrupts[i]));
            }
            if (beforeInterrupts.length > 0) {
                states[stateIndex].blockNextAdvance = true;
            }
        }

        if (!skipAssistFollowUp) {
            actions.push({
                key,
                characterId: character.id,
                displayName: states[stateIndex].isMemeState
                    ? character.name
                    : undefined,
                targetKind: states[stateIndex].isMemeState ? "忆灵" : undefined,
                isCombustionAction: states[stateIndex].isInCompleteCombustion,
                isAglaeaSupremeAction:
                    states[stateIndex].aglaeaSupremeActive,
                actionNo,
                actionValue,
                skill: resolvedSkill as SkillCode,
                speed: actionSpeed,
                isAssistFollowUp: himekoNovaAssist !== undefined,
                isMemospriteAction: states[stateIndex].isMemeState,
                memospriteOwnerId: states[stateIndex].memeOwnerId,
                activeOdeLabels: getActiveOdeLabels(activeOdes, character.id),
            });
            consumeActionOdes(activeOdes, character.id, skill, true);
            if (
                isCharacterTarget(character) &&
                hasSkillEffect(character.name, "Q", "cyreneUltimate") &&
                usesUltimate
            ) {
                emitCyreneMemospriteAction({
                    input,
                    actions,
                    states,
                    activeOdes,
                    cyrene: character,
                    sourceKey: key,
                    actionValue,
                });
            }
        }

        // ── 流萤完全燃烧 EE 多出的 E → 生成额外行动 ──
        if (eeSplitCount > 0 && !skipAssistFollowUp) {
            for (let ei = 0; ei < eeSplitCount; ei++) {
                const extraKey = `${key}-combustion-e${ei + 1}`;
                actions.push({
                    key: extraKey,
                    characterId: character.id,
                    isCombustionAction: true,
                    actionNo,
                    actionValue,
                    skill: "E" as SkillCode,
                    speed: actionSpeed,
                });
            }
        }

        // Apply speed adjustment
        states[stateIndex].currentSpeed = getNextSpeed(
            states[stateIndex].currentSpeed,
            states[stateIndex].baseSpeed,
            input.speedAdjustments[key],
        );
        if (isAllyTarget(character.kind)) {
            expirePhainonDomainSpeedBonus(states, actionValue);
        }

        // ── 白厄 Q 境界（改为逐动生成，让敌人可以穿插） ──
        if (
            isCharacterTarget(character) &&
            hasSkillEffect(character.name, "W", "counterW") &&
            skill.includes("Q")
        ) {
            const domainRule = getCounterWDomainRule(character.name);
            const domainInterval = getPhainonDomainInterval(
                character,
                actionSpeed,
            );
            const startAV = actionValue;
            const isEndlessDomain = hasActiveOdeEffect(
                activeOdes,
                character.id,
                "endlessCounterWDomain",
            );
            const maxDomainActionIndex = isEndlessDomain
                ? Math.max(
                      0,
                      Math.ceil((input.limit - startAV) / domainInterval),
                  )
                : Math.max(0, domainRule.extraActionCount - 1);
            const domainEndIndex = getPhainonDomainEndIndex(
                key,
                input.domainEndOverrides,
                maxDomainActionIndex,
            );

            if (domainEndIndex >= 0) {
                // 设置境界状态，由上层循环逐一生成境界内行动
                states[stateIndex].domainState = {
                    keyPrefix: key,
                    startAV,
                    interval: domainInterval,
                    currentIndex: 0,
                    maxIndex: domainEndIndex,
                    rule: domainRule,
                };
                // 下一动就是境界第一动（与 Q 同 AV）
                states[stateIndex].nextActionValue = startAV;
            }
        } else {
            // ── 流萤完全燃烧（使用 Q 后激活） ──
            let justActivatedCombustion = false;
            if (
                shouldActivateCombustion(
                    character,
                    usesUltimate,
                    Boolean(states[stateIndex].isInCompleteCombustion),
                )
            ) {
                activateCombustion(
                    states,
                    stateIndex,
                    actions,
                    key,
                    character,
                    actionNo,
                    actionValue,
                    input,
                );
                justActivatedCombustion = true;
            }

            // ── 正常下一动间隔（燃烧激活时由 activateCombustion 设 100%提前） ──
            {
                const nextInterval = 10000 / states[stateIndex].currentSpeed;
                states[stateIndex].actionNo += 1;
                if (!justActivatedCombustion) {
                    states[stateIndex].nextActionValue = actionValue + nextInterval;
                }
                // 风套：Q 后行动提前 25%
                if (
                    isCharacterTarget(character) &&
                    character.hasWindSet &&
                    usesUltimate &&
                    !qIsFront &&
                    !justActivatedCombustion
                ) {
                    const windAdvance = 2500 / states[stateIndex].currentSpeed;
                    states[stateIndex].nextActionValue = Math.max(
                        actionValue,
                        states[stateIndex].nextActionValue - windAdvance,
                    );
                }
                if (pendingAssistFollowUpAdvance > 0) {
                    states[stateIndex].nextActionValue = Math.max(
                        actionValue,
                        states[stateIndex].nextActionValue -
                            pendingAssistFollowUpAdvance,
                    );
                }

                // 24% 全队拉条（舞舞舞、忘归人 2魂等）。
                if (
                    hasTeamAdvance24OnUltimate(character) &&
                    usesUltimate &&
                    !qIsFront
                ) {
					for (const teammate of states) {
						if (!canBeAdvancedByDance(teammate.character.kind))
							continue;
						if (teammate.blockNextAdvance) continue;
						const advance = 2400 / teammate.currentSpeed;
						teammate.nextActionValue = Math.max(
							actionValue,
							teammate.nextActionValue - advance,
						);
					}
				}

                // Bronya A: self advance 30%
                if (
                    isCharacterTarget(character) &&
                    hasSkillEffect(character.name, "A", "selfAdvance30") &&
                    skill.includes("A")
                ) {
                    const advance = 3000 / actionSpeed;
                    if (!states[stateIndex].blockNextAdvance) {
                        states[stateIndex].nextActionValue = Math.max(
                            actionValue,
                            states[stateIndex].nextActionValue - advance,
                        );
                    }
                }

                // Bronya/Sunday E: pull target to current action value
                if (
                    isCharacterTarget(character) &&
                    hasSkillEffect(character.name, "E", "allyPullToCurrent") &&
                    skill.includes("E")
                ) {
                    const targetId = getSkillTarget(input, key, character);
                    if (targetId) {
                        for (const teammate of states) {
                            if (
                                teammate.character.id === targetId &&
                                !teammate.blockNextAdvance
                            ) {
                                teammate.nextActionValue = actionValue;
                            }
                        }
                    }
                }

                // Sparkle E: 50% advance, not past current action value
                if (
                    isCharacterTarget(character) &&
                    hasSkillEffect(
                        character.name,
                        "E",
                        "allyAdvance50NotPast",
                    ) &&
                    skill.includes("E")
                ) {
                    const targetId = getSkillTarget(input, key, character);
                    if (targetId) {
                        for (const teammate of states) {
                            if (
                                teammate.character.id === targetId &&
                                !teammate.blockNextAdvance
                            ) {
                                const advance = teammate.nextActionValue * 0.5;
                                teammate.nextActionValue = Math.max(
                                    actionValue,
                                    teammate.nextActionValue - advance,
                                );
                            }
                        }
                    }
                }

                // Memory Trailblazer E: summon Meme as a 130-speed memosprite.
                if (
                    isCharacterTarget(character) &&
                    hasSkillEffect(character.name, "E", "summonMeme") &&
                    skill.includes("E")
                ) {
                    summonMemeState(states, character, actionValue);
                }

                // Aglaea E/Q: summon Garmentmaker; Q starts/resets Supreme Stance.
                handleAglaeaSkillEffects(
                    states,
                    stateIndex,
                    skill,
                    actionValue,
                );

                // Robin Q: speed to 90, reset allies, block advance
                if (
                    isCharacterTarget(character) &&
                    hasSkillEffect(character.name, "Q", "robinUltimate") &&
                    usesUltimate
                ) {
                    states[stateIndex].currentSpeed = 90;
                    states[stateIndex].nextActionValue =
                        actionValue + 10000 / states[stateIndex].currentSpeed;
                    states[stateIndex].blockNextAdvance = true;

                    const allyOrder = states
                        .map((s, i) => ({ index: i, value: s.nextActionValue }))
                        .filter(
                            ({ index }) =>
                                index !== stateIndex &&
                                isAllyTarget(states[index].character.kind),
                        )
                        .sort((a, b) => {
                            if (a.value !== b.value) return a.value - b.value;
                            return a.index - b.index;
                        });

                    for (let rank = 0; rank < allyOrder.length; rank++) {
                        states[allyOrder[rank].index].nextActionValue =
                            actionValue + rank * 0.0001;
                    }
                }

                // ── 流萤 完全燃烧中击破触发 ──
                if (
                    shouldCheckBreakTrigger(
                        character,
                        states[stateIndex].isInCompleteCombustion,
                        usesUltimate,
                    )
                ) {
                    checkBreakTrigger(
                        states,
                        stateIndex,
                        actions,
                        key,
                        character,
                        actionNo,
                        actionValue,
                        input,
                    );
                }
            }
        } // Clear advance block
        if (shouldClearAdvanceBlock) {
            states[stateIndex].blockNextAdvance = false;
        }

        // 行动后插队（按添加顺序逐个执行）
        if (!skipAssistFollowUp) {
            for (let i = 0; i < afterInterrupts.length; i++) {
                emitInterrupt(interrupts.indexOf(afterInterrupts[i]));
            }
        }

        if (!states[stateIndex].isMemeState) {
            emitMemeAdvanceAction({
                input,
                actions,
                states,
                sourceKey: key,
                actionValue,
                activeOdes,
            });
        }
    }

    return actions;
}
