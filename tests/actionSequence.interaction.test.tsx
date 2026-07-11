import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActionSequence from "../src/pages/ActionSequence";
import { invoke } from "../src/utils/backend";

const mockedInvoke = vi.mocked(invoke);

function character(
	id: string,
	name: string,
	speed: number,
	options: Partial<{
		baseSpeed: number;
		hasVonwacq: boolean;
		hasWindSet: boolean;
		hasDance: boolean;
		hasCastoriceTechnique: boolean;
		eidolon: number;
		superimpose: number;
		lc_id: number;
	}> = {},
) {
	return {
		id,
		kind: "角色" as const,
		name,
		speed: String(speed),
		baseSpeed: String(options.baseSpeed ?? speed),
		hasVonwacq: options.hasVonwacq ?? false,
		hasWindSet: options.hasWindSet ?? false,
		hasDance: options.hasDance ?? false,
		hasCastoriceTechnique: options.hasCastoriceTechnique ?? false,
		eidolon: options.eidolon ?? 0,
		superimpose: options.superimpose ?? 1,
		lc_id: options.lc_id ?? 0,
	};
}

describe("ActionSequence front-end interaction", () => {
	beforeEach(() => {
		mockedInvoke.mockReset();
		mockedInvoke.mockImplementation(async (method: string) => {
			switch (method) {
				case "get_autosave_path":
					return "autosave.json";
				case "read_text_file":
					return "";
				case "write_text_file":
				case "write_png_file":
				case "write_base64_file":
					return undefined;
				default:
					throw new Error(`Unexpected invoke method: ${method}`);
			}
		});
	});

	it("clearing Sunday's E target updates JSON and removes stale 36.59 Castorice/Pollux actions", async () => {
		render(<ActionSequence />);

		const importArea = await screen.findByPlaceholderText("JSON 导入 / 导出内容");
		const importJson = {
			// Assertions only inspect the sequence through AV 212.77.
			limitPreset: "250",
			customLimit: "",
			displayedLimit: "250",
			characters: [
				character("castorice", "遐蝶", 94, {
					eidolon: 2,
					hasCastoriceTechnique: true,
				}),
				character("sunday", "星期日", 164, {
					hasVonwacq: true,
					hasWindSet: true,
				}),
			],
			resources: ["战技点"],
			overrides: {},
			resourceValues: {},
			skillOverrides: {
				"sunday-1": "E",
				"castorice-3": "EQ",
				"castorice-pollux-1": "EA",
				"castorice-pollux-2": "EA",
				"castorice-pollux-3": "EA",
			},
			skillTargets: {
				"sunday-1": "castorice",
			},
			defaultSkillTargets: {
				sunday: "castorice",
			},
		};

		fireEvent.change(importArea, {
			target: { value: JSON.stringify(importJson, null, 2) },
		});
		await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

		await waitFor(() => {
			expect(screen.getAllByDisplayValue("36.59").length).toBeGreaterThan(1);
		});
		await waitFor(() => {
			expect(screen.getAllByDisplayValue("142.97").length).toBeGreaterThan(0);
		});

		const sundayLabel = screen.getAllByText("星期日")[0];
		const sundayRow = sundayLabel.closest("tr");
		expect(sundayRow).not.toBeNull();
		if (!sundayRow) throw new Error("Sunday row not found");

		await userEvent.click(within(sundayRow).getAllByText("遐蝶")[0]);
		await userEvent.click(screen.getAllByText("无目标").at(-1)!);

		await waitFor(() => {
			const json = (screen.getByPlaceholderText("JSON 导入 / 导出内容") as HTMLTextAreaElement).value;
			expect(json).not.toContain('"sunday-1": "castorice"');
			expect(json).not.toContain('"sunday": "castorice"');
		});

		await waitFor(() => {
			expect(screen.getAllByDisplayValue("36.59")).toHaveLength(1);
		});
		await waitFor(() => {
			expect(screen.queryAllByDisplayValue("142.97")).toHaveLength(0);
		});
		await waitFor(() => {
			expect(screen.getAllByDisplayValue("212.77").length).toBeGreaterThan(0);
		});
	});

	it("editing Evey skill updates JSON and keeps the table cell in sync", async () => {
		render(<ActionSequence />);

		const importArea = await screen.findByPlaceholderText("JSON 导入 / 导出内容");
		const importJson = {
			limitPreset: "150",
			customLimit: "",
			displayedLimit: "150",
			characters: [
				character("evernight", "长夜月", 100),
			],
			resources: ["战技点"],
			overrides: {},
			resourceValues: {},
			skillOverrides: {
				"evernight-evey-1": "A",
			},
		};

		fireEvent.change(importArea, {
			target: { value: JSON.stringify(importJson, null, 2) },
		});
		await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

		const eveyRow = await waitFor(() => {
			const row =
				screen.getAllByRole("row").find((candidate) => {
					const scoped = within(candidate);
					return (
						scoped.queryByText("长夜") !== null &&
						scoped.queryByDisplayValue("0.00") !== null
					);
				}) ?? null;
			expect(row).not.toBeNull();
			return row;
		});
		if (!eveyRow) throw new Error("Evey row not found");

		const skillInput = within(eveyRow)
			.getAllByRole("textbox")
			.find((input) => input.getAttribute("maxlength") === "6") as
			| HTMLInputElement
			| undefined;
		expect(skillInput).toBeDefined();
		if (!skillInput) throw new Error("Evey skill input not found");

		await userEvent.clear(skillInput);
		await userEvent.type(skillInput, "E{Enter}");

		await waitFor(() => {
			const json = (
				screen.getByPlaceholderText("JSON 导入 / 导出内容") as HTMLTextAreaElement
			).value;
			expect(json).toContain('"evernight-evey-1":"E"');
		});
		expect(within(eveyRow).getByDisplayValue("E")).toBeInTheDocument();
	});
});
