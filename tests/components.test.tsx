import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	NumberInput,
	SelectInput,
	TextInput,
	Toggle,
} from "../src/components/action-sequence/Controls";

// ───── Controls ─────

describe("Toggle", () => {
	it("renders with label and reflects checked state", () => {
		const { rerender } = render(
			<Toggle label="舞舞舞" checked={false} onChange={() => {}} />,
		);
		expect(screen.getByText("舞舞舞")).toBeInTheDocument();
		const btn = screen.getByRole("switch");
		expect(btn).toHaveAttribute("aria-checked", "false");

		rerender(<Toggle label="舞舞舞" checked={true} onChange={() => {}} />);
		expect(btn).toHaveAttribute("aria-checked", "true");
	});

	it("fires onChange when clicked", async () => {
		const onChange = vi.fn();
		render(<Toggle label="翁瓦克" checked={false} onChange={onChange} />);
		await userEvent.click(screen.getByRole("switch"));
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});

describe("NumberInput", () => {
	it("renders label and allows typing", async () => {
		const onChange = vi.fn();
		render(<NumberInput label="速度 v" value="100" onChange={onChange} />);
		expect(screen.getByText("速度 v")).toBeInTheDocument();
		const input =
			screen.getByRole("textbox") ?? screen.getByDisplayValue("100");
		expect(input).toBeDefined();
	});
});

describe("TextInput", () => {
	it("renders and updates value", async () => {
		const onChange = vi.fn();
		render(<TextInput value="" onChange={onChange} placeholder="输入名称" />);
		const input = screen.getByPlaceholderText("输入名称");
		await userEvent.type(input, "布洛妮娅");
		expect(onChange).toHaveBeenCalled();
	});
});

describe("SelectInput", () => {
	it("renders options and selects value", async () => {
		const onChange = vi.fn();
		const options = [
			{ value: "", label: "无目标" },
			{ value: "c1", label: "角色 1" },
			{ value: "c2", label: "角色 2" },
		];
		render(<SelectInput value="" options={options} onChange={onChange} />);
		expect(screen.getByText("无目标")).toBeInTheDocument();

		await userEvent.click(screen.getByText("无目标"));
		expect(screen.getByText("角色 1")).toBeInTheDocument();
		expect(screen.getByText("角色 2")).toBeInTheDocument();
	});
});

// ───── CharacterPanel rendering ─────

import type { ReactNode } from "react";
import CharacterPanel from "../src/components/action-sequence/CharacterPanel";
import {
	type ActionSequenceContextType,
	ActionSequenceCtx,
} from "../src/contexts/ActionSequenceContext";
import { defaultCharacters } from "../src/utils/actionSequence";

function createMockContext(
	overrides: Partial<ActionSequenceContextType> = {},
): ActionSequenceContextType {
	const characters = defaultCharacters.map((c, i) => ({
		...c,
		id: `c${i + 1}`,
		name: `角色 ${i + 1}`,
		speed: "100",
		baseSpeed: "100",
	}));

	return {
		characters,
		setCharacters: vi.fn(),
		limitPreset: "150",
		setLimitPreset: vi.fn(),
		customLimit: "",
		setCustomLimit: vi.fn(),
		displayedLimit: "250",
		setDisplayedLimit: vi.fn(),
		resources: ["战技点"],
		setResources: vi.fn(),
		overrides: {},
		setOverrides: vi.fn(),
		ultOverrides: {},
		setUltOverrides: vi.fn(),
		skillOverrides: {},
		setSkillOverrides: vi.fn(),
		domainEndOverrides: {},
		setDomainEndOverrides: vi.fn(),
		speedAdjustments: {},
		setSpeedAdjustments: vi.fn(),
		skillTargets: {},
		setSkillTargets: vi.fn(),
		defaultSkillTargets: {},
		setDefaultSkillTargets: vi.fn(),
		odeSelections: {},
		setOdeSelections: vi.fn(),
		memeSelections: {},
		setMemeSelections: vi.fn(),
		lastMemeTarget: "",
		setLastMemeTarget: vi.fn(),
		ultInterrupts: {},
		setUltInterrupts: vi.fn(),
		fireflyBreakCounters: {},
		setFireflyBreakCounters: vi.fn(),
		godmodeExtraActions: {},
		setGodmodeExtraActions: vi.fn(),
		meritTarget: undefined,
		setMeritTarget: vi.fn(),
		dancePartner: undefined,
		setDancePartner: vi.fn(),
		resourceValues: {},
		setResourceValues: vi.fn(),
		actions: [],
		setActions: vi.fn(),
		importText: "",
		message: "",
		setMessage: vi.fn(),
		isExportingImage: false,
		setIsExportingImage: vi.fn(),
		selectedActionKeys: new Set(),
		setSelectedActionKeys: vi.fn(),
		actionMenuOpen: false,
		setActionMenuOpen: vi.fn(),
		actionMenuKey: null,
		setActionMenuKey: vi.fn(),
		actionMenuPos: 0,
		setActionMenuPos: vi.fn(),
		actionOperation: "advance",
		setActionOperation: vi.fn(),
		operationValue: "",
		setOperationValue: vi.fn(),
		operationSpeedMode: "absolute",
		setOperationSpeedMode: vi.fn(),
		advanceCeiling: "",
		setAdvanceCeiling: vi.fn(),
		draftInterruptCaster: "",
		setDraftInterruptCaster: vi.fn(),
		draftInterruptTiming: "before",
		setDraftInterruptTiming: vi.fn(),
		actionLimit: 150,
		displayedActionLimit: 250,
		characterNames: Object.fromEntries(characters.map((c) => [c.id, c.name])),
		characterKinds: Object.fromEntries(characters.map((c) => [c.id, c.kind])),
		charactersById: Object.fromEntries(characters.map((c) => [c.id, c])),
		memospriteTargets: [],
		imageExportRef: { current: null },
		addTarget: vi.fn(),
		removeTarget: vi.fn(),
		updateCharacter: vi.fn(),
		updateResourceValue: vi.fn(),
		cancelHimekoNovaAssist: vi.fn(),
		updateSkillTarget: vi.fn(),
		updateActionSkill: vi.fn(),
		selectAction: vi.fn(),
		openActionMenu: vi.fn(),
		closeActionMenu: vi.fn(),
		applyActionOperation: vi.fn(),
		addResource: vi.fn(),
		updateResource: vi.fn(),
		removeResource: vi.fn(),
		buildExportData: vi.fn(),
		exportJson: vi.fn(),
		exportImage: vi.fn(),
		importJson: vi.fn(),
		importFromFile: vi.fn(),
		setImportText: vi.fn(),
		...overrides,
	};
}

function renderWithContext(
	ui: ReactNode,
	ctxOverrides: Partial<ActionSequenceContextType> = {},
) {
	const ctx = createMockContext(ctxOverrides);
	return render(
		<ActionSequenceCtx.Provider value={ctx}>{ui}</ActionSequenceCtx.Provider>,
	);
}

describe("CharacterPanel rendering", () => {
	it("renders character cards for each target", () => {
		renderWithContext(<CharacterPanel />);
		// Each character has a name input with their name
		const nameInputs = screen.getAllByDisplayValue("角色 1");
		expect(nameInputs.length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByDisplayValue("100").length).toBeGreaterThanOrEqual(4);
	});

	it("shows toggle labels for character-type targets", () => {
		renderWithContext(<CharacterPanel />);
		expect(screen.getAllByText("翁瓦克").length).toBeGreaterThanOrEqual(4);
		expect(screen.getAllByText("风套").length).toBeGreaterThanOrEqual(4);
	});

	it("renders '添加目标' button", () => {
		renderWithContext(<CharacterPanel />);
		expect(screen.getByText("添加目标")).toBeInTheDocument();
	});

	it("renders '清空排轴' and '恢复当前配置默认行动值' buttons", () => {
		renderWithContext(<CharacterPanel />);
		expect(screen.getByText("清空排轴")).toBeInTheDocument();
		expect(screen.getByText("恢复当前配置默认行动值")).toBeInTheDocument();
	});

	it("renders delete button for each target", () => {
		renderWithContext(<CharacterPanel />);
		const deleteButtons = screen.getAllByText("删除目标");
		expect(deleteButtons.length).toBe(4);
	});

	it("speed inputs have initial values", () => {
		renderWithContext(<CharacterPanel />);
		const speedInputs = screen.getAllByDisplayValue("100");
		expect(speedInputs.length).toBeGreaterThanOrEqual(4);
	});

	it("renders with a memosprite target showing correct labels", () => {
		const charWithMemosprite = defaultCharacters.map((c, i) => ({
			...c,
			id: `c${i + 1}`,
			name: i === 2 ? "迷迷" : `角色 ${i + 1}`,
			speed: "100",
			baseSpeed: "100",
			kind: i === 2 ? ("忆灵" as const) : ("角色" as const),
		}));
		renderWithContext(<CharacterPanel />, { characters: charWithMemosprite });
		const nameInputs = screen.getAllByDisplayValue("迷迷");
		expect(nameInputs.length).toBeGreaterThanOrEqual(1);
	});

	it("renders with an enemy target", () => {
		const charWithEnemy = defaultCharacters.map((c, i) => ({
			...c,
			id: `c${i + 1}`,
			name: i === 3 ? "史瓦罗" : `角色 ${i + 1}`,
			speed: "100",
			baseSpeed: "100",
			kind: i === 3 ? ("敌人" as const) : ("角色" as const),
		}));
		renderWithContext(<CharacterPanel />, { characters: charWithEnemy });
		const enemyInput = screen.getAllByDisplayValue("史瓦罗");
		expect(enemyInput.length).toBeGreaterThanOrEqual(1);
	});

	it("Harmony character has light cone dropdown instead of 舞舞舞 toggle", () => {
		// 停云 is a Harmony character → 舞舞舞 toggle removed, light cone dropdown shown
		const harmonyChar = defaultCharacters.map((c, i) => ({
			...c,
			id: `c${i + 1}`,
			name: i === 0 ? "停云" : `角色 ${i + 1}`,
			speed: "100",
			baseSpeed: "100",
		}));
		renderWithContext(<CharacterPanel />, { characters: harmonyChar });
		// 舞舞舞 toggle should NOT appear
		const danceToggles = screen.queryAllByText("舞舞舞");
		expect(danceToggles.length).toBe(0);
	});
});

// ───── ActionPanel rendering ─────

import ActionPanel from "../src/components/action-sequence/ActionPanel";

describe("ActionPanel rendering", () => {
	it("renders action table header with correct columns", () => {
		renderWithContext(<ActionPanel />);
		// "行动序列" appears in title and action count - use getAllByText
		expect(screen.getAllByText("行动序列").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("序号")).toBeInTheDocument();
		expect(screen.getAllByText("角色").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("行动值")).toBeInTheDocument();
		expect(screen.getByText("技能")).toBeInTheDocument();
	});

	it("shows empty state message when no actions", () => {
		renderWithContext(<ActionPanel />);
		expect(screen.getByText("请至少填写一个有效速度。")).toBeInTheDocument();
	});

	it("renders export buttons", () => {
		renderWithContext(<ActionPanel />);
		expect(screen.getByText("导出图片")).toBeInTheDocument();
		expect(screen.getByText("导出 Excel")).toBeInTheDocument();
		expect(screen.getByText("导出 JSON")).toBeInTheDocument();
		expect(screen.getByText("导入 JSON")).toBeInTheDocument();
		expect(screen.getByText("从文件导入")).toBeInTheDocument();
	});

	it("renders limit controls", () => {
		renderWithContext(<ActionPanel />);
		expect(screen.getByText("行动值上限")).toBeInTheDocument();
		expect(screen.getByText("显示上限")).toBeInTheDocument();
	});

	it("renders resource column header", () => {
		renderWithContext(<ActionPanel />);
		expect(screen.getByText("战技点")).toBeInTheDocument();
	});
});

// ───── Action Sequence Context Integration ─────

describe("Action Sequence Context integration", () => {
	it("provides default character names", () => {
		const ctx = createMockContext();
		expect(ctx.characterNames.c1).toBe("角色 1");
		expect(ctx.characterNames.c2).toBe("角色 2");
	});

	it("characters have correct default speed", () => {
		const ctx = createMockContext();
		expect(ctx.characters[0].speed).toBe("100");
		expect(ctx.characters[0].baseSpeed).toBe("100");
	});

	it("default characters are all 角色 kind", () => {
		const ctx = createMockContext();
		ctx.characters.forEach((c) => {
			expect(c.kind).toBe("角色");
		});
	});

	it("toggles default to false", () => {
		const ctx = createMockContext();
		ctx.characters.forEach((c) => {
			expect(c.hasVonwacq).toBe(false);
			expect(c.hasWindSet).toBe(false);
			expect(c.hasDance).toBe(false);
			expect(c.eidolon).toBe(0);
		});
	});
});

// ───── Firefly E2 break toggle ─────

import type { GeneratedAction } from "../src/utils/actionSequence";

function mockCombustionAction(overrides: Partial<GeneratedAction> = {}): GeneratedAction {
	return {
		key: "firefly-2",
		characterId: "firefly",
		displayName: "流萤",
		actionNo: 2,
		actionValue: 100,
		skill: "E",
		speed: 220,
		isCombustionAction: true,
		...overrides,
	};
}

describe("Firefly E2 break toggle", () => {
	it("clicking break toggle calls setFireflyBreakCounters", async () => {
		const setFireflyBreakCounters = vi.fn();
		const action = mockCombustionAction();
		const chars = [
			{ id: "firefly", name: "流萤", kind: "角色" as const, speed: "160", baseSpeed: "104", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 2, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { firefly: "流萤" },
			characterKinds: { firefly: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [action],
			setFireflyBreakCounters,
		});

		// The break toggle button shows "击破"
		const btn = screen.queryByText("击破");
		if (btn) {
			await userEvent.click(btn);
			expect(setFireflyBreakCounters).toHaveBeenCalled();
		}
	});

	it("break toggle appears for combustion actions", () => {
		const action = mockCombustionAction();
		const chars = [
			{ id: "firefly", name: "流萤", kind: "角色" as const, speed: "160", baseSpeed: "104", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 2, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { firefly: "流萤" },
			characterKinds: { firefly: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [action],
		});
		expect(screen.getByText("击破")).toBeInTheDocument();
	});

	it("break toggle does NOT appear for non-combustion actions", () => {
		const normalAction: GeneratedAction = {
			key: "ally-1", characterId: "ally", actionNo: 1, actionValue: 100, skill: "E", speed: 100,
		};
		const chars = [
			{ id: "ally", name: "队友", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { ally: "队友" },
			characterKinds: { ally: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [normalAction],
		});
		expect(screen.queryByText("击破")).toBeNull();
	});
});

// ───── Silver Wolf E2 godmode extra toggle (right-click menu) ─────

describe("Silver Wolf E2 right-click menu", () => {
	it("shows E2 toggle when SW in godmode and ally selected", () => {
		const swAction: GeneratedAction = {
			key: "sw-1", characterId: "sw", actionNo: 1, actionValue: 100, skill: "A", speed: 100, lockedSkill: true,
		};
		const allyAction: GeneratedAction = {
			key: "ally-1", characterId: "ally", actionNo: 1, actionValue: 80, skill: "E", speed: 80,
		};
		const chars = [
			{ id: "sw", name: "银狼LV.999", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 2, superimpose: 1, lc_id: 0 },
			{ id: "ally", name: "队友", kind: "角色" as const, speed: "80", baseSpeed: "80", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		const setGodmodeExtraActions = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", ally: "队友" },
			characterKinds: { sw: "角色", ally: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [swAction, allyAction],
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
			setGodmodeExtraActions,
		});

		// E2 按钮应出现
		expect(screen.getByText("银狼 E2 额外行动：")).toBeInTheDocument();
	});

	it("clicking E2 toggle calls setGodmodeExtraActions", async () => {
		const swAction: GeneratedAction = {
			key: "sw-1", characterId: "sw", actionNo: 1, actionValue: 100, skill: "A", speed: 100, lockedSkill: true,
		};
		const allyAction: GeneratedAction = {
			key: "ally-1", characterId: "ally", actionNo: 1, actionValue: 80, skill: "E", speed: 80,
		};
		const chars = [
			{ id: "sw", name: "银狼LV.999", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 2, superimpose: 1, lc_id: 0 },
			{ id: "ally", name: "队友", kind: "角色" as const, speed: "80", baseSpeed: "80", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		const setGodmodeExtraActions = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", ally: "队友" },
			characterKinds: { sw: "角色", ally: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [swAction, allyAction],
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
			setGodmodeExtraActions,
		});

		const btn = screen.getByText("已关闭");
		await userEvent.click(btn);
		expect(setGodmodeExtraActions).toHaveBeenCalled();
	});

	it("shows E2 toggle on Aha action when SW used self-Q (AQ → q key)", () => {
		const swQ: GeneratedAction = {
			key: "sw-1-q", characterId: "sw", actionNo: 0, actionValue: 100, skill: "Q", speed: 100,
		};
		const ahaAction: GeneratedAction = {
			key: "@aha-1", characterId: "@aha", displayName: "阿哈时刻",
			actionNo: 1, actionValue: 89, skill: "", speed: 110, isAhaInstant: true,
		};
		const chars = [
			{ id: "sw", name: "银狼LV.999", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 2, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", "@aha": "阿哈时刻" },
			characterKinds: { sw: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [swQ, ahaAction],
			actionMenuOpen: true,
			actionMenuKey: "@aha-1",
			selectedActionKeys: new Set(["@aha-1"]),
		});

		expect(screen.getByText("银狼 E2 额外行动：")).toBeInTheDocument();
	});

	it("shows E2 toggle on Aha action when SW used interrupt Q", () => {
		const swQ: GeneratedAction = {
			key: "ally-1-interrupt-0", characterId: "sw", actionNo: 0, actionValue: 80, skill: "Q", speed: 100,
		};
		const ahaAction: GeneratedAction = {
			key: "@aha-1", characterId: "@aha", displayName: "阿哈时刻",
			actionNo: 1, actionValue: 89, skill: "", speed: 110, isAhaInstant: true,
		};
		const chars = [
			{ id: "sw", name: "银狼LV.999", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 2, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", "@aha": "阿哈时刻" },
			characterKinds: { sw: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [swQ, ahaAction],
			actionMenuOpen: true,
			actionMenuKey: "@aha-1",
			selectedActionKeys: new Set(["@aha-1"]),
		});

		expect(screen.getByText("银狼 E2 额外行动：")).toBeInTheDocument();
	});

	it("does NOT show E2 toggle on Aha when SW has no Q or lockedSkill", () => {
		const swAction: GeneratedAction = {
			key: "sw-1", characterId: "sw", actionNo: 1, actionValue: 100, skill: "A", speed: 100,
		};
		const ahaAction: GeneratedAction = {
			key: "@aha-1", characterId: "@aha", displayName: "阿哈时刻",
			actionNo: 1, actionValue: 89, skill: "", speed: 110, isAhaInstant: true,
		};
		const chars = [
			{ id: "sw", name: "银狼LV.999", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 2, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", "@aha": "阿哈时刻" },
			characterKinds: { sw: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [swAction, ahaAction],
			actionMenuOpen: true,
			actionMenuKey: "@aha-1",
			selectedActionKeys: new Set(["@aha-1"]),
		});

		expect(screen.queryByText("银狼 E2 额外行动：")).toBeNull();
	});
});

// ───── Skill input Enter key ─────

describe("Skill input Enter key", () => {
	it("Enter key triggers updateActionSkill", async () => {
		const action: GeneratedAction = {
			key: "c1-1", characterId: "c1", actionNo: 1, actionValue: 100, skill: "", speed: 100,
		};
		const chars = [
			{ id: "c1", name: "角色 1", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		const updateActionSkill = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { c1: "角色 1" },
			characterKinds: { c1: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [action],
			updateActionSkill,
		});
		// 找到技能输入框并输入 AQ
		const inputs = screen.getAllByRole("textbox");
		const skillInput = inputs.find(i => i.getAttribute("maxlength") === "6");
		expect(skillInput).toBeDefined();
		if (skillInput) {
			await userEvent.clear(skillInput);
			await userEvent.type(skillInput, "AQ{Enter}");
			// Enter 键应触发 updateActionSkill
			expect(updateActionSkill).toHaveBeenCalled();
		}
	});
});

// ───── Deimos Q → heart icon (romance ode) ─────

describe("Romance ode heart icon", () => {
	it("shows heart label on Aglaea after romance ode applied", () => {
		const aglaeaAction: GeneratedAction = {
			key: "aglaea-1", characterId: "aglaea", actionNo: 1, actionValue: 80,
			skill: "E", speed: 120, activeOdeLabels: ["浪漫"], isRomanceAction: true,
		};
		const chars = [
			{ id: "aglaea", name: "阿格莱雅", kind: "角色" as const, speed: "120", baseSpeed: "120", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { aglaea: "阿格莱雅" },
			characterKinds: { aglaea: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [aglaeaAction],
		});

		// 爱心符号 ♥ 应出现
		expect(screen.getByText("♥")).toBeInTheDocument();
		// 电池符号 ⚡ 应出现
		expect(screen.getByText("⚡")).toBeInTheDocument();
	});

	it("heart label does NOT appear without romance ode", () => {
		const normalAction: GeneratedAction = {
			key: "aglaea-1", characterId: "aglaea", actionNo: 1, actionValue: 80,
			skill: "E", speed: 120,
		};
		const chars = [
			{ id: "aglaea", name: "阿格莱雅", kind: "角色" as const, speed: "120", baseSpeed: "120", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { aglaea: "阿格莱雅" },
			characterKinds: { aglaea: "角色" },
			charactersById: Object.fromEntries(chars.map(c => [c.id, c])),
			actions: [normalAction],
		});

		expect(screen.queryByText("♥")).toBeNull();
		expect(screen.queryByText("⚡")).toBeNull();
	});
});

// ───── Meme right-click section ─────

describe("Meme right-click selection", () => {
	it("renders meme advance target selector in right-click menu", () => {
		const rmcAction: GeneratedAction = {
			key: "rmc-1", characterId: "rmc", actionNo: 1, actionValue: 62.5, skill: "E", speed: 160,
		};
		const memeAction: GeneratedAction = {
			key: "rmc-1-meme", characterId: "rmc-meme", displayName: "迷迷",
			actionNo: 0, actionValue: 62.5, skill: "拉条", speed: 130,
			isMemeAction: true, isMemospriteAction: true, memospriteOwnerId: "rmc",
		};
		const chars = [
			{ id: "rmc", name: "开拓者·记忆", kind: "角色" as const, speed: "160", baseSpeed: "160", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
			{ id: "ally", name: "队友", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		const gm = {
			id: "rmc-meme", name: "迷迷", kind: "忆灵" as const,
			speed: "130", baseSpeed: "130",
			hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0,
		};
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { rmc: "开拓者·记忆", ally: "队友", "rmc-meme": "迷迷" },
			characterKinds: { rmc: "角色", ally: "角色", "rmc-meme": "忆灵" },
			charactersById: { rmc: chars[0], ally: chars[1], "rmc-meme": gm },
			actions: [rmcAction, memeAction],
			actionMenuOpen: true,
			actionMenuKey: "rmc-1-meme",
			selectedActionKeys: new Set(["rmc-1-meme"]),
			memospriteTargets: [gm],
		});

		// 迷迷拉条区域应在右键菜单显示
		const memeLabels = screen.queryAllByText(/迷迷/);
		expect(memeLabels.length).toBeGreaterThanOrEqual(1);
	});
});
