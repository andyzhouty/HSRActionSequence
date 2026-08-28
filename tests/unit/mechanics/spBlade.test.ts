import { describe, expect, it } from "vitest";
import {
	flushSpBladeExtraTurn,
	handleSpBladeRecordedAction,
	isSpBladeAttack,
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
	it("开大前的攻击不叠层，Q 开启无量忿怒并生成倒计时", () => {
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
			spBladeStacks: 8,
		});
		expect(
			actions.find((action) => action.key === "blade-1-q-sp-blade-extra"),
		).toBeUndefined();
		expect(actions.some((action) => action.isSpBladeCountdownAction)).toBe(
			true,
		);
	});

	it("无量忿怒期间的攻击叠层并按 E2 阈值生成额外回合", () => {
		const base = input({
			characters: [
				{ ...character("blade", "千冶·刃", 300), eidolon: 2 },
				character("ally", "停云", 100),
			],
			resourceValues: { "blade-1": { [spBladeStackResourceName]: "6" } },
			skillOverrides: skills({ "blade-1": "AQ" }),
			overrides: { "ally-1": "50" },
			limit: 60,
		});
		const actions = simulateActions(base);
		expect(actions.find((action) => action.key === "ally-1")).toMatchObject({
			spBladeStacks: 7,
		});
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					key: "ally-1-sp-blade-extra",
					isSpBladeExtraAction: true,
				}),
			]),
		);
		expect(
			simulateActions({
				...base,
				spBladeExtraTurnToggles: { "ally-1": false },
			}).some((action) => action.isSpBladeExtraAction),
		).toBe(false);
	});

	it("手动输入的 SP 刃层数表示当前行动结束后的最终值", () => {
		const blade = actionState(
			character("blade", "千冶·刃", 100, { eidolon: 2 }),
		);
		blade.spBladeInfiniteFury = true;
		blade.spBladeStacks = 4;
		const action: GeneratedAction = {
			key: "ally-1",
			characterId: "ally",
			actionNo: 1,
			actionValue: 50,
			skill: "A",
			speed: 100,
		};
		const ally = character("ally", "停云", 100);

		handleSpBladeRecordedAction({
			state: blade,
			action,
			attacker: ally,
			states: [blade],
			actions: [],
			input: input({
				characters: [blade.character, ally],
				resourceValues: {
					[action.key]: { [spBladeStackResourceName]: "6" },
				},
			}),
			isForcedAttack: false,
		});

		expect(blade.spBladeStacks).toBe(6);
		expect(action.spBladeStacks).toBe(6);
	});

	it("男性记忆主的普攻同样会触发史诗额外叠层", () => {
		const blade = actionState(character("blade", "千冶·刃", 100));
		blade.spBladeInfiniteFury = true;
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

	it("阿哈空技能不叠层", () => {
		const blade = actionState(character("blade", "千冶·刃", 100));
		blade.spBladeInfiniteFury = true;
		const ahaAction: GeneratedAction = {
			key: "@aha-1",
			characterId: "@aha",
			actionNo: 1,
			actionValue: 50,
			skill: "",
			speed: 100,
			isAhaInstant: true,
		};

		expect(
			isSpBladeAttack({
				action: ahaAction,
				attacker: undefined,
				attackDisabled: {},
				isForcedAttack: true,
			}),
		).toBe(false);

		handleSpBladeRecordedAction({
			state: blade,
			action: ahaAction,
			attacker: undefined,
			states: [blade],
			actions: [],
			input: input({ characters: [blade.character] }),
			isForcedAttack: true,
		});

		expect(blade.spBladeStacks).toBe(0);
	});

	it("银狼非无敌状态的欢愉技不叠层", () => {
		const blade = actionState(character("blade", "千冶·刃", 100));
		blade.spBladeInfiniteFury = true;
		const silverWolf = character("sw", "银狼LV.999", 100);
		const action: GeneratedAction = {
			key: "@aha-1-elation-sw",
			characterId: "sw",
			actionNo: 0,
			actionValue: 50,
			skill: "ES",
			speed: 0,
			isElationSkill: true,
			elationSkillParentKey: "@aha-1",
		};

		handleSpBladeRecordedAction({
			state: blade,
			action,
			attacker: silverWolf,
			states: [blade],
			actions: [
				{
					key: "@aha-1",
					characterId: "@aha",
					actionNo: 1,
					actionValue: 50,
					skill: "",
					speed: 100,
					isAhaInstant: true,
				},
				action,
			],
			input: input({ characters: [blade.character, silverWolf] }),
			isForcedAttack: false,
			isSilverWolfNonAttack: true,
		});

		expect(blade.spBladeStacks).toBe(0);
	});

	it("阿哈欢愉技期间达到阈值后延后释放额外 E", () => {
		const blade = actionState(
			character("blade", "千冶·刃", 100, { eidolon: 2 }),
		);
		blade.spBladeInfiniteFury = true;
		blade.spBladeStacks = 6;
		const elationAction: GeneratedAction = {
			key: "@aha-1-elation-yaoguang",
			characterId: "yaoguang",
			actionNo: 0,
			actionValue: 50,
			skill: "ES",
			speed: 0,
			isElationSkill: true,
			elationSkillParentKey: "@aha-1",
		};
		const actions: GeneratedAction[] = [
			{
				key: "@aha-1",
				characterId: "@aha",
				actionNo: 1,
				actionValue: 50,
				skill: "",
				speed: 100,
				isAhaInstant: true,
			},
			elationAction,
		];

		handleSpBladeRecordedAction({
			state: blade,
			action: elationAction,
			attacker: character("yaoguang", "爻光", 100),
			states: [blade],
			actions,
			input: input({ characters: [blade.character] }),
			isForcedAttack: false,
		});

		expect(blade.spBladeStacks).toBe(7);
		expect(actions).toHaveLength(2);

		flushSpBladeExtraTurn({
			owner: blade,
			actions,
			input: input({ characters: [blade.character] }),
			states: [blade],
		});

		expect(actions[2]).toMatchObject({
			key: "@aha-1-elation-yaoguang-sp-blade-extra",
			isSpBladeExtraAction: true,
		});
		handleSpBladeRecordedAction({
			state: blade,
			action: actions[2],
			attacker: blade.character,
			states: [blade],
			actions,
			input: input({ characters: [blade.character] }),
			isForcedAttack: true,
		});
		expect(blade.spBladeStacks).toBe(1);
	});
});
