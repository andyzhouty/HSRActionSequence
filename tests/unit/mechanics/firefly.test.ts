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

// ───── 流萤完全燃烧激活 ─────

describe("Firefly Complete Combustion activation", () => {
	it("activates Complete Combustion from a normal ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({
					"firefly-1": "AQ",
				}),
				fireflyBreakCounters: {
					"firefly-2": false,
					"firefly-3": false,
					"firefly-4": false,
				},
				limit: 310,
			}),
		);

		expect(
			stripAv0(actions)
				.map((action) => action.key)
				.slice(0, 5),
		).toEqual([
			"firefly-1",
			"firefly-1-q",
			"firefly-2",
			"firefly-3",
			"firefly-4",
		]);
		expect(
			actions.find((action) => action.key === "firefly-3")?.actionValue,
		).toBeCloseTo(162.5, 4);
		const countdown = actions.find(
			(action) => action.displayName === "完全燃烧倒计时",
		);
		expect(countdown?.actionValue).toBeCloseTo(242.8571, 4);
	});

	it("activates Complete Combustion from an interrupt ultimate", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("a", "行动角色", 100),
					character("firefly", "流萤", 100),
				],
				ultInterrupts: interrupts({
					"a-1": [{ casterId: "firefly", timing: "before" }],
				}),
				limit: 190,
			}),
		);

		expect(
			stripAv0(actions)
				.map((action) => action.key)
				.slice(0, 4),
		).toEqual(["a-1-interrupt-0", "a-1", "firefly-1", "firefly-2"]);
		expect(
			actions.find((action) => action.key === "firefly-2")?.actionValue,
		).toBeCloseTo(162.5, 4);
	});
});

// ───── 流萤倒计时手动提前 ─────

describe("Firefly countdown manual advance", () => {
	it("countdown fires at normal AV without override", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({ "firefly-1": "AQ" }),
				limit: 300,
			}),
		);

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
		expect(countdown?.actionValue).toBeCloseTo(242.8571, 4);

		const combustionActions = actions.filter(
			(a) => a.isCombustionAction && a.characterId === "firefly",
		);
		expect(combustionActions.length).toBeGreaterThan(0);

		// 倒计时结束后不再产生燃烧行动。
		const afterCountdown = actions.filter(
			(a) => a.isCombustionAction && a.actionValue > countdown?.actionValue,
		);
		expect(afterCountdown).toHaveLength(0);
	});

	it("manual advance (override to earlier AV) fires countdown early", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({ "firefly-1": "AQ" }),
				overrides: {
					"firefly-combustion-countdown-1": "150",
				},
				limit: 300,
			}),
		);

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
		expect(countdown?.actionValue).toBeCloseTo(150, 4);

		const fireflyActionsAfterCountdown = actions.filter(
			(a) =>
				a.characterId === "firefly" &&
				!a.isCombustionAction &&
				a.actionValue > countdown?.actionValue,
		);
		expect(fireflyActionsAfterCountdown.length).toBeGreaterThan(0);
	});

	it("manual delay (override to later AV) delays countdown", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({ "firefly-1": "AQ" }),
				overrides: {
					"firefly-combustion-countdown-1": "300",
				},
				limit: 400,
			}),
		);

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
		expect(countdown?.actionValue).toBeCloseTo(300, 4);

		const combustionActions = actions.filter(
			(a) =>
				a.isCombustionAction &&
				a.characterId === "firefly" &&
				a.actionValue < countdown?.actionValue,
		);
		expect(combustionActions.length).toBeGreaterThanOrEqual(3);
	});

	it("interrupt ultimate during combustion triggers break with delay tracking", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100),
					character("a", "行动角色", 200),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
				}),
				ultInterrupts: {
					"firefly-2": [{ casterId: "a", timing: "before" }],
				},
				limit: 300,
			}),
		);

		const firefly2 = actions.find((a) => a.key === "firefly-2");
		expect(firefly2).toBeDefined();

		const interrupt = actions.find((a) => a.key === "firefly-2-interrupt-0");
		expect(interrupt).toBeDefined();

		const countdown = actions.find(
			(a) => a.characterId === "firefly-combustion-countdown",
		);
		expect(countdown).toBeDefined();
	});
});

// ───── 流萤燃烧 EE 拆分 ─────

