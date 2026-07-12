import { hasSkillEffect } from "../data/characters";
import { handleAglaeaSkillEffects, handleGarmentmakerAction } from "../mechanics/aglaeaGarmentmaker";
import { activateCombustion, shouldActivateCombustion } from "../mechanics/fireflyCombustion";
import { expirePhainonDomainSpeedBonus } from "../mechanics/phainonDomain";
import { type SkillCode, isCharacterTarget } from "../utils/actionSequence";
import { canBeAdvancedByDance, consumeActionOdes, emitCyreneMemospriteAction, emitMemeAdvanceAction, getActiveOdeLabels, getTeamAdvanceOnUltimate, handleCyrenePostUltimate, isAllyTarget } from "./effects";
import type { ActionContext } from "./context";
import type { SimulationRuntime } from "./runtime";

/** 执行衣匠行动及其专属插队效果。 */
export function handleGarmentmakerActionTurn(runtime: SimulationRuntime, context: ActionContext): boolean {
	const { input, states, actions, activeOdes } = runtime;
	const { stateIndex, key, actionValue, character, actionNo } = context;
	const emitEvernightSelfDestructAction = runtime.callbacks.emitEvernightSelfDestructAction;
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
			handleCyrenePostUltimate({
				states,
				casterIndex,
				character: caster.character,
				actions,
				actionValue,
				activeOdes,
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
	emitEvernightSelfDestructAction(key, actionValue);
	return true;
}
return false;
}
