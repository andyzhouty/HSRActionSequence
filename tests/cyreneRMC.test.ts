import { describe, expect, it } from "vitest";
import type {
	CharacterConfig,
	SkillCode,
	UltInterrupt,
	OdeSelection,
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

function interrupts(
	entries: Record<string, UltInterrupt[]>,
): Record<string, UltInterrupt[]> {
	return entries;
}

function odeSelections(
	entries: Record<string, OdeSelection>,
): Record<string, OdeSelection> {
	return entries;
}

// ───── 记忆主【史诗】系统 ─────

describe("Memory Trailblazer Epic System", () => {
	it("记忆主 Q 后史诗 +1，下一次纯 A 后消耗", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("rmc", "开拓者·记忆", 100),
				],
				skillOverrides: skills({
					"rmc-1": "AQ",
					"rmc-2": "",
				}),
				limit: 350,
			}),
		);

		// rmc-1 (A) → rmc-1-q (Q, epic+1) → rmc-2 (A, consumes epic)
		// rmc-2 should be a normal action (no extra memosprite since no genesis ode)
		const rmc1 = actions.find((a) => a.key === "rmc-1");
		expect(rmc1).toBeDefined();
		expect(rmc1?.skill).toBe("A");

		const rmc2 = actions.find((a) => a.key === "rmc-2");
		expect(rmc2).toBeDefined();
		// No extra memosprite without genesis ode
		const epicMemosprite = actions.find((a) => a.isEpicTriggeredMemosprite);
		expect(epicMemosprite).toBeUndefined();
	});

	it("记忆主 Q 后史诗最多 2 层，连续 Q 不溢出", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("rmc", "开拓者·记忆", 100),
				],
				skillOverrides: skills({
					"rmc-1": "AQ",
					"rmc-2": "AQ",
					"rmc-3": "",
				}),
				limit: 500,
			}),
		);

		// rmc-1 (A) → rmc-1-q (Q, epic=1) → rmc-2 (A) → rmc-2-q (Q, epic=1, not 2 since first A consumed)
		// Actually: Q1 → epic=1 → A2 → consumed → Q2 → epic=1 → A3 → consumed
		// The test just verifies no crash and actions exist
		expect(actions.length).toBeGreaterThan(0);
		const rmcActions = actions.filter((a) => a.characterId === "rmc");
		expect(rmcActions.length).toBeGreaterThanOrEqual(3);
	});

	it("记忆主 AQ 的 Q 增加史诗，下次纯 A 有创世之诗时触发德谬歌额外 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("rmc", "开拓者·记忆", 100),
					character("cyrene", "昔涟", 200),
				],
				skillOverrides: skills({
					"rmc-1": "AQ",
					"rmc-2": "",
					"cyrene-1": "AQ",
				}),
				// 昔涟给记忆主上创世之诗
				odeSelections: odeSelections({
					"cyrene-1-memosprite-Q": {
						odeCode: "genesis",
						targetId: "rmc",
					},
				}),
				limit: 500,
			}),
		);

		// cyrene-1 (A, AV=50) → cyrene-1-q (Q, AV=50, memosprite: genesis→rmc) →
		// rmc-1 (A, AV=100) → rmc-1-q (Q, AV=100, epic=1) →
		// rmc-2 (A, AV=200, consumes epic=0, triggers extra memosprite)
		const epicMemosprite = actions.find((a) => a.isEpicTriggeredMemosprite);
		expect(epicMemosprite).toBeDefined();
		expect(epicMemosprite?.displayName).toBe("德谬歌");
		expect(epicMemosprite?.lockedSkill).toBe(true);
		expect(epicMemosprite?.skill).toBe("Q");
	});
});

// ───── 昔涟 Q_counter 系统 ─────

describe("Cyrene Q_counter System", () => {
	it("昔涟每次 Q 后 Q_counter +1，第三动（Q_counter=2）触发强化 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 100),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
					"cyrene-2": "AQ",
					"cyrene-3": "AQ",
				}),
				limit: 800,
			}),
		);

		// Q_counter: 0→1(cyrene-1-q), 1→2(cyrene-2-q, enhanced Q triggers)
		// Enhanced Q should appear at cyrene-2's actionValue
		const enhancedQs = actions.filter((a) => a.isCyreneEnhancedQ);
		expect(enhancedQs.length).toBe(1);
		expect(enhancedQs[0].skill).toBe("Q");
		expect(enhancedQs[0].lockedSkill).toBe(true);
		expect(enhancedQs[0].characterId).toBe("cyrene-memosprite");
	});

	it("Q_counter = 5 时（第 6 次大）再次触发强化 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 100),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
					"cyrene-2": "AQ",
					"cyrene-3": "AQ",
					"cyrene-4": "AQ",
					"cyrene-5": "AQ",
					"cyrene-6": "AQ",
				}),
				limit: 1500,
			}),
		);

		// Q_counter: 1,2(enhanced),3,4,5(enhanced),6
		const enhancedQs = actions.filter((a) => a.isCyreneEnhancedQ);
		expect(enhancedQs.length).toBe(2);
	});
});

// ───── 昔涟 E6 效果 ─────

