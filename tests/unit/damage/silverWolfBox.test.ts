import { expect, it } from "vitest";
import { silverWolfBoxProbabilities } from "../../../src/damage/silverWolfBox";

const probabilities = (
	sp: number,
	hidden: number,
	spCap = 5,
	hiddenCap = 300,
	beanCurveK = 8,
) => silverWolfBoxProbabilities({ sp, hidden, spCap, hiddenCap, beanCurveK });
it("has valid corner probabilities and respects increased SP and hidden capacities", () => {
	expect(probabilities(0, 0)).toEqual({ sp: 0.5, beans: 0.5, sword: 0 });
	expect(probabilities(5, 300)).toEqual({ sp: 0, beans: 0, sword: 1 });
	expect(probabilities(0, 300)).toEqual({ sp: 0.5, beans: 0, sword: 0.5 });
	expect(probabilities(5, 0)).toEqual({ sp: 0, beans: 0.5, sword: 0.5 });
	expect(probabilities(4, 300, 8, 600)).toEqual(probabilities(2, 150, 4, 300));
	expect(probabilities(4, 300, 8, 600).sp).toBe(0.25);
	expect(probabilities(4, 300, 8, 600).beans).toBeGreaterThan(0);
});
it("decreases SP probability with SP, decreases beans with score, and sums to one", () => {
	for (const spCap of [5, 8])
		for (const hiddenCap of [300, 600]) {
			for (let sp = 0; sp <= spCap; sp++)
				for (let hidden = 0; hidden <= hiddenCap; hidden += 10) {
					const p = probabilities(sp, hidden, spCap, hiddenCap);
					expect(p.sp + p.beans + p.sword).toBeCloseTo(1, 14);
					expect(Object.values(p).every((n) => n >= 0 && n <= 1)).toBe(true);
					if (sp < spCap)
						expect(
							probabilities(sp + 1, hidden, spCap, hiddenCap).sp,
						).toBeLessThan(p.sp);
					if (hidden < hiddenCap)
						expect(
							probabilities(sp, hidden + 1, spCap, hiddenCap).beans,
						).toBeLessThan(p.beans);
				}
		}
});
it("k eight slows the initial decline relative to k ten while keeping the decreasing convex curve", () => {
	const bean = (x: number, k: number) => probabilities(0, x, 5, 300, k).beans;
	expect(bean(0, 8) - bean(0.1, 8)).toBeLessThan(bean(0, 10) - bean(0.1, 10));
	for (let x = 1; x < 300; x++) {
		expect(bean(x, 8)).toBeGreaterThan(bean(x, 10));
		expect(bean(x - 1, 8) - 2 * bean(x, 8) + bean(x + 1, 8)).toBeGreaterThan(0);
	}
});
it("rejects invalid capacities and out of range state", () => {
	for (const args of [
		[0, 0, 0, 300, 8],
		[0, 0, 5, 0, 8],
		[-1, 0, 5, 300, 8],
		[6, 0, 5, 300, 8],
		[0, 301, 5, 300, 8],
		[0, 0, 5, 300, 0],
		[0, Number.NaN, 5, 300, 8],
	])
		expect(() =>
			probabilities(...(args as [number, number, number, number, number])),
		).toThrow();
});
