import { getCharacterBaseSpeed, getCharacterPath } from "../data/characters";
import type { ActionState } from "../simulate/types";
import {
	type CharacterConfig,
	toPositiveNumber,
} from "../utils/action-sequence";
import { hasSpRobin, syncSpRobinSongbirds } from "./spRobin";

// ── 光锥效果（按光锥 ID 集中维护，不写入角色机制文件）──

/** 黎明恰如此燃烧（毁灭）：提供额外基础速度（10 + 2×叠影）。 */
export const dawnAsBurningFlamesLightConeId = 23044;
/** 将光阴织成黄金（记忆）：提供额外基础速度（10 + 2×叠影）。 */
export const memoryWeavingGoldenLightConeId = 23036;

/** 你将起身歌唱（记忆）：进战装备者行动提前 40%；全队速度 +20% 持续 2 回合。 */
export const ENTRY_LIGHTCONE_ID = 23063;
export const ENTRY_ADVANCE_PCT = 0.4;
export const ENTRY_SPEED_BUFF_PCT = 0.2;
export const ENTRY_SPEED_BUFF_TURNS = 2;

/** 向浪花掷下盛夏（欢愉）：装备者施放欢愉技时速度提高 20%（基于基础速度，一次性）。 */
export const ELATION_LIGHTCONE_ID = 23064;
export const ELATION_LIGHTCONE_SPEED_PCT = 0.2;

/** 角色基础速度，优先使用角色数据；仅未登记的运行时实体回退其自身字段。 */
export function getCharacterBaseSpeedValue(character: CharacterConfig): number {
	const configured = getCharacterBaseSpeed(character.name);
	if (configured !== undefined) return configured;
	return (
		toPositiveNumber(character.baseSpeed, 0) ||
		toPositiveNumber(character.speed, 0)
	);
}

/** 两种指定光锥均提供 10 + 2×叠影 的基础速度。 */
export function getEffectiveCharacterBaseSpeed(
	character: CharacterConfig,
): number {
	const baseSpeed = getCharacterBaseSpeedValue(character);
	const path = getCharacterPath(character.name);
	const bonus = 10 + 2 * Math.max(0, character.superimpose);
	if (
		(character.lc_id === dawnAsBurningFlamesLightConeId &&
			path === "Destruction") ||
		(character.lc_id === memoryWeavingGoldenLightConeId &&
			path === "Remembrance")
	)
		return baseSpeed + bonus;
	return baseSpeed;
}

export function hasEntryLightcone(characters: CharacterConfig[]): boolean {
	return characters.some((c) => c.lc_id === ENTRY_LIGHTCONE_ID);
}

/** 进战全队速度 +20%，各目标自己计 2 个正常回合。 */
export function applyEntrySpeedBuff(
	states: ActionState[],
	actionValue: number,
): void {
	for (const state of states) {
		if (state.isSongbirdsAction) continue;
		if (state.character.kind !== "角色" && state.character.kind !== "忆灵")
			continue;
		const oldSpeed = state.currentSpeed;
		state.currentSpeed += state.baseSpeed * ENTRY_SPEED_BUFF_PCT;
		state.entrySpeedBuffTurns = ENTRY_SPEED_BUFF_TURNS;
		if (oldSpeed > 0 && state.nextActionValue > 0) {
			state.nextActionValue =
				state.nextActionValue * (oldSpeed / state.currentSpeed);
		}
	}
	for (const state of states) {
		if (state.character.kind === "角色" && hasSpRobin(state.character)) {
			state.spRobinMemospritePercentBuff =
				(state.spRobinMemospritePercentBuff ?? 0) + ENTRY_SPEED_BUFF_PCT;
			syncSpRobinSongbirds(states, state, actionValue);
		}
	}
}

/** 角色每个正常回合结束后递减；归零时移除 +20% 并重排已排定的下一动。 */
export function consumeEntrySpeedBuff(
	states: ActionState[],
	stateIndex: number,
	actionValue: number,
): void {
	const state = states[stateIndex];
	if ((state.entrySpeedBuffTurns ?? 0) <= 0) return;
	state.entrySpeedBuffTurns = (state.entrySpeedBuffTurns ?? 0) - 1;
	if (state.entrySpeedBuffTurns > 0) return;
	const oldSpeed = state.currentSpeed;
	const nextSpeed = Math.max(
		0.001,
		state.currentSpeed - state.baseSpeed * ENTRY_SPEED_BUFF_PCT,
	);
	state.currentSpeed = nextSpeed;
	if (oldSpeed > 0 && state.nextActionValue > actionValue) {
		const remainingDistance = (state.nextActionValue - actionValue) * oldSpeed;
		state.nextActionValue = actionValue + remainingDistance / nextSpeed;
	} else {
		state.nextActionValue = actionValue + 10000 / nextSpeed;
	}
	if (state.character.kind === "角色" && hasSpRobin(state.character)) {
		state.spRobinMemospritePercentBuff = Math.max(
			0,
			(state.spRobinMemospritePercentBuff ?? 0) - ENTRY_SPEED_BUFF_PCT,
		);
		syncSpRobinSongbirds(states, state, actionValue);
	}
}

/** 光锥 23064：装备者施放欢愉技后的一次性 +20% 速度（基于基础速度）。 */
export function applyElationLightconeSpeedBuff(
	state: ActionState,
	actionValue: number,
): void {
	if (state.elationLightconeSpeedBuffed) return;
	const oldSpeed = state.currentSpeed;
	const nextSpeed = oldSpeed + state.baseSpeed * ELATION_LIGHTCONE_SPEED_PCT;
	if (nextSpeed <= 0) return;
	const remaining = state.nextActionValue - actionValue;
	if (remaining > 0) {
		state.nextActionValue = actionValue + remaining * (oldSpeed / nextSpeed);
	}
	state.currentSpeed = nextSpeed;
	state.elationLightconeSpeedBuffed = true;
}