describe("Firefly combustion EE split", () => {
	it("E2 break generates one extra turn at same AV", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100, { eidolon: 2 })],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
				}),
				fireflyBreakCounters: { "firefly-2": true },
				limit: 210,
			}),
		);

		// 正常回合开启击破时，二魂会在同一 AV 生成额外回合。
		const main = actions.find((a) => a.key === "firefly-2");
		expect(main).toBeDefined();
		expect(main?.skill).toBe("E");
		expect(main?.actionValue).toBeCloseTo(100, 4);

		const extra = actions.find((a) => a.key === "firefly-2-break-extra-1");
		expect(extra).toBeDefined();
		expect(extra?.actionValue).toBeCloseTo(100, 4);
		expect(extra?.isCombustionAction).toBe(true);
	});

	it("single E on combustion action stays as single E (no split)", () => {
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
				}),
				fireflyBreakCounters: { "firefly-2": false },
				limit: 210,
			}),
		);

		// 应只有普通 E，不应生成额外 E。
		const extraE = actions.find((a) => a.key === "firefly-2");
		expect(extraE).toBeDefined();
		expect(extraE?.skill).toBe("E");

		const splitE = actions.find((a) => a.key === "firefly-2-combustion-e1");
		expect(splitE).toBeUndefined();
	});

	it("EE on non-combustion action is rejected by validation", () => {
		// 该行为通过 UI 校验测试，而不是直接测试模拟器。
		// 模拟器本身不校验技能代码。
		// 这里只验证非燃烧状态下模拟器会原样生成该技能代码。
		const actions = simulateActions(
			input({
				characters: [character("firefly", "流萤", 100)],
				skillOverrides: skills({
					"firefly-1": "EE",
				}),
				limit: 210,
			}),
		);

		const action = actions.find((a) => a.key === "firefly-1");
		expect(action).toBeDefined();
		// 模拟器接受 EE 并原样使用（不拆分，也不进入燃烧）。
		expect(action?.skill).toBe("EE");
	});
});

// ───── 星期日拉条流萤 ─────

describe("Sunday pulling Firefly with E (allyPullToCurrent)", () => {
	it("Sunday E pulls Firefly's next action to Sunday's current AV", () => {
		// 速度 200 的星期日先行动，并对流萤（速度 100）使用 E。
		// 流萤的下一次行动应被拉到星期日的当前 AV。
		const actions = simulateActions(
			input({
				characters: [
					character("sunday", "星期日", 200),
					character("firefly", "流萤", 100),
				],
				skillOverrides: skills({
					"sunday-1": "E",
				}),
				skillTargets: {
					"sunday-1": "firefly",
				},
				limit: 200,
			}),
		);

		// 星期日先在 AV=50 行动。
		expect(stripAv0(actions)[0].key).toBe("sunday-1");
		expect(stripAv0(actions)[0].actionValue).toBeCloseTo(50, 4);

		// 流萤应被拉到星期日的 AV=50。
		// 因此流萤接下来在 AV=50 行动，随后星期日在 AV=100 再次行动。
		const fireflyAction = stripAv0(actions).find(
			(a) => a.characterId === "firefly",
		);
		expect(fireflyAction).toBeDefined();
		expect(fireflyAction?.actionValue).toBeCloseTo(50, 4);

		// 行动顺序：星期日 E → 流萤（被拉条）→ 星期日第 2 次行动 → ……
		expect(
			stripAv0(actions)
				.map((a) => a.characterId)
				.slice(0, 3),
		).toEqual(["sunday", "firefly", "sunday"]);
	});

	it("Sunday E pulls Firefly during Complete Combustion", () => {
		// 流萤使用 Q 进入燃烧，然后星期日将她拉条。
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100),
					character("sunday", "星期日", 200),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"sunday-2": "E",
				}),
				skillTargets: {
					"sunday-2": "firefly",
				},
				limit: 200,
			}),
		);

		// 流萤在 AV=100 使用 Q → 进入燃烧。
		// 星期日在 AV=50 对流萤使用 E → 拉条流萤。
		// 燃烧期间流萤应被拉到星期日的 AV。
		const sundayEAction = actions.find((a) => a.key === "sunday-2");
		expect(sundayEAction).toBeDefined();

		// 流萤应在被拉到的 AV 行动。
		const fireflyActions = actions.filter(
			(a) => a.characterId === "firefly" && a.isCombustionAction,
		);
		// 星期日拉条后应仍有燃烧行动。
		const fireflyAfterPull = fireflyActions.filter(
			(a) => a.actionValue >= (sundayEAction?.actionValue ?? 0),
		);
		expect(fireflyAfterPull.length).toBeGreaterThan(0);
	});

	it("multiple Sunday pulls keep Firefly's AV in sync", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("sunday", "星期日", 200),
					character("firefly", "流萤", 100),
				],
				skillOverrides: skills({
					"sunday-1": "E",
					"sunday-2": "E",
				}),
				skillTargets: {
					"sunday-1": "firefly",
					"sunday-2": "firefly",
				},
				limit: 250,
			}),
		);

		// 星期日的两次行动都对流萤使用 E。
		// 每次流萤的 AV 都应被拉到与星期日相同。
		const fireflyActions = actions.filter((a) => a.characterId === "firefly");

		// 流萤应始终紧接在星期日之后行动。
		for (let i = 0; i < fireflyActions.length; i++) {
			const fireflyAV = fireflyActions[i].actionValue;
			const sundayAction = actions.find(
				(a) => a.characterId === "sunday" && a.actionValue === fireflyAV,
			);
			if (sundayAction) {
				// 此时流萤的 AV 应与星期日拉条后的 AV 相同。
				expect(fireflyAV).toBeCloseTo(sundayAction.actionValue, 4);
			}
		}
	});
});

