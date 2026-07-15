import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CompanionFuaToggleSection } from "../../src/components/action-panel/CompanionFuaToggleSection";
import { renderWithContext } from "../helpers/actionSequenceComponentTestUtils";

describe("不死途与卡芙卡追击右键入口", () => {
	it("复用攻击判定，并为其他角色攻击提供取消入口", async () => {
		const ashveil = {
			id: "ashveil",
			name: "不死途",
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
		const ally = { ...ashveil, id: "ally", name: "丹恒" };
		const setAshveilFuaToggles = vi.fn();
		renderWithContext(<CompanionFuaToggleSection />, {
			characters: [ashveil, ally],
			charactersById: { ashveil, ally },
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
			selectedActionKeys: new Set(["ally-1"]),
			setAshveilFuaToggles,
		});

		await userEvent.click(
			screen.getByRole("button", { name: "取消不死途追击" }),
		);
		const updater = setAshveilFuaToggles.mock.calls[0][0];
		expect(updater({})).toEqual({ "ally-1": false });
	});

	it("不为固定非攻击和追击行动显示入口", () => {
		const kafka = {
			id: "kafka",
			name: "卡芙卡",
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
		const robin = { ...kafka, id: "robin", name: "知更鸟" };
		renderWithContext(<CompanionFuaToggleSection />, {
			characters: [kafka, robin],
			charactersById: { kafka, robin },
			actions: [
				{
					key: "robin-1",
					characterId: "robin",
					actionNo: 1,
					actionValue: 100,
					skill: "E",
					speed: 100,
				},
			],
			selectedActionKeys: new Set(["robin-1"]),
		});

		expect(screen.queryByRole("button", { name: /卡芙卡追击/ })).toBeNull();
	});

	it("队伍中不存在对应角色时不显示取消入口", () => {
		const ally = {
			id: "ally",
			name: "丹恒",
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
		renderWithContext(<CompanionFuaToggleSection />, {
			characters: [ally],
			charactersById: { ally },
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
			selectedActionKeys: new Set(["ally-1"]),
		});

		expect(screen.queryByRole("button", { name: /追击/ })).toBeNull();
	});
});
