import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionPanel from "../../../src/components/ActionPanel";
import type { GeneratedAction } from "../../../src/utils/actionSequence";
import { renderWithContext } from "../../helpers/actionSequenceComponentTestUtils";

const robinChar = {
	id: "robin",
	name: "sp知更鸟",
	kind: "角色" as const,
	speed: "100",
	baseSpeed: "95",
	hasVonwacq: false,
	hasWindSet: false,
	hasDance: false,
	eidolon: 0,
	superimpose: 1,
	lc_id: 0,
};

describe("SP Robin Fever 右键菜单", () => {
	it("任意行动点的右键菜单显示 Fever 开关", () => {
		const enemyAction: GeneratedAction = {
			key: "enemy-1",
			characterId: "enemy",
			displayName: "敌人",
			actionNo: 1,
			actionValue: 50,
			skill: "",
			speed: 200,
		};
		renderWithContext(<ActionPanel />, {
			characters: [
				robinChar,
				{ ...robinChar, id: "enemy", name: "敌人", kind: "敌人" },
			],
			characterNames: { robin: "sp知更鸟", enemy: "敌人" },
			characterKinds: { robin: "角色", enemy: "敌人" },
			charactersById: { robin: robinChar },
			actions: [enemyAction],
			actionMenuOpen: true,
			actionMenuKey: "enemy-1",
			selectedActionKeys: new Set(["enemy-1"]),
			spRobinFeverToggles: {},
			setSpRobinFeverToggles: vi.fn(),
		});
		expect(screen.getByText("Fever：")).toBeInTheDocument();
		expect(screen.getByText("进入Fever")).toBeInTheDocument();
	});

	it("点击开关写入 spRobinFeverToggles", async () => {
		const user = userEvent.setup();
		const enemyAction: GeneratedAction = {
			key: "enemy-1",
			characterId: "enemy",
			displayName: "敌人",
			actionNo: 1,
			actionValue: 50,
			skill: "",
			speed: 200,
		};
		const setSpRobinFeverToggles = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: [
				robinChar,
				{ ...robinChar, id: "enemy", name: "敌人", kind: "敌人" },
			],
			characterNames: { robin: "sp知更鸟", enemy: "敌人" },
			characterKinds: { robin: "角色", enemy: "敌人" },
			charactersById: { robin: robinChar },
			actions: [enemyAction],
			actionMenuOpen: true,
			actionMenuKey: "enemy-1",
			selectedActionKeys: new Set(["enemy-1"]),
			spRobinFeverToggles: {},
			setSpRobinFeverToggles,
		});
		await user.click(screen.getByText("进入Fever"));
		expect(setSpRobinFeverToggles).toHaveBeenCalled();
	});

	it("氛围值输入不超过星魂上限（E0 上限 50）", async () => {
		const updateResourceValue = vi.fn();
		const action: GeneratedAction = {
			key: "robin-1",
			characterId: "robin",
			displayName: "sp知更鸟",
			actionNo: 1,
			actionValue: 80,
			skill: "",
			speed: 100,
		};
		renderWithContext(<ActionPanel />, {
			characters: [robinChar],
			characterNames: { robin: "sp知更鸟" },
			characterKinds: { robin: "角色" },
			charactersById: { robin: robinChar },
			actions: [action],
			resources: ["氛围值"],
			resourceValues: {},
			updateResourceValue,
		});
		const input = document.querySelector(
			'input[inputmode="numeric"]',
		) as HTMLInputElement | null;
		expect(input).not.toBeNull();
		if (!input) return;
		fireEvent.change(input, { target: { value: "60" } });
		// "60" 超过上限 50，应被拒绝
		expect(updateResourceValue).not.toHaveBeenCalledWith(
			"robin-1",
			"氛围值",
			"60",
		);
		fireEvent.change(input, { target: { value: "50" } });
		expect(updateResourceValue).toHaveBeenCalledWith("robin-1", "氛围值", "50");
	});

	it("氛围值输入不超过星魂上限（E2 上限 70）", async () => {
		const updateResourceValue = vi.fn();
		const action: GeneratedAction = {
			key: "robin-1",
			characterId: "robin",
			displayName: "sp知更鸟",
			actionNo: 1,
			actionValue: 80,
			skill: "",
			speed: 100,
		};
		renderWithContext(<ActionPanel />, {
			characters: [{ ...robinChar, eidolon: 2 }],
			characterNames: { robin: "sp知更鸟" },
			characterKinds: { robin: "角色" },
			charactersById: { robin: { ...robinChar, eidolon: 2 } },
			actions: [action],
			resources: ["氛围值"],
			resourceValues: {},
			updateResourceValue,
		});
		const input = document.querySelector(
			'input[inputmode="numeric"]',
		) as HTMLInputElement | null;
		expect(input).not.toBeNull();
		if (!input) return;
		fireEvent.change(input, { target: { value: "71" } });
		expect(updateResourceValue).not.toHaveBeenCalledWith(
			"robin-1",
			"氛围值",
			"71",
		);
		fireEvent.change(input, { target: { value: "70" } });
		expect(updateResourceValue).toHaveBeenCalledWith("robin-1", "氛围值", "70");
	});
});
