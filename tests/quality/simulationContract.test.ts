import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import { character, input, skills } from "../helpers/simulateActionTestUtils";

function projectActions(actions: ReturnType<typeof simulateActions>) {
	return actions.map((action) => ({
		key: action.key,
		characterId: action.characterId,
		actionNo: action.actionNo,
		actionValue: Number(action.actionValue.toFixed(6)),
		skill: action.skill,
		isDomainAction: action.isDomainAction,
		isSpBladeExtraAction: action.isSpBladeExtraAction,
		isArcherExtraE: action.isArcherExtraE,
	}));
}

describe("模拟结果契约", () => {
	it.each([
		{
			name: "普通队伍",
			input: input({
				characters: [
					character("a", "停云", 100),
					character("b", "布洛妮娅", 99),
				],
				skillOverrides: skills({ "a-1": "E", "b-1": "E" }),
				limit: 180,
			}),
		},
		{
			name: "特殊角色队伍",
			input: input({
				characters: [
					character("archer", "Archer", 108),
					character("blade", "千冶·刃", 102, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"archer-1": "3E",
					"blade-1": "Q",
				}),
				limit: 220,
			}),
		},
	])("同一输入的 $name 结果可重复", ({ input: simulationInput }) => {
		const first = projectActions(simulateActions(simulationInput));
		const second = projectActions(simulateActions(simulationInput));
		expect(first).toEqual(second);
		expect(new Set(first.map((action) => action.key)).size).toBe(first.length);
	});

	it("代表性场景的核心行动序列保持稳定", () => {
		const scenarios = {
			普通角色: input({
				characters: [character("a", "停云", 100)],
				skillOverrides: skills({ "a-1": "EQ" }),
				limit: 120,
			}),
			Archer: input({
				characters: [character("archer", "Archer", 200)],
				skillOverrides: skills({ "archer-1": "3E" }),
				limit: 140,
			}),
		};
		const snapshots: Record<string, string> = {};
		for (const [name, scenario] of Object.entries(scenarios)) {
			const summary = projectActions(simulateActions(scenario))
				.map(
					(action) =>
						`${action.key}:${action.characterId}:${action.actionNo}:${action.actionValue}:${action.skill}`,
				)
				.join("|");
			snapshots[name] = summary;
		}
		expect(snapshots).toEqual({
			普通角色: "@av0-1:@av0:0:0:|a-1:a:1:100:E|a-1-q:a:0:100:Q",
			Archer:
				"@av0-1:@av0:0:0:|archer-1:archer:1:50:E|archer-1-ea2:archer:0:50:E|archer-1-ea3:archer:0:50:E|archer-2:archer:2:100:",
		});
	});
});
