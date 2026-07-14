import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";
import { character, input, skills } from "../helpers/simulateActionTestUtils";

describe("丹恒 Q 击杀再动", () => {
	function actionsAtEidolon(eidolon: number) {
		return simulateActions(
			input({
				characters: [character("dh", "丹恒", 110, { eidolon })],
				skillOverrides: skills({ "dh-1": "AQ" }),
				killToggles: { "dh-1": true },
				limit: 200,
			}),
		);
	}

	it("仅在 E4+ 的 Q 击杀后立即行动", () => {
		const e4Actions = actionsAtEidolon(4);
		const e3Actions = actionsAtEidolon(3);
		const e4Q = e4Actions.find((action) => action.key === "dh-1-q");
		const e4NextAction = e4Actions.find((action) => action.key === "dh-2");
		const e3Q = e3Actions.find((action) => action.key === "dh-1-q");
		const e3NextAction = e3Actions.find((action) => action.key === "dh-2");

		expect(e4Q).toMatchObject({ skill: "Q" });
		expect(e4NextAction?.actionValue).toBe(e4Q?.actionValue);
		expect(e3Q).toMatchObject({ skill: "Q" });
		expect(e3NextAction?.actionValue).toBeGreaterThan(e3Q?.actionValue ?? 0);
	});
});
