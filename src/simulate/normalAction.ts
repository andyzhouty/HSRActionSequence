import { type SkillCode } from "../utils/actionSequence";
import { getActionSkill } from "./effects";
import { getGodmodeSkill, hasSilverWolfGodmode } from "../mechanics/silverWolfGodmode";
import { resolveHimekoNovaAssist } from "./assist";
import type { ActionContext } from "./context";
import type { SimulationRuntime } from "./runtime";

/** 正常角色行动在写入动作前的解析结果。 */
export function resolveNormalActionPlan(
	runtime: SimulationRuntime,
	context: ActionContext,
) {
	const { input, states } = runtime;
	const { stateIndex, key, character, actionNo } = context;
	const configuredSkill = getActionSkill(character, actionNo, key, input.skillOverrides, input.legacyUltOverrides);
	const savedSkill = states[stateIndex].e2SavedActionSkill;
	states[stateIndex].e2SavedActionSkill = undefined;
	const rawSkill = hasSilverWolfGodmode(character.name)
		? getGodmodeSkill(states[stateIndex], savedSkill ?? configuredSkill)
		: ((savedSkill ?? configuredSkill) as SkillCode);
	const assistPlan = resolveHimekoNovaAssist(states, character, rawSkill);
	const skill = assistPlan.skill;
	const hasSelfQ = skill.includes("Q") && skill.length > 1;
	return {
		...assistPlan,
		skill,
		hasSelfQ,
		resolvedSkill: (hasSelfQ ? skill.replace(/Q/g, "") || "" : skill) as SkillCode,
		usesUltimate: skill.includes("Q"),
		qIsFront: skill.length > 1 && skill.startsWith("Q"),
		hasEvernightNextTurnSpeedBuff: (states[stateIndex].evernightNextTurnSpeedBonus ?? 0) > 0,
		actionSpeed: states[stateIndex].currentSpeed,
	};
}
