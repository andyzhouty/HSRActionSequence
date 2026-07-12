import { hasPassive, hasSkillEffect } from "../data/characters";
import {
	type GeneratedAction,
	getCharacterPath,
	getCounterWDomainRule,
	getCyreneUltimateRule,
	isCharacterTarget,
	type SkillCode,
} from "../utils/actionSequence";
import { handleAglaeaSkillEffects } from "../mechanics/aglaeaGarmentmaker";
import {
	hasCastoriceSummon,
	summonPollux,
	applyCastoriceE2Pull,
} from "../mechanics/castoricePollux";
import {
	createIcaAction,
	handleHyacineQ,
	hasHyacineIca,
	summonIca,
	triggerIcaExtraTurn,
} from "../mechanics/hyacineIca";
import {
	consumeEvernightSpeedBuff,
	hasEvernightEvey,
	summonEveyState,
} from "../mechanics/evernightEvey";
import {
	summonSouldragonState,
} from "../mechanics/danHengSouldragon";
import {
	activateCombustion,
	checkBreakTrigger,
	shouldActivateCombustion,
	shouldCheckBreakTrigger,
} from "../mechanics/fireflyCombustion";
import {
	expirePhainonDomainSpeedBonus,
	freezeAlliesForDomain,
	getPhainonDomainEndIndex,
	getPhainonDomainInterval,
} from "../mechanics/phainonDomain";
import {
	activateGodmode,
	consumeGodmodeAction,
	hasSilverWolfGodmode,
	isInGodmode,
} from "../mechanics/silverWolfGodmode";
import {
	consumeActionOdes,
	emitCyreneMemospriteAction,
	getActiveOdeLabels,
	getNextSpeed,
	getSkillTarget,
	hasActiveOdeEffect,
	getTeamAdvanceOnUltimate,
	isAllyTarget,
	killMeme,
	summonMemeState,
	findCyreneState,
	handleMemoryTrailblazerQ,
	consumeMemoryTrailblazerEpic,
	handleCyrenePostUltimate,
	hasActiveOde,
} from "./effects";
import type { ActionState, ActiveOdeState, SimulateActionsInput } from "./types";
import { selectNextAction } from "./scheduler";
import { handleSpecialAction } from "./specialActions";
import { handleDomainAction } from "./domain";
import { createActionContext } from "./context";
import { runPreActionChecks } from "./preAction";
import { runPostActionCleanup } from "./postAction";
import { handleGarmentmakerActionTurn } from "./garmentmakerAction";
import { resolveNormalActionPlan } from "./normalAction";
import { advanceNotPastCurrent, advanceTeamByUltimate, pullToCurrentAction } from "./advance";
import { emitHimekoNovaAssists } from "./assist";
import type { SimulationCallbacks, SimulationRuntime } from "./runtime";

export type SimulationLoopCallbacks = SimulationCallbacks;

