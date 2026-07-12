import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulateActions } from "../src/simulate/actions";

describe("example-蝶夜堇昔", () => {
	it("6魂昔涟外部 Q 后仅立即行动一次", () => {
		const input = JSON.parse(
			readFileSync("example-蝶夜堇昔.json", "utf8"),
		);
		input.legacyUltOverrides = input.ultOverrides ?? {};
		input.limit = Number(input.displayedLimit);
		const actions = simulateActions(input);

		expect(actions.find((action) => action.key === "c1-pollux-1")?.actionValue)
			.toBe(0);
		expect(actions.find((action) => action.key === "c4-1")?.actionValue)
			.toBe(0);
		expect(actions.find((action) => action.key === "c4-2")?.actionValue)
			.toBeCloseTo(31.6556, 4);
	});
});
