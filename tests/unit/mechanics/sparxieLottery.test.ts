import { describe, expect, it } from "vitest";
import {
	analyzeSparxieRenewal,
	drawSparxieLottery,
	sparxieJackpotProbability,
	startSparxieLottery,
} from "../../../src/mechanics/sparxieLottery";

describe("Sparxie finite-pool lottery", () => {
	it("starts at pity four and guarantees the third initial draw; later rounds inherit zero", () => {
		let s = startSparxieLottery();
		const small = () => 0.999;
		s = drawSparxieLottery(s, small).state;
		s = drawSparxieLottery(s, small).state;
		expect(s.pity).toBe(6);
		const big = drawSparxieLottery(s, () => {
			throw new Error("forced draw must not sample RNG");
		});
		expect(big.jackpot).toBe(true);
		expect(big.forced).toBe(true);
		expect(big.state.draws).toBe(3);
		s = startSparxieLottery(big.state.pity);
		for (let i = 0; i < 6; i++) s = drawSparxieLottery(s, small).state;
		expect(s.pity).toBe(6);
		expect(drawSparxieLottery(s, small).jackpot).toBe(true);
	});
	it("draws without replacement, consumes guaranteed prizes, and never invents exhausted jackpots", () => {
		let s = startSparxieLottery(0);
		expect(sparxieJackpotProbability(s)).toBeCloseTo(3 / 28);
		s = drawSparxieLottery(s, () => 0.999).state;
		expect(sparxieJackpotProbability(s)).toBeCloseTo(3 / 27);
		const d = drawSparxieLottery(s, () => 0);
		s = d.state;
		expect(d.jokes).toBe(2);
		expect(d.spRefund).toBe(2);
		expect(sparxieJackpotProbability(s)).toBeCloseTo(2 / 26);
		s = drawSparxieLottery(s, () => 0).state;
		s = drawSparxieLottery(s, () => 0).state;
		while (s.draws < 20) {
			const d = drawSparxieLottery(s, () => 0);
			expect(d.jackpot).toBe(false);
			expect(d.jokes).toBe(1);
			s = d.state;
		}
		expect(s.jackpots).toBe(3);
		expect(s.pity).toBe(6);
		expect(s.smallPrizesLeft).toBe(8);
		expect(() => drawSparxieLottery(s, () => 0)).toThrow("20");
	});
	it.each([
		[1, 5.017, 1.994],
		[2, 5.157763532763532, 1 + 3 / (5.157763532763532 - 2)],
		[3, 5.398789493064802, 1 + 3 / (5.398789493064802 - 2)],
	])("computes exact rule-based long-run rewards for target %i", (target, draws, jokes) => {
		const r = analyzeSparxieRenewal(target as 1 | 2 | 3);
		expect(r.stationary.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
		expect(r.drawsPerJackpot).toBeCloseTo(draws, 2);
		expect(r.jokesPerNetSp).toBeCloseTo(jokes, 2);
		expect(r.firstRound.draws / r.firstRound.jackpots).toBeLessThan(
			r.drawsPerJackpot,
		);
	});
	it("agrees with independent seeded Monte Carlo after warmup", () => {
		let rng = 12345;
		const random = () => {
			rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
			return rng / 4294967296;
		};
		for (const target of [1, 2, 3] as const) {
			let pity = 4,
				draws = 0,
				big = 0;
			for (let round = 0; round < 30000; round++) {
				// Independent oracle: explicitly remove a uniformly chosen item from a real pool.
				const pool = Array.from({ length: 28 }, (_, i) => i < 3);
				let n = 0,
					wins = 0;
				while (n < 20 && wins < target) {
					const index =
						pity === 6 && pool.includes(true)
							? pool.indexOf(true)
							: Math.floor(random() * pool.length);
					const jackpot = pool.splice(index, 1)[0];
					pity = jackpot ? 0 : Math.min(6, pity + 1);
					wins += Number(jackpot);
					n++;
				}
				if (round > 100) {
					draws += n;
					big += wins;
				}
			}

			const r = analyzeSparxieRenewal(target);
			expect(Math.abs(draws / big - r.drawsPerJackpot)).toBeLessThan(0.04);
			expect(
				Math.abs((draws + big) / (draws - 2 * big) - r.jokesPerNetSp),
			).toBeLessThan(0.02);
		}
	});
});
