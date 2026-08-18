import { describe, expect, it } from "vitest";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../../src/simulate/actions";
import type {
	CharacterConfig,
	SkillCode,
	UltInterrupt,
} from "../../../src/utils/action-sequence";

const stripAv0 = (axs: { characterId: string }[]) =>
	axs.filter((a) => a.characterId !== "@av0");

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

function enemy(
	id: string,
	name: string,
	speed: number,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "敌人",
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
		limit: 300,
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

// ───── Phainon (白厄) ─────

describe("Phainon (白厄)", () => {
	it("keeps Aha moment on its normal independent timeline inside the domain", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 200),
					character("sparxie", "火花", 160),
				],
				skillOverrides: skills({ "phainon-1": "AQ" }),
				limit: 300,
			}),
		);

		const aha = actions.find((action) => action.isAhaInstant);
		const domainActions = actions.filter((action) => action.isDomainAction);
		expect(aha).toBeDefined();
		expect(aha!.actionValue).toBeGreaterThan(domainActions[0].actionValue);
		expect(aha!.actionValue).toBeLessThan(
			domainActions[domainActions.length - 1].actionValue,
		);
	});

	it("enters domain state after ultimate and generates domain actions", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "AQ",
				}),
				limit: 300,
			}),
		);

		// 第一次行动：Q → 开始建立境界。
		expect(stripAv0(actions)[0].key).toBe("phainon-1");
		expect(stripAv0(actions)[0].skill).toBe("A");

		// 后续为境界行动（isDomainAction: true）。
		const domainActions = actions.filter((a) => a.isDomainAction);
		expect(domainActions.length).toBeGreaterThanOrEqual(8);
		expect(domainActions[0].isDomainAction).toBe(true);
		expect(domainActions[0].actionValue).toBeCloseTo(100, 4);

		// 最后一次境界行动应为终结行动（Q）。
		const finalDomain = domainActions[domainActions.length - 1];
		expect(finalDomain.isDomainFinalAction).toBe(true);
		expect(finalDomain.skill).toBe("Q");

		// 境界行动的行动值应递增。
		for (let i = 1; i < domainActions.length; i++) {
			expect(domainActions[i].actionValue).toBeGreaterThan(
				domainActions[i - 1].actionValue,
			);
		}
	});

	it("generates 7 non-final domain actions by default (extraActionCount=8)", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "AQ",
				}),
				limit: 300,
			}),
		);

		const domainActions = actions.filter((a) => a.isDomainAction);
		// extraActionCount=8 → 索引为 0-7，其中索引 7 为终结行动。
		// 因此是 7 次非终结行动 + 1 次终结行动，共 8 次境界行动。
		expect(domainActions).toHaveLength(8);
		expect(domainActions.filter((a) => !a.isDomainFinalAction)).toHaveLength(7);
		expect(domainActions.filter((a) => a.isDomainFinalAction)).toHaveLength(1);
	});

	it("domain interval differs with eidolon 1", () => {
		const actionsE0 = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({ "phainon-1": "AQ" }),
				limit: 300,
			}),
		);
		const actionsE1 = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100, { eidolon: 1 })],
				skillOverrides: skills({ "phainon-1": "AQ" }),
				limit: 300,
			}),
		);

		const domainE0 = actionsE0.filter((a) => a.isDomainAction);
		const domainE1 = actionsE1.filter((a) => a.isDomainAction);

		// E1 的等效速度系数更高（0.66 对比 0.6），
		// 因此境界间隔更小，境界行动排列更紧密。
		if (domainE0.length > 1 && domainE1.length > 1) {
			const gapE0 = domainE0[1].actionValue - domainE0[0].actionValue;
			const gapE1 = domainE1[1].actionValue - domainE1[0].actionValue;
			expect(gapE1).toBeLessThan(gapE0);
		}
	});

	it("applies speed bonus to allies after domain ends", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100),
					character("ally", "队友", 80),
				],
				skillOverrides: skills({
					"phainon-1": "AQ",
				}),
				limit: 600,
			}),
		);

		const finalDomain = actions.find((a) => a.isDomainFinalAction);
		expect(finalDomain).toBeDefined();

		// 境界结束后，队友会被暂停并推到境界结束之后，
		// 同时获得速度加成（基础速度的 15%）。
		const finalAV = finalDomain?.actionValue;
		const allyAfter = actions.find(
			(a) => a.characterId === "ally" && a.actionValue > finalAV,
		);
		expect(allyAfter).toBeDefined();
		expect(allyAfter?.actionValue).toBeGreaterThan(finalAV);
	});

	it("respects domain end override to end domain early", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "AQ",
				}),
				domainEndOverrides: {
					"phainon-1-domain-2": true,
				},
				limit: 300,
			}),
		);

		const domainActions = actions.filter((a) => a.isDomainAction);
		// 境界应在索引 2（从 0 开始）结束，即共 3 次境界行动。
		expect(domainActions.length).toBeLessThanOrEqual(4);
		const finalDomain = domainActions[domainActions.length - 1];
		expect(finalDomain.isDomainFinalAction).toBe(true);
		expect(finalDomain.key).toBe("phainon-1-domain-2");
	});

	it("allows enemy actions to interleave during domain", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100),
					enemy("e1", "敌人", 200),
				],
				skillOverrides: skills({
					"phainon-1": "AQ",
				}),
				limit: 200,
			}),
		);

		// 敌人应在境界期间行动（位于境界行动之间）。
		const enemyActions = actions.filter((a) => a.characterId === "e1");
		expect(enemyActions.length).toBeGreaterThan(0);
	});

	it("triggers enemy immediate action on W/EW domain skills", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100),
					enemy("e1", "敌人", 200),
				],
				skillOverrides: skills({
					"phainon-1": "AQ",
					"phainon-1-domain-0": "W",
				}),
				limit: 200,
			}),
		);

		// 境界期间的 W 技能应在同一 AV 触发敌方行动。
		const domainWAction = actions.find((a) => a.key === "phainon-1-domain-0");
		expect(domainWAction).toBeDefined();
		expect(domainWAction?.skill).toBe("W");

		// 敌方应在与境界 W 行动相同的 AV 被触发行动。
		const triggerActions = actions.filter(
			(a) =>
				a.key?.includes("enemy") &&
				a.actionValue === domainWAction?.actionValue,
		);
		expect(triggerActions.length).toBeGreaterThan(0);
	});

	it("enters domain from interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("phainon", "白厄", 100),
				],
				ultInterrupts: interrupts({
					"a-1": [{ casterId: "phainon", timing: "before" }],
				}),
				limit: 300,
			}),
		);

		// 插队触发白厄的 Q → 后续应产生境界行动。
		const domainActions = actions.filter((a) => a.isDomainAction);
		expect(domainActions.length).toBeGreaterThan(0);

		// 境界应从插队行动开始。
		const interruptAction = actions.find((a) => a.key === "a-1-interrupt-0");
		expect(interruptAction).toBeDefined();
	});

	it("domain is capped by extraActionCount without endless Ode effect", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "AQ",
				}),
				limit: 600,
			}),
		);

		const domainActions = actions.filter((a) => a.isDomainAction);
		// extraActionCount=8 → 共 8 次境界行动（7 次非终结行动 + 1 次终结行动）。
		expect(domainActions).toHaveLength(8);

		const finalDomain = domainActions[domainActions.length - 1];
		expect(finalDomain.isDomainFinalAction).toBe(true);
	});

	it("E2 未勾选时 EA 和 EW 降级为普攻（空字符串）", () => {
		const actions = simulateActions(
			input({
				characters: [character("phainon", "白厄", 100)],
				skillOverrides: skills({
					"phainon-1": "AQ",
					"phainon-1-domain-0": "EW",
					"phainon-1-domain-1": "EA",
					"phainon-1-domain-2": "E",
				}),
				limit: 300,
			}),
		);

		const domain0 = actions.find((a) => a.key === "phainon-1-domain-0");
		const domain1 = actions.find((a) => a.key === "phainon-1-domain-1");
		const domain2 = actions.find((a) => a.key === "phainon-1-domain-2");

		expect(domain0).toBeDefined();
		expect(domain1).toBeDefined();
		expect(domain2).toBeDefined();

		// 无 E2：EA 和 EW 降级为 ""（普攻）
		expect(domain0?.skill).toBe("");
		expect(domain1?.skill).toBe("");
		// E 不受影响
		expect(domain2?.skill).toBe("E");
	});

	it("E2 勾选时 EA 和 EW 正常生效", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("phainon", "白厄", 100, {
						eidolon: 2,
					}),
				],
				skillOverrides: skills({
					"phainon-1": "AQ",
					"phainon-1-domain-0": "EW",
					"phainon-1-domain-1": "EA",
				}),
				limit: 300,
			}),
		);

		const domain0 = actions.find((a) => a.key === "phainon-1-domain-0");
		const domain1 = actions.find((a) => a.key === "phainon-1-domain-1");

		expect(domain0).toBeDefined();
		expect(domain1).toBeDefined();

		// 有 E2：EA 和 EW 正常
		expect(domain0?.skill).toBe("EW");
		expect(domain1?.skill).toBe("EA");
	});
});
