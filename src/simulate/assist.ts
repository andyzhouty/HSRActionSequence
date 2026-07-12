import { hasSkillEffect } from "../data/characters";
import { expirePhainonDomainSpeedBonus } from "../mechanics/phainonDomain";
import type { GeneratedAction } from "../utils/actionSequence";
import { getCharacterCid, type SkillCode } from "../utils/actionSequence";
import {
	emitMemeAdvanceAction,
	findHimekoNovaAssistState,
	getActiveOdeLabels,
	isAllyTarget,
} from "./effects";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

const novaFFCidWhitelist = new Set([
	"1002",
	"1414",
	"1001",
	"1224",
	"1413",
	"1004",
	"8002",
	"8004",
	"8006",
	"8008",
	"8010",
	"1313",
	"1003",
]);

/** 解析 SP 姬子协战，并决定原行动是否保留。 */
export function resolveHimekoNovaAssist(
	states: ActionState[],
	character: ActionState["character"],
	rawSkill: SkillCode,
): {
	assist: ActionState | undefined;
	skill: SkillCode;
	assistUseCount: number;
	skipFollowUp: boolean;
} {
	const assist =
		rawSkill.includes("F") &&
		isAllyTarget(character.kind) &&
		!hasSkillEffect(character.name, "F", "himekoNovaAssist")
			? findHimekoNovaAssistState(states, character.id)
			: undefined;
	const assistUseCount = rawSkill.match(/F/g)?.length ?? 0;
	const cid = getCharacterCid(character.name);
	const skipFollowUp =
		assist !== undefined &&
		(assistUseCount >= 2 ||
			(assist.character.eidolon < 2 &&
				(cid === undefined || !novaFFCidWhitelist.has(cid))));
	return {
		assist,
		skill: rawSkill.replace(/F/g, "") as SkillCode,
		assistUseCount,
		skipFollowUp,
	};
}

/** 生成 SP 姬子协战及其专属插队。 */
export function emitHimekoNovaAssists(args: {
	assist: ActionState | undefined;
	assistUseCount: number;
	key: string;
	actionValue: number;
	states: ActionState[];
	actions: GeneratedAction[];
	activeOdes: Map<string, ActiveOdeState[]>;
	input: SimulateActionsInput;
}): void {
	const {
		assist,
		assistUseCount,
		key,
		actionValue,
		states,
		actions,
		activeOdes,
		input,
	} = args;
	if (!assist) return;
	for (
		let assistIndex = 1;
		assistIndex <= Math.min(assistUseCount, 2);
		assistIndex++
	) {
		const assistKey =
			assistIndex === 1 ? `${key}-assist-F` : `${key}-assist-F-${assistIndex}`;
		actions.push({
			key: assistKey,
			characterId: assist.character.id,
			actionNo: 0,
			actionValue,
			skill: "F" as SkillCode,
			speed: assist.currentSpeed,
			isAssistAction: true,
			assistSourceKey: key,
			assistIndex,
			activeOdeLabels: getActiveOdeLabels(activeOdes, assist.character.id),
		});
		emitMemeAdvanceAction({
			input,
			actions,
			states,
			sourceKey: assistKey,
			actionValue,
			activeOdes,
		});
		for (let ai = 0; ai < (input.ultInterrupts[assistKey] ?? []).length; ai++) {
			const interrupt = input.ultInterrupts[assistKey][ai];
			const caster = states.find(
				(state) => state.character.id === interrupt.casterId,
			);
			if (!caster) continue;
			actions.push({
				key: `${assistKey}-interrupt-${ai}`,
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
				sourceKey: `${assistKey}-interrupt-${ai}`,
				actionValue,
				activeOdes,
			});
		}
		expirePhainonDomainSpeedBonus(states, actionValue);
	}
}
