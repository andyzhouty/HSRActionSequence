import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import {
	ashveilFuaResourceName,
	kafkaFuaResourceName,
} from "../../src/utils/actionSequence";
import { character, input, skills } from "../helpers/simulateActionTestUtils";

describe("不死途与卡芙卡追加攻击", () => {
	it("不死途以 2 层初始充能追击，且可从右键来源取消", () => {
		const base = input({
			characters: [
				character("ashveil", "不死途", 100),
				character("ally", "丹恒", 200),
			],
			limit: 60,
		});
		const actions = simulateActions(base);
		expect(
			actions.find((action) => action.key === "ally-1-ashveil-fua"),
		).toMatchObject({
			skill: "Z",
			lockedSkill: true,
			isAshveilFua: true,
		});
		expect(
			actions.find((action) => action.key === "ally-1")?.ashveilFuaCharge,
		).toBe(1);

		const cancelled = simulateActions({
			...base,
			ashveilFuaToggles: { "ally-1": false },
		});
		expect(cancelled.some((action) => action.isAshveilFua)).toBe(false);
		expect(
			cancelled.find((action) => action.key === "ally-1")?.ashveilFuaCharge,
		).toBe(2);
	});

	it("不死途 Q 增加 3 层并在上限 3 截断", () => {
		const actions = simulateActions(
			input({
				characters: [character("ashveil", "不死途", 100)],
				skillOverrides: skills({ "ashveil-1": "EQ" }),
				resourceValues: { "ashveil-1": { [ashveilFuaResourceName]: "0" } },
				limit: 110,
			}),
		);
		expect(
			actions.find((action) => action.key === "ashveil-1-q")?.ashveilFuaCharge,
		).toBe(3);
	});

	it("卡芙卡普通回合与 Q 分别回充，充能为 0 的 EQ 回到 2", () => {
		const actions = simulateActions(
			input({
				characters: [character("kafka", "卡芙卡", 100)],
				skillOverrides: skills({ "kafka-1": "EQ" }),
				resourceValues: { "kafka-1": { [kafkaFuaResourceName]: "0" } },
				limit: 110,
			}),
		);
		expect(
			actions.find((action) => action.key === "kafka-1")?.kafkaFuaCharge,
		).toBe(1);
		expect(
			actions.find((action) => action.key === "kafka-1-q")?.kafkaFuaCharge,
		).toBe(2);
	});

	it("卡芙卡对其他角色攻击发动 Z 并消耗 1 层", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("kafka", "卡芙卡", 100),
					character("ally", "丹恒", 200),
				],
				limit: 60,
			}),
		);
		expect(
			actions.find((action) => action.key === "ally-1-kafka-fua"),
		).toMatchObject({
			skill: "Z",
			isKafkaFua: true,
			lockedSkill: true,
		});
		expect(
			actions.find((action) => action.key === "ally-1")?.kafkaFuaCharge,
		).toBe(1);
	});

	it("固定攻击沿用既有规则，不受旧 attackDisabled 记录影响", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("ashveil", "不死途", 100),
					character("ally", "丹恒", 200),
				],
				attackDisabled: { "ally-1": true },
				limit: 110,
			}),
		);

		expect(actions.some((action) => action.isAshveilFua)).toBe(true);
	});

	it("不死途与卡芙卡自身行动不会触发自身追击", () => {
		for (const [id, name, flag] of [
			["ashveil", "不死途", "isAshveilFua"],
			["kafka", "卡芙卡", "isKafkaFua"],
		] as const) {
			const actions = simulateActions(
				input({
					characters: [character(id, name, 100)],
					skillOverrides: skills({ [`${id}-1`]: "EQ" }),
					limit: 110,
				}),
			);

			expect(actions.some((action) => action[flag] === true)).toBe(false);
		}
	});
});
