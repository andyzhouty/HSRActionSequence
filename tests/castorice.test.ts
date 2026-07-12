import { describe, expect, it } from "vitest";
import type {
	CharacterConfig,
	SkillCode,
} from "../src/utils/actionSequence";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../src/simulate/actions";

function character(
	id: string,
	name: string,
	speed: number,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: String(speed),
		baseSpeed: String(speed),
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...overrides,
	};
}

function input(
	overrides: Partial<SimulateActionsInput> = {},
): SimulateActionsInput {
	return {
		characters: [],
		limit: 500,
		overrides: {},
		skillOverrides: {},
		domainEndOverrides: {},
		legacyUltOverrides: {},
		speedAdjustments: {},
		skillTargets: {},
		defaultSkillTargets: {},
		odeSelections: {},
		memeSelections: {},
		ultInterrupts: {},
		fireflyBreakCounters: {},
		...overrides,
	};
}

function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

// ───── 遐蝶死龙 ─────

describe("Castorice (遐蝶) Pollux Summon", () => {
	it("遐蝶 Q 召唤死龙，死龙立即行动", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
				}),
				limit: 200,
			}),
		);

		// castorice-1 (A, AV=100) → castorice-1-q (Q, AV=100, summon pollux)
		// pollux-1 at AV=100
		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBeGreaterThanOrEqual(1);
		expect(polluxActions[0].actionValue).toBeCloseTo(100, 1);
		expect(polluxActions[0].displayName).toBe("死龙");
	});

	it("死龙 EA 行动后驻场（polluxCount < 3）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
				}),
				limit: 400,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBeGreaterThanOrEqual(2);
		// First pollux action is EA (no despawn), second action follows
		expect(polluxActions[0].skill).toBe("EA");
		expect(polluxActions[1].actionValue).toBeGreaterThan(
			polluxActions[0].actionValue,
		);
	});

	it("死龙 E 行动后离场", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E",
				}),
				limit: 400,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBe(1);
		expect(polluxActions[0].skill).toBe("E");
	});

	it("死龙 3 回合后自动离场", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "A",
					"castorice-pollux-2": "A",
					"castorice-pollux-3": "A",
				}),
				limit: 600,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		// After 3 A actions, pollux should despawn (3 actions = polluxCount=3)
		expect(polluxActions.length).toBe(3);
	});

	it("死龙离场后遐蝶可再次 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E",
					"castorice-2": "AQ",
				}),
				limit: 500,
			}),
		);

		// First Q → pollux → E despawn → second Q possible
		const castoriceQ = actions.filter(
			(a) => a.characterId === "castorice" && a.skill === "Q",
		);
		expect(castoriceQ.length).toBe(2);
	});

	it("E2 遐蝶自拉条 100%，排在死龙之前", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
				}),
				limit: 200,
			}),
		);

		// E2: after Q, castorice self-advance 100% → castorice-2 before pollux-1
		const castorice2 = actions.find(
			(a) => a.characterId === "castorice" && a.actionNo === 2,
		);
		const pollux1 = actions.find((a) => a.isPolluxAction);
		expect(castorice2).toBeDefined();
		expect(pollux1).toBeDefined();
		// castorice should act before pollux (both at ~100 AV)
		const castoriceIdx = actions.indexOf(castorice2!);
		const polluxIdx = actions.indexOf(pollux1!);
		expect(castoriceIdx).toBeLessThan(polluxIdx);
	});

	it("E2 QE 不产生独立 main action，自拉条后下一动继承 E", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"castorice-1": "QE",
				}),
				limit: 300,
			}),
		);

		// QE with E2: only Q front action, no separate E main action
		// Castorice actions: c1-1-q (Q, AV=100) → c1-2 (E, AV=100, pulled by E2)
		const castoriceActions = actions.filter(
			(a) => a.characterId === "castorice",
		);
		console.log("Castorice actions:", castoriceActions.map(a => a.key + " skill=" + a.skill + " AV=" + a.actionValue).join(", "));

		// Should NOT have a separate E action at the same AV as the Q
		const mainE = castoriceActions.find(
			(a) => a.key === "castorice-1" && a.skill === "E",
		);
		expect(mainE).toBeUndefined();

		// The pulled action should have skill E
		const pulledAction = castoriceActions.find(
			(a) => a.actionNo === 2,
		);
		expect(pulledAction).toBeDefined();
		expect(pulledAction?.skill).toBe("E");
	});

	it("E2 QA 跳过 A，自拉条后下一动继承 A", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"castorice-1": "QA",
				}),
				limit: 300,
			}),
		);

		const castoriceActions = actions.filter(
			(a) => a.characterId === "castorice",
		);

		// Should NOT have A at same AV as Q
		const mainA = castoriceActions.find(
			(a) => a.key === "castorice-1" && a.skill === "A",
		);
		expect(mainA).toBeUndefined();

		// Pulled action should have skill A
		const pulledAction = castoriceActions.find((a) => a.actionNo === 2);
		expect(pulledAction).toBeDefined();
		expect(pulledAction?.skill).toBe("A");
	});

	it("E0 遐蝶 QE 不跳过，正常产生 E 主行动", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 0 }),
				],
				skillOverrides: skills({
					"castorice-1": "QE",
				}),
				limit: 300,
			}),
		);

		const castoriceActions = actions.filter(
			(a) => a.characterId === "castorice",
		);

		// E0 should have normal main E action at same AV as Q
		const mainE = castoriceActions.find(
			(a) => a.key === "castorice-1" && a.skill === "E",
		);
		expect(mainE).toBeDefined();
		expect(mainE?.actionValue).toBeCloseTo(100, 1);
	});

	it("E2 EQ 后遐蝶和死龙依次紧邻 Q，先于无关角色的正常回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 2 }),
					character("ally", "队友", 100),
				],
				skillOverrides: skills({
					"castorice-1": "EQ",
				}),
				limit: 150,
			}),
		);

		const qIndex = actions.findIndex((action) => action.key === "castorice-1-q");
		const polluxIndex = actions.findIndex(
			(action) => action.key === "castorice-pollux-1",
		);
		const castoriceSecondIndex = actions.findIndex(
			(action) => action.key === "castorice-2",
		);
		const allyIndex = actions.findIndex((action) => action.key === "ally-1");

		expect(qIndex).toBeGreaterThan(-1);
		expect(castoriceSecondIndex).toBe(qIndex + 1);
		expect(polluxIndex).toBe(castoriceSecondIndex + 1);
		expect(allyIndex).toBeGreaterThan(polluxIndex);
	});

	it("死龙 AV 间距正确（165 速 = 10000/165 ≈ 60.6 AV）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
				}),
				limit: 250,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBeGreaterThanOrEqual(2);

		// First pollux at AV 100, second at ~160.6
		expect(polluxActions[0].actionValue).toBeCloseTo(100, 1);
		expect(polluxActions[1].actionValue).toBeCloseTo(
			100 + 10000 / 165,
			1,
		);
	});

	it("死龙 3 动后自动离场，可重新召唤", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
					"castorice-pollux-3": "EA", // 3rd → auto dismiss
				}),
				limit: 500,
			}),
		);

		// After 3 EA actions, pollux should despawn (no 4th action)
		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBe(3);
		expect(polluxActions[0].skill).toBe("EA");
		expect(polluxActions[1].skill).toBe("EA");
		expect(polluxActions[2].skill).toBe("EA");

		// Castorice can act again after dismiss
		const castoriceAfter = actions.filter(
			(a) =>
				a.characterId === "castorice" &&
				a.actionValue > polluxActions[2].actionValue,
		);
		expect(castoriceAfter.length).toBeGreaterThanOrEqual(1);
	});

	it("死龙 isMemospriteAction 且 memospriteOwnerId 正确", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
				}),
				limit: 300,
			}),
		);

		const pollux = actions.find((a) => a.isPolluxAction);
		expect(pollux).toBeDefined();
		expect(pollux?.isMemospriteAction).toBe(true);
		expect(pollux?.memospriteOwnerId).toBe("castorice");
		expect(pollux?.targetKind).toBe("忆灵");
		expect(pollux?.characterId).toBe("castorice-pollux");
	});

	it("死龙 actionNo 从 1 开始递增", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
				}),
				limit: 250,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions[0].actionNo).toBe(1);
		expect(polluxActions[1].actionNo).toBe(2);
	});

	it("不在场的遐蝶不会重复召唤死龙", () => {
		// polluxOnField prevents duplicate summon
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA", // pollux stays
					// castorice uses AQ again, but pollux still on field → no re-summon
					"castorice-2": "Q",
				}),
				limit: 300,
			}),
		);

		// Should have 1 continuous pollux, not 2
		const polluxActions = actions.filter((a) => a.isPolluxAction);
		// First pollux summoned, then EA (stays), then castorice Q (no re-summon)
		expect(polluxActions.length).toBeGreaterThanOrEqual(1);
		// All pollux actions should share the same characterId
		const polluxIds = new Set(polluxActions.map((a) => a.characterId));
		expect(polluxIds.size).toBe(1);
	});

	it("死龙支持 EA 以外的驻场技能（通过 skill override）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "A", // plain A also keeps it
					"castorice-pollux-2": "EA",
				}),
				limit: 300,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBeGreaterThanOrEqual(2);
		expect(polluxActions[0].skill).toBe("A");
	});

	it("E2 QE 死龙排在遐蝶自拉条之后", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"castorice-1": "QE",
				}),
				limit: 200,
			}),
		);

		// Order: Q → E2 self-pull → castorice pulled action → pollux first action
		const castoricePulled = actions.find(
			(a) => a.characterId === "castorice" && a.actionNo === 2,
		);
		const polluxFirst = actions.find((a) => a.isPolluxAction);
		expect(castoricePulled).toBeDefined();
		expect(polluxFirst).toBeDefined();

		const castoriceIdx = actions.indexOf(castoricePulled!);
		const polluxIdx = actions.indexOf(polluxFirst!);
		expect(castoriceIdx).toBeLessThan(polluxIdx);
	});

	it("死龙离场后 polluxOnField 为 false", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E", // dismiss
				}),
				limit: 300,
			}),
		);

		// Only 1 pollux action (the dismiss itself)
		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBe(1);
		expect(polluxActions[0].skill).toBe("E");
	});

	it("纯 A 不下场，纯 E 下场", () => {
		// EA → stays, E → gone
		const keepActions = simulateActions(
			input({
				characters: [character("castorice", "遐蝶", 100)],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
				}),
				limit: 300,
			}),
		);
		expect(keepActions.filter((a) => a.isPolluxAction).length).toBeGreaterThanOrEqual(1);

		const dismissActions = simulateActions(
			input({
				characters: [character("castorice", "遐蝶", 100)],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E",
				}),
				limit: 300,
			}),
		);
		expect(dismissActions.filter((a) => a.isPolluxAction).length).toBe(1);
	});

	it("死龙 165 速独立于遐蝶 100 速运行", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
				}),
				limit: 300,
			}),
		);

		// castorice at 100 speed: second action ~200 AV
		// pollux at 165 speed: second action ~160.6 AV
		const castorice2 = actions.find(
			(a) => a.characterId === "castorice" && a.actionNo === 2,
		);
		const pollux2 = actions.find(
			(a) => a.isPolluxAction && a.actionNo === 2,
		);

		if (castorice2 && pollux2) {
			// pollux is faster, should act before castorice
			expect(pollux2.actionValue).toBeLessThan(castorice2.actionValue);
		}
	});

	it("无序指定死龙技能时默认表现正常", () => {
		// No skill override for pollux → default behavior should work
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					// pollux actions without explicit override
				}),
				limit: 500,
			}),
		);

		// Pollux should still render with skill="" (default)
		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBeGreaterThanOrEqual(1);
		expect(polluxActions[0].displayName).toBe("死龙");
	});

	it("击杀：E 后死龙不消失且速度翻倍（165→330）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E",
				}),
				castoriceKillToggles: {
					"castorice-pollux-1": true,
				},
				limit: 500,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		// Should NOT dismiss after E with kill
		expect(polluxActions.length).toBeGreaterThanOrEqual(2);
		expect(polluxActions[0].skill).toBe("E");
		expect(polluxActions[0].speed).toBe(165); // before speed change

		// Second action should exist at shorter interval (330 speed ≈ 30.3 AV gap)
		expect(polluxActions[1].actionValue).toBeCloseTo(
			polluxActions[0].actionValue + 10000 / 330,
			1,
		);
	});

	it("击杀对 EA 不生效（仅纯 E 触发）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
				}),
				castoriceKillToggles: {
					"castorice-pollux-1": true, // kill on, but EA keeps it anyway
				},
				limit: 500,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		// EA always keeps pollux, kill toggle doesn't change speed for EA
		expect(polluxActions.length).toBeGreaterThanOrEqual(2);
		expect(polluxActions[0].skill).toBe("EA");
		// Normal EA speed: 165
		expect(polluxActions[1].actionValue).toBeCloseTo(
			polluxActions[0].actionValue + 10000 / 165,
			1,
		);
	});

	it("加速后死龙离场，重新召唤时速度恢复 165", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "E", // kill → stays at 330 speed
					"castorice-pollux-2": "EA",
					"castorice-pollux-3": "EA", // 3rd → auto dismiss
					"castorice-2": "Q", // re-summon (after pollux gone)
				}),
				castoriceKillToggles: {
					"castorice-pollux-1": true,
				},
				limit: 500,
			}),
		);

		// First batch: 3 actions, first at 330 speed after kill
		const firstBatch = actions.filter(
			(a) =>
				a.isPolluxAction &&
				(a.key === "castorice-pollux-1" ||
					a.key === "castorice-pollux-2" ||
					a.key === "castorice-pollux-3"),
		);
		expect(firstBatch.length).toBe(3);

		// After kill, pollux-2 should come ~30.3 AV after pollux-1 (330 speed)
		expect(firstBatch[1].actionValue).toBeCloseTo(
			firstBatch[0].actionValue + 10000 / 330,
			1,
		);

		// Re-summoned pollux should be at 165 speed again
		const newPollux = actions.find(
			(a) => a.isPolluxAction && !firstBatch.includes(a),
		);
		if (newPollux) {
			expect(newPollux.speed).toBe(165);
		}
	});

	it("死龙第三回合即使击杀，也不会获得第四回合", () => {
		const actions = simulateActions(
			input({
				characters: [character("castorice", "遐蝶", 100)],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
					"castorice-pollux-3": "E",
				}),
				castoriceKillToggles: {
					"castorice-pollux-3": true,
				},
				limit: 800,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions).toHaveLength(3);
		expect(polluxActions.map((a) => a.actionNo)).toEqual([1, 2, 3]);
		expect(
			actions.find((a) => a.isPolluxAction && a.actionNo === 4),
		).toBeUndefined();
	});

	it("遐蝶秘技开启时开场自动召唤死龙，并在 AV=0 立即行动", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						hasCastoriceTechnique: true,
					}),
				],
				limit: 200,
			}),
		);

		const polluxFirst = actions.find((a) => a.isPolluxAction);
		expect(polluxFirst).toBeDefined();
		expect(polluxFirst?.actionNo).toBe(1);
		expect(polluxFirst?.actionValue).toBe(0);
	});

	it("遐蝶秘技在 2 魂时开场会触发 100% 自拉条，且排在死龙之前", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						hasCastoriceTechnique: true,
						eidolon: 2,
					}),
				],
				limit: 200,
			}),
		);

		const castoriceFirst = actions.find((a) => a.key === "castorice-1");
		const polluxFirst = actions.find((a) => a.isPolluxAction);
		expect(castoriceFirst?.actionValue).toBe(0);
		expect(polluxFirst?.actionValue).toBeCloseTo(0.0001, 4);
	});

	it("遐蝶秘技开场动作计入 3 次上限", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						hasCastoriceTechnique: true,
					}),
				],
				skillOverrides: skills({
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
					"castorice-pollux-3": "EA",
				}),
				limit: 400,
			}),
		);

		const polluxActions = actions.filter((a) => a.isPolluxAction);
		expect(polluxActions.length).toBe(3);
		expect(polluxActions.map((a) => a.actionNo)).toEqual([1, 2, 3]);
	});

	it("遐蝶秘技开启后，死龙在场时后续 Q 不重复召唤", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						hasCastoriceTechnique: true,
					}),
				],
				skillOverrides: skills({
					"castorice-pollux-1": "EA",
					"castorice-1": "AQ",
				}),
				limit: 300,
			}),
		);

		const polluxIds = new Set(
			actions.filter((a) => a.isPolluxAction).map((a) => a.characterId),
		);
		expect(polluxIds.size).toBe(1);
	});

	it("遐蝶插队Q会正常召唤死龙", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("ally", "停云", 100),
					character("castorice", "遐蝶", 90),
				],
				ultInterrupts: {
					"ally-1": [{ casterId: "castorice", timing: "before" }],
				},
				limit: 200,
			}),
		);

		expect(actions.find((a) => a.key === "ally-1-interrupt-0")?.skill).toBe("Q");
		expect(actions.find((a) => a.isPolluxAction)).toBeDefined();
	});

	it("死龙召唤时会排在同AV且序号更大的既有忆灵行动之前", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("aglaea", "阿格莱雅", 100),
					character("castorice", "遐蝶", 100),
				],
				skillOverrides: skills({
					"aglaea-1": "E",
					"castorice-1": "AQ",
				}),
				overrides: {
					"castorice-1": "211.1111",
				},
				limit: 220,
			}),
		);

		const garmentmakerSecond = actions.find(
			(action) => action.key === "aglaea-garmentmaker-g1-2",
		);
		const pollux = actions.find((action) => action.key === "castorice-pollux-1");
		expect(garmentmakerSecond).toBeDefined();
		expect(pollux).toBeDefined();
		expect(pollux?.actionValue).toBeCloseTo(
			garmentmakerSecond?.actionValue ?? 0,
			4,
		);
		expect(actions.indexOf(pollux!)).toBeLessThan(actions.indexOf(garmentmakerSecond!));
	});

	it("星期日拉条遐蝶时会同步拉条死龙", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 150),
					character("sunday", "星期日", 100),
				],
				skillOverrides: skills({
					"castorice-1": "AQ",
					"sunday-1": "E",
				}),
				skillTargets: {
					"sunday-1": "castorice",
				},
				limit: 200,
			}),
		);

		const sunday = actions.find((a) => a.key === "sunday-1");
		const castoricePulled = actions.find((a) => a.key === "castorice-2");
		const polluxPulled = actions.find(
			(a) => a.isPolluxAction && a.actionNo === 2,
		);
		expect(sunday).toBeDefined();
		expect(castoricePulled?.actionValue).toBeCloseTo(sunday!.actionValue, 4);
		expect(polluxPulled?.actionValue).toBeCloseTo(sunday!.actionValue, 4);
	});

	it("星期日不能单独拉条死龙", () => {
		const baseInput = input({
			characters: [
				character("castorice", "遐蝶", 150),
				character("sunday", "星期日", 100),
			],
			skillOverrides: skills({
				"castorice-1": "AQ",
				"sunday-1": "E",
			}),
			limit: 220,
		});
		const baseline = simulateActions(baseInput);
		const actions = simulateActions(
			input({
				...baseInput,
				skillTargets: {
					"sunday-1": "castorice-pollux",
				},
			}),
		);

		const baselinePolluxPulled = baseline.find(
			(a) => a.isPolluxAction && a.actionNo === 2,
		);
		const polluxPulled = actions.find(
			(a) => a.isPolluxAction && a.actionNo === 2,
		);
		expect(baselinePolluxPulled).toBeDefined();
		expect(polluxPulled?.actionValue).toBeCloseTo(
			baselinePolluxPulled?.actionValue ?? 0,
			4,
		);
	});

	it("2魂开秘技遐蝶94速，周日166速每动E拉遐蝶时，前三次会同步拉条死龙", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 94, {
						eidolon: 2,
						hasCastoriceTechnique: true,
					}),
					character("sunday", "星期日", 166),
				],
				skillOverrides: skills({
					"sunday-1": "E",
					"sunday-2": "E",
					"sunday-3": "E",
					"sunday-4": "E",
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
					"castorice-pollux-3": "EA",
				}),
				skillTargets: {
					"sunday-1": "castorice",
					"sunday-2": "castorice",
					"sunday-3": "castorice",
					"sunday-4": "castorice",
				},
				limit: 500,
			}),
		);

		const sunday1 = actions.find((a) => a.key === "sunday-1");
		const sunday2 = actions.find((a) => a.key === "sunday-2");
		const sunday3 = actions.find((a) => a.key === "sunday-3");
		const sunday4 = actions.find((a) => a.key === "sunday-4");
		const castorice2 = actions.find((a) => a.key === "castorice-2");
		const castorice3 = actions.find((a) => a.key === "castorice-3");
		const castorice4 = actions.find((a) => a.key === "castorice-4");
		const castorice5 = actions.find((a) => a.key === "castorice-5");
		const pollux2 = actions.find(
			(a) => a.isPolluxAction && a.actionNo === 2,
		);
		const pollux3 = actions.find(
			(a) => a.isPolluxAction && a.actionNo === 3,
		);
		const pollux4 = actions.find(
			(a) => a.isPolluxAction && a.actionNo === 4,
		);

		expect(actions.find((a) => a.key === "castorice-1")?.actionValue).toBe(0);
		expect(
			actions.find((a) => a.key === "castorice-pollux-1")?.actionValue,
		).toBeCloseTo(0.0001, 4);

		expect(castorice2?.actionValue).toBeCloseTo(sunday1?.actionValue ?? 0, 4);
		expect(pollux2?.actionValue).toBeCloseTo(sunday1?.actionValue ?? 0, 4);
		expect(castorice3?.actionValue).toBeCloseTo(sunday2?.actionValue ?? 0, 4);
		expect(pollux3?.actionValue).toBeCloseTo(sunday2?.actionValue ?? 0, 4);
		expect(castorice4?.actionValue).toBeCloseTo(sunday3?.actionValue ?? 0, 4);
		expect(pollux4).toBeUndefined();
		expect(castorice5?.actionValue).toBeCloseTo(sunday4?.actionValue ?? 0, 4);
	});

	it("死龙回合内支持插入角色大招", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						hasCastoriceTechnique: true,
					}),
					character("bronya", "布洛妮娅", 90),
				],
				ultInterrupts: {
					"castorice-pollux-1": [{ casterId: "bronya", timing: "before" }],
				},
				limit: 200,
			}),
		);

		const interrupt = actions.find(
			(a) => a.key === "castorice-pollux-1-interrupt-0",
		);
		const pollux = actions.find((a) => a.key === "castorice-pollux-1");
		expect(interrupt?.skill).toBe("Q");
		expect(interrupt?.actionValue).toBe(0);
		expect(pollux?.actionValue).toBe(0);
	});

	it("死龙自爆回合后插遐蝶Q可无缝重召死龙", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						hasCastoriceTechnique: true,
					}),
				],
				skillOverrides: skills({
					"castorice-pollux-1": "E",
					"castorice-pollux-1-g2": "EA",
				}),
				ultInterrupts: {
					"castorice-pollux-1": [{ casterId: "castorice", timing: "after" }],
				},
				limit: 250,
			}),
		);

		const dismissPollux = actions.find((a) => a.key === "castorice-pollux-1");
		const interruptQ = actions.find(
			(a) => a.key === "castorice-pollux-1-interrupt-0",
		);
		const resummonedPollux = actions.find(
			(a) => a.key === "castorice-pollux-1-g2",
		);

		expect(dismissPollux?.skill).toBe("E");
		expect(interruptQ?.skill).toBe("Q");
		expect(interruptQ?.actionValue).toBeCloseTo(
			dismissPollux?.actionValue ?? 0,
			4,
		);
		expect(resummonedPollux).toBeDefined();
		expect(resummonedPollux?.actionValue).toBeCloseTo(
			interruptQ?.actionValue ?? 0,
			4,
		);
	});

	it("死龙第三回合后插遐蝶Q可无缝重召死龙", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("castorice", "遐蝶", 100, {
						hasCastoriceTechnique: true,
					}),
				],
				skillOverrides: skills({
					"castorice-pollux-1": "EA",
					"castorice-pollux-2": "EA",
					"castorice-pollux-3": "EA",
					"castorice-pollux-1-g2": "EA",
				}),
				ultInterrupts: {
					"castorice-pollux-3": [{ casterId: "castorice", timing: "after" }],
				},
				limit: 400,
			}),
		);

		const thirdPollux = actions.find((a) => a.key === "castorice-pollux-3");
		const interruptQ = actions.find(
			(a) => a.key === "castorice-pollux-3-interrupt-0",
		);
		const resummonedPollux = actions.find(
			(a) => a.key === "castorice-pollux-1-g2",
		);

		expect(thirdPollux?.skill).toBe("EA");
		expect(interruptQ?.skill).toBe("Q");
		expect(interruptQ?.actionValue).toBeCloseTo(
			thirdPollux?.actionValue ?? 0,
			4,
		);
		expect(resummonedPollux).toBeDefined();
		expect(resummonedPollux?.actionValue).toBeCloseTo(
			interruptQ?.actionValue ?? 0,
			4,
		);
	});

	it("取消星期日对遐蝶的 E 目标后，遐蝶第三动 EQ 重召的死龙不会卡在第一次拉条位置", () => {
		const baseInput = input({
			characters: [
				character("castorice", "遐蝶", 94, {
					eidolon: 2,
					hasCastoriceTechnique: true,
				}),
				character("sunday", "星期日", 164, {
					hasVonwacq: true,
					hasWindSet: true,
				}),
			],
			skillOverrides: skills({
				"sunday-1": "E",
				"castorice-3": "EQ",
				"castorice-pollux-1": "EA",
				"castorice-pollux-2": "EA",
				"castorice-pollux-3": "EA",
			}),
			limit: 500,
		});

		const withTarget = simulateActions({
			...baseInput,
			skillTargets: {
				"sunday-1": "castorice",
			},
		});
		const withoutTarget = simulateActions(baseInput);
		console.log(
			"withTarget:",
			withTarget
				.map((a) => `${a.key}:${a.skill}@${a.actionValue.toFixed(4)}`)
				.join(", "),
		);
		console.log(
			"withoutTarget:",
			withoutTarget
				.map((a) => `${a.key}:${a.skill}@${a.actionValue.toFixed(4)}`)
				.join(", "),
		);

		const sunday1WithTarget = withTarget.find((a) => a.key === "sunday-1");
		const castorice3WithTarget = withTarget.find((a) => a.key === "castorice-3");
		expect(sunday1WithTarget?.actionValue).toBeCloseTo(36.59, 2);
		expect(castorice3WithTarget?.actionValue).toBeCloseTo(142.97, 2);

		const castorice3QNoTargetIndex = withoutTarget.findIndex(
			(a) => a.key === "castorice-3-q",
		);
		expect(castorice3QNoTargetIndex).toBeGreaterThan(-1);

		const castorice3QNoTarget = withoutTarget[castorice3QNoTargetIndex];
		const repolluxNoTarget = withoutTarget
			.slice(castorice3QNoTargetIndex + 1)
			.find((a) => a.isPolluxAction);
		const sunday1NoTarget = withoutTarget.find((a) => a.key === "sunday-1");

		expect(sunday1NoTarget?.actionValue).toBeCloseTo(36.59, 2);
		expect(repolluxNoTarget).toBeDefined();
		expect(repolluxNoTarget?.actionValue).toBeCloseTo(
			castorice3QNoTarget?.actionValue ?? 0,
			4,
		);
		const castoricePulledActionIndex = withoutTarget.findIndex(
			(action) => action.key === "castorice-4",
		);
		expect(castoricePulledActionIndex).toBe(
			castorice3QNoTargetIndex + 1,
		);
		expect(withoutTarget.indexOf(repolluxNoTarget!)).toBe(
			castoricePulledActionIndex + 1,
		);
		expect(repolluxNoTarget?.actionValue).not.toBeCloseTo(
			sunday1NoTarget?.actionValue ?? 0,
			2,
		);
	});
});




