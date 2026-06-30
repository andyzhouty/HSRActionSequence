import { hasPassive, hasSkillEffect } from "../data/characters";
import {
	type GeneratedAction,
	characterNameMatchesAliases,
	getCharacterPath,
	getCounterWDomainRule,
	isCharacterTarget,
	type SkillCode,
	toPositiveNumber,
} from "./actionSequence";
import {
	handleAglaeaCountdownAction,
	handleAglaeaSkillEffects,
	handleGarmentmakerAction,
	isAglaeaCountdownAction,
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
} from "./phainonDomain";
import {
	type GodmodeState,
	activateGodmode,
	consumeGodmodeAction,
	getGodmodeSkill,
	hasSilverWolfGodmode,
	isInGodmode,
} from "./silverWolfGodmode";
import {
	canBeAdvancedByDance,
	consumeActionOdes,
	emitCyreneMemospriteAction,
	emitMemeAdvanceAction,
	findHimekoNovaAssistState,
	getActionSkill,
	getActiveOdeLabels,
	getNextSpeed,
	getSkillTarget,
	hasActiveOdeEffect,
	getTeamAdvanceOnUltimate,
	isAllyTarget,
	summonMemeState,
	toNonNegativeNumber,
} from "./simulateEffects";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./simulateTypes";

