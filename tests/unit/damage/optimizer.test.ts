import { expect, it } from "vitest";
import { optimizeDomain } from "../../../src/damage/optimizer";

it("matches single-target E/A and three-target E/W resource cycles", () => {
	for (let initial = 0; initial <= 7; initial++) {
		const single = optimizeDomain(initial, 7, 1);
		expect(single.every((skill) => !skill.includes("W"))).toBe(true);
		const multiple = optimizeDomain(initial, 7, 3);
		expect(multiple.every((skill) => !skill.includes("A"))).toBe(true);
	}
});
