import { hasSkillEffect } from "../data/characters";
import type {
	CharacterConfig,
	GeneratedAction,
	SkillCode,
} from "../utils/actionSequence";
import { getEveyRule } from "../utils/actionSequence";

type EveyActionState = {
	character: CharacterConfig;
	baseSpeed: number;
	currentSpeed: number;
	actionNo: number;
	nextActionValue: number;
	blockNextAdvance: boolean;
	eveyOnField?: boolean;
	eveyGeneration?: number;
	eveySummonGeneration?: number;
	isEveyAction?: boolean;
	evernightNextTurnSpeedBonus?: number;
	sameActionPriority?: number;
};

type EveyDismissSource = "normal" | "selfDestruct" | "thresholdBurst";

const EVERNIGHT_BASE_SPEED = 99;
const EVERNIGHT_BASE_SPEED_BUFF = EVERNIGHT_BASE_SPEED * 0.1;

function getEffectiveDismissSpeedBuff(
	resourceValue: string | undefined,
	source: EveyDismissSource,
) {
	if (source === "selfDestruct") return EVERNIGHT_BASE_SPEED_BUFF;
	if (source === "thresholdBurst") {
		const parsed = Number.parseFloat(resourceValue ?? "");
		const consumed = Number.isFinite(parsed) && parsed >= 16 ? parsed : 16;
		const extraPercent = Math.min(consumed, 40);
		return (
			EVERNIGHT_BASE_SPEED_BUFF + (EVERNIGHT_BASE_SPEED * extraPercent) / 100
		);
	}
	const parsed = Number.parseFloat(resourceValue ?? "");
	const consumed = Number.isFinite(parsed) && parsed < 0 ? Math.abs(parsed) : 0;
	const extraPercent = Math.min(consumed, 40);
	return (
		EVERNIGHT_BASE_SPEED_BUFF + (EVERNIGHT_BASE_SPEED * extraPercent) / 100
	);
}

function applyEvernightDisappearSpeedBuff(
	ownerState: EveyActionState,
	actionValue: number,
	nextBonus: number,
) {
	const oldSpeed = ownerState.currentSpeed;
	const previousBonus = ownerState.evernightNextTurnSpeedBonus ?? 0;
	const baseSpeed = Math.max(0, oldSpeed - previousBonus);
	const nextSpeed = baseSpeed + nextBonus;
	if (nextSpeed <= 0) return;

	ownerState.currentSpeed = nextSpeed;
	ownerState.evernightNextTurnSpeedBonus = nextBonus;
	if (ownerState.nextActionValue > actionValue && oldSpeed > 0) {
		const remainingActionDistance =
			(ownerState.nextActionValue - actionValue) * oldSpeed;
		ownerState.nextActionValue =
			actionValue + remainingActionDistance / nextSpeed;
	} else {
		ownerState.nextActionValue = actionValue + 10000 / nextSpeed;
	}
}

export function consumeEvernightSpeedBuff(state: EveyActionState) {
	const bonus = state.evernightNextTurnSpeedBonus ?? 0;
	if (bonus <= 0) return;
	state.currentSpeed = Math.max(0, state.currentSpeed - bonus);
	state.evernightNextTurnSpeedBonus = 0;
}

export function hasEvernightEvey(characterName: string): boolean {
	return hasSkillEffect(characterName, "E", "summonEvey");
}

export function findEveyState(states: EveyActionState[], ownerId: string) {
	return states.find(
		(state) => state.isEveyAction && state.character.id === `${ownerId}-evey`,
	);
}

export function summonEveyState(
	states: EveyActionState[],
	owner: CharacterConfig,
	actionValue: number,
	options?: {
		immediate?: boolean;
		sameActionPriority?: number;
	},
) {
	if (findEveyState(states, owner.id)) return;
	const rule = getEveyRule(owner.name);
	const speed = rule.memospriteSpeed;
	const ownerState = states.find((state) => state.character.id === owner.id);
	const nextGeneration = (ownerState?.eveySummonGeneration ?? 0) + 1;
	if (ownerState) {
		ownerState.eveyOnField = true;
		ownerState.eveySummonGeneration = nextGeneration;
	}

	states.push({
		character: {
			id: `${owner.id}-evey`,
			kind: "忆灵",
			name: rule.memospriteName,
			speed: String(speed),
			baseSpeed: String(speed),
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		},
		baseSpeed: speed,
		currentSpeed: speed,
		actionNo: 1,
		nextActionValue: options?.immediate
			? actionValue
			: actionValue + 10000 / speed,
		blockNextAdvance: false,
		isEveyAction: true,
		eveyGeneration: nextGeneration,
		sameActionPriority: options?.sameActionPriority,
	} as EveyActionState);
}

export function handleEveyAction(
	states: EveyActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	actionValue: number,
	skill: SkillCode,
	options?: {
		lockedSkill?: boolean;
		selfDestruct?: boolean;
		thresholdBurst?: boolean;
		resourceValue?: string;
	},
) {
	const state = states[stateIndex];
	const ownerId = state.character.id.replace("-evey", "");
	const ownerState = states.find(
		(candidate) => candidate.character.id === ownerId,
	);
	const rule = ownerState
		? getEveyRule(ownerState.character.name)
		: getEveyRule("");
	const resolvedSkill = skill === "" ? rule.keepSkill : skill;
	const dismissSource: EveyDismissSource = options?.thresholdBurst
		? "thresholdBurst"
		: options?.selfDestruct
			? "selfDestruct"
			: "normal";

	actions.push({
		key,
		characterId: state.character.id,
		displayName: rule.memospriteName,
		targetKind: "忆灵",
		actionNo: state.actionNo,
		actionValue,
		skill,
		speed: state.currentSpeed,
		isMemospriteAction: true,
		memospriteOwnerId: ownerId,
		isEveyAction: true,
		isEveySelfDestructAction: options?.selfDestruct ?? false,
		isEveyThresholdBurstAction: options?.thresholdBurst ?? false,
		lockedSkill: options?.lockedSkill ?? false,
	});

	state.sameActionPriority = 0;

	if (resolvedSkill === rule.dismissSkill) {
		if (ownerState) {
			ownerState.eveyOnField = false;
			applyEvernightDisappearSpeedBuff(
				ownerState,
				actionValue,
				getEffectiveDismissSpeedBuff(options?.resourceValue, dismissSource),
			);
		}
		states.splice(stateIndex, 1);
		return;
	}

	state.actionNo += 1;
	state.nextActionValue = actionValue + 10000 / state.currentSpeed;
	state.blockNextAdvance = false;
}
