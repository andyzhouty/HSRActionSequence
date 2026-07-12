import { hasSkillEffect } from "../data/characters";
import type {
	CharacterConfig,
	GeneratedAction,
	SkillCode,
} from "../utils/actionSequence";
import { toPositiveNumber } from "../utils/actionSequence";

// ── 类型 ──

export interface HyacineActionState {
	character: CharacterConfig;
	currentSpeed: number;
	baseSpeed: number;
	actionNo: number;
	nextActionValue: number;
	blockNextAdvance: boolean;
	icaOnField?: boolean;
	afterRain?: number;
	hyacineE2SpeedBonus?: number;
}

// ── 判断 ──

export function hasHyacineIca(characterName: string): boolean {
	return hasSkillEffect(characterName, "E", "summonIca");
}

export function isIcaOnField(state: {
	icaOnField?: boolean;
}): boolean {
	return state.icaOnField ?? false;
}

/** 在 states 中找风堇 */
export function findHyacineState(
	states: HyacineActionState[],
): HyacineActionState | undefined {
	return states.find((s) => hasHyacineIca(s.character.name));
}

// ── 召唤 Ica ──

export function summonIca(
	state: HyacineActionState,
) {
	state.icaOnField = true;
}

// ── Ica 死亡 ──

export function killIca(
	states: HyacineActionState[],
	actionValue: number,
) {
	const hyacine = findHyacineState(states);
	if (!hyacine || !hyacine.icaOnField) return;

	hyacine.icaOnField = false;
	hyacine.afterRain = 0;

	// 风堇 30% 自拉条，不超过 Ica 死亡时的 AV
	const advance = 3000 / hyacine.currentSpeed;
	hyacine.nextActionValue = Math.max(
		actionValue,
		hyacine.nextActionValue - advance,
	);
}

export function createIcaAction(
	characterId: string,
	sourceKey: string,
	actionValue: number,
): GeneratedAction {
	return {
		key: `${sourceKey}-ica`,
		characterId: `${characterId}-ica`,
		displayName: "小伊卡",
		targetKind: "忆灵",
		actionNo: 0,
		actionValue,
		skill: "A" as SkillCode,
		speed: 0,
		isMemospriteAction: true,
		memospriteOwnerId: characterId,
		isIcaAction: true,
		lockedSkill: true,
	};
}

// ── Q 处理 ──

/** 风堇 Q：若 Ica 不在场则召唤，afterRain 直接设为 3，并触发一次不消耗层数的 Ica 额外回合 */
export function handleHyacineQ(
	states: HyacineActionState[],
	characterId: string,
) {
	const hyacine = states.find((s) => s.character.id === characterId);
	if (!hyacine || !hasHyacineIca(hyacine.character.name)) return;

	// Q 也可召唤 Ica
	if (!hyacine.icaOnField) {
		summonIca(hyacine);
	}
	hyacine.afterRain = 3;
}

/** 风堇 A/E 后：若 afterRain > 0 且 Ica 在场，触发 Ica 额外回合并消耗 1 层 */
export function triggerIcaExtraTurn(
	states: HyacineActionState[],
	characterId: string,
) {
	const hyacine = states.find((s) => s.character.id === characterId);
	if (!hyacine || !hasHyacineIca(hyacine.character.name)) return;
	if (!hyacine.icaOnField) return;
	if ((hyacine.afterRain ?? 0) <= 0) return;

	hyacine.afterRain = (hyacine.afterRain ?? 1) - 1;
}

// ── E2 全队加速 ──

/** 应用风堇 E2 全队速度加成（各自 baseSpeed × 30%，不可叠加） */
export function applyHyacineE2SpeedBuff(
	states: HyacineActionState[],
) {
	const hyacine = findHyacineState(states);
	if (!hyacine || hyacine.character.eidolon < 2) return;
	if ((hyacine.hyacineE2SpeedBonus ?? 0) > 0) return; // 已应用，不可叠加

	for (const state of states) {
		const kind = state.character.kind;
		if (kind !== "角色" && kind !== "忆灵") continue;
		const v0 =
			toPositiveNumber(state.character.baseSpeed, 0) > 0
				? toPositiveNumber(state.character.baseSpeed, 100)
				: state.baseSpeed;
		const bonus = v0 * 0.3;
		const oldSpeed = state.currentSpeed;
		state.currentSpeed += bonus;
		if (oldSpeed > 0 && state.nextActionValue > 0) {
			state.nextActionValue =
				state.nextActionValue * (oldSpeed / state.currentSpeed);
		}
	}
	hyacine.hyacineE2SpeedBonus = 1; // 标记已应用
}

