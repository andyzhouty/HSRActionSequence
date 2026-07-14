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

	it("万敌在场时可在任意行动点切换血仇并触发弑神登神", () => {
		const mydei = character("mydei", "万敌");
		mydei.eidolon = 6;
		const ally = character("ally", "停云");
		const setMydeiVendettaToggles = vi.fn();
		const setMydeiGodslayerToggles = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: [mydei, ally],
			charactersById: { mydei, ally },
			characterNames: { mydei: "万敌", ally: "停云" },
			characterKinds: { mydei: "角色", ally: "角色" },
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
			setMydeiVendettaToggles,
			setMydeiGodslayerToggles,
		});

		expect(screen.getByRole("button", { name: "血仇中" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "弑神登神" }));
		expect(setMydeiGodslayerToggles).toHaveBeenCalledOnce();
	});

	it("可为姬子助战行动插入绯英追击", () => {
		const himeko = character("himeko", "姬子·启行");
		const evanescia = character("evanescia", "绯英");
		const assist: GeneratedAction = {
			key: "ally-1-assist-F",
			characterId: "himeko",
			actionNo: 0,
			actionValue: 100,
			skill: "F",
			speed: 100,
			isAssistAction: true,
		};
		renderWithContext(<ActionPanel />, {
			characters: [himeko, evanescia],
			charactersById: { himeko, evanescia },
			characterNames: { himeko: "姬子·启行", evanescia: "绯英" },
			characterKinds: { himeko: "角色", evanescia: "角色" },
			actions: [assist],
			actionMenuOpen: true,
			actionMenuKey: assist.key,
			selectedActionKeys: new Set([assist.key]),
		});

		expect(
			screen.getByRole("button", { name: "插入追击（Z）" }),
		).toBeInTheDocument();
	});
});
