import { hasSkillEffect } from "../data/characters";
import type { SimulationRuntime } from "../simulate/runtime";
import type {
	CharacterConfig,
	GeneratedAction,
	SkillCode,
} from "../utils/action-sequence";
import { isCharacterTarget } from "../utils/action-sequence";

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
	/** 晴空乐手忆灵速度由 SP Robin 派生，不吃直接百分比加速。 */
	isSongbirdsAction?: boolean;
}

// ── 判断 ──

export function hasHyacineIca(characterName: string): boolean {
	return hasSkillEffect(characterName, "E", "summonIca");
}

export function isIcaOnField(state: { icaOnField?: boolean }): boolean {
	return state.icaOnField ?? false;
}

/** 在 states 中找风堇 */
export function findHyacineState(
	states: HyacineActionState[],
): HyacineActionState | undefined {
	return states.find((s) => hasHyacineIca(s.character.name));
}

// ── 召唤 Ica ──

export function summonIca(state: HyacineActionState) {
	state.icaOnField = true;
}

// ── Ica 死亡 ──

export function killIca(states: HyacineActionState[], actionValue: number) {
	const hyacine = findHyacineState(states);
	if (!hyacine?.icaOnField) return;

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
export function applyHyacineE2SpeedBuff(states: HyacineActionState[]) {
	const hyacine = findHyacineState(states);
	if (!hyacine || hyacine.character.eidolon < 2) return;
	if ((hyacine.hyacineE2SpeedBonus ?? 0) > 0) return; // 已应用，不可叠加

	for (const state of states) {
		const kind = state.character.kind;
		if (kind !== "角色" && kind !== "忆灵") continue;
		// 晴空乐手速度由 SP Robin 的百分比增益比例派生，不直接叠加。
		if (state.isSongbirdsAction) continue;
		const bonus = state.baseSpeed * 0.3;
		const oldSpeed = state.currentSpeed;
		state.currentSpeed += bonus;
		if (oldSpeed > 0 && state.nextActionValue > 0) {
			state.nextActionValue =
				state.nextActionValue * (oldSpeed / state.currentSpeed);
		}
	}
	hyacine.hyacineE2SpeedBonus = 1; // 标记已应用
}

/**
 * 为战斗中后续召唤的忆灵补上已启用的风堇 E2 速度加成。
 * 召唤物可能在开场团队加速结算之后才入场，因此不能只依赖初始全队遍历。
 */
export function applyActiveHyacineE2SpeedBuffToSummon(
	states: HyacineActionState[],
	summon: HyacineActionState,
	actionValue: number,
): void {
	const hyacine = findHyacineState(states);
	if (
		!hyacine ||
		(hyacine.hyacineE2SpeedBonus ?? 0) <= 0 ||
		summon.character.kind !== "忆灵" ||
		summon.isSongbirdsAction
	)
		return;
	const oldSpeed = summon.currentSpeed;
	if (oldSpeed <= 0) return;
	summon.currentSpeed += summon.baseSpeed * 0.3;
	const remaining = Math.max(0, summon.nextActionValue - actionValue);
	summon.nextActionValue =
		actionValue + remaining * (oldSpeed / summon.currentSpeed);
}

type HyacineNormalActionParams = {
	runtime: SimulationRuntime;
	stateIndex: number;
	key: string;
	character: CharacterConfig;
	actionValue: number;
	resolvedSkill: SkillCode;
	normalUsesUltimate: boolean;
	usesUltimate: boolean;
	qIsFront: boolean;
};

/** 风堇的 Ica 召唤、雨幕与额外行动均在主行动后按固定顺序结算。 */
export function handleHyacineNormalAction({
	runtime,
	stateIndex,
	key,
	character,
	actionValue,
	resolvedSkill,
	normalUsesUltimate,
	usesUltimate,
	qIsFront,
}: HyacineNormalActionParams) {
	if (!isCharacterTarget(character) || !hasHyacineIca(character.name)) return;
	const { input, states, actions } = runtime;
	const emitIcaAction = (sourceKey: string, parentKey: string) => {
		const configured = input.ultInterrupts[sourceKey] ?? [];
		for (let index = 0; index < configured.length; index++) {
			const interrupt = configured[index];
			if (interrupt.timing === "before")
				runtime.callbacks.emitSpecialInterruptAction(
					`${sourceKey}-interrupt-${index}`,
					interrupt,
					actionValue,
				);
		}
		actions.push(createIcaAction(character.id, parentKey, actionValue));
		for (let index = 0; index < configured.length; index++) {
			const interrupt = configured[index];
			if (interrupt.timing === "after")
				runtime.callbacks.emitSpecialInterruptAction(
					`${sourceKey}-interrupt-${index}`,
					interrupt,
					actionValue,
				);
		}
	};
	if (normalUsesUltimate) {
		handleHyacineQ(states, character.id);
		emitIcaAction(`${key}-q-ica`, `${key}-q`);
	}
	if (resolvedSkill.includes("E") && !states[stateIndex].icaOnField)
		summonIca(states[stateIndex]);
	if (
		(resolvedSkill === "" ||
			resolvedSkill === "A" ||
			resolvedSkill.includes("E")) &&
		(!usesUltimate || qIsFront)
	) {
		const beforeRain = states[stateIndex].afterRain ?? 0;
		triggerIcaExtraTurn(states, character.id);
		if ((states[stateIndex].afterRain ?? 0) < beforeRain)
			emitIcaAction(`${key}-ica`, key);
	}
}
