import { hasPassive, hasSkillEffect } from "../../data/characters";
import { clampArcherFuaCharge, hasArcher } from "../../mechanics/archer";
import { hasCastoriceSummon } from "../../mechanics/castoricePollux";
import {
	summonSouldragonState,
	updateSouldragonBondmate,
} from "../../mechanics/danHengSouldragon";
import { consumeEvernightSpeedBuff } from "../../mechanics/evernightEvey";
import {
	activateCombustion,
	checkBreakTrigger,
	shouldActivateCombustion,
	shouldCheckBreakTrigger,
} from "../../mechanics/fireflyCombustion";
import {
	expirePhainonDomainSpeedBonus,
	freezeAlliesForDomain,
	getPhainonDomainEndIndex,
	getPhainonDomainInterval,
} from "../../mechanics/phainonDomain";
import { hasSaber } from "../../mechanics/saber";
import {
	consumeGodmodeAction,
	getGodmodeSkill,
	hasSilverWolfGodmode as hasSilverWolfGodmodeCheck,
	isInGodmode,
} from "../../mechanics/silverWolfGodmode";
import {
	getCharacterPath,
	getCounterWDomainRule,
	getCyreneUltimateRule,
	isCharacterTarget,
	type SkillCode,
} from "../../utils/actionSequence";
import {
	advanceNotPastCurrent,
	advanceTeamByUltimate,
} from "../advance";
import { resolveHimekoNovaAssist } from "../assist";
import type { ActionContext } from "../context";
import {
	applyMemeAdvanceTarget,
	consumeActionOdes,
	consumeMemoryTrailblazerEpic,
	findCyreneState,
	getActionSkill,
	getActiveOdeLabels,
	getNextSpeed,
	getSkillTarget,
	getTeamAdvanceOnUltimate,
	handleMemoryTrailblazerQ,
	hasActiveOde,
	hasActiveOdeEffect,
	isAllyTarget,
	killMeme,
} from "../effects";
import {
	emitArcherExtraEs,
	handleCyreneNormalUltimate,
} from "./archerCyrene";
import { handleHyacineNormalAction } from "./hyacine";
import { handleTargetEffects } from "./targetEffects";
import { handleSummons } from "./summons";
import type { SimulationRuntime } from "../runtime";
import { handlePostUltimateEffects } from "../ultimateEffects";

export type NormalActionResult = {
	/** 是否因为协战规则而跳过原行动主体的行动后处理（follow-up）。 */
	skipAssistFollowUp: boolean;
	/** 行动前插队列表。 */
	beforeInterruptIndices: number[];
	/** 行动后插队列表。 */
	afterInterruptIndices: number[];
	/** 是否因为遐蝶 E2 拉条跳过了主行动。 */
	skippedMainAction: boolean;
	/** 行动前插队设置的临时拉条屏蔽应在本行动收尾后释放。 */
	clearAdvanceBlockAfterAction: boolean;
};

/**
 * 执行普通角色的完整行动处理：插队大招分发、主行动生成、行动后效果结算。
 *
 * 该函数负责原 loop.ts 中 else 块的全部逻辑（白厄境界走另一分支），
 * 包括状态修改、速度调整、召唤物管理、拉条效果等。
 */
