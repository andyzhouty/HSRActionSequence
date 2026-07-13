import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ActionPanel from "../../src/components/action-sequence/ActionPanel";
import { simulateActions } from "../../src/simulate/actions";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../../src/utils/actionSequence";
import { renderWithContext } from "../helpers/actionSequenceComponentTestUtils";

function c(id: string, name: string, speed: number): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: String(speed),
		baseSpeed: String(speed),
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
	};
}

function sim(characters: CharacterConfig[]): GeneratedAction[] {
	return simulateActions({
		characters,
		limit: 300,
		overrides: {},
		skillOverrides: { "emc-1": "EQ" },
		domainEndOverrides: {},
		legacyUltOverrides: {},
		speedAdjustments: {},
		skillTargets: {},
		defaultSkillTargets: {},
		odeSelections: {},
		memeSelections: {},
		ultInterrupts: {},
		fireflyBreakCounters: {},
		godmodeExtraActions: {},
	});
}

describe("self-Q interrupt click stability", () => {
	it("Q interrupt exists after EQ combo", () => {
		const chars = [c("emc", "欢愉主", 200), c("target", "火花", 150)];
		const actions = sim(chars);
		const q = actions.filter((a) => a.key === "emc-1-q");
		expect(q.length).toBe(1);
		expect(q[0].skill).toBe("Q");
	});

	it("clicking Q interrupt row does NOT remove it", async () => {
		const chars = [c("emc", "欢愉主", 200), c("target", "火花", 150)];
		const actions = sim(chars);

		renderWithContext(<ActionPanel />, {
			characters: chars,
			skillOverrides: { "emc-1": "EQ" },
			actions,
			characterNames: { emc: "欢愉主", target: "火花" },
			charactersById: { emc: chars[0], target: chars[1] },
			characterKinds: { emc: "角色", target: "角色" },
		});

		await waitFor(() => {
			expect(
				document.querySelector('[data-action-key="emc-1-q"]'),
			).toBeTruthy();
		});

		const qRow = document.querySelector('[data-action-key="emc-1-q"]')!;

		// 5 rapid clicks
		for (let i = 0; i < 5; i++) {
			await userEvent.click(qRow);
			await waitFor(() => {
				expect(
					document.querySelector('[data-action-key="emc-1-q"]'),
				).toBeTruthy();
			});
		}
	}, 10000);
});
