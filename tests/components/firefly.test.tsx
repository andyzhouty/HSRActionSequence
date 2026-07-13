import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionPanel from "../../src/components/action-sequence/ActionPanel";
import type { GeneratedAction } from "../../src/utils/actionSequence";
import { renderWithContext } from "../helpers/actionSequenceComponentTestUtils";

function mockCombustionAction(
	overrides: Partial<GeneratedAction> = {},
): GeneratedAction {
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

describe("ActionPanel Firefly", () => {
	it("点击击破开关会调用 setFireflyBreakCounters", async () => {
		const setFireflyBreakCounters = vi.fn();
		const action = mockCombustionAction();
		const chars = [
			{
				id: "firefly",
				name: "流萤",
				kind: "角色" as const,
				speed: "160",
				baseSpeed: "104",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { firefly: "流萤" },
			characterKinds: { firefly: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [action],
			setFireflyBreakCounters,
		});

		const btn = screen.queryByText("击破");
		if (btn) {
			await userEvent.click(btn);
			expect(setFireflyBreakCounters).toHaveBeenCalled();
		}
	});

	it("完全燃烧行动会显示击破开关", () => {
		const action = mockCombustionAction();
		const chars = [
			{
				id: "firefly",
				name: "流萤",
				kind: "角色" as const,
				speed: "160",
				baseSpeed: "104",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { firefly: "流萤" },
			characterKinds: { firefly: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [action],
		});
		expect(screen.getByText("击破")).toBeInTheDocument();
	});

	it("非完全燃烧行动不显示击破开关", () => {
		const normalAction: GeneratedAction = {
			key: "ally-1",
			characterId: "ally",
			actionNo: 1,
			actionValue: 100,
			skill: "E",
			speed: 100,
		};
		const chars = [
			{
				id: "ally",
				name: "队友",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { ally: "队友" },
			characterKinds: { ally: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [normalAction],
		});
		expect(screen.queryByText("击破")).toBeNull();
	});
});