// Re-export for backward compatibility
export type { SimulateActionsInput } from "./simulateTypes";

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
			if (hasPassive(character.name, "firstActionAdvance30")) advancePct += 0.3;
			if (hasPassive(character.name, "firstActionAdvance40")) advancePct += 0.4;
			const firstActionValue = (10000 * (1 - advancePct)) / speed;

			return {
				character,
				baseSpeed:
					toPositiveNumber(character.baseSpeed, 0) > 0
						? toPositiveNumber(character.baseSpeed, speed)
						: hasSkillEffect(character.name, "W", "counterW")
							? character.lc_id === 23044
								? character.superimpose > 0
									? 104 + 2 * character.superimpose
									: 94
								: 94
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

	// ── 阿哈时刻：检测欢愉角色 ──
	const elationStates = states.filter(
		(s) => getCharacterPath(s.character.name) === "Elation",
	);
	const calcAhaSpeed = () => {
		const speeds = elationStates
			.map((s) => s.currentSpeed)
			.sort((a, b) => b - a);
		const [v1 = 0, v2 = 0, v3 = 0, v4 = 0] = speeds;
		return v1 * 0.2 + v2 * 0.1 + v3 * 0.05 + v4 * 0.025 + 80;
	};
	let ahaState: ActionState | null = null;
	if (elationStates.length > 0 && calcAhaSpeed() > 0) {
		ahaState = {
			character: {
				id: "@aha",
				kind: "阿哈",
				name: "阿哈时刻",
				speed: String(calcAhaSpeed()),
				baseSpeed: String(calcAhaSpeed()),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			baseSpeed: calcAhaSpeed(),
			currentSpeed: calcAhaSpeed(),
			phainonDomainSpeedBonus: 0,
			actionNo: 1,
			nextActionValue: 10000 / calcAhaSpeed(),
			blockNextAdvance: false,
		};
		states.push(ahaState);
	}

	// ── 藿藿 1 魂：全队加速 12% ──
	const huohuoState = states.find(
		(s) =>
			getCharacterPath(s.character.name) === "Abundance" &&
			s.character.eidolon >= 1 &&
			hasPassive(s.character.name, "teamSpeedBuff12"),
	);
	if (huohuoState) {
		for (const s of states) {
			if (s.character.kind === "角色") {
				const v0 = s.baseSpeed;
				s.currentSpeed = s.currentSpeed + v0 * 0.12;
				s.nextActionValue = 10000 / s.currentSpeed;
			}
		}
	}

	// ── 刻律 军功：刻律和军功目标加速 20% ──
	if (input.meritTarget) {
		const meritOwner = states.find((s) =>
			hasPassive(s.character.name, "meritSpeedBuff20"),
		);
		if (meritOwner) {
			for (const s of states) {
				if (
					s.character.id === meritOwner.character.id ||
					s.character.id === input.meritTarget
				) {
					const v0_merit = s.baseSpeed;
					s.currentSpeed = s.currentSpeed + v0_merit * 0.2;
					s.nextActionValue = 10000 / s.currentSpeed;
				}
			}
		}
	}

	// ── 大丽花 共舞者：若目标为特定角色则加速 30% ──
	if (input.dancePartner) {
		const dahliaState = states.find((s) =>
			hasPassive(s.character.name, "dancePartnerSpeedBuff30"),
		);
		if (dahliaState) {
			const partnerAliases = ["那刻夏", "波提欧", "流萤", "白厄"];
			const partner = states.find((s) => s.character.id === input.dancePartner);
			if (
				partner &&
				partnerAliases.some((alias) =>
					characterNameMatchesAliases(partner.character.name, [alias]),
				)
			) {
				const v0_dahlia =
					toPositiveNumber(partner.character.baseSpeed, 0) > 0
						? toPositiveNumber(partner.character.baseSpeed, 100)
						: 100;
				partner.currentSpeed = partner.currentSpeed + v0_dahlia * 0.3;
				partner.nextActionValue = 10000 / partner.currentSpeed;
			}
		}
	}

	// 军功目标追踪（模拟中途可被 E 切换）
	let currentMeritTarget: string | null = input.meritTarget ?? null;
	const meritOwnerState = states.find((s) =>
		hasPassive(s.character.name, "meritSpeedBuff20"),
	);

	let guard = 0;

	while (states.length > 0 && guard < 2000) {
		guard += 1;

		// Build candidates
		const candidates = states.map((state, stateIndex) => {
			const key = state.isGarmentmakerState &&
				state.garmentmakerGeneration
				? `${state.character.id}-g${state.garmentmakerGeneration}-${state.actionNo}`
				: `${state.character.id}-${state.actionNo}`;
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
			if (a.actionValue !== b.actionValue) return a.actionValue - b.actionValue;
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

		// ── 阿哈时刻：欢愉角色存在时生成独立轴 ──
		if (character.id === "@aha") {
			const ahaSpeed = calcAhaSpeed();
			states[stateIndex].currentSpeed = ahaSpeed;
			actions.push({
				key,
				characterId: "@aha",
				displayName: "阿哈时刻",
				actionNo,
				actionValue,
				skill: "" as SkillCode,
				speed: ahaSpeed,
				isAhaInstant: true,
			});
			// 阿哈时刻支持 after 插队（不支持 before）
			const ahaInterrupts = input.ultInterrupts[key] ?? [];
			for (let ai = 0; ai < ahaInterrupts.length; ai++) {
				const int = ahaInterrupts[ai];
				if (int.timing !== "after") continue;
				const casterIndex = states.findIndex(
					(s) => s.character.id === int.casterId,
				);
				if (casterIndex === -1) continue;
				const caster = states[casterIndex];
				actions.push({
					key: `${key}-interrupt-${ai}`,
					characterId: caster.character.id,
					actionNo: 0,
					actionValue,
					skill: "Q" as SkillCode,
					speed: caster.currentSpeed,
					activeOdeLabels: getActiveOdeLabels(activeOdes, caster.character.id),
				});
				emitMemeAdvanceAction({
					input,
					actions,
					states,
					sourceKey: `${key}-interrupt-${ai}`,
					actionValue,
					activeOdes,
				});
			}
			// 银狼 E2：无敌玩家状态下，阿哈行动后可插入额外 A
			const ahaGodmodeExtra = input.godmodeExtraActions ?? {};
			if (ahaGodmodeExtra[key]) {
				const swIndex = states.findIndex(
					(s) =>
						hasSilverWolfGodmode(s.character.name) && isInGodmode(s),
				);
				if (swIndex !== -1) {
					const sw = states[swIndex];
					actions.push({
						key: `${key}-godmode-A`,
						characterId: sw.character.id,
						displayName: "银狼E2",
						actionNo: 0,
						actionValue,
						skill: "A" as SkillCode,
						speed: sw.currentSpeed,
						lockedSkill: true,
					});
				}
			}
			states[stateIndex].actionNo += 1;
			states[stateIndex].nextActionValue = actionValue + 10000 / ahaSpeed;
			continue;
		}

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
			// 衣匠行动也支持插队大招
			const gmInterrupts = input.ultInterrupts[key] ?? [];
			for (const int of gmInterrupts) {
				const casterIndex = states.findIndex(
					(s) => s.character.id === int.casterId,
				);
				if (casterIndex === -1) continue;
				const caster = states[casterIndex];
				actions.push({
					key: `${key}-interrupt-${gmInterrupts.indexOf(int)}`,
					characterId: caster.character.id,
					actionNo: 0,
					actionValue,
					skill: "Q" as SkillCode,
					speed: caster.currentSpeed,
					activeOdeLabels: getActiveOdeLabels(activeOdes, caster.character.id),
				});
				emitMemeAdvanceAction({
					input,
					actions,
					states,
					sourceKey: `${key}-interrupt-${gmInterrupts.indexOf(int)}`,
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
						sourceKey: `${key}-interrupt-${gmInterrupts.indexOf(int)}`,
						actionValue,
					});
				}
				// 插队大招触发全队拉条（舞舞舞 = (14+2s)%, 忘归人 2魂 = 24%）。
				const teamAdvance = getTeamAdvanceOnUltimate(caster.character);
				if (teamAdvance > 0) {
					for (
						let teammateIndex = 0;
						teammateIndex < states.length;
						teammateIndex++
					) {
						const teammate = states[teammateIndex];
						if (!canBeAdvancedByDance(teammate.character.kind)) continue;
						if (teammate.blockNextAdvance) continue;
						const adv = teamAdvance / teammate.currentSpeed;
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
					const windAdvance = 2500 / caster.currentSpeed;
					if (!caster.blockNextAdvance) {
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
					caster.nextActionValue = actionValue + 10000 / caster.currentSpeed;
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
						caster.character,
						actionValue,
					);
				}
				// 插队大招触发阿格莱雅至高之姿，并使自身立即行动。
				handleAglaeaSkillEffects(states, casterIndex, "Q", actionValue);
			}
			emitMemeAdvanceAction({
				input,
				actions,
				states,
				sourceKey: key,
				actionValue,
				activeOdes,
			});
			continue;
		}

		// ── 境界内连动（每循环一次生成一动，让敌人行动可自然穿插） ──
		const domainState = states[stateIndex].domainState;
		if (domainState) {
			const ds = domainState;
			const i = ds.currentIndex;
			const domainKey = `${ds.keyPrefix}-domain-${i}`;
			const domainAV = toNonNegativeNumber(
				input.overrides[domainKey],
				ds.startAV + ds.interval * i,
			);
			const isFinalDomainAction = i >= ds.maxIndex;
			const rawDomainSkill = isFinalDomainAction
				? ds.rule.finalSkill
				: ((input.skillOverrides[domainKey] ?? "") as SkillCode);
			const domainSkill =
				!isFinalDomainAction &&
				character.eidolon < 2 &&
				(rawDomainSkill === "EA" || rawDomainSkill === "EW")
					? ("" as SkillCode)
					: rawDomainSkill;

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

		const resolvedOverride = getActionSkill(
			character,
			actionNo,
			key,
			input.skillOverrides,
			input.legacyUltOverrides,
		);
		const rawSkill = hasSilverWolfGodmode(character.name)
			? getGodmodeSkill(states[stateIndex], resolvedOverride)
			: (resolvedOverride as SkillCode);
		const himekoNovaAssist =
			rawSkill.includes("F") &&
			isAllyTarget(character.kind) &&
			!hasSkillEffect(character.name, "F", "himekoNovaAssist")
				? findHimekoNovaAssistState(states, character.id)
				: undefined;
		const actionSkill = rawSkill.replace(/F/g, "") as SkillCode;
		const skill = actionSkill;
		const assistUseCount = rawSkill.match(/F/g)?.length ?? 0;
	// E0/E1 sp姬子：非白名单角色只能触发单 F，且不保留原回合
	const himekoNovaLowEidolon =
		himekoNovaAssist !== undefined &&
		himekoNovaAssist.character.eidolon < 2;
	const novaFFWhitelist = [
		"丹恒", "丹恒·腾荒",
		"三月七", "三月七·巡猎",
		"长夜月",
		"瓦尔特",
		"开拓者·毁灭", "开拓者·存护", "开拓者·同谐", "开拓者·记忆", "开拓者·欢愉",
		"星期日",
		"姬子",
	];
	const isNovaFFWhitelisted =
		characterNameMatchesAliases(character.name, novaFFWhitelist);
	const skipAssistFollowUp =
		himekoNovaAssist !== undefined &&
		(assistUseCount >= 2 ||
			(himekoNovaLowEidolon && !isNovaFFWhitelisted));
		// 通用 Q 拆分：Q 始终是插队，解析出非 Q 部分作为主行动
		const hasSelfQ = skill.includes("Q") && skill.length > 1;

		const resolvedSkill = hasSelfQ
			? (skill.replace(/Q/g, "") as SkillCode) || ("" as SkillCode)
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
				activeOdeLabels: getActiveOdeLabels(activeOdes, caster.character.id),
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
			const teamAdvance2 = getTeamAdvanceOnUltimate(caster.character);
			if (teamAdvance2 > 0) {
				for (
					let teammateIndex = 0;
					teammateIndex < states.length;
					teammateIndex++
				) {
					const teammate = states[teammateIndex];
					if (!canBeAdvancedByDance(teammate.character.kind)) continue;
					if (teammate.blockNextAdvance) continue;
					const adv = teamAdvance2 / teammate.currentSpeed;
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
			if (isCharacterTarget(caster.character) && caster.character.hasWindSet) {
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
				caster.nextActionValue = actionValue + 10000 / caster.currentSpeed;
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
			// 插队大招触发银狼LV.999 无敌玩家
			if (
				isCharacterTarget(caster.character) &&
				hasSkillEffect(caster.character.name, "Q", "selfAdvance100")
			) {
				activateGodmode(
					states as GodmodeState[],
					casterIndex,
				);
				caster.nextActionValue = actionValue;
			}
			// 插队大招触发流萤完全燃烧。
			if (
				shouldActivateCombustion(
					caster.character,
					true,
					Boolean(caster.isInCompleteCombustion),
				)
			) {
				activateCombustion(states, casterIndex, caster.character, actionValue);
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
					? Math.max(0, Math.ceil((input.limit - actionValue) / domainInterval))
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
			// 银狼 E2：插队 Q 后也可插入额外 A
			const interruptKey = `${key}-interrupt-${idx}`;
			const intGodmodeExtra = input.godmodeExtraActions ?? {};
			if (intGodmodeExtra[interruptKey]) {
				const swIdx = states.findIndex(
					(s) =>
						hasSilverWolfGodmode(s.character.name) && isInGodmode(s),
				);
				if (swIdx !== -1) {
					const sw = states[swIdx];
					actions.push({
						key: `${interruptKey}-godmode-A`,
						characterId: sw.character.id,
						displayName: "银狼E2",
						actionNo: 0,
						actionValue,
						skill: "A" as SkillCode,
						speed: sw.currentSpeed,
						lockedSkill: true,
					});
				}
			}
		};

		// 按 timing 分组处理
		const beforeInterrupts = interrupts.filter((i) => i.timing === "before");
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
				// 协战 F 行动支持插队大招
				const assistInterrupts = input.ultInterrupts[assistKey] ?? [];
				for (let ai = 0; ai < assistInterrupts.length; ai++) {
					const int2 = assistInterrupts[ai];
					const casterIndex2 = states.findIndex(
						(s) => s.character.id === int2.casterId,
					);
					if (casterIndex2 === -1) continue;
					const caster2 = states[casterIndex2];
					actions.push({
						key: `${assistKey}-interrupt-${ai}`,
						characterId: caster2.character.id,
						actionNo: 0,
						actionValue,
						skill: "Q" as SkillCode,
						speed: caster2.currentSpeed,
						activeOdeLabels: getActiveOdeLabels(
							activeOdes,
							caster2.character.id,
						),
					});
					emitMemeAdvanceAction({
						input,
						actions,
						states,
						sourceKey: `${assistKey}-interrupt-${ai}`,
						actionValue,
						activeOdes,
					});
				}
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
						states[stateIndex].nextActionValue - pendingAssistFollowUpAdvance,
					);
				}

				// 全队拉条（舞舞舞 = (14+2s)%, 忘归人 2魂 = 24%）。
				const teamAdvance3 = getTeamAdvanceOnUltimate(character);
				if (teamAdvance3 > 0 && usesUltimate && !qIsFront) {
					for (const teammate of states) {
						if (!canBeAdvancedByDance(teammate.character.kind)) continue;
						if (teammate.blockNextAdvance) continue;
						const advance = teamAdvance3 / teammate.currentSpeed;
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
					skill.includes("E") &&
					(hasSkillEffect(character.name, "E", "allyPullToCurrent") ||
						hasSkillEffect(character.name, "E", "sundayPullWithMemosprite"))
				) {
					const targetId = getSkillTarget(input, key, character);
					if (targetId) {
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
									teammate.nextActionValue = actionValue;
								}
							}
						}
						// Sunday additionally pulls the target's owned summons
						if (
							hasSkillEffect(character.name, "E", "sundayPullWithMemosprite")
						) {
							for (const entity of states) {
								const isOwnedSummon =
									entity.character.id !== targetId &&
									((entity.isGarmentmakerState &&
										entity.garmentmakerOwnerId === targetId) ||
										(entity.isMemeState && entity.memeOwnerId === targetId));
								if (isOwnedSummon && !entity.blockNextAdvance) {
									entity.nextActionValue = actionValue;
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
					if (!qIsFront) {
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

		// 银狼 E2：无敌玩家状态下，我方/阿哈行动后可插入额外 A
		if (
			!skipAssistFollowUp &&
			(isAllyTarget(character.kind) || character.id === "@aha")
		) {
			const godmodeExtraActions = input.godmodeExtraActions ?? {};
			if (godmodeExtraActions[key]) {
				const swIndex = states.findIndex(
					(s) => hasSilverWolfGodmode(s.character.name) && isInGodmode(s),
				);
				if (swIndex !== -1) {
					const sw = states[swIndex];
					actions.push({
						key: `${key}-godmode-A`,
						characterId: sw.character.id,
						displayName: "银狼E2",
						actionNo: 0,
						actionValue,
						skill: "A" as SkillCode,
						speed: sw.currentSpeed,
						lockedSkill: true,
					});
				}
			}
		}

		emitMemeAdvanceAction({
			input,
			actions,
			states,
			sourceKey: key,
			actionValue,
			activeOdes,
		});
	}

	return actions;
}
