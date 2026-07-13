import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActionSequence from "../../src/pages/ActionSequence";
import { invoke } from "../../src/utils/backend";

const mockedInvoke = vi.mocked(invoke);

describe("Dan Heng Permansor Terrae front-end interaction", () => {
	beforeEach(() => {
		mockedInvoke.mockReset();
		mockedInvoke.mockImplementation(async (method: string) => {
			if (method === "get_autosave_path") return "autosave.json";
			if (method === "read_text_file") return "";
			return undefined;
		});
	});

	it("renders Souldragon and persists only disabled attack switches", async () => {
		render(<ActionSequence />);
		const importArea = await screen.findByPlaceholderText(
			"JSON 导入 / 导出内容",
		);
		const imported = {
			limitPreset: "100",
			customLimit: "",
			displayedLimit: "100",
			characters: [
				{
					id: "dhpt",
					kind: "角色",
					name: "丹恒·腾荒",
					speed: "100",
					baseSpeed: "100",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
				{
					id: "ally",
					kind: "角色",
					name: "队友",
					speed: "200",
					baseSpeed: "200",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			],
			resources: [],
			overrides: {},
			resourceValues: {},
			bondmateTarget: "ally",
			skillOverrides: { "dhpt-1": "E" },
			skillTargets: { "dhpt-1": "ally" },
		};

		fireEvent.change(importArea, {
			target: { value: JSON.stringify(imported) },
		});
		await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

		const dragonRow = await waitFor(() => {
			const row = document.querySelector(
				'tr[data-action-key="dhpt-souldragon-1"]',
			);
			expect(row).not.toBeNull();
			return row as HTMLElement;
		});
		expect(within(dragonRow).getByAltText("龙灵")).toBeInTheDocument();
		expect(
			within(dragonRow)
				.queryAllByRole("textbox")
				.some((input) => input.getAttribute("maxlength") === "6"),
		).toBe(false);

		const allyRow = document.querySelector(
			'tr[data-action-key="ally-1"]',
		) as HTMLElement;
		const attack = within(allyRow).getByRole("button", { name: "攻击" });
		expect(attack).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(attack);

		await waitFor(() => {
			const value = (importArea as HTMLTextAreaElement).value;
			expect(JSON.parse(value).attackDisabled).toEqual({ "ally-1": true });
		});

		const ownerRow = document.querySelector(
			'tr[data-action-key="dhpt-1"]',
		) as HTMLElement;
		const ownerAttack = within(ownerRow).getByRole("button", { name: "攻击" });
		expect(ownerAttack).toBeDisabled();
		expect(ownerAttack).toHaveAttribute("aria-pressed", "false");
	});

	it("keeps the non-memosprite Souldragon visible during Phainon's domain", async () => {
		render(<ActionSequence />);
		const importArea = await screen.findByPlaceholderText(
			"JSON 导入 / 导出内容",
		);
		const character = (id: string, name: string, speed: string) => ({
			id,
			kind: "角色",
			name,
			speed,
			baseSpeed: speed,
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		});
		fireEvent.change(importArea, {
			target: {
				value: JSON.stringify({
					limitPreset: "300",
					customLimit: "",
					displayedLimit: "300",
					characters: [
						character("phainon", "白厄", "100"),
						character("dhpt", "丹恒·腾荒", "100"),
						character("ally", "队友", "80"),
					],
					resources: [],
					overrides: {},
					resourceValues: {},
					bondmateTarget: "ally",
					skillOverrides: { "phainon-1": "AQ" },
				}),
			},
		});
		await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

		await waitFor(() => {
			expect(
				document.querySelector('tr[data-action-key="dhpt-souldragon-2"]'),
			).not.toBeNull();
		});
	});
});
