import {
	handleAglaeaCountdownAction,
	isAglaeaCountdownAction,
} from "../mechanics/aglaeaGarmentmaker";
import { handlePolluxAction } from "../mechanics/castoricePollux";
import { emitSouldragonAction } from "../mechanics/danHengSouldragon";
import { handleEveyAction } from "../mechanics/evernightEvey";
import {
	handleFireflyCountdownAction,
	isFireflyCountdownAction,
} from "../mechanics/fireflyCombustion";
import type { GeneratedAction, SkillCode } from "../utils/actionSequence";
import { emitMemeAdvanceAction } from "./effects";
import type {
	ActionState,
	ActiveOdeState,
	SimulateActionsInput,
} from "./types";

export type SpecialActionCallbacks = {
	emitGodmodeExtraAction: (sourceKey: string, actionValue: number) => void;
	emitSpecialInterruptAction: (
		interruptKey: string,
		interrupt: { casterId: string; timing: "before" | "after" },
		actionValue: number,
		qIsFront?: boolean,
	) => void;
	emitSparxieExtraAction: (sourceKey: string, actionValue: number) => void;
	emitEvernightSelfDestructAction: (
		sourceKey: string,
		actionValue: number,
	) => void;
};

/** 处理不走普通角色技能状态机的特殊实体行动。 */
export function handleSpecialAction({
	input,
	states,
	actions,
	activeOdes,
	stateIndex,
	key,
	actionValue,
	character,
	actionNo,
	calcAhaSpeed,
	callbacks,
}: {
	input: SimulateActionsInput;
	states: ActionState[];
	actions: GeneratedAction[];
	activeOdes: Map<string, ActiveOdeState[]>;
	stateIndex: number;
	key: string;
	actionValue: number;
	character: ActionState["character"];
	actionNo: number;
	calcAhaSpeed: () => number;
	callbacks: SpecialActionCallbacks;
}): boolean {
	const {
		emitGodmodeExtraAction,
		emitSpecialInterruptAction,
		emitSparxieExtraAction,
		emitEvernightSelfDestructAction,
	} = callbacks;
	// ── 0 行动值：仅在 AV=0 行动一次后移除 ──
	if (character.id === "@av0") {
		const av0Interrupts = input.ultInterrupts[key] ?? [];
		for (let ai = 0; ai < av0Interrupts.length; ai++) {
			const int = av0Interrupts[ai];
			if (int.timing !== "before") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		actions.push({
			key,
			characterId: character.id,
			displayName: "0行动值",
			actionNo: 0,
			actionValue,
			skill: "" as SkillCode,
			speed: 1,
		});
		for (let ai = 0; ai < av0Interrupts.length; ai++) {
			const int = av0Interrupts[ai];
			if (int.timing !== "after") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		states.splice(stateIndex, 1);
		return true;
	}

	// ── 阿哈时刻：欢愉角色存在时生成独立轴 ──
	if (character.id === "@aha") {
		const ahaSpeed = calcAhaSpeed();
		states[stateIndex].currentSpeed = ahaSpeed;
		actions.push({
			key,
			characterId: "@aha",
			displayName: "阿哈时刻",
			actionNo,
			actionValue,
			skill: "" as SkillCode,
			speed: ahaSpeed,
			isAhaInstant: true,
		});
		// 阿哈时刻支持 after 插队（不支持 before），必须复用统一 Q 处理以结算角色效果。
		const ahaInterrupts = input.ultInterrupts[key] ?? [];
		for (let ai = 0; ai < ahaInterrupts.length; ai++) {
			const int = ahaInterrupts[ai];
			if (int.timing !== "after") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		// 银狼 E2：无敌玩家状态下，阿哈行动后可插入额外 A
		emitGodmodeExtraAction(key, actionValue);
		emitSparxieExtraAction(key, actionValue);
		states[stateIndex].actionNo += 1;
		states[stateIndex].nextActionValue = actionValue + 10000 / ahaSpeed;
		return true;
	}

	if (states[stateIndex].isSouldragonAction) {
		const souldragonInterrupts = input.ultInterrupts[key] ?? [];
		for (let ai = 0; ai < souldragonInterrupts.length; ai++) {
			const int = souldragonInterrupts[ai];
			if (int.timing !== "before") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		emitSouldragonAction(states[stateIndex], actions, actionValue, key);
		emitMemeAdvanceAction({
			input,
			actions,
			states,
			sourceKey: key,
			actionValue,
			activeOdes,
		});
		for (let ai = 0; ai < souldragonInterrupts.length; ai++) {
			const int = souldragonInterrupts[ai];
			if (int.timing !== "after") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		return true;
	}

	// ── 流萤完全燃烧倒计时行动 ──
	if (isFireflyCountdownAction(states[stateIndex])) {
		handleFireflyCountdownAction(
			states,
			stateIndex,
			actions,
			key,
			character,
			actionNo,
			actionValue,
		);
		return true;
	}

	// ── 阿格莱雅至高之姿倒计时：倒计时行动时衣匠离场 ──
	if (isAglaeaCountdownAction(states[stateIndex])) {
		handleAglaeaCountdownAction(
			states,
			stateIndex,
			actions,
			key,
			character,
			actionNo,
			actionValue,
		);
		return true;
	}

	// ── 死龙行动 ──
	if (states[stateIndex].isPolluxAction) {
		const polluxInterrupts = input.ultInterrupts[key] ?? [];
		for (let ai = 0; ai < polluxInterrupts.length; ai++) {
			const int = polluxInterrupts[ai];
			if (int.timing !== "before") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		const polluxOverride = input.skillOverrides[key];
		const resolvedOverridePollux = (
			polluxOverride !== undefined ? polluxOverride : ""
		) as SkillCode;
		handlePolluxAction(
			states,
			stateIndex,
			actions,
			key,
			character,
			actionNo,
			actionValue,
			resolvedOverridePollux as SkillCode,
			input.castoriceKillToggles?.[key] ?? false,
		);
		emitMemeAdvanceAction({
			input,
			actions,
			states,
			sourceKey: key,
			actionValue,
			activeOdes,
		});
		for (let ai = 0; ai < polluxInterrupts.length; ai++) {
			const int = polluxInterrupts[ai];
			if (int.timing !== "after") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		emitEvernightSelfDestructAction(key, actionValue);
		return true;
	}

	if (states[stateIndex].isEveyAction) {
		const eveyInterrupts = input.ultInterrupts[key] ?? [];
		for (let ai = 0; ai < eveyInterrupts.length; ai++) {
			const int = eveyInterrupts[ai];
			if (int.timing !== "before") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		handleEveyAction(
			states,
			stateIndex,
			actions,
			key,
			actionValue,
			(input.skillOverrides[key] ?? "") as SkillCode,
			{
				resourceValue: input.resourceValues?.[key]?.忆质,
			},
		);
		emitMemeAdvanceAction({
			input,
			actions,
			states,
			sourceKey: key,
			actionValue,
			activeOdes,
		});
		for (let ai = 0; ai < eveyInterrupts.length; ai++) {
			const int = eveyInterrupts[ai];
			if (int.timing !== "after") continue;
			emitSpecialInterruptAction(`${key}-interrupt-${ai}`, int, actionValue);
		}
		emitEvernightSelfDestructAction(key, actionValue);
		return true;
	}

	return false;
}
