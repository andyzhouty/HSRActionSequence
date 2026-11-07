import type { AxisEvaluation, SearchStats } from "./elationSearch";
import { simulateElationTeam } from "./elationTeam";
import type { ElationTeamConfig } from "./elationTypes";
export type EvaluationRequest = {
	id: number;
	config: ElationTeamConfig;
	job: AxisEvaluation;
};
export type EvaluationReply = {
	id: number;
	stats?: SearchStats;
	error?: string;
};
export function evaluateAxis(
	config: ElationTeamConfig,
	job: AxisEvaluation,
): SearchStats {
	const totals: number[] = [];
	for (let i = 0; i < job.samples; i++) {
		const result = simulateElationTeam({
			...config,
			...job.policy,
			seed: (job.seed + i) >>> 0,
		});
		if (!result.events || !Number.isFinite(result.total))
			throw new Error("配置未能生成有效行动轴");
		totals.push(result.total);
	}
	totals.sort((a, b) => a - b);
	return {
		mean: totals.reduce((a, b) => a + b, 0) / totals.length,
		min: totals[0],
		max: totals[totals.length - 1],
		p10: totals[Math.floor(totals.length * 0.1)],
		p90: totals[Math.floor(totals.length * 0.9)],
		samples: totals.length,
	};
}
