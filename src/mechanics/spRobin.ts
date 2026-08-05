import { getCharacterCid, getEffectRule } from "../data/characters";
import type { ActionState, SimulateActionsInput } from "../simulate/types";
import type {
	CharacterConfig,
	GeneratedAction,
	SummerSongbirdsRule,
} from "../utils/action-sequence";

// ── 知更鸟·晴歌（SP Robin / Robin Summeretto） ──
// 角色数据（CID/命途/基础速度）在 characters.json；本模块只保留行动调度机制。

export const SP_ROBIN_CID = "1512";
export const SP_ROBIN_BASE_SPEED = 98;

const SONGBIRDS_SPEED_RATIO = 1.8;
const FEVER_COUNTDOWN_SPEED = 140;
const FEVER_HALVED_DISTANCE = 5000;
const FEVER_IDLE_SENTINEL = 99999;

const defaultSummerSongbirdsRule: SummerSongbirdsRule = {
	memospriteName: "晴空乐手",
	memospriteSkill: "A",
	memospriteSpeedRatio: SONGBIRDS_SPEED_RATIO,
};

export function hasSpRobin(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === SP_ROBIN_CID;
}

export function getSpRobinFeverCap(eidolon: number): number {
	return eidolon >= 2 ? 70 : 50;
}

/** 氛围值资源列的合法输入：空串或不超过星魂对应上限的非负整数。 */
export function isValidSpRobinFeverValue(
	value: string,
	eidolon: number,
): boolean {
	if (value === "") return true;
	if (!/^\d+$/.test(value)) return false;
	return Number(value) <= getSpRobinFeverCap(eidolon);
}

export function getSummerSongbirdsRule(ownerName: string): SummerSongbirdsRule {
	const effectRule = getEffectRule<Partial<SummerSongbirdsRule>>(
		ownerName,
		"summonSummerSongbirds",
	);
	return { ...defaultSummerSongbirdsRule, ...effectRule };
}

// ── 晴空乐手（忆灵） ──
// 忆灵速度 =（sp鸟面板速度 + 98 × 局内百分比速度buff之和）× 1.8。
// 百分比 buff 以基础速度 98 计算；绝对速度调整不参与忆灵速度。

export function findSongbirdsState(states: ActionState[], ownerId: string) {
	return states.find(
		(state) => state.isSongbirdsAction && state.songbirdsOwnerId === ownerId,
	);
}

function getRobinPanelSpeed(robin: ActionState): number {
	return (
		Math.max(0, Number.parseFloat(robin.character.speed)) || robin.baseSpeed
	);
}

export function getSongbirdsSpeed(robin: ActionState): number {
	const pctSum = robin.spRobinMemospritePercentBuff ?? 0;
	return (
		(getRobinPanelSpeed(robin) + SP_ROBIN_BASE_SPEED * pctSum) *
		SONGBIRDS_SPEED_RATIO
	);
}

/** 在 SP Robin 百分比速度 buff 变化后，同步晴空乐手的速度与下一次行动 AV。 */
export function syncSpRobinSongbirds(
	states: ActionState[],
	robin: ActionState,
	actionValue: number,
): void {
	const songbirds = findSongbirdsState(states, robin.character.id);
	if (!songbirds) return;
	const oldSpeed = songbirds.currentSpeed;
	const newSpeed = getSongbirdsSpeed(robin);
	if (newSpeed <= 0) return;
	songbirds.currentSpeed = newSpeed;
	songbirds.baseSpeed = newSpeed;
	songbirds.character.speed = String(newSpeed);
	songbirds.character.baseSpeed = String(newSpeed);
	if (oldSpeed > 0 && songbirds.nextActionValue > actionValue) {
		const remaining = songbirds.nextActionValue - actionValue;
		songbirds.nextActionValue = actionValue + remaining * (oldSpeed / newSpeed);
	}
}

/** 记录一个以基础速度计算的百分比速度 buff（如藿藿E1 +12% → deltaPct = 0.12）。 */
export function recordSpRobinPercentBuff(
	states: ActionState[],
	robinId: string,
	deltaPct: number,
	actionValue: number,
): void {
	const robin = states.find(
		(state) => state.character.id === robinId && hasSpRobin(state.character),
	);
	if (!robin) return;
	robin.spRobinMemospritePercentBuff =
		(robin.spRobinMemospritePercentBuff ?? 0) + deltaPct;
	syncSpRobinSongbirds(states, robin, actionValue);
}

