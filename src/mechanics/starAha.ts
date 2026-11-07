import { getCharacterCid } from "../data/characters";
import type { ActionState, SimulateActionsInput } from "../simulate/types";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../utils/action-sequence";

// HSRVersionInspector 4.6.54: 151104, 151107, 1511102, 1511601.
export const starAhaWillResourceName = "愿力";
export const starAhaJokesResourceName = "笑点";
export const starAhaHealingResourceName = "治疗/护盾";
export function hasStarAha(character: CharacterConfig | undefined) {
	return (
		character?.kind === "角色" && getCharacterCid(character.name) === "1511"
	);
}
function gain(state: ActionState, amount: number) {
	state.starAhaWill = Math.min(
		10,
		Math.max(0, (state.starAhaWill ?? 0) + amount),
	);
}
export function initializeStarAha(states: ActionState[]) {
	const owner = states.find((s) => hasStarAha(s.character));
	if (owner) {
		owner.starAhaWill = owner.character.eidolon >= 1 ? 5 : 0;
		owner.starAhaJokes = 0;
	}
	return owner;
}
/** Before inserted Qs: the envoy grants Will at turn start, not on every action. */
export function beginStarAhaTurn(
	states: ActionState[],
	actorId: string,
	key: string,
	consumeDuration = true,
) {
	const owner = states.find((s) => hasStarAha(s.character));
	if (!owner || owner.starAhaTurnKeys?.[key]) return;
	owner.starAhaTurnKeys ??= {};
	owner.starAhaTurnKeys[key] = true;
	if (owner.starAhaEnvoy === actorId) gain(owner, 1);
	if (owner.character.id === actorId && consumeDuration)
		owner.starAhaUniverseTurns = Math.max(
			0,
			(owner.starAhaUniverseTurns ?? 0) - 1,
		);
}
function manualNumber(input: SimulateActionsInput, key: string, name: string) {
	const value = input.resourceValues?.[key]?.[name];
	if (value === undefined || value.trim() === "") return undefined;
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : undefined;
}
/** Scheduler events only: no damage, healing or shield strength is calculated here. */
export function handleStarAhaRecordedAction(params: {
	owner: ActionState;
	action: GeneratedAction;
	states: ActionState[];
	actions: GeneratedAction[];
	input: SimulateActionsInput;
	emitExtraAha: (
		key: string,
		av: number,
		options?: { fixedJokes?: number; doesNotConsumeJokes?: boolean },
	) => void;
}) {
	const { owner, action, states, actions, input, emitExtraAha } = params;
	// Additional turns are emitted directly rather than through the normal loop.
	if (
		action.key.endsWith("-godmode-A") ||
		action.isSparxieExtraAction ||
		action.isSpBladeExtraAction ||
		action.isMydeiGodslayerAction ||
		action.isPearlExtraAction
	)
		beginStarAhaTurn(
			states,
			action.characterId,
			action.key,
			!action.isPearlExtraAction,
		);
	const own = action.characterId === owner.character.id;
	const jokes = manualNumber(input, action.key, starAhaJokesResourceName);
	if (jokes !== undefined) owner.starAhaJokes = jokes;
	if ((owner.starAhaJokes ?? 0) >= 40 && !owner.starAhaFortyClaimed) {
		gain(owner, 1);
		owner.starAhaFortyClaimed = true;
	}
	if (
		manualNumber(input, action.key, starAhaHealingResourceName) === 1 &&
		!owner.starAhaHealingUsed
	) {
		gain(owner, 1);
		owner.starAhaHealingUsed = true;
	}
	if (
		own &&
		(action.skill === "A" || action.skill === "E" || action.skill === "ES")
	)
		gain(owner, 1);
	if (own && action.skill === "E") {
		const target =
			input.skillTargets[action.key] ??
			input.defaultSkillTargets[owner.character.id];
		if (
			states.some(
				(s) =>
					s.character.id === target &&
					s.character.kind === "角色" &&
					s !== owner,
			)
		)
			owner.starAhaEnvoy = target;
	}
	if (own && action.skill === "Q") {
		action.starAhaUltimateUnavailable = (owner.starAhaWill ?? 0) < 8;
		gain(owner, -8);
		owner.starAhaUniverseTurns = 3;
		owner.starAhaHealingUsed = false;
		const aha = states.find((s) => s.character.id === "@aha");
		const advance =
			owner.character.eidolon >= 6 && !owner.starAhaE6Used ? 1 : 0.2;
		if (advance === 1) {
			owner.starAhaE6Used = true;
			owner.starAhaJokes = (owner.starAhaJokes ?? 0) + 100;
		}
		if (aha && aha.currentSpeed > 0)
			aha.nextActionValue = Math.max(
				action.actionValue,
				aha.nextActionValue - (10000 * advance) / aha.currentSpeed,
			);
	}
	// A Q (notably E6) can itself take the pool across forty.
	if ((owner.starAhaJokes ?? 0) >= 40 && !owner.starAhaFortyClaimed) {
		gain(owner, 1);
		owner.starAhaFortyClaimed = true;
	}
	if (action.isAhaInstant) {
		const consumed = action.ahaDoesNotConsumeJokes
			? 0
			: (owner.starAhaJokes ?? 0);
		action.ahaJokesUsed = action.ahaFixedJokes ?? consumed;
		owner.starAhaMoments ??= {};
		owner.starAhaMoments[action.key] = {
			consumed,
			refund: (owner.starAhaUniverseTurns ?? 0) > 0,
		};
		if (!action.ahaDoesNotConsumeJokes) owner.starAhaJokes = 0;
	}
	if (own && action.isElationSkill && action.elationSkillParentKey) {
		const moment = owner.starAhaMoments?.[action.elationSkillParentKey];
		if (moment?.refund)
			owner.starAhaJokes = (owner.starAhaJokes ?? 0) + moment.consumed * 0.1;
		if (owner.starAhaMoments)
			delete owner.starAhaMoments[action.elationSkillParentKey];
		owner.starAhaFortyClaimed = false;
	}
	const will = manualNumber(input, action.key, starAhaWillResourceName);
	if (will !== undefined) owner.starAhaWill = Math.min(10, Math.trunc(will));
	action.starAhaWill = owner.starAhaWill;
	action.starAhaJokes = owner.starAhaJokes;
	action.starAhaEnvoy = owner.starAhaEnvoy;
	action.starAhaUniverseTurns = owner.starAhaUniverseTurns ?? 0;
	if (action.characterId === "@av0" && owner.character.techniqueOn)
		emitExtraAha(action.key, 0, {
			fixedJokes: 20,
			doesNotConsumeJokes: true,
		});
	if (own && action.skill === "E")
		actions.push({
			key: `${action.key}-fua`,
			characterId: owner.character.id,
			displayName: owner.character.name,
			actionValue: action.actionValue,
			actionNo: 0,
			skill: "Z",
			speed: owner.currentSpeed,
			isFuaAction: true,
			starAhaSkillPointRefund: 1,
			lockedSkill: true,
		});
}
