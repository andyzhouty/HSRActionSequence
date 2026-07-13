import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import { character, input, skills } from "../helpers/simulateActionTestUtils";

describe("Evernight (长夜月)", () => {
	it("开场默认带长夜上场", () => {
		const actions = simulateActions(
			input({
				characters: [character("evernight", "长夜月", 100)],
				limit: 120,
			}),
		);

		expect(
			actions.find((action) => action.key === "evernight-evey-1"),
		).toMatchObject({
			characterId: "evernight-evey",
			actionValue: 0,
			skill: "",
			isEveyAction: true,
		});
	});

	it("0行动值处会先显示长夜，再显示遐蝶秘技死龙", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						techniqueOn: true,
					}),
					character("evernight", "长夜月", 100),
				],
				limit: 120,
			}),
		);

		const av0 = actions.findIndex((action) => action.characterId === "@av0");
		const evey = actions.findIndex(
			(action) => action.key === "evernight-evey-1",
		);
		const pollux = actions.findIndex(
			(action) => action.key === "castorice-pollux-1",
		);

		expect(av0).toBeGreaterThan(-1);
		expect(evey).toBeGreaterThan(av0);
		expect(pollux).toBeGreaterThan(evey);
		expect(actions[evey]?.actionValue).toBe(0);
		expect(actions[pollux]?.actionValue).toBe(0);
	});

	it("长夜离场后，长夜月 E/Q 会把新一轮长夜立即召回到当前时点", () => {
		const actions = simulateActions(
			input({
				characters: [character("evernight", "长夜月", 100)],
				skillOverrides: skills({
					"evernight-evey-1": "E",
					"evernight-1": "E",
				}),
				limit: 220,
			}),
		);

		const dismissed = actions.find(
			(action) => action.key === "evernight-evey-1",
		);
		const ownerE = actions.find((action) => action.key === "evernight-1");
		const resummoned = actions.find(
			(action) => action.key === "evernight-evey-1-g2",
		);

		expect(dismissed?.skill).toBe("E");
		expect(ownerE?.actionValue).toBeCloseTo(90.9918, 4);
		expect(resummoned?.actionValue).toBeCloseTo(ownerE?.actionValue ?? 0, 4);
		expect(resummoned?.isEveyAction).toBe(true);
	});

	it("星期日拉条长夜月时会同步拉条长夜，且不能单独拉条长夜", () => {
		const baseInput = input({
			characters: [
				character("evernight", "长夜月", 100),
				character("sunday", "星期日", 200),
			],
			skillOverrides: skills({
				"sunday-1": "E",
			}),
			limit: 180,
		});
		const withOwnerTarget = simulateActions({
			...baseInput,
			skillTargets: {
				"sunday-1": "evernight",
			},
		});
		const withEveyTarget = simulateActions({
			...baseInput,
			skillTargets: {
				"sunday-1": "evernight-evey",
			},
		});

		const sunday = withOwnerTarget.find((action) => action.key === "sunday-1");
		const ownerPulled = withOwnerTarget.find(
			(action) => action.key === "evernight-1",
		);
		const eveyPulled = withOwnerTarget.find(
			(action) => action.key === "evernight-evey-2",
		);
		const baselineEvey = simulateActions(baseInput).find(
			(action) => action.key === "evernight-evey-2",
		);
		const invalidTargetEvey = withEveyTarget.find(
			(action) => action.key === "evernight-evey-2",
		);

		expect(ownerPulled?.actionValue).toBeCloseTo(sunday?.actionValue ?? 0, 4);
		expect(eveyPulled?.actionValue).toBeCloseTo(sunday?.actionValue ?? 0, 4);
		expect(invalidTargetEvey?.actionValue).toBeCloseTo(
			baselineEvey?.actionValue ?? 0,
			4,
		);
	});

	it("长夜自爆会在本回合所有附属动作后触发，且支持后插 Q 重召", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("evernight", "长夜月", 100),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				ultInterrupts: {
					"evernight-evey-2": [{ casterId: "evernight", timing: "after" }],
				},
				evernightSelfDestructToggles: {
					"enemy-1": true,
				},
				limit: 120,
			}),
		);

		const enemy = actions.find((action) => action.key === "enemy-1");
		const selfDestruct = actions.find(
			(action) => action.key === "evernight-evey-2",
		);
		const interruptQ = actions.find(
			(action) => action.key === "evernight-evey-2-interrupt-0",
		);
		const resummoned = actions.find(
			(action) => action.key === "evernight-evey-1-g2",
		);

		expect(selfDestruct?.actionValue).toBeCloseTo(enemy?.actionValue ?? 0, 4);
		expect(selfDestruct?.skill).toBe("E");
		expect(selfDestruct?.lockedSkill).toBe(true);
		expect(selfDestruct?.isEveySelfDestructAction).toBe(true);
		expect(interruptQ?.actionValue).toBeCloseTo(
			selfDestruct?.actionValue ?? 0,
			4,
		);
		expect(resummoned?.actionValue).toBeCloseTo(
			selfDestruct?.actionValue ?? 0,
			4,
		);
	});

	it("长夜离场后，在其它角色回合插队 Q 也会立即重召长夜", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("evernight", "长夜月", 100),
					character("ally", "队友", 90),
				],
				skillOverrides: skills({
					"evernight-evey-1": "E",
				}),
				ultInterrupts: {
					"ally-1": [{ casterId: "evernight", timing: "before" }],
				},
				limit: 200,
			}),
		);

		const dismissed = actions.find(
			(action) => action.key === "evernight-evey-1",
		);
		const interruptQ = actions.find(
			(action) => action.key === "ally-1-interrupt-0",
		);
		const resummoned = actions.find(
			(action) => action.key === "evernight-evey-1-g2",
		);

		expect(dismissed?.skill).toBe("E");
		expect(interruptQ?.skill).toBe("Q");
		expect(resummoned).toBeDefined();
		expect(resummoned?.actionValue).toBeCloseTo(
			interruptQ?.actionValue ?? 0,
			4,
		);
	});

	it("长夜以 E 离场后会按消耗的忆质加速长夜月，并在长夜月下回合开始后移除", () => {
		const actions = simulateActions(
			input({
				characters: [character("evernight", "长夜月", 100)],
				skillOverrides: skills({
					"evernight-evey-1": "E",
				}),
				resourceValues: {
					"evernight-evey-1": {
						忆质: "-12",
					},
				},
				limit: 220,
			}),
		);

		const ownerFirstAction = actions.find(
			(action) => action.key === "evernight-1",
		);
		const ownerSecondAction = actions.find(
			(action) => action.key === "evernight-2",
		);

		expect(ownerFirstAction?.actionValue).toBeCloseTo(82.1153, 4);
		expect(ownerFirstAction?.speed).toBeCloseTo(121.78, 4);
		expect(
			(ownerSecondAction?.actionValue ?? 0) -
				(ownerFirstAction?.actionValue ?? 0),
		).toBeCloseTo(100, 4);
	});

	it("未填写忆质时，右键长夜自爆会正常触发", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("evernight", "长夜月", 100),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				evernightSelfDestructToggles: {
					"enemy-1": true,
				},
				limit: 220,
			}),
		);

		const enemy = actions.find((action) => action.key === "enemy-1");
		const selfDestruct = actions.find(
			(action) => action.key === "evernight-evey-2",
		);
		const owner = actions.find((action) => action.key === "evernight-1");

		expect(selfDestruct?.actionValue).toBeCloseTo(enemy?.actionValue ?? 0, 4);
		expect(selfDestruct?.isEveySelfDestructAction).toBe(true);
		expect(selfDestruct?.isEveyThresholdBurstAction).not.toBe(true);
		expect(owner?.speed).toBeCloseTo(109.9, 4);
	});

	it("填写的忆质小于16时，即使右键长夜自爆也不会触发", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("evernight", "长夜月", 100),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				resourceValues: {
					"enemy-1": {
						忆质: "15",
					},
				},
				evernightSelfDestructToggles: {
					"enemy-1": true,
				},
				limit: 220,
			}),
		);

		const eveyNextAction = actions.find(
			(action) => action.key === "evernight-evey-2",
		);
		expect(eveyNextAction?.skill).toBe("");
		expect(eveyNextAction?.isEveySelfDestructAction).not.toBe(true);
	});

	it("填写的忆质大于等于16时，不做右键操作也会自动自爆", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("evernight", "长夜月", 100),
					character("enemy", "敌人", 200, { kind: "敌人" }),
				],
				resourceValues: {
					"enemy-1": {
						忆质: "23",
					},
				},
				limit: 220,
			}),
		);

		const burst = actions.find((action) => action.key === "evernight-evey-2");
		const owner = actions.find((action) => action.key === "evernight-1");

		expect(burst?.skill).toBe("E");
		expect(burst?.lockedSkill).toBe(true);
		expect(burst?.isEveyThresholdBurstAction).toBe(true);
		expect(owner?.speed).toBeCloseTo(132.67, 4);
	});
});