export function summonSongbirdsState(
	states: ActionState[],
	owner: CharacterConfig,
	actionValue: number,
): void {
	if (findSongbirdsState(states, owner.id)) return;
	const robinState = states.find((state) => state.character.id === owner.id);
	const pctSum = robinState?.spRobinMemospritePercentBuff ?? 0;
	const panelSpeed = Math.max(0, Number.parseFloat(owner.speed)) || 0;
	const speed =
		(panelSpeed + SP_ROBIN_BASE_SPEED * pctSum) * SONGBIRDS_SPEED_RATIO;
	const rule = getSummerSongbirdsRule(owner.name);
	states.push({
		character: {
			id: `${owner.id}-songbirds`,
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
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: actionValue + 10000 / speed,
		blockNextAdvance: false,
		isSongbirdsAction: true,
		songbirdsOwnerId: owner.id,
	});
	if (robinState) robinState.songbirdsOnField = true;
}

export function handleSongbirdsAction(
	states: ActionState[],
	stateIndex: number,
	actions: GeneratedAction[],
	key: string,
	actionValue: number,
): void {
	const state = states[stateIndex];
	const owner = states.find(
		(candidate) => candidate.character.id === state.songbirdsOwnerId,
	);
	const rule = owner
		? getSummerSongbirdsRule(owner.character.name)
		: defaultSummerSongbirdsRule;
	actions.push({
		key,
		characterId: state.character.id,
		displayName: rule.memospriteName,
		targetKind: "忆灵",
		actionNo: state.actionNo,
		actionValue,
		skill: rule.memospriteSkill,
		speed: state.currentSpeed,
		isSongbirdsAction: true,
		songbirdsOwnerId: state.songbirdsOwnerId,
		lockedSkill: true,
	});
	state.actionNo += 1;
	state.nextActionValue = actionValue + 10000 / state.currentSpeed;
}

// ── Fever 状态 ──
// 进入：SP Robin 无自身回合、不丢 buff，记录剩余路程并创建固定 140 速 Fever减半倒计时。
// Fever 结束由右键开关控制；倒计时在 Fever 未结束期间持续以 140 速行动（不结束 Fever）。
// 结束（手动关闭）：nextAV = 结束AV + max{0, 剩余路程 - 5000 - 被提前量}/速度。
// 口径已确认：「剩余路程」= 到下一动的剩余距离 = (nextAV - 进入AV) × 当前速度（不是已行驶路程）。

export function isSpRobinFeverCountdown(state: ActionState): boolean {
	return state.spRobinFeverCountdownOwnerId !== undefined;
}

export function applySpRobinFeverToggle(
	states: ActionState[],
	input: SimulateActionsInput,
	key: string,
	actionValue: number,
): void {
	const requested = input.spRobinFeverToggles?.[key];
	if (requested === undefined) return;
	const robinIndex = states.findIndex(
		(state) => state.character.kind === "角色" && hasSpRobin(state.character),
	);
	if (robinIndex === -1) return;
	const robin = states[robinIndex];
	if (Boolean(robin.spRobinInFever) === requested) return;
	// Fever 会自动结束；同一 key 重复出现（如 SP Robin 自己的回合）时不重复触发。
	const applied = robin.spRobinFeverAppliedKeys ?? new Set<string>();
	if (applied.has(key)) return;
	applied.add(key);
	robin.spRobinFeverAppliedKeys = applied;
	if (requested) enterSpRobinFever(states, robinIndex, actionValue);
	else exitSpRobinFever(states, robinIndex, actionValue);
}

export function enterSpRobinFever(
	states: ActionState[],
	robinIndex: number,
	actionValue: number,
): void {
	const robin = states[robinIndex];
	if (robin.spRobinInFever) return;
	robin.spRobinInFever = true;
	robin.spRobinFeverRemainingDistance =
		Math.max(0, robin.nextActionValue - actionValue) * robin.currentSpeed;
	robin.spRobinFeverAdvancedDistance = 0;
	const countdownId = `${robin.character.id}-fever-countdown`;
	robin.spRobinFeverCountdownId = countdownId;
	states.push({
		character: {
			id: countdownId,
			kind: "倒计时",
			name: "Fever减半",
			speed: String(FEVER_COUNTDOWN_SPEED),
			baseSpeed: String(FEVER_COUNTDOWN_SPEED),
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		},
		baseSpeed: FEVER_COUNTDOWN_SPEED,
		currentSpeed: FEVER_COUNTDOWN_SPEED,
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: actionValue + 10000 / FEVER_COUNTDOWN_SPEED,
		blockNextAdvance: true,
		spRobinFeverCountdownOwnerId: robin.character.id,
	});
	robin.nextActionValue = actionValue + FEVER_IDLE_SENTINEL;
}

/** 结算 Fever 结束后的 SP Robin 下一次行动（「减半」一次性扣除 5000 距离）。 */
function settleSpRobinFeverEnd(robin: ActionState, actionValue: number): void {
	robin.spRobinInFever = false;
	const distance = Math.max(
		0,
		(robin.spRobinFeverRemainingDistance ?? 0) -
			FEVER_HALVED_DISTANCE -
			(robin.spRobinFeverAdvancedDistance ?? 0),
	);
	robin.nextActionValue =
		actionValue + distance / Math.max(0.001, robin.currentSpeed);
	robin.spRobinFeverCountdownId = undefined;
	robin.spRobinFeverRemainingDistance = undefined;
	robin.spRobinFeverAdvancedDistance = undefined;
}

/** 手动关闭 Fever（右键关闭）——移除倒计时并立即结算。 */
export function exitSpRobinFever(
	states: ActionState[],
	robinIndex: number,
	actionValue: number,
): void {
	const robin = states[robinIndex];
	if (!robin.spRobinInFever) return;
	if (robin.spRobinFeverCountdownId) {
		const countdownIndex = states.findIndex(
			(state) => state.character.id === robin.spRobinFeverCountdownId,
		);
		if (countdownIndex >= 0) states.splice(countdownIndex, 1);
	}
	settleSpRobinFeverEnd(robin, actionValue);
}

/**
 * Fever减半倒计时行动：只要 Fever 未结束就持续以 140 速行动（不结束 Fever）。
 * Fever 结束由右键开关控制；每次倒计时行动仅生成一条行动记录并继续按 140 速排下一动。
 */
export function endSpRobinFeverFromCountdown(
	states: ActionState[],
	countdownIndex: number,
	actions: GeneratedAction[],
	key: string,
	actionValue: number,
): void {
	const countdown = states[countdownIndex];
	void states;
	actions.push({
		key,
		characterId: countdown.character.id,
		displayName: "Fever减半",
		targetKind: "倒计时",
		actionNo: countdown.actionNo,
		actionValue,
		skill: "" as const,
		speed: FEVER_COUNTDOWN_SPEED,
		isSpRobinFeverCountdownAction: true,
		lockedSkill: true,
	});
	countdown.actionNo += 1;
	countdown.nextActionValue = actionValue + 10000 / FEVER_COUNTDOWN_SPEED;
}

// ── Q：指定我方单体立即行动 + 2 回合不可使其他我方目标提前 ──

export function handleSpRobinUltimate({
	states,
	casterIndex,
	actionValue,
	input,
	sourceKey,
}: {
	states: ActionState[];
	casterIndex: number;
	actionValue: number;
	input: SimulateActionsInput;
	sourceKey: string;
}): void {
	const caster = states[casterIndex];
	if (!hasSpRobin(caster.character)) return;
	const targetId = input.skillTargets[sourceKey];
	if (!targetId) return;
	const target = states.find(
		(state) =>
			state.character.id === targetId &&
			(state.character.kind === "角色" || state.character.kind === "忆灵"),
	);
	if (!target) return;
	// 目标若处于 Fever，该次立即行动计为「被提前的量」（不直接改写 nextAV）。
	if (!consumeFeverFullPull(target) && !target.blockNextAdvance) {
		target.nextActionValue = actionValue;
		target.sameActionPriority = -1;
	}
	target.allyAdvanceBlockTurns = 2;
}

/** 目标处于 Fever（SP Robin）时，将剩余路程全部计为被提前量（拉满）。 */
export function consumeFeverFullPull(target: ActionState): boolean {
	if (!target.spRobinInFever) return false;
	target.spRobinFeverAdvancedDistance =
		target.spRobinFeverRemainingDistance ?? 0;
	return true;
}

/** 目标处于 Fever（SP Robin）时，累计指定距离（速度×行动值）的被提前量。 */
export function consumeFeverAdvance(
	target: ActionState,
	advanceDistance: number,
): boolean {
	if (!target.spRobinInFever) return false;
	target.spRobinFeverAdvancedDistance =
		(target.spRobinFeverAdvancedDistance ?? 0) + advanceDistance;
	return true;
}

export function hasAllyAdvanceBlock(state: ActionState | undefined): boolean {
	return (state?.allyAdvanceBlockTurns ?? 0) > 0;
}

/** 目标的 2 个正常回合 debuff 在每次正常行动后递减。 */
export function consumeAllyAdvanceBlock(state: ActionState): void {
	if ((state.allyAdvanceBlockTurns ?? 0) > 0) {
		state.allyAdvanceBlockTurns = (state.allyAdvanceBlockTurns ?? 0) - 1;
	}
}
