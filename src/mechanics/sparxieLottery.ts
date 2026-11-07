/** User-confirmed 4.6.54 interaction lottery. A round resets the pool, never the pity. */
export type SparxieLotteryState = {
	pity: number;
	jackpotsLeft: number;
	smallPrizesLeft: number;
	draws: number;
	jackpots: number;
};
export const sparxieInitialPity = 4;
export function startSparxieLottery(
	pity = sparxieInitialPity,
): SparxieLotteryState {
	if (!Number.isInteger(pity) || pity < 0 || pity > 6)
		throw new Error("火花保底计数须为0～6整数");
	return { pity, jackpotsLeft: 3, smallPrizesLeft: 25, draws: 0, jackpots: 0 };
}
export function sparxieJackpotProbability(s: SparxieLotteryState) {
	if (s.draws >= 20 || s.jackpotsLeft + s.smallPrizesLeft === 0) return 0;
	return s.jackpotsLeft === 0
		? 0
		: s.pity === 6
			? 1
			: s.jackpotsLeft / (s.jackpotsLeft + s.smallPrizesLeft);
}
export function drawSparxieLottery(
	s: SparxieLotteryState,
	random: () => number,
) {
	if (s.draws >= 20) throw new Error("火花每轮最多互动20次");
	const probability = sparxieJackpotProbability(s);
	const forced = s.pity === 6 && s.jackpotsLeft > 0;
	const roll = probability === 0 || probability === 1 ? 0 : random();
	if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
		throw new Error("抽奖随机数须在[0,1)内");
	const jackpot = probability === 1 || (probability > 0 && roll < probability);
	const next = {
		...s,
		draws: s.draws + 1,
		jackpots: s.jackpots + Number(jackpot),
		jackpotsLeft: s.jackpotsLeft - Number(jackpot),
		smallPrizesLeft: s.smallPrizesLeft - Number(!jackpot),
		pity: jackpot ? 0 : Math.min(6, s.pity + 1),
	};
	return {
		state: next,
		jackpot,
		forced,
		probability,
		jokes: jackpot ? 2 : 1,
		spRefund: jackpot ? 2 : 0,
	};
}

/** Exact finite-pool transition rewards. No SP cap/budget/boom is included in this theoretical baseline. */
export function analyzeSparxieRenewal(target: 1 | 2 | 3) {
	type Value = { next: number[]; draws: number; jackpots: number };
	const memo = new Map<string, Value>();
	const visit = (s: SparxieLotteryState): Value => {
		if (s.draws === 20 || s.jackpots >= target)
			return {
				next: Array.from({ length: 7 }, (_, i) => Number(i === s.pity)),
				draws: 0,
				jackpots: 0,
			};
		const key = [s.pity, s.draws, s.jackpots].join(":");
		const old = memo.get(key);
		if (old) return old;
		const p = sparxieJackpotProbability(s);
		const out: Value = { next: Array(7).fill(0), draws: 1, jackpots: p };
		for (const [jackpot, probability] of [
			[true, p],
			[false, 1 - p],
		] as const) {
			if (probability === 0) continue;
			const future = visit({
				...s,
				draws: s.draws + 1,
				jackpots: s.jackpots + Number(jackpot),
				jackpotsLeft: s.jackpotsLeft - Number(jackpot),
				smallPrizesLeft: s.smallPrizesLeft - Number(!jackpot),
				pity: jackpot ? 0 : Math.min(6, s.pity + 1),
			});
			out.draws += probability * future.draws;
			out.jackpots += probability * future.jackpots;
			future.next.forEach((n, i) => {
				out.next[i] += probability * n;
			});
		}
		memo.set(key, out);
		return out;
	};
	const rows = Array.from({ length: 7 }, (_, p) =>
		visit(startSparxieLottery(p)),
	);
	let stationary = Array.from({ length: 7 }, (_, i) => Number(i === 4));
	for (let iteration = 0; iteration < 10000; iteration++) {
		const next = Array(7).fill(0) as number[];
		rows.forEach((r, i) => {
			r.next.forEach((n, j) => {
				next[j] += stationary[i] * n;
			});
		});
		const error = Math.max(...next.map((n, i) => Math.abs(n - stationary[i])));
		stationary = next;
		if (error < 1e-14) break;
	}
	const draws = rows.reduce((n, r, i) => n + stationary[i] * r.draws, 0);
	const jackpots = rows.reduce((n, r, i) => n + stationary[i] * r.jackpots, 0);
	const netSp = draws - 2 * jackpots,
		jokes = draws + jackpots;
	return {
		target,
		stationary,
		draws,
		jackpots,
		netSp,
		jokes,
		drawsPerJackpot: draws / jackpots,
		jokesPerNetSp: jokes / netSp,
		firstRound: rows[4],
	};
}
