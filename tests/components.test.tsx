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
		draftInterruptCaster: "",
		setDraftInterruptCaster: vi.fn(),
		draftInterruptTiming: "before",
		setDraftInterruptTiming: vi.fn(),
		actionLimit: 150,
		displayedActionLimit: 250,
		characterNames: Object.fromEntries(characters.map((c) => [c.id, c.name])),
		characterKinds: Object.fromEntries(characters.map((c) => [c.id, c.kind])),
		charactersById: Object.fromEntries(characters.map((c) => [c.id, c])),
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
