import { hasPassive, hasSkillEffect } from "../data/characters";
import { summonGarmentmakerState } from "../mechanics/aglaeaGarmentmaker";
import { clampArcherFuaCharge, hasArcher } from "../mechanics/archer";
import { getGilgameshBaseSpeed, hasGilgamesh } from "../mechanics/gilgamesh";
import {
	applyCastoriceE2Pull,
	hasCastoriceSummon,
	summonPollux,
} from "../mechanics/castoricePollux";
import {
	hasDanHengSouldragon,
	summonSouldragonState,
} from "../mechanics/danHengSouldragon";
import { hasEvernightEvey, summonEveyState } from "../mechanics/evernightEvey";
import { applyHyacineE2SpeedBuff } from "../mechanics/hyacineIca";
import {
	type CharacterConfig,
	getCharacterCid,
	getCharacterPath,
	isCharacterTarget,
	toPositiveNumber,
} from "../utils/actionSequence";
import type { ActionState, SimulateActionsInput } from "./types";

/** 根据角色配置构建初始行动状态。 */
export function buildInitialStates(
	characters: CharacterConfig[],
): ActionState[] {
	return characters
		.filter((c) => toPositiveNumber(c.speed, 0) > 0)
		.map((character) => {
			const speed = toPositiveNumber(character.speed, 0);
			let advancePct = 0;
			if (isCharacterTarget(character) && character.hasVonwacq)
				advancePct += 0.4;
			if (hasPassive(character.name, "firstActionAdvance25"))
				advancePct += 0.25;
			if (hasPassive(character.name, "firstActionAdvance30")) advancePct += 0.3;
			if (hasPassive(character.name, "firstActionAdvance40")) advancePct += 0.4;
			const firstActionValue = (10000 * (1 - advancePct)) / speed;

			return {
				character,
				baseSpeed: hasGilgamesh(character)
					? getGilgameshBaseSpeed(character)
					:
					toPositiveNumber(character.baseSpeed, 0) > 0
						? toPositiveNumber(character.baseSpeed, speed)
						: hasSkillEffect(character.name, "W", "counterW")
							? character.lc_id === 23044
								? character.superimpose > 0
									? 104 + 2 * character.superimpose
									: 94
								: 94
							: speed,
				currentSpeed: speed,
				phainonDomainSpeedBonus: 0,
				actionNo: 1,
				nextActionValue: firstActionValue,
				blockNextAdvance: false,
				archerFuaCharge: hasArcher(character)
					? clampArcherFuaCharge(isTechniqueOn(character) ? 2 : 1)
					: undefined,
				gilgameshInterest: hasGilgamesh(character)
					? (character.eidolon >= 2 ? 5 : 0) +
						(isTechniqueOn(character) ? 3 : 0)
					: undefined,
				gilgameshEUnlocked: hasGilgamesh(character) ? false : undefined,
				gilgameshAttackCount: hasGilgamesh(character) ? 0 : undefined,
			};
		});
}

export type SouldragonSetup = {
	souldragonOwner: ActionState | undefined;
	currentBondmateTarget: string | null;
};

/** 初始化龙灵同袍并在已选择目标时召唤龙灵。 */
export function setupSouldragonBondmate(
	states: ActionState[],
	input: SimulateActionsInput,
): SouldragonSetup {
	const souldragonOwner = states.find(
		(state) =>
			isCharacterTarget(state.character) &&
			hasDanHengSouldragon(state.character.name),
	);
	const currentBondmateTarget = input.characters.some(
		(character) =>
			character.id === input.bondmateTarget && character.kind === "角色",
	)
		? (input.bondmateTarget ?? null)
		: null;
	if (souldragonOwner && currentBondmateTarget) {
		summonSouldragonState(
			states,
			souldragonOwner.character,
			0,
			currentBondmateTarget,
		);
	}
	return { souldragonOwner, currentBondmateTarget };
}

