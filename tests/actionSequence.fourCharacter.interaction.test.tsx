import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
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

describe("ActionSequence four-character front-end interaction", () => {
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

	it("renders and edits a complex Castorice/Evernight/Hyacine/Cyrene sequence", async () => {
		render(<ActionSequence />);

		const importArea = await screen.findByPlaceholderText(
			"JSON 导入 / 导出内容",
		);
		const importJson = {
			// The interaction under test is complete by AV 100; avoid rendering
			// unrelated long-tail summon actions.
			limitPreset: "150",
			customLimit: "",
			displayedLimit: "150",
			characters: [
				character("castorice", "遐蝶", 94, {
					eidolon: 2,
					hasCastoriceTechnique: true,
				}),
				character("evernight", "长夜月", 100),
				character("hyacine", "风堇", 101),
				character("cyrene", "昔涟", 150),
			],
			resources: ["战技点"],
			overrides: {},
			resourceValues: {},
			skillOverrides: {
				"castorice-pollux-1": "EA",
				"castorice-pollux-2": "E",
				"evernight-evey-1": "A",
				"evernight-1": "E",
				"hyacine-1": "EQ",
				"hyacine-2": "A",
				"cyrene-1": "AQ",
			},
			ultInterrupts: {
				"castorice-pollux-2": [{ casterId: "castorice", timing: "after" }],
				"evernight-evey-2": [{ casterId: "evernight", timing: "after" }],
			},
			odeSelections: {
				"cyrene-1-memosprite-Q": {
					odeCode: "lifeDeath",
					targetId: "castorice",
				},
			},
			evernightSelfDestructToggles: {
				"hyacine-1": true,
			},
		};

		fireEvent.change(importArea, {
			target: { value: JSON.stringify(importJson, null, 2) },
		});
		await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

		await waitFor(() => {
			expect(screen.getAllByText("死龙").length).toBeGreaterThan(0);
			expect(screen.getAllByText("长夜").length).toBeGreaterThan(0);
			expect(screen.getAllByText("小伊卡").length).toBeGreaterThan(0);
			expect(screen.getAllByText("德谬歌").length).toBeGreaterThan(0);
		});

		const firstEvernightRow = document.querySelector(
			'tr[data-action-key="evernight-1"]',
		);
		expect(firstEvernightRow).not.toBeNull();
		if (!firstEvernightRow) throw new Error("First Evernight row not found");

		const skillInputs = within(firstEvernightRow).getAllByRole("textbox");
		const skillInput = skillInputs.find(
			(input) => input.getAttribute("maxlength") === "6",
		) as HTMLInputElement | undefined;
		expect(skillInput).toBeDefined();
		if (!skillInput) throw new Error("Evernight skill input not found");

		await userEvent.clear(skillInput);
		await userEvent.type(skillInput, "AQ{Enter}");

		await waitFor(() => {
			const json = (
				screen.getByPlaceholderText(
					"JSON 导入 / 导出内容",
				) as HTMLTextAreaElement
			).value;
			expect(json).toContain('"evernight-1":"AQ"');
		});
		expect(
			within(firstEvernightRow).getByDisplayValue("AQ"),
		).toBeInTheDocument();

		const hyacineLabel = screen.getAllByText("风堇")[0];
		const hyacineRow = hyacineLabel.closest("tr");
		expect(hyacineRow).not.toBeNull();
		if (!hyacineRow) throw new Error("Hyacine row not found");

		fireEvent.contextMenu(hyacineRow);
		await waitFor(() => {
			expect(screen.getByText("长夜自爆：")).toBeInTheDocument();
			expect(screen.getByText("插入大招：")).toBeInTheDocument();
		});

		const cyreneLabel = screen.getAllByText("昔涟")[0];
		const cyreneRow = cyreneLabel.closest("tr");
		expect(cyreneRow).not.toBeNull();
		if (!cyreneRow) throw new Error("Cyrene row not found");

		fireEvent.contextMenu(cyreneRow);
		await waitFor(() => {
			expect(screen.getByText("插入大招：")).toBeInTheDocument();
		});
	}, 10_000);
});
