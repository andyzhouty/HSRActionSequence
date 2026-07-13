import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulateActions } from "../../src/simulate/actions";

describe("example2", () => {
	it("死龙回合后的昔涟 Q 会拉条遐蝶", () => {
		const input = JSON.parse(readFileSync("tests/cases/example2.json", "utf8"));
		input.legacyUltOverrides = input.ultOverrides ?? {};
		input.limit = Number(input.displayedLimit);
		const actions = simulateActions(input);

		expect(
			actions.find((action) => action.key === "c1-pollux-1")?.actionValue,
		).toBe(0);
		expect(
			actions.find((action) => action.key === "c1-2")?.actionValue,
		).toBeCloseTo(0.0003, 4);
	});
});
