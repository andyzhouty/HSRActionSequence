import type { ActionState, SimulateActionsInput } from "../simulate/types";
import type { GeneratedAction } from "../utils/actionSequence";
import { getCharacterCid } from "../utils/actionSequence";

export function hasMydei(name: string): boolean {
	return getCharacterCid(name) === "1404";
}

/** 在一个行动点设置血仇；进入时将下一正常行动提前至当前 AV。 */
export function applyMydeiVendettaToggle(
	states: ActionState[],
	input: SimulateActionsInput,
	key: string,
	actionValue: number,
): void {
	const requested = input.mydeiVendettaToggles?.[key];
	if (requested === undefined) return;
	const mydei = states.find((state) => hasMydei(state.character.name));
	if (!mydei || mydei.mydeiVendettaActive === requested) return;
	mydei.mydeiVendettaActive = requested;
	if (requested) mydei.nextActionValue = actionValue;
}

/** 弑神登神：仅血仇期间可在任意行动点插入一次锁定 E 的额外回合。 */
export function emitMydeiGodslayerExtraAction(
	sourceKey: string,
	actionValue: number,
	states: ActionState[],
	actions: GeneratedAction[],
	input: SimulateActionsInput,
): void {
	if (!input.mydeiGodslayerToggles?.[sourceKey]) return;
	const mydei = states.find(
		(state) => hasMydei(state.character.name) && state.mydeiVendettaActive,
	);
	if (!mydei) return;
	actions.push({
		key: `${sourceKey}-mydei-godslayer`,
		characterId: mydei.character.id,
		displayName: "万敌",
		actionNo: 0,
		actionValue,
		skill: "E",
		speed: mydei.currentSpeed,
		isMydeiGodslayerAction: true,
		lockedSkill: true,
	});
}
