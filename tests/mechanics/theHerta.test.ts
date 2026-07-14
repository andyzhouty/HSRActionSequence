import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import type { CharacterConfig } from "../../src/utils/actionSequence";

function character(id: string, eidolon = 0): CharacterConfig {
	return {
		id,
		kind: "角色",
		name: "大黑塔",
		speed: "100",
		baseSpeed: "",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon,
		superimpose: 1,
		lc_id: 0,
	};
}

function input(overrides: Partial<Parameters<typeof simulateActions>[0]> = {}) {
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
		...overrides,
	};
}

describe("大黑塔灵感", () => {
	it("E0 初始灵感为 0，普通 E 不会强化", () => {
		const actions = simulateActions(
			input({
				characters: [character("herta")],
				skillOverrides: { "herta-1": "E" },
				limit: 120,
			}),
		);
		expect(actions.find((action) => action.key === "herta-1")).toMatchObject({
			skill: "E",
			isTheHertaEnhancedE: false,
			theHertaInspiration: 0,
		});
	});

	it("Q 为 E0/E1 增加一点灵感，后续 E 变为强化 E", () => {
		const actions = simulateActions(
			input({
				characters: [character("herta")],
				skillOverrides: { "herta-1": "AQ", "herta-2": "E" },
				limit: 220,
			}),
		);
		expect(actions.find((action) => action.key === "herta-1-q")).toMatchObject({
			skill: "Q",
			theHertaInspiration: 1,
		});
		expect(actions.find((action) => action.key === "herta-2")).toMatchObject({
			skill: "E",
			isTheHertaEnhancedE: true,
			theHertaInspiration: 1,
		});
	});

	it("E2 初始一点灵感，强化 E 消耗一点并将下一动提前 35%", () => {
		const actions = simulateActions(
			input({
				characters: [character("herta", 2)],
				skillOverrides: { "herta-1": "E" },
				limit: 200,
			}),
		);
		expect(actions.find((action) => action.key === "herta-1")).toMatchObject({
			actionValue: 100,
			isTheHertaEnhancedE: true,
			theHertaInspiration: 0,
		});
		expect(
			actions.find((action) => action.key === "herta-2")?.actionValue,
		).toBe(165);
	});

	it("E2 的强化 E 只消耗一层，后续灵感仍可继续强化", () => {
		const actions = simulateActions(
			input({
				characters: [character("herta", 2)],
				skillOverrides: {
					"herta-1": "AQ",
					"herta-2": "E",
					"herta-3": "E",
				},
				limit: 300,
			}),
		);
		expect(
			actions.find((action) => action.key === "herta-1-q")?.theHertaInspiration,
		).toBe(3);
		expect(actions.find((action) => action.key === "herta-2")).toMatchObject({
			isTheHertaEnhancedE: true,
			theHertaInspiration: 2,
		});
		expect(actions.find((action) => action.key === "herta-3")).toMatchObject({
			isTheHertaEnhancedE: true,
			theHertaInspiration: 1,
		});
	});

	it("E2 的 Q 每次增加两点灵感，并在四点封顶", () => {
		const actions = simulateActions(
			input({
				characters: [character("herta", 2)],
				skillOverrides: {
					"herta-1": "AQ",
					"herta-2": "AQ",
					"herta-3": "AQ",
				},
				limit: 250,
			}),
		);
		expect(
			actions.find((action) => action.key === "herta-1-q")?.theHertaInspiration,
		).toBe(3);
		expect(
			actions.find((action) => action.key === "herta-2-q")?.theHertaInspiration,
		).toBe(4);
		expect(
			actions.find((action) => action.key === "herta-3-q")?.theHertaInspiration,
		).toBe(4);
	});

	it("E4 为全队智识角色提供 12% 固定基础速度加成", () => {
		const herta = {
			...character("herta", 4),
			baseSpeed: "300",
		};
		const anaxa = {
			...character("anaxa"),
			name: "那刻夏",
			baseSpeed: "300",
		};
		const himeko = {
			...character("himeko"),
			name: "姬子",
			baseSpeed: "120",
		};
		const tingyun = {
			...character("tingyun"),
			name: "停云",
			baseSpeed: "120",
		};
		const actions = simulateActions(
			input({ characters: [herta, anaxa, himeko, tingyun], limit: 120 }),
		);
		expect(
			actions.find((action) => action.key === "herta-1")?.speed,
		).toBeCloseTo(111.88);
		expect(
			actions.find((action) => action.key === "anaxa-1")?.speed,
		).toBeCloseTo(111.64);
		expect(actions.find((action) => action.key === "himeko-1")?.speed).toBe(
			114.4,
		);
		expect(actions.find((action) => action.key === "tingyun-1")?.speed).toBe(
			100,
		);
	});
});