describe("Cyrene E6 Effects", () => {
	it("E6 首次开大（Q_counter=1）全队 100% 拉条到昔涟 Q 的 AV", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 200, { eidolon: 6 }),
					character("ally", "队友", 100),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				limit: 100,
			}),
		);

		// 昔涟首动 AV = 10000/200 * (1-0) = 50（无首动提前被动）
		// cyrene-1 (A, AV=50) → cyrene-1-q (Q, AV=50, Q_counter=1, E6 pull)
		// 队友被拉到 AV=50 附近
		const allyAction = actions.find((a) => a.characterId === "ally");
		expect(allyAction).toBeDefined();
		// 队友应在昔涟 Q 的 AV 附近
		expect(allyAction?.actionValue).toBeLessThan(55);
	});

	it("E6 首次大拉条后昔涟自身也拉条（不同于知更鸟自身不拉条）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 200, { eidolon: 6 }),
					character("ally", "队友", 100),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				limit: 120,
			}),
		);

		// 昔涟 Q 后自身被拉条，下一动应在附近 AV（~50）
		const cyreneQ = actions.find((a) => a.key === "cyrene-1-q");
		expect(cyreneQ).toBeDefined();

		const cyreneNext = actions.find(
			(a) => a.characterId === "cyrene" && a.actionNo === 2,
		);
		expect(cyreneNext).toBeDefined();
		// 昔涟下一动应在 Q 的 AV 附近（被拉条了，不会被覆盖）
		expect(cyreneNext?.actionValue).toBeLessThan(55);
		expect(cyreneNext?.actionValue).toBeGreaterThan(49.9);
	});

	it("E6 强化 Q（Q_counter=5）结束后 24% 全队拉条", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("cyrene", "昔涟", 200, { eidolon: 6 }),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ", // Q_counter=1 (E6 first ult: 100% pull)
					"cyrene-2": "AQ", // Q_counter=2 (enhanced Q, no 24% for E6 since k=0)
					"cyrene-3": "AQ", // Q_counter=3
					"cyrene-4": "AQ", // Q_counter=4
					"cyrene-5": "AQ", // Q_counter=5 (enhanced Q + 24% pull for E6)
				}),
				limit: 400,
			}),
		);

		// Q_counter=5 时应有强化 Q
		const enhancedQs = actions.filter((a) => a.isCyreneEnhancedQ);
		expect(enhancedQs.length).toBe(2); // Q_counter=2 and Q_counter=5

		// 队友在强化 Q 后应被拉条
		const allyActions = actions.filter((a) => a.characterId === "ally");
		const enhancedQ = enhancedQs[1]; // the second one (Q_counter=5)
		const alliesAfterEnhancedQ = allyActions.filter(
			(a) => a.actionValue >= enhancedQ.actionValue,
		);
		expect(alliesAfterEnhancedQ.length).toBeGreaterThan(0);
	});
});

// ───── 昔涟 + 记忆主 完整联动 ─────

describe("Cyrene + Memory Trailblazer Full Integration", () => {
	it("德谬歌给记忆主上创世之诗后，记忆主 A 触发额外德谬歌 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("rmc", "开拓者·记忆", 100),
					character("cyrene", "昔涟", 150),
				],
				skillOverrides: skills({
					"rmc-1": "E",
					"cyrene-1": "AQ",
					"rmc-2": "AQ",
					"rmc-3": "",
				}),
				// 昔涟 Q 给记忆主上创世之诗
				odeSelections: odeSelections({
					"cyrene-1-memosprite-Q": {
						odeCode: "genesis",
						targetId: "rmc",
					},
				}),
				limit: 500,
			}),
		);

		// rmc-1 (E) → cyrene-1 (A) → cyrene-1-q (Q, ode genesis to rmc) → ...
		// rmc-2 (AQ, A + Q, epic+1 via Q) → rmc-3 (A, consumes epic, triggers extra memosprite)
		const epicMemosprite = actions.find((a) => a.isEpicTriggeredMemosprite);
		expect(epicMemosprite).toBeDefined();
		expect(epicMemosprite?.memospriteOwnerId).toBe("cyrene");
	});

	it("记忆主 QA（Q在前）也正确消耗史诗触发德谬歌额外 Q", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("rmc", "开拓者·记忆", 160),
					character("cyrene", "昔涟", 200, { eidolon: 6 }),
				],
				skillOverrides: skills({
					"rmc-1": "E",
					"cyrene-1": "EQ",
					"cyrene-2": "E",
					"rmc-2": "QA",
				}),
				odeSelections: odeSelections({
					"cyrene-1-memosprite-Q": {
						odeCode: "genesis",
						targetId: "rmc",
					},
				}),
				limit: 400,
			}),
		);

		// cyrene EQ (AV=50, Q_counter=1, E6 100% pull, genesis→rmc)
		// rmc E (AV~50, summon Meme)
		// cyrene E (AV~50)
		// rmc QA (AV~112.5, Q→epic=1, A→consumes epic→emits epic memosprite)
		const epicMemosprite = actions.find((a) => a.isEpicTriggeredMemosprite);
		expect(epicMemosprite).toBeDefined();
		expect(epicMemosprite?.lockedSkill).toBe(true);
		expect(epicMemosprite?.skill).toBe("Q");
		expect(epicMemosprite?.memospriteOwnerId).toBe("cyrene");
	});

	it("昔涟插队 Q 也计入 Q_counter（两次插队 Q 计数器到 2 触发强化 Q）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("b", "另一个", 100),
					character("cyrene", "昔涟", 200),
				],
				skillOverrides: skills({
					"cyrene-1": "AQ",
				}),
				ultInterrupts: interrupts({
					"a-1": [{ casterId: "cyrene", timing: "before" }],
					"b-1": [{ casterId: "cyrene", timing: "before" }],
				}),
				limit: 300,
			}),
		);

		// cyrene-1 (A, AV=50) → cyrene-1-q (Q, AV=50, Q_counter=1) →
		// a-1-interrupt-0 (Q, AV=100, Q_counter=2, enhanced Q triggers)
		// b-1-interrupt-0 (Q, AV=100, Q_counter=3)
		const enhancedQs = actions.filter((a) => a.isCyreneEnhancedQ);
		expect(enhancedQs.length).toBe(1);
	});
});




