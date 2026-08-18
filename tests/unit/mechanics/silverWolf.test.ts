import { describe, expect, it } from "vitest";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../../src/simulate/actions";
import type {
	CharacterConfig,
	SkillCode,
} from "../../../src/utils/action-sequence";

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

function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

function interrupts(
	entries: Record<
		string,
		import("../../../src/utils/action-sequence").UltInterrupt[]
	>,
): Record<string, import("../../../src/utils/action-sequence").UltInterrupt[]> {
	return entries;
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
		godmodeExtraActions: {},
		...overrides,
	};
}

// ───── 银狼LV.999 ─────

describe("Silver Wolf LV.999", () => {
	it("AQ 开大后自拉条（Q 在后，A 在前 Q 在后）", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				skillOverrides: skills({
					"sw-1": "AQ",
				}),
				limit: 300,
			}),
		);

		// sw-1（A）在 AV=100 → sw-1-q（Q）在 AV=100 → Q 自拉条 100%
		// sw-2 在 AV=100（与 Q 同 AV）
		const sw1 = actions.find((a) => a.key === "sw-1");
		expect(sw1).toBeDefined();
		expect(sw1?.actionValue).toBeCloseTo(100, 2);
		expect(sw1?.skill).toBe("A");

		const swQ = actions.find((a) => a.key === "sw-1-q");
		expect(swQ).toBeDefined();
		expect(swQ?.actionValue).toBeCloseTo(100, 2);
		expect(swQ?.skill).toBe("Q");

		// A 在 Q 之前
		const sw1Index = actions.indexOf(sw1);
		const swQIndex = actions.indexOf(swQ);
		expect(sw1Index).toBeLessThan(swQIndex);

		const sw2 = actions.find((a) => a.key === "sw-2");
		expect(sw2).toBeDefined();
		// Q 后 100% 提前 → sw-2 在 AV=100（同 AV）
		expect(sw2?.actionValue).toBeCloseTo(100, 2);

		// 进入无敌玩家状态，技能锁定为 A
		expect(sw2?.skill).toBe("A");
	});

	it("无敌玩家状态下技能锁定为 A，正常行动 3 次后退出", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				skillOverrides: skills({
					"sw-1": "AQ",
					"sw-5": "E",
					"sw-6": "E",
				}),
				limit: 900,
			}),
		);

		// sw-1 (A, 计数0→1) → sw-1-q (Q) → sw-2 (A, 计数1→2) → sw-3 (A, 计数2→3, 退出)
		// sw-2 和 sw-3 的技能应是 A（被锁定），即使 override 是 ""
		// sw-4 及之后恢复正常，sw-5 的 override "E" 应生效
		const sw2 = actions.find((a) => a.key === "sw-2");
		const sw3 = actions.find((a) => a.key === "sw-3");
		const sw4 = actions.find((a) => a.key === "sw-4");
		const sw5 = actions.find((a) => a.key === "sw-5");

		expect(sw2?.skill).toBe("A");
		expect(sw3?.skill).toBe("A");
		// sw-4 退出后恢复正常，无 override 时 skill 为 ""
		expect(sw4).toBeDefined();
		// sw-5 的 E 应正常生效
		expect(sw5?.skill).toBe("E");
	});

	it("QA 开大进入无敌玩家（Q 在前，自拉条无效）", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				skillOverrides: skills({
					"sw-1": "QA",
				}),
				limit: 400,
			}),
		);

		// sw-1-q (Q) 先行动 → 进入无敌玩家，无自拉条
		// sw-1 (A) 后行动
		// 正常间隔：10000/100=100，sw-2 应在 200
		const swQ = actions.find((a) => a.key === "sw-1-q");
		expect(swQ).toBeDefined();
		expect(swQ?.actionValue).toBeCloseTo(100, 2);
		expect(swQ?.skill).toBe("Q");

		const sw1 = actions.find((a) => a.key === "sw-1");
		expect(sw1).toBeDefined();
		expect(sw1?.actionValue).toBeCloseTo(100, 2);
		expect(sw1?.skill).toBe("A");

		// Q 在 A 之前
		const swQIndex = actions.indexOf(swQ);
		const sw1Index = actions.indexOf(sw1);
		expect(swQIndex).toBeLessThan(sw1Index);

		// 无自拉条 → sw-2 在正常间隔后的 AV
		const sw2 = actions.find((a) => a.key === "sw-2");
		expect(sw2).toBeDefined();
		expect(sw2?.actionValue).toBeCloseTo(200, 2);
	});

	it("QA: Q 在前立即进入无敌，A 作为第一次消耗（共 3 次退出）", () => {
		const actions = simulateActions(
			input({
				characters: [character("sw", "银狼LV.999", 100)],
				skillOverrides: skills({
					"sw-1": "QA",
					"sw-5": "AQ",
				}),
				limit: 600,
			}),
		);

		// sw-1: QA → Q 立即进无敌 → A 消耗 1/3
		// sw-2: A 消耗 2/3
		// sw-3: A 消耗 3/3 → 退出无敌
		// sw-4: 自由
		// sw-5: AQ → 再次进无敌
		expect(actions.find((a) => a.key === "sw-1-q")?.skill).toBe("Q");
		expect(actions.find((a) => a.key === "sw-1")?.skill).toBe("A");
		expect(actions.find((a) => a.key === "sw-1")?.lockedSkill).toBe(true);

		expect(actions.find((a) => a.key === "sw-2")?.skill).toBe("A");
		expect(actions.find((a) => a.key === "sw-2")?.lockedSkill).toBe(true);

		// sw-3: skill forced to A (getGodmodeSkill), lockedSkill false (退出后检查)
		expect(actions.find((a) => a.key === "sw-3")?.skill).toBe("A");

		// sw-4: 退出无敌，不再锁定
		expect(actions.find((a) => a.key === "sw-4")).toBeDefined();
		expect(actions.find((a) => a.key === "sw-4")?.lockedSkill).toBeFalsy();

		// sw-5: AQ，再次进无敌（Q 在后 → A 不消耗，Q 后进入）
		expect(actions.find((a) => a.key === "sw-5-q")?.skill).toBe("Q");
		expect(actions.find((a) => a.key === "sw-5")?.skill).toBe("A");
	});

	it("E2：在阿哈行动后可插入额外 A", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sw", "银狼LV.999", 200),
					character("sparxie", "火花", 160),
				],
				skillOverrides: skills({
					"sw-1": "AQ",
				}),
				godmodeExtraActions: {
					"@aha-1": true,
				},
				limit: 200,
			}),
		);

		// 阿哈时刻后应有银狼 E2 额外 A（SW 需先于阿哈进入无敌玩家）
		const extraA = actions.find((a) => a.key === "@aha-1-godmode-A");
		expect(extraA).toBeDefined();
		expect(extraA?.skill).toBe("A");
		expect(extraA?.displayName).toBe("银狼E2");
		expect(extraA?.characterId).toBe("sw");
	});

	it("E2：在队友行动后可插入额外 A（不消耗正常行动次数）", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sw", "银狼LV.999", 100),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"sw-1": "AQ",
					"ally-1": "E",
				}),
				godmodeExtraActions: {
					"ally-1": true,
				},
				limit: 300,
			}),
		);

		// ally-1 后应有 extra A（ally-1-godmode-A）
		const extraA = actions.find((a) => a.key === "ally-1-godmode-A");
		expect(extraA).toBeDefined();
		expect(extraA?.skill).toBe("A");
		expect(extraA?.displayName).toBe("银狼E2");
	});

	it("E2：在插队 Q 后也可插入额外 A", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sw", "银狼LV.999", 100),
					character("ally", "队友", 100),
				],
				skillOverrides: skills({
					"sw-1": "AQ",
				}),
				ultInterrupts: interrupts({
					"sw-2": [{ casterId: "ally", timing: "after" }],
				}),
				godmodeExtraActions: {
					"sw-2-interrupt-0": true,
				},
				limit: 400,
			}),
		);

		const extraA = actions.find((a) => a.key === "sw-2-interrupt-0-godmode-A");
		expect(extraA).toBeDefined();
		expect(extraA?.skill).toBe("A");
		expect(extraA?.displayName).toBe("银狼E2");
	});

	it("E2：在火花额外回合后也可插入额外 A", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sw", "银狼LV.999", 200),
					character("sparxie", "火花", 160, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"sw-1": "AQ",
				}),
				godmodeExtraActions: {
					"@aha-1-sparxie-extra": true,
				},
				limit: 200,
			}),
		);

		const extraA = actions.find(
			(a) => a.key === "@aha-1-sparxie-extra-godmode-A",
		);
		expect(extraA).toBeDefined();
		expect(extraA?.skill).toBe("A");
		expect(extraA?.displayName).toBe("银狼E2");
		expect(extraA?.characterId).toBe("sw");
	});

	it("E2：兼容旧的火花额外回合 Q 行 key", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sw", "银狼LV.999", 200),
					character("sparxie", "火花", 160, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"sw-1": "AQ",
					"@aha-1-sparxie-extra": "AQ",
				}),
				godmodeExtraActions: {
					"@aha-1-sparxie-extra-q": true,
				},
				limit: 200,
			}),
		);

		const extraA = actions.find(
			(a) => a.key === "@aha-1-sparxie-extra-godmode-A",
		);
		expect(extraA).toBeDefined();
		expect(extraA?.characterId).toBe("sw");
	});

	it("E2：可以连续插入两个 2 魂额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sw", "银狼LV.999", 200),
					character("sparxie", "火花", 160, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"sw-1": "AQ",
				}),
				godmodeExtraActions: {
					"@aha-1": true,
					"@aha-1-godmode-A": true,
				},
				limit: 200,
			}),
		);

		expect(actions.find((a) => a.key === "@aha-1-godmode-A")).toBeDefined();
		expect(
			actions.find((a) => a.key === "@aha-1-godmode-A-godmode-A"),
		).toBeDefined();
	});

	it("火花额外回合输入 F 时会触发姬子·启行助战，且 2 魂单 F 保留额外回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sparxie", "火花", 160, { eidolon: 2 }),
					character("himeko", "姬子·启行", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"@aha-1-sparxie-extra": "F",
				}),
				limit: 200,
			}),
		);

		expect(
			actions.find((a) => a.key === "@aha-1-sparxie-extra-assist-F"),
		).toBeDefined();
		expect(actions.find((a) => a.key === "@aha-1-sparxie-extra")).toBeDefined();
	});

	it("imported action-sequence-test.json: Silver Wolf Q before Sparxie extra self-pulls to same AV", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("c1", "sp银狼", 200),
					character("c2", "爻光", 180, { hasVonwacq: true }),
					character("c3", "火花", 130, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"c1-1": "E",
					"c2-1": "EQ",
				}),
				ultInterrupts: interrupts({
					"@aha-1-sparxie-extra": [{ casterId: "c1", timing: "before" }],
				}),
				limit: 250,
			}),
		);

		const swInterruptQ = actions.find(
			(a) => a.key === "@aha-1-sparxie-extra-interrupt-0",
		);
		const swNextAction = actions.find((a) => a.key === "c1-2");
		expect(swInterruptQ).toBeDefined();
		expect(swInterruptQ?.actionValue).toBeCloseTo(69.2041, 3);
		expect(swNextAction).toBeDefined();
		expect(swNextAction?.actionValue).toBeCloseTo(swInterruptQ?.actionValue, 3);
	});
});