/** 根据欢愉角色的当前速度计算阿哈时刻速度。 */
export function calcAhaSpeedFromStates(elationStates: ActionState[]): number {
	const speeds = elationStates.map((s) => s.currentSpeed).sort((a, b) => b - a);
	const [v1 = 0, v2 = 0, v3 = 0, v4 = 0] = speeds;
	return v1 * 0.2 + v2 * 0.1 + v3 * 0.05 + v4 * 0.025 + 80;
}

export type AhaState = {
	ahaState: ActionState | null;
	elationStates: ActionState[];
	calcAhaSpeed: () => number;
	refreshAhaSchedule: (currentActionValue: number) => void;
};

/** 队伍含欢愉角色时初始化阿哈时刻状态。 */
export function setupAhaMoment(states: ActionState[]): AhaState {
	const elationStates = states.filter(
		(s) => getCharacterPath(s.character.name) === "Elation",
	);
	const calcAhaSpeedFn = () => calcAhaSpeedFromStates(elationStates);
	let ahaState: ActionState | null = null;
	if (elationStates.length > 0 && calcAhaSpeedFn() > 0) {
		ahaState = {
			character: {
				id: "@aha",
				kind: "阿哈",
				name: "阿哈时刻",
				speed: String(calcAhaSpeedFn()),
				baseSpeed: String(calcAhaSpeedFn()),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			baseSpeed: calcAhaSpeedFn(),
			currentSpeed: calcAhaSpeedFn(),
			phainonDomainSpeedBonus: 0,
			actionNo: 1,
			nextActionValue: 10000 / calcAhaSpeedFn(),
			blockNextAdvance: false,
		};
		states.push(ahaState);
	}
	const refreshAhaScheduleFn = (currentActionValue: number) => {
		if (!ahaState) return;
		const oldSpeed = ahaState.currentSpeed;
		const nextSpeed = calcAhaSpeedFn();
		if (oldSpeed <= 0 || nextSpeed <= 0) return;
		if (ahaState.nextActionValue > currentActionValue) {
			const remaining = ahaState.nextActionValue - currentActionValue;
			ahaState.nextActionValue =
				currentActionValue + remaining * (oldSpeed / nextSpeed);
		}
		ahaState.currentSpeed = nextSpeed;
		ahaState.baseSpeed = nextSpeed;
		ahaState.character.speed = String(nextSpeed);
		ahaState.character.baseSpeed = String(nextSpeed);
	};
	return {
		ahaState,
		elationStates,
		calcAhaSpeed: calcAhaSpeedFn,
		refreshAhaSchedule: refreshAhaScheduleFn,
	};
}

/** 通用秘技开关（兼容旧字段 hasCastoriceTechnique / hasAglaeaTechnique）。 */
function isTechniqueOn(character: CharacterConfig): boolean {
	return (
		character.techniqueOn ??
		character.hasCastoriceTechnique ??
		character.hasAglaeaTechnique ??
		false
	);
}

/** 在 AV=0 应用秘技召唤：遐蝶 → 死龙，阿格莱雅 → 衣匠，长夜月 → 长夜（无需开关）。 */
export function applyTechniqueSummons(states: ActionState[]): void {
	for (const state of [...states]) {
		if (
			isCharacterTarget(state.character) &&
			hasCastoriceSummon(state.character.name) &&
			isTechniqueOn(state.character) &&
			!state.polluxOnField
		) {
			summonPollux(states, state.character, 0, { sameActionPriority: -1 });
			if (state.character.eidolon >= 2) {
				const castoriceIndex = states.findIndex(
					(candidate) => candidate.character.id === state.character.id,
				);
				if (castoriceIndex >= 0) {
					applyCastoriceE2Pull(states, castoriceIndex, 0);
				}
			}
		}
		if (
			isCharacterTarget(state.character) &&
			hasSkillEffect(state.character.name, "E", "summonGarmentmaker") &&
			isTechniqueOn(state.character) &&
			!states.some(
				(candidate) =>
					candidate.isGarmentmakerState &&
					candidate.garmentmakerOwnerId === state.character.id,
			)
		) {
			summonGarmentmakerState(states, state.character, 0);
		}
		if (
			isCharacterTarget(state.character) &&
			hasEvernightEvey(state.character.name) &&
			!state.eveyOnField
		) {
			summonEveyState(states, state.character, 0, {
				immediate: true,
				sameActionPriority: -2,
			});
		}
	}
}

/** 应用藿藿、军功、大丽花和风堇的开场速度加成。 */
export function applyTeamSpeedBuffs(
	states: ActionState[],
	input: SimulateActionsInput,
	refreshAhaSchedule: (v: number) => void,
): void {
	// 藿藿 1 魂：全队加速 12%
	const huohuoState = states.find(
		(s) =>
			getCharacterPath(s.character.name) === "Abundance" &&
			s.character.eidolon >= 1 &&
			hasPassive(s.character.name, "teamSpeedBuff12"),
	);
	if (huohuoState) {
		for (const s of states) {
			if (s.character.kind === "角色") {
				const v0 =
					toPositiveNumber(s.character.baseSpeed, 0) > 0
						? toPositiveNumber(s.character.baseSpeed, 100)
						: hasSkillEffect(s.character.name, "W", "counterW")
							? s.baseSpeed
							: 100;
				const oldSpeed = s.currentSpeed;
				s.currentSpeed = s.currentSpeed + v0 * 0.12;
				s.nextActionValue = s.nextActionValue * (oldSpeed / s.currentSpeed);
			}
		}
	}
	refreshAhaSchedule(0);

	// 刻律 军功：刻律和军功目标加速 20%
	if (input.meritTarget) {
		const meritOwner = states.find((s) =>
			hasPassive(s.character.name, "meritSpeedBuff20"),
		);
		if (meritOwner) {
			for (const s of states) {
				if (
					s.character.id === meritOwner.character.id ||
					s.character.id === input.meritTarget
				) {
					const v0_merit =
						toPositiveNumber(s.character.baseSpeed, 0) > 0
							? toPositiveNumber(s.character.baseSpeed, 100)
							: hasSkillEffect(s.character.name, "W", "counterW")
								? s.baseSpeed
								: 100;
					const oldSpeed = s.currentSpeed;
					s.currentSpeed = s.currentSpeed + v0_merit * 0.2;
					s.nextActionValue = s.nextActionValue * (oldSpeed / s.currentSpeed);
				}
			}
		}
	}
	refreshAhaSchedule(0);

	// 大丽花 共舞者
	if (input.dancePartner) {
		const dahliaState = states.find((s) =>
			hasPassive(s.character.name, "dancePartnerSpeedBuff30"),
		);
		if (dahliaState) {
			const dancePartnerCidWhitelist = new Set([
				"1405",
				"1315",
				"1310",
				"1408",
			]);
			const partner = states.find((s) => s.character.id === input.dancePartner);
			const partnerCid = partner
				? getCharacterCid(partner.character.name)
				: undefined;
			if (
				partner &&
				partnerCid !== undefined &&
				dancePartnerCidWhitelist.has(partnerCid)
			) {
				const v0_dahlia =
					toPositiveNumber(partner.character.baseSpeed, 0) > 0
						? toPositiveNumber(partner.character.baseSpeed, 100)
						: hasSkillEffect(partner.character.name, "W", "counterW")
							? partner.baseSpeed
							: 100;
				const oldSpeed = partner.currentSpeed;
				partner.currentSpeed = partner.currentSpeed + v0_dahlia * 0.3;
				partner.nextActionValue =
					partner.nextActionValue * (oldSpeed / partner.currentSpeed);
			}
		}
	}
	refreshAhaSchedule(0);

	// 风堇 E2：全队速度 +30%
	if (input.hyacineE2Active) {
		applyHyacineE2SpeedBuff(states);
	}
	refreshAhaSchedule(0);
}

/** 创建仅在 AV=0 行动一次的倒计时哨兵。 */
export function createAv0State(): ActionState {
	return {
		character: {
			id: "@av0",
			kind: "倒计时",
			name: "0行动值",
			speed: "1",
			baseSpeed: "1",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		},
		baseSpeed: 1,
		currentSpeed: 1,
		phainonDomainSpeedBonus: 0,
		actionNo: 1,
		nextActionValue: 0,
		blockNextAdvance: true,
	};
}