/** 执行行动值调度主循环。 */
export function runSimulationLoop(params: {
	input: SimulateActionsInput;
	states: ActionState[];
	actions: GeneratedAction[];
	activeOdes: Map<string, ActiveOdeState[]>;
	souldragonOwner: ActionState | undefined;
	currentBondmateTarget: string | null;
	calcAhaSpeed: () => number;
	refreshAhaSchedule: (actionValue: number) => void;
	callbacks: SimulationLoopCallbacks;
}): GeneratedAction[] {
	const runtime: SimulationRuntime = {
		...params,
		currentMeritTarget: params.input.meritTarget ?? null,
	};
	const {
		input, states, actions, activeOdes, souldragonOwner,
		currentBondmateTarget: initialBondmateTarget,
		calcAhaSpeed, refreshAhaSchedule, callbacks,
	} = runtime;
	let currentBondmateTarget = initialBondmateTarget;
	let currentMeritTarget: string | null = input.meritTarget ?? null;
	const meritOwnerState = states.find((state) => hasPassive(state.character.name, "meritSpeedBuff20"));
	let guard = 0;
	const {
		emitExtraAhaAction,
		emitGodmodeExtraAction,
		emitSpecialInterruptAction,
		emitSparxieExtraAction,
		emitEvernightSelfDestructAction,
	} = callbacks;
while (states.length > 0 && guard < 2000) {
	guard += 1;

	// 选择下一次行动。
	const next = selectNextAction(states, input);
	if (!next) break;
	if (next.actionValue > input.limit) break;

	const context = createActionContext(states, next);
	const { stateIndex, key, actionValue, character, actionNo } = context;

	runPreActionChecks(runtime, context);

	if (handleSpecialAction({
		input, states, actions, activeOdes, stateIndex, key, actionValue, character, actionNo,
		calcAhaSpeed,
		callbacks: { emitGodmodeExtraAction, emitSpecialInterruptAction, emitSparxieExtraAction, emitEvernightSelfDestructAction },
	})) {
		continue;
	}

	if (handleGarmentmakerActionTurn(runtime, context)) {
		continue;
	}


	// ── 境界内连动（每循环一次生成一动，让敌人行动可自然穿插） ──
	if (handleDomainAction(states, stateIndex, actions, character, activeOdes, input)) {
		continue;
	}

	const normalPlan = resolveNormalActionPlan(runtime, context);
	const { assist: himekoNovaAssist, assistUseCount, skipFollowUp: skipAssistFollowUp,
		skill, hasSelfQ, resolvedSkill, usesUltimate, qIsFront,
		hasEvernightNextTurnSpeedBuff, actionSpeed } = normalPlan;

	const interrupts = input.ultInterrupts[key] ?? [];
	let pendingAssistFollowUpAdvance = 0;

	// 插队大招：在目标行动前/后插入多个施法者的大招行动
	const emitInterrupt = (idx: number) => {
		const interrupt = interrupts[idx];
		if (interrupt) emitSpecialInterruptAction(`${key}-interrupt-${idx}`, interrupt, actionValue);
	};

	// 按 timing 分组处理
	const beforeInterrupts = interrupts.filter((i) => i.timing === "before");
	const afterInterrupts = interrupts.filter((i) => i.timing === "after");

	emitHimekoNovaAssists({ assist: himekoNovaAssist, assistUseCount, key, actionValue, states, actions, activeOdes, input });

	// 行动前插队（按添加顺序逐个执行）
	if (!skipAssistFollowUp) {
		for (let i = 0; i < beforeInterrupts.length; i++) {
			emitInterrupt(interrupts.indexOf(beforeInterrupts[i]));
		}
		if (beforeInterrupts.length > 0) {
			states[stateIndex].blockNextAdvance = true;
		}
		// Q 在前（如 QA、QE）→ 主行动前先推 Q 插队
		if (hasSelfQ && qIsFront) {
			actions.push({
				key: `${key}-q`,
				characterId: character.id,
				isAglaeaSupremeAction: states[stateIndex].aglaeaSupremeActive,
				actionNo: 0,
				actionValue,
				skill: "Q" as SkillCode,
				speed: actionSpeed,
			});
			// 银狼 Q 在前 → 立即进入无敌玩家，后续 A 作为第一次消耗
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "Q", "selfAdvance100")
			) {
				activateGodmode(states, stateIndex);
			}
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "Q", "extraAhaAfterUltimate")
			) {
				emitExtraAhaAction(`${key}-q`, actionValue);
			}
		}
	}

	// E2 遐蝶 QE/QA（Q在前）：跳过 main action，保留技能给自拉条后的下一动
	const shouldSkipMainForE2Pull =
		!skipAssistFollowUp &&
		isCharacterTarget(character) &&
		hasCastoriceSummon(character.name) &&
		character.eidolon >= 2 &&
		hasSelfQ &&
		qIsFront;
	if (shouldSkipMainForE2Pull) {
		states[stateIndex].e2SavedActionSkill = resolvedSkill;
	}

	if (!skipAssistFollowUp && !shouldSkipMainForE2Pull) {
		actions.push({
			key,
			characterId: character.id,
			displayName: states[stateIndex].isMemeState
				? character.name
				: undefined,
			targetKind: states[stateIndex].isMemeState ? "忆灵" : undefined,
			isCombustionAction: states[stateIndex].isInCompleteCombustion,
			isAglaeaSupremeAction: states[stateIndex].aglaeaSupremeActive,
			actionNo,
			actionValue,
			skill: resolvedSkill as SkillCode,
			speed: actionSpeed,
			isAssistFollowUp: himekoNovaAssist !== undefined,
			isMemospriteAction: states[stateIndex].isMemeState,
			memospriteOwnerId: states[stateIndex].memeOwnerId,
			activeOdeLabels: getActiveOdeLabels(activeOdes, character.id),
		});
		// 浪漫之诗：阿格莱雅/衣匠非 Q 行动消耗充能
		const romanceOwnerId = states[stateIndex].isGarmentmakerState
			? states[stateIndex].garmentmakerOwnerId
			: character.id;
		if (
			!resolvedSkill.includes("Q")
		) {
			const romanceOdes = activeOdes.get(romanceOwnerId ?? "");
			const romanceActive = romanceOdes?.find(
				(o) => o.ode.effects?.includes("odeToRomance") && o.romanceCharged,
			);
			if (romanceActive) {
				romanceActive.romanceCharged = false;
				actions[actions.length - 1].isRomanceAction = true;
			}
		}
		// 银狼无敌玩家：正常行动消耗层数
		if (
			hasSilverWolfGodmode(character.name) &&
			isInGodmode(states[stateIndex])
		) {
			consumeGodmodeAction(states, stateIndex);
		}
		// 银狼无敌玩家状态下锁定技能输入框
		if (
			hasSilverWolfGodmode(character.name) &&
			isInGodmode(states[stateIndex])
		) {
			actions[actions.length - 1].lockedSkill = true;
		}
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
			handleCyrenePostUltimate({
				states,
				casterIndex: stateIndex,
				character,
				actions,
				actionValue,
				activeOdes,
				excludeSelf: qIsFront,
			});
		}
	}

	// ── 通用 Q 插队（Q 在后，如 AQ、EQ）→ 主行动后推 Q ──
	if (hasSelfQ && !qIsFront && !skipAssistFollowUp) {
		actions.push({
			key: `${key}-q`,
			characterId: character.id,
			isAglaeaSupremeAction: states[stateIndex].aglaeaSupremeActive,
			actionNo: 0,
			actionValue,
			skill: "Q" as SkillCode,
			speed: actionSpeed,
		});
		if (
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "Q", "extraAhaAfterUltimate")
		) {
			emitExtraAhaAction(`${key}-q`, actionValue);
		}
	}

	// ── 刻律军功目标切换：E 技能可更改军功目标 ──
	if (
		meritOwnerState &&
		character.id === meritOwnerState.character.id &&
		skill.includes("E") &&
		!resolvedSkill.includes("Q")
	) {
		const eTarget = getSkillTarget(input, key, character);
		if (eTarget && eTarget !== currentMeritTarget) {
			// 移除旧目标加速
			if (currentMeritTarget) {
				const oldTarget = states.find(
					(s) => s.character.id === currentMeritTarget,
				);
				if (oldTarget) {
					const oldSpeed = oldTarget.currentSpeed;
					oldTarget.currentSpeed -= oldTarget.baseSpeed * 0.2;
					const newSpeed = oldTarget.currentSpeed;
					const remaining = oldTarget.nextActionValue - actionValue;
					if (remaining > 0) {
						oldTarget.nextActionValue =
							actionValue + remaining * (oldSpeed / newSpeed);
					} else {
						oldTarget.nextActionValue =
							actionValue + 10000 / newSpeed;
					}
				}
			}
			// 添加新目标加速
			{
				const newTarget = states.find(
					(s) => s.character.id === eTarget,
				);
				if (newTarget) {
					const oldSpeed = newTarget.currentSpeed;
					newTarget.currentSpeed += newTarget.baseSpeed * 0.2;
					const newSpeed = newTarget.currentSpeed;
					const remaining = newTarget.nextActionValue - actionValue;
					if (remaining > 0) {
						newTarget.nextActionValue =
							actionValue + remaining * (oldSpeed / newSpeed);
					} else {
						newTarget.nextActionValue =
							actionValue + 10000 / newSpeed;
					}
				}
			}
			currentMeritTarget = eTarget;
		}
	}

	if (hasEvernightNextTurnSpeedBuff) {
		consumeEvernightSpeedBuff(states[stateIndex]);
	}

	if (
		souldragonOwner &&
		character.id === souldragonOwner.character.id &&
		resolvedSkill.includes("E")
	) {
		const nextBondmate = getSkillTarget(input, key, character);
		const validTarget = states.find(
			(state) =>
				state.character.id === nextBondmate &&
				state.character.kind === "角色",
		);
		if (validTarget && nextBondmate !== currentBondmateTarget) {
			currentBondmateTarget = nextBondmate;
			summonSouldragonState(states, souldragonOwner.character, actionValue);
		}
	}

	// Apply speed adjustment
	const oldActionSpeed = states[stateIndex].currentSpeed;
	states[stateIndex].currentSpeed = getNextSpeed(
		states[stateIndex].currentSpeed,
		states[stateIndex].baseSpeed,
		input.speedAdjustments[key],
	);
	if (
		oldActionSpeed !== states[stateIndex].currentSpeed &&
		getCharacterPath(character.name) === "Elation"
	) {
		refreshAhaSchedule(actionValue);
	}
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
		const domainInterval = getPhainonDomainInterval(character, actionSpeed);
		const startAV = actionValue;
		const isEndlessDomain = hasActiveOdeEffect(
			activeOdes,
			character.id,
			"endlessCounterWDomain",
		);
		const maxDomainActionIndex = isEndlessDomain
			? Math.max(0, Math.ceil((input.limit - startAV) / domainInterval))
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
			// 冻结友方：境界期间不行动
			freezeAlliesForDomain(states, stateIndex, startAV);
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
			activateCombustion(states, stateIndex, character, actionValue);
			justActivatedCombustion = true;
		}

		// ── 正常下一动间隔（燃烧激活时由 activateCombustion 设 100%提前） ──
		{
			const nextInterval = 10000 / states[stateIndex].currentSpeed;
			states[stateIndex].actionNo += 1;
			if (states[stateIndex].e6FirstUltimatePulled) {
				states[stateIndex].e6FirstUltimatePulled = false;
			} else if (!justActivatedCombustion) {
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
				advanceNotPastCurrent(states[stateIndex], actionValue, 2500 / states[stateIndex].currentSpeed);
			}
			if (pendingAssistFollowUpAdvance > 0) {
				advanceNotPastCurrent(states[stateIndex], actionValue, pendingAssistFollowUpAdvance);
			}

			// 全队拉条（舞舞舞 = (14+2s)%, 忘归人 2魂 = 24%）。
			const teamAdvance3 = getTeamAdvanceOnUltimate(character);
			if (teamAdvance3 > 0 && usesUltimate && !qIsFront) {
				advanceTeamByUltimate(states, actionValue, teamAdvance3);
			}

			// Bronya A: self advance 30%
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "A", "selfAdvance30") &&
				skill.includes("A")
			) {
				const advance = 3000 / actionSpeed;
				if (!states[stateIndex].blockNextAdvance) {
					advanceNotPastCurrent(states[stateIndex], actionValue, advance);
				}
			}

			// Bronya/Sunday E: pull target to current action value
			if (
				isCharacterTarget(character) &&
				skill.includes("E") &&
				(hasSkillEffect(character.name, "E", "allyPullToCurrent") ||
					hasSkillEffect(character.name, "E", "sundayPullWithMemosprite"))
			) {
				const targetId = getSkillTarget(input, key, character);
				if (targetId) {
					const targetState = states.find(
						(state) => state.character.id === targetId,
					);
					const isSundayInvalidDirectMemospriteTarget =
						hasSkillEffect(
							character.name,
							"E",
							"sundayPullWithMemosprite",
						) &&
						targetState !== undefined &&
						!isCharacterTarget(targetState.character);
					if (!isSundayInvalidDirectMemospriteTarget) {
						const isSundayAndHarmonyTarget =
							hasSkillEffect(
								character.name,
								"E",
								"sundayPullWithMemosprite",
							) &&
							getCharacterPath(
								states.find((s) => s.character.id === targetId)
									?.character.name ?? "",
							) === "Harmony";
						if (!isSundayAndHarmonyTarget) {
							for (const teammate of states) {
								if (
									teammate.character.id === targetId &&
									!teammate.blockNextAdvance
								) {
									pullToCurrentAction(teammate, actionValue);
								}
							}
						}
						// Sunday additionally pulls the target's owned summons
						if (
							hasSkillEffect(
								character.name,
								"E",
								"sundayPullWithMemosprite",
							)
						) {
							for (const entity of states) {
								const isOwnedSummon =
									entity.character.id !== targetId &&
									((entity.isGarmentmakerState &&
										entity.garmentmakerOwnerId === targetId) ||
										(entity.isMemeState && entity.memeOwnerId === targetId) ||
										(entity.isEveyAction &&
											entity.character.id === `${targetId}-evey`) ||
										(entity.isPolluxAction &&
											entity.character.id === `${targetId}-pollux`));
								if (isOwnedSummon && !entity.blockNextAdvance) {
									pullToCurrentAction(entity, actionValue);
								}
							}
						}
					}
				}
			}

			// Sparkle E: 50% advance, not past current action value
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "E", "allyAdvance50NotPast") &&
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
							advanceNotPastCurrent(teammate, actionValue, advance);
						}
					}
				}
			}

			// Memory Trailblazer E/Q: summon Meme as a 130-speed memosprite.
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "E", "summonMeme") &&
				(skill.includes("E") || usesUltimate)
			) {
				summonMemeState(states, character, actionValue);
			}

			if (
				isCharacterTarget(character) &&
				hasEvernightEvey(character.name) &&
				(resolvedSkill.includes("E") || usesUltimate) &&
				!states[stateIndex].eveyOnField
			) {
				summonEveyState(states, character, actionValue, {
					immediate: true,
					sameActionPriority: -2,
				});
			}

			// Memory Trailblazer Q: increment epic
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "E", "summonMeme") &&
				usesUltimate
			) {
				handleMemoryTrailblazerQ(states[stateIndex]);
			}

			// 风堇 Q: summon Ica (if not on field) + afterRain = 3
			const hyIcaCheck = isCharacterTarget(character) && hasHyacineIca(character.name) && usesUltimate;
			if (hyIcaCheck) {
				handleHyacineQ(states, character.id);
				const icaQKey = `${key}-q-ica`;
				const configured = input.ultInterrupts[icaQKey] ?? [];
				for (let ai = 0; ai < configured.length; ai++) {
					const int = configured[ai];
					if (int.timing !== "before") continue;
					emitSpecialInterruptAction(`${icaQKey}-interrupt-${ai}`, int, actionValue);
				}
				actions.push(createIcaAction(character.id, `${key}-q`, actionValue));
				for (let ai = 0; ai < configured.length; ai++) {
					const int = configured[ai];
					if (int.timing !== "after") continue;
					emitSpecialInterruptAction(`${icaQKey}-interrupt-${ai}`, int, actionValue);
				}
			}

			// 风堇 E: summon Ica (first E or first E after death)
			if (
				isCharacterTarget(character) &&
				hasHyacineIca(character.name) &&
				resolvedSkill.includes("E") &&
				!states[stateIndex].icaOnField
			) {
				summonIca(states[stateIndex]);
			}

			// 风堇 A/E: trigger Ica extra turn (afterRain > 0 && Ica on field)
			if (
				isCharacterTarget(character) &&
				hasHyacineIca(character.name) &&
				(resolvedSkill === "" || resolvedSkill === "A" || resolvedSkill.includes("E")) &&
				(!usesUltimate || qIsFront)
			) {
				const beforeRain = states[stateIndex].afterRain ?? 0;
				triggerIcaExtraTurn(states, character.id);
				if ((states[stateIndex].afterRain ?? 0) < beforeRain) {
					const icaKey = `${key}-ica`;
					const configured = input.ultInterrupts[icaKey] ?? [];
					for (let ai = 0; ai < configured.length; ai++) {
						const int = configured[ai];
						if (int.timing !== "before") continue;
						emitSpecialInterruptAction(`${icaKey}-interrupt-${ai}`, int, actionValue);
					}
					actions.push(createIcaAction(character.id, key, actionValue));
					for (let ai = 0; ai < configured.length; ai++) {
						const int = configured[ai];
						if (int.timing !== "after") continue;
						emitSpecialInterruptAction(`${icaKey}-interrupt-${ai}`, int, actionValue);
					}
				}
			}

			// 遐蝶 Q: summon Pollux（死龙）
			if (
				isCharacterTarget(character) &&
				hasCastoriceSummon(character.name) &&
				usesUltimate &&
				!states[stateIndex].polluxOnField
			) {
				summonPollux(states, character, actionValue, {
					sameActionPriority: -1,
				});
				if (character.eidolon >= 2) {
					applyCastoriceE2Pull(states, stateIndex, actionValue, {
						queuePolluxAtCurrentAction: true,
					});
				}
			}

			// Aglaea E/Q: summon Garmentmaker; Q starts/resets Supreme Stance.
			handleAglaeaSkillEffects(states, stateIndex, skill, actionValue);

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

			// 丹恒 Q：【击杀】开关打开时立即行动
			if (
				isCharacterTarget(character) &&
				hasPassive(character.name, "killReset") &&
				usesUltimate &&
				input.killToggles?.[key]
			) {
				states[stateIndex].nextActionValue = actionValue;
			}

			// 银狼LV.999 Q：进入无敌玩家
			// Q 在前（如 QA）时已在 Q-front 处激活，此处跳过
			// Q 在后（如 AQ）时自拉条 100%
			if (
				isCharacterTarget(character) &&
				hasSkillEffect(character.name, "Q", "selfAdvance100") &&
				usesUltimate
			) {
				if (!qIsFront && hasSilverWolfGodmode(character.name)) {
					activateGodmode(states, stateIndex);
				}
				if (!qIsFront) {
					states[stateIndex].nextActionValue = actionValue;
				}
			}

			// ── 流萤 完全燃烧中击破触发 ──
			if (
				shouldCheckBreakTrigger(
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

			if (input.memeKillToggles?.[key] && states[stateIndex]?.isMemeState) {
				killMeme(states, actionValue);
			}
		}
		// ── 记忆主 A 消耗【史诗】并触发德谬歌额外 Q ──
		// QA（Q在前）的 A 消耗史诗；纯 A 也消耗；AQ（Q在后）的 A 不消耗（A 在 Q 之前）
		if (
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "E", "summonMeme") &&
			states[stateIndex].epicPendingA &&
			(states[stateIndex].epic ?? 0) > 0 &&
			(resolvedSkill === "" || resolvedSkill === "A") &&
			(!usesUltimate || qIsFront)
		) {
			const consumed = consumeMemoryTrailblazerEpic(states[stateIndex]);
			if (consumed) {
				// 若德谬歌对记忆主释放过创世之诗，触发额外德谬歌 Q
				const cyreneState = findCyreneState(states);
				if (
					cyreneState &&
					hasActiveOde(
						activeOdes,
						character.id,
						"genesis",
					)
				) {
					const cyreneRule = getCyreneUltimateRule(cyreneState.character.name);
					const epicMemospriteKey = `${key}-epic-memosprite`;
					actions.push({
						key: epicMemospriteKey,
						characterId: `${cyreneState.character.id}-memosprite`,
						displayName: cyreneRule.memospriteName,
						targetKind: "忆灵",
						actionNo: 0,
						actionValue,
						skill: "Q" as SkillCode,
						speed: 0,
						isMemospriteAction: true,
						memospriteOwnerId: cyreneState.character.id,
						isEpicTriggeredMemosprite: true,
						lockedSkill: true,
					});
				}
			}
		}
	} // Clear advance block
	runPostActionCleanup(runtime, context, {
		skipAssistFollowUp,
		afterInterrupts,
		emitInterrupt: (interrupt) => emitInterrupt(interrupts.indexOf(interrupt)),
	});
}

	return actions;
}



