import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActionPanel from "../../src/components/ActionPanel";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../../src/utils/actionSequence";
import { renderWithContext } from "../helpers/actionSequenceComponentTestUtils";

function character(id: string, name: string): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: "100",
		baseSpeed: "100",
		hasVonwacq: false,
		hasWindSet: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
	};
}

describe("Saber right-click menu", () => {
	it("Saber 在场时可为所选行动切换拉条", () => {
		const saber = character("saber", "Saber");
		const ally = character("ally", "停云");
		const action: GeneratedAction = {
			key: "ally-1",
			characterId: "ally",
			actionNo: 1,
			actionValue: 100,
			skill: "E",
			speed: 100,
		};
		const setSaberAdvanceToggles = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: [saber, ally],
			charactersById: { saber, ally },
			characterNames: { saber: "Saber", ally: "停云" },
			characterKinds: { saber: "角色", ally: "角色" },
			actions: [action],
			actionMenuOpen: true,
			actionMenuKey: action.key,
			selectedActionKeys: new Set([action.key]),
			setSaberAdvanceToggles,
		});

		fireEvent.click(screen.getByRole("button", { name: "未拉条" }));
		expect(setSaberAdvanceToggles).toHaveBeenCalledOnce();
		const enableUpdater = setSaberAdvanceToggles.mock.calls[0][0] as (
			prev: Record<string, boolean>,
		) => Record<string, boolean>;
		expect(enableUpdater({})).toEqual({ "ally-1": true });
	});

	it("已启用时菜单显示取消并删除当前行动的拉条记录", () => {
		const saber = character("saber", "Saber");
		const ally = character("ally", "停云");
		const setSaberAdvanceToggles = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: [saber, ally],
			charactersById: { saber, ally },
			characterNames: { saber: "Saber", ally: "停云" },
			characterKinds: { saber: "角色", ally: "角色" },
			actions: [
				{
					key: "ally-1",
					characterId: "ally",
					actionNo: 1,
					actionValue: 100,
					skill: "E",
					speed: 100,
				},
			],
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
			saberAdvanceToggles: { "ally-1": true },
			setSaberAdvanceToggles,
		});

		fireEvent.click(screen.getByRole("button", { name: "已拉条" }));
		const cancelUpdater = setSaberAdvanceToggles.mock.calls[0][0] as (
			prev: Record<string, boolean>,
		) => Record<string, boolean>;
		expect(cancelUpdater({ "ally-1": true })).toEqual({});
	});

	it("绯英不在场时不显示追击入口", () => {
		const ally = character("ally", "停云");
		renderWithContext(<ActionPanel />, {
			characters: [ally],
			charactersById: { ally },
			characterNames: { ally: "停云" },
			characterKinds: { ally: "角色" },
			actions: [
				{
					key: "ally-1",
					characterId: "ally",
					actionNo: 1,
					actionValue: 100,
					skill: "E",
					speed: 100,
				},
			],
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
		});

		expect(screen.queryByText("绯英追击：")).toBeNull();
	});
});
