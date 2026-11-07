export type SilverWolfBoxContext = {
	sp: number;
	spCap: number;
	hidden: number;
	hiddenCap: number;
	beanCurveK: number;
};

/** User's qualitative model, not measured game probabilities. a = hiddenCap / beanCurveK. */
export function silverWolfBoxProbabilities({
	sp,
	spCap,
	hidden,
	hiddenCap,
	beanCurveK = 8,
}: SilverWolfBoxContext) {
	if (
		![sp, spCap, hidden, hiddenCap, beanCurveK].every(Number.isFinite) ||
		spCap <= 0 ||
		hiddenCap <= 0 ||
		beanCurveK <= 0 ||
		sp < 0 ||
		sp > spCap ||
		hidden < 0 ||
		hidden > hiddenCap
	)
		throw new Error("银狼盲盒概率输入越界");
	const spProbability = 0.5 * (1 - sp / spCap);
	const beansProbability =
		0.5 *
		(1 -
			Math.log1p(beanCurveK * (hidden / hiddenCap)) / Math.log1p(beanCurveK));
	const swordProbability = Math.max(0, 1 - spProbability - beansProbability);
	return {
		sp: spProbability,
		beans: beansProbability,
		sword: swordProbability,
	};
}

/**
 * 触发率低于阈值的分支视为实战无法触发：剔除后其余分支按原比例归一。
 * 阈值 0 表示保留原模型；这是用户指定的实战修正，不是游戏概率实测。
 */
export function pruneSilverWolfBoxProbabilities(
	probabilities: { sp: number; beans: number; sword: number },
	threshold: number,
) {
	if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
		throw new Error("盲盒剔除阈值无效");
	if (threshold <= 0) return probabilities;
	const entries = [
		{ key: "sword" as const, value: probabilities.sword },
		{ key: "sp" as const, value: probabilities.sp },
		{ key: "beans" as const, value: probabilities.beans },
	];
	const kept = entries.filter((entry) => entry.value >= threshold);
	const usable = kept.length ? kept : entries;
	const total = usable.reduce((sum, entry) => sum + entry.value, 0);
	return Object.fromEntries(
		usable.map((entry) => [entry.key, entry.value / total]),
	) as { sword: number; sp: number; beans: number };
}