export function handleNormalAction(
	runtime: SimulationRuntime,
	context: ActionContext,
): NormalActionResult {
	const { input, states, actions, activeOdes, souldragonOwner, callbacks } =
		runtime;
	const { stateIndex, key, actionValue, character, actionNo } = context;
	const isMemeAdvanceAction = Boolean(states[stateIndex].memeAdvanceSourceKey);
	const { emitSpecialInterruptAction } = callbacks;

	const configuredSkill = getActionSkill(
		character,
		actionNo,
		key,
		input.skillOverrides,
		input.legacyUltOverrides,
	);
	const savedSkill = states[stateIndex].e2SavedActionSkill;
	states[stateIndex].e2SavedActionSkill = undefined;
	const isSaberForcedBasicAttack =
		hasSaber(character) && states[stateIndex].saberForceBasicAttack === true;
	const rawSkill = isSaberForcedBasicAttack
		? ("A" as SkillCode)
		: hasSilverWolfGodmodeCheck(character.name)
			? getGodmodeSkill(states[stateIndex], savedSkill ?? configuredSkill)
			: ((savedSkill ?? configuredSkill) as SkillCode);
	if (isSaberForcedBasicAttack) {
		states[stateIndex].saberForceBasicAttack = false;
	}

	const assistPlan = resolveHimekoNovaAssist(states, character, rawSkill);
	const skill = assistPlan.skill;
	const {
		assist: himekoNovaAssist,
		assistUseCount,
		skipFollowUp: skipAssistFollowUp,
	} = assistPlan;
	// 只有 AQ/EQ/QE/QA 是自身插队 Q 的简写；领域技能 EW/EA 等不是。
	const hasSelfQ = /^(?:[AE]Q|Q[AE])$/.test(skill);
	const resolvedSkill = (
		hasSelfQ ? skill.replace(/Q/g, "") || "" : skill
	) as SkillCode;
	// 红A {n}E：解析数字前缀，拆分 E（如 4E → 1 个主 E + 3 个额外 E）
	const archerEMatch = hasArcher(character)
		? /^(\d*)E$/.exec(resolvedSkill)
		: null;
	const archerECount = archerEMatch
		? archerEMatch[1]
			? Number.parseInt(archerEMatch[1], 10)
			: 1
		: 0;
	const isArcherMultiE = archerECount > 0;

	const usesUltimate = skill.includes("Q");
	const normalUsesUltimate = usesUltimate && !hasSelfQ;
	const qIsFront = hasSelfQ && skill.startsWith("Q");
	const hasEvernightNextTurnSpeedBuff =
		(states[stateIndex].evernightNextTurnSpeedBonus ?? 0) > 0;
	const actionSpeed = states[stateIndex].currentSpeed;

	const interrupts = input.ultInterrupts[key] ?? [];
	const beforeInterrupts = interrupts.filter((i) => i.timing === "before");
	const afterInterrupts = interrupts.filter((i) => i.timing === "after");

	const beforeInterruptIndices: number[] = [];
	const afterInterruptIndices: number[] = [];

	// 插队大招：在目标行动前/后插入多个施法者的大招行动
	const emitInterrupt = (idx: number) => {
		const interrupt = interrupts[idx];
		if (interrupt) {
			emitSpecialInterruptAction(
				`${key}-interrupt-${idx}`,
				interrupt,
				actionValue,
			);
		}
	};
	const emitSelfUltimate = () => {
		emitSpecialInterruptAction(
			`${key}-q`,
			{ casterId: character.id, timing: qIsFront ? "before" : "after" },
			actionValue,
			qIsFront,
			key,
		);
	};

	// 生成姬子协战行动
	{
		const assistArgs = {
			assist: himekoNovaAssist,
			assistUseCount,
			key,
			actionValue,
			states,
			actions,
			activeOdes,
			input,
		};
		// inline emitHimekoNovaAssists to avoid circular issues
		const {
			assist,
			assistUseCount: auc,
			key: k,
			actionValue: av,
			actions: ac,
			activeOdes: ao,
		} = assistArgs;
		if (assist) {
			for (
				let assistIndex = 1;
				assistIndex <= Math.min(auc, 2);
				assistIndex++
			) {
				const assistKey =
					assistIndex === 1 ? `${k}-assist-F` : `${k}-assist-F-${assistIndex}`;
				ac.push({
					key: assistKey,
					characterId: assist.character.id,
					actionNo: 0,
					actionValue: av,
					skill: "F" as SkillCode,
					speed: assist.currentSpeed,
					isAssistAction: true,
					assistSourceKey: k,
					assistIndex,
					activeOdeLabels: getActiveOdeLabels(ao, assist.character.id),
				});
			}
		}
	}

	// ── 行动前插队（按添加顺序逐个执行） ──
	if (!skipAssistFollowUp) {
		for (let i = 0; i < beforeInterrupts.length; i++) {
			const idx = interrupts.indexOf(beforeInterrupts[i]);
			emitInterrupt(idx);
			beforeInterruptIndices.push(idx);
		}
		if (beforeInterrupts.length > 0) {
			states[stateIndex].blockNextAdvance = true;
		}
		// Q 在前（如 QA、QE）→ 主行动前先推 Q 插队
		if (hasSelfQ && qIsFront) {
			emitSelfUltimate();
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
		// Q 已消耗本次正常行动；被 2 魂拉回的技能属于下一动。
		states[stateIndex].actionNo += 1;
		return {
			skipAssistFollowUp,
			beforeInterruptIndices,
			afterInterruptIndices: afterInterrupts.map((item) =>
				interrupts.indexOf(item),
			),
			skippedMainAction: true,
			clearAdvanceBlockAfterAction: beforeInterrupts.length > 0,
		};
	}

	// ── 主行动生成 ──
	if (!skipAssistFollowUp && !shouldSkipMainForE2Pull) {
		if (hasArcher(character) && usesUltimate) {
			states[stateIndex].archerFuaCharge = clampArcherFuaCharge(
				(states[stateIndex].archerFuaCharge ?? 0) + 2,
			);
		}
		actions.push({
			key,
			characterId: character.id,
			displayName: states[stateIndex].isMemeState ? character.name : undefined,
			targetKind: states[stateIndex].isMemeState ? "忆灵" : undefined,
			isCombustionAction: states[stateIndex].isInCompleteCombustion,
			isAglaeaSupremeAction: states[stateIndex].aglaeaSupremeActive,
			actionNo,
			actionValue,
			skill: (isArcherMultiE ? "E" : resolvedSkill) as SkillCode,
			speed: actionSpeed,
			...(isSaberForcedBasicAttack ? { lockedSkill: true } : {}),
			isAssistFollowUp: himekoNovaAssist !== undefined,
			isMemospriteAction: states[stateIndex].isMemeState,
			isMemeAdvanceAction,
			memospriteOwnerId: states[stateIndex].memeOwnerId,
			activeOdeLabels: getActiveOdeLabels(activeOdes, character.id),
			archerFuaCharge: states[stateIndex].archerFuaCharge,
		});
		if (isMemeAdvanceAction) {
			applyMemeAdvanceTarget(
				states,
				input,
				states[stateIndex],
				key,
				actionValue,
			);
		}
		// 浪漫之诗：阿格莱雅/衣匠非 Q 行动消耗充能
		const romanceOwnerId = states[stateIndex].isGarmentmakerState
			? states[stateIndex].garmentmakerOwnerId
			: character.id;
		if (!(isArcherMultiE ? "E" : resolvedSkill).includes("Q")) {
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
			hasSilverWolfGodmodeCheck(character.name) &&
			isInGodmode(states[stateIndex])
		) {
			consumeGodmodeAction(states, stateIndex);
		}
		// 银狼无敌玩家状态下锁定技能输入框
		if (
			hasSilverWolfGodmodeCheck(character.name) &&
			isInGodmode(states[stateIndex])
		) {
			actions[actions.length - 1].lockedSkill = true;
		}
		consumeActionOdes(
			activeOdes,
			character.id,
			isArcherMultiE ? "E" : resolvedSkill,
			true,
		);
		if (isArcherMultiE && archerECount > 1) {
			actions[actions.length - 1].hasArcherExtraEs = true;
		}

		if (isArcherMultiE && archerECount > 1) {
			emitArcherExtraEs({
				runtime,
				stateIndex,
				key,
				character,
				actionValue,
				actionSpeed,
				count: archerECount,
			});
		}
		if (
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "Q", "cyreneUltimate") &&
			usesUltimate &&
			!hasSelfQ
		) {
			handleCyreneNormalUltimate({
				runtime,
				stateIndex,
				key,
				character,
				actionValue,
			});
		}
	}

	// ── 刻律军功目标切换 ──
	{
		const meritOwnerState = states.find((s) =>
			hasPassive(s.character.name, "meritSpeedBuff20"),
		);
		if (
			meritOwnerState &&
			character.id === meritOwnerState.character.id &&
			skill.includes("E") &&
			!resolvedSkill.includes("Q")
		) {
			const eTarget = getSkillTarget(input, key, character);
			if (eTarget && eTarget !== runtime.currentMeritTarget) {
				// 移除旧目标加速
				if (runtime.currentMeritTarget) {
					const oldTarget = states.find(
						(s) => s.character.id === runtime.currentMeritTarget,
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
							oldTarget.nextActionValue = actionValue + 10000 / newSpeed;
						}
					}
				}
				// 添加新目标加速
				{
					const newTarget = states.find((s) => s.character.id === eTarget);
					if (newTarget) {
						const oldSpeed = newTarget.currentSpeed;
						newTarget.currentSpeed += newTarget.baseSpeed * 0.2;
						const newSpeed = newTarget.currentSpeed;
						const remaining = newTarget.nextActionValue - actionValue;
						if (remaining > 0) {
							newTarget.nextActionValue =
								actionValue + remaining * (oldSpeed / newSpeed);
						} else {
							newTarget.nextActionValue = actionValue + 10000 / newSpeed;
						}
					}
				}
				runtime.currentMeritTarget = eTarget;
			}
		}
	}

	if (hasEvernightNextTurnSpeedBuff) {
		consumeEvernightSpeedBuff(states[stateIndex]);
	}

	// ── 龙灵同袍目标切换 ──
	if (
		souldragonOwner &&
		character.id === souldragonOwner.character.id &&
		resolvedSkill.includes("E")
	) {
		const nextBondmate =
			getSkillTarget(input, key, character) ??
			runtime.currentBondmateTarget.value;
		const validTarget = states.find(
			(state) =>
				state.character.id === nextBondmate && state.character.kind === "角色",
		);
		if (validTarget && nextBondmate !== runtime.currentBondmateTarget.value) {
			runtime.currentBondmateTarget.value = nextBondmate;
			// 确保龙灵存在（可能是首次召唤），然后更新归属
			summonSouldragonState(
				states,
				souldragonOwner.character,
				actionValue,
				nextBondmate,
			);
			updateSouldragonBondmate(
				states,
				souldragonOwner.character.id,
				nextBondmate,
			);
		}
	}

	// ── 白厄 Q 境界 ──
	if (
		isCharacterTarget(character) &&
		hasSkillEffect(character.name, "W", "counterW") &&
		normalUsesUltimate
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
			states[stateIndex].domainState = {
				keyPrefix: key,
				startAV,
				interval: domainInterval,
				currentIndex: 0,
				maxIndex: domainEndIndex,
				rule: domainRule,
			};
			freezeAlliesForDomain(states, stateIndex, startAV);
			states[stateIndex].nextActionValue = startAV;
		}
		return {
			skipAssistFollowUp,
			beforeInterruptIndices,
			afterInterruptIndices,
			skippedMainAction: shouldSkipMainForE2Pull,
			clearAdvanceBlockAfterAction: beforeInterrupts.length > 0,
		};
	}

	// ── 正常下一动间隔（非境界分支） ──

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
		runtime.refreshAhaSchedule(actionValue);
	}
	if (isAllyTarget(character.kind)) {
		expirePhainonDomainSpeedBonus(states, actionValue);
	}

	// ── 流萤完全燃烧（使用 Q 后激活） ──
	let justActivatedCombustion = false;
	if (
		shouldActivateCombustion(
			character,
			normalUsesUltimate,
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
		if (!justActivatedCombustion && !states[stateIndex].domainState) {
			states[stateIndex].nextActionValue = actionValue + nextInterval;
		}
		// AQ/EQ：先结算主行动的正常下一动，再将 Q 作为 after 插队发射。
		// 这样 Q 的自拉、召唤及立即行动不会被正常下一动排程覆盖。
		if (hasSelfQ && !qIsFront && !skipAssistFollowUp) {
			emitSelfUltimate();
		}
		// 风套：Q 后行动提前 25%
		if (
			isCharacterTarget(character) &&
			character.hasWindSet &&
			normalUsesUltimate &&
			!qIsFront &&
			!justActivatedCombustion
		) {
			advanceNotPastCurrent(
				states[stateIndex],
				actionValue,
				2500 / states[stateIndex].currentSpeed,
			);
		}

		// 全队拉条（舞舞舞 = (14+2s)%, 忘归人 2魂 = 24%）。
		const teamAdvance3 = getTeamAdvanceOnUltimate(character);
		if (teamAdvance3 > 0 && normalUsesUltimate && !qIsFront) {
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

		// 目标拉条：布洛妮娅/星期日/花火
		handleTargetEffects({
			character,
			skill,
			states,
			actionValue,
			input,
			key,
		});

				// 召唤与忆灵：迷迷/长夜/衣匠
		handleSummons({
			character,
			resolvedSkill,
			normalUsesUltimate,
			states,
			stateIndex,
			actionValue,
		});

		// Memory Trailblazer Q: increment epic
		if (
			isCharacterTarget(character) &&
			hasSkillEffect(character.name, "E", "summonMeme") &&
			normalUsesUltimate
		) {
			handleMemoryTrailblazerQ(states[stateIndex]);
		}

		handleHyacineNormalAction({
			runtime,
			stateIndex,
			key,
			character,
			actionValue,
			resolvedSkill,
			normalUsesUltimate,
			usesUltimate,
			qIsFront,
		});

		// ── 流萤 完全燃烧中击破触发 ──
		if (
			shouldCheckBreakTrigger(
				states[stateIndex].isInCompleteCombustion,
				normalUsesUltimate,
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

		// ── 统一 Q 后效处理 ──
		if (normalUsesUltimate) {
			handlePostUltimateEffects({
				states,
				casterIndex: stateIndex,
				actions,
				actionValue,
				input,
				activeOdes,
				sourceKey: key,
				qIsFront,
			});
		}
	}

	// ── 记忆主 A 消耗【史诗】并触发德谬歌额外 Q ──
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
			const cyreneState = findCyreneState(states);
			if (cyreneState && hasActiveOde(activeOdes, character.id, "genesis")) {
				const cyreneRule = getCyreneUltimateRule(cyreneState.character.name);
				actions.push({
					key: `${key}-epic-memosprite`,
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

	return {
		skipAssistFollowUp,
		beforeInterruptIndices,
		afterInterruptIndices: afterInterrupts.map((i) => interrupts.indexOf(i)),
		skippedMainAction: shouldSkipMainForE2Pull,
		clearAdvanceBlockAfterAction: beforeInterrupts.length > 0,
	};
}