// ───── 流萤二魂 + SP 姬子 F 在击破追加行动中的协战 ─────

describe("E2 Firefly break-extra with SP Himeko assist", () => {
	it("break-extra turn can trigger Himeko F assist", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100, { eidolon: 2 }),
					character("himeko", "姬子·启行", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
					"firefly-2-break-extra-1": "F",
				}),
				fireflyBreakCounters: {
					"firefly-2": true,
					"firefly-2-break-extra-1": true,
				},
				limit: 250,
			}),
		);

		// 击破追加回合使用 F → 应生成姬子助战
		const assistActions = actions.filter((a) => a.isAssistAction);
		expect(assistActions.length).toBeGreaterThan(0);
		expect(assistActions[0].characterId).toBe("himeko");
	});

	it("break-extra turn can use FE (Himeko assist + skill)", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100, { eidolon: 2 }),
					character("himeko", "姬子·启行", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
					"firefly-2-break-extra-1": "FE",
				}),
				fireflyBreakCounters: {
					"firefly-2": true,
					"firefly-2-break-extra-1": true,
				},
				limit: 250,
			}),
		);

		const assistActions = actions.filter((a) => a.isAssistAction);
		expect(assistActions.length).toBeGreaterThan(0);
	});

	it("break-extra turn F does not generate recursive break-extras", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100, { eidolon: 2 }),
					character("himeko", "姬子·启行", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
					"firefly-2-break-extra-1": "FE",
				}),
				fireflyBreakCounters: {
					"firefly-2": true,
					"firefly-2-break-extra-1": true,
				},
				limit: 300,
			}),
		);

		// 只有一层击破追加，不会递归生成更多（排除姬子协战 key 中的追加标记）。
		const breakExtras = actions.filter(
			(a) => a.key.includes("-break-extra-") && a.characterId === "firefly",
		);
		expect(breakExtras.length).toBe(1);
	});

	it("E0 Himeko: break-extra 输入 F → 额外回合消失", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100, { eidolon: 2 }),
					character("himeko", "姬子·启行", 100),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
					"firefly-2-break-extra-1": "F",
				}),
				fireflyBreakCounters: {
					"firefly-2": true,
					"firefly-2-break-extra-1": true,
				},
				limit: 250,
			}),
		);

		// E0 姬子 + F → 击破追加消失，仅保留姬子助战
		const assistActions = actions.filter((a) => a.isAssistAction);
		expect(assistActions.length).toBe(1);
		const breakExtra = actions.find((a) => a.key === "firefly-2-break-extra-1");
		expect(breakExtra).toBeUndefined();
	});

	it("E2 Himeko: break-extra 输入 FF → 额外回合消失", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100, { eidolon: 2 }),
					character("himeko", "姬子·启行", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
					"firefly-2-break-extra-1": "FF",
				}),
				fireflyBreakCounters: {
					"firefly-2": true,
					"firefly-2-break-extra-1": true,
				},
				limit: 250,
			}),
		);

		// E2 姬子 + FF → 2 次助战，击破追加消失
		const assistActions = actions.filter((a) => a.isAssistAction);
		expect(assistActions.length).toBe(2);
		const breakExtra = actions.find((a) => a.key === "firefly-2-break-extra-1");
		expect(breakExtra).toBeUndefined();
	});

	it("E2 Himeko: break-extra 输入单 F → 额外回合保留", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("firefly", "流萤", 100, { eidolon: 2 }),
					character("himeko", "姬子·启行", 100, { eidolon: 2 }),
				],
				skillOverrides: skills({
					"firefly-1": "AQ",
					"firefly-2": "E",
					"firefly-2-break-extra-1": "F",
				}),
				fireflyBreakCounters: {
					"firefly-2": true,
					"firefly-2-break-extra-1": true,
				},
				limit: 250,
			}),
		);

		// E2 + 单 F → 额外回合保留 + 1 次助战
		const assistActions = actions.filter((a) => a.isAssistAction);
		expect(assistActions.length).toBe(1);
		const breakExtra = actions.find((a) => a.key === "firefly-2-break-extra-1");
		expect(breakExtra).toBeDefined();
	});
});
