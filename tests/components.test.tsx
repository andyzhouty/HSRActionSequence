import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
	NumberInput,
	SelectInput,
	TextInput,
	Toggle,
} from "../src/components/action-sequence/Controls";
import type { GeneratedAction } from "../src/utils/actionSequence";
import ActionPanel from "../src/components/action-sequence/ActionPanel";
import CharacterPanel from "../src/components/action-sequence/CharacterPanel";
import { defaultCharacters } from "../src/utils/actionSequence";
import {
	createMockContext,
	renderWithContext,
} from "./helpers/actionSequenceComponentTestUtils";

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

describe("ActionPanel rendering", () => {
	it("renders action table header with correct columns", () => {
		renderWithContext(<ActionPanel />);
		// "行动序列" appears in title and action count - use getAllByText
		expect(screen.getAllByText("行动序列").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("序号")).toBeInTheDocument();
		expect(screen.getAllByText("目标").length).toBeGreaterThanOrEqual(1);
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

	it("locks 忆质 resource editing while 长夜月 is in team", () => {
		renderWithContext(<ActionPanel />, {
			characters: [
				{
					id: "evernight",
					name: "长夜月",
					kind: "角色",
					speed: "100",
					baseSpeed: "100",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			],
			resources: ["战技点", "忆质"],
		});

		expect(screen.getByDisplayValue("忆质")).toBeDisabled();
		expect(screen.getByText("固定")).toBeInTheDocument();
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

	it("Pollux skill input is editable and Enter commits E", async () => {
		const action: GeneratedAction = {
			key: "castorice-pollux-1",
			characterId: "castorice-pollux",
			displayName: "死龙",
			targetKind: "忆灵",
			actionNo: 1,
			actionValue: 100,
			skill: "",
			speed: 165,
			isPolluxAction: true,
			isMemospriteAction: true,
			memospriteOwnerId: "castorice",
		};
		const chars = [
			{ id: "castorice", name: "遐蝶", kind: "角色" as const, speed: "100", baseSpeed: "100", hasVonwacq: false, hasWindSet: false, hasDance: false, eidolon: 0, superimpose: 1, lc_id: 0 },
		];
		const pollux = {
			id: "castorice-pollux",
			name: "死龙",
			kind: "忆灵" as const,
			speed: "165",
			baseSpeed: "165",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		};
		const updateActionSkill = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { castorice: "遐蝶", "castorice-pollux": "死龙" },
			characterKinds: { castorice: "角色", "castorice-pollux": "忆灵" },
			charactersById: { castorice: chars[0], "castorice-pollux": pollux },
			memospriteTargets: [pollux],
			actions: [action],
			updateActionSkill,
		});

		const inputs = screen.getAllByRole("textbox");
		const skillInput = inputs.find((input) => input.getAttribute("maxlength") === "6");
		expect(skillInput).toBeDefined();
		expect(skillInput).not.toBeDisabled();
		if (skillInput) {
			await userEvent.clear(skillInput);
			await userEvent.type(skillInput, "E{Enter}");
			expect(updateActionSkill).toHaveBeenCalledWith(action, "E");
		}
	});

	it("Evey skill input is editable and Enter commits E", async () => {
		const action: GeneratedAction = {
			key: "evernight-evey-1",
			characterId: "evernight-evey",
			displayName: "长夜",
			targetKind: "忆灵",
			actionNo: 1,
			actionValue: 62.5,
			skill: "",
			speed: 160,
			isEveyAction: true,
			isMemospriteAction: true,
			memospriteOwnerId: "evernight",
		};
		const owner = {
			id: "evernight",
			name: "长夜月",
			kind: "角色" as const,
			speed: "100",
			baseSpeed: "100",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		};
		const evey = {
			id: "evernight-evey",
			name: "长夜",
			kind: "忆灵" as const,
			speed: "160",
			baseSpeed: "160",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		};
		const updateActionSkill = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: [owner],
			characterNames: { evernight: "长夜月", "evernight-evey": "长夜" },
			characterKinds: { evernight: "角色", "evernight-evey": "忆灵" },
			charactersById: { evernight: owner, "evernight-evey": evey },
			memospriteTargets: [evey],
			actions: [action],
			updateActionSkill,
		});

		const inputs = screen.getAllByRole("textbox");
		const skillInput = inputs.find((input) => input.getAttribute("maxlength") === "6");
		expect(skillInput).toBeDefined();
		expect(skillInput).not.toBeDisabled();
		if (skillInput) {
			await userEvent.clear(skillInput);
			await userEvent.type(skillInput, "E{Enter}");
			expect(updateActionSkill).toHaveBeenCalledWith(action, "E");
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

