import { describe, expect, it } from "vitest";
import {
	handleSpBladeRecordedAction,
	spBladeStackResourceName,
} from "../../../src/mechanics/spBlade";
import { simulateActions } from "../../../src/simulate/actions";
import type { ActionState } from "../../../src/simulate/types";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../../../src/utils/action-sequence";
import {
	character,
	input,
	skills,
} from "../../helpers/simulateActionTestUtils";

function actionState(characterConfig: CharacterConfig): ActionState {
	return {
		character: characterConfig,
		baseSpeed: Number(characterConfig.baseSpeed),
		currentSpeed: Number(characterConfig.speed),
		nextActionValue: 0,
		actionNo: 1,
		blockNextAdvance: false,
		phainonDomainSpeedBonus: 0,
	};
}

describe("千冶·刃", () => {
	it("Q 开启无量忿怒、生成 70 速倒计时，并在阈值生成锁定 E", () => {
		const actions = simulateActions(
			input({
				characters: [character("blade", "千冶·刃", 100)],
				skillOverrides: skills({ "blade-1": "EQ" }),
				resourceValues: { "blade-1": { [spBladeStackResourceName]: "8" } },
				limit: 300,
			}),
		);
		expect(actions.find((action) => action.key === "blade-1-q")).toMatchObject({
			isSpBladeFuryActivation: true,
			spBladeStacks: 9,
		});
		expect(
			actions.find((action) => action.key === "blade-1-q-sp-blade-extra"),
		).toMatchObject({
			skill: "E",
			lockedSkill: true,
			isSpBladeExtraAction: true,
		});
		expect(actions.some((action) => action.isSpBladeCountdownAction)).toBe(
			true,
		);
	});

	it("E2 使用 7 层阈值，且可取消额外回合", () => {
		const base = input({
			characters: [{ ...character("blade", "千冶·刃", 100), eidolon: 2 }],
			resourceValues: { "blade-1": { [spBladeStackResourceName]: "6" } },
			skillOverrides: skills({ "blade-1": "EQ" }),
			limit: 110,
		});
		expect(
			simulateActions(base).some((action) => action.isSpBladeExtraAction),
		).toBe(true);
		expect(
			simulateActions({
				...base,
				spBladeExtraTurnToggles: { "blade-1-q": false },
			}).some((action) => action.isSpBladeExtraAction),
		).toBe(false);
	});

	it("男性记忆主的普攻同样会触发史诗额外叠层", () => {
		const blade = actionState(character("blade", "千冶·刃", 100));
		const memory = actionState(character("rmc", "开拓者·记忆（男）", 100));
		memory.epic = 1;
		memory.epicPendingA = true;
		const action: GeneratedAction = {
			key: "rmc-1",
			characterId: "rmc",
			actionNo: 1,
			actionValue: 50,
			skill: "A",
			speed: 100,
		};

		handleSpBladeRecordedAction({
			state: blade,
			action,
			attacker: memory.character,
			states: [blade, memory],
			actions: [],
			input: input({ characters: [blade.character, memory.character] }),
			isForcedAttack: false,
		});

		expect(blade.spBladeStacks).toBe(2);
	});
});
