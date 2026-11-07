import { getCharacterCid } from "../data/characters";
import type { ElationTeamConfig } from "./elationTypes";

export const axisKeys = [
	"wolfUltMinScore",
	"wolfUltRushWindow",
	"wolfSupportTiming",
	"starSkillEvery",
	"pearlSkillEvery",
	"starEnvoyId",
	"pearlBlueprintId",
	"huoSkillEvery",
	"mcSkillEvery",
	"sparxieJackpotTarget",
] as const;
export type AxisKey = (typeof axisKeys)[number];
export type AxisPolicy = Pick<ElationTeamConfig, AxisKey>;
export type SearchQuality = "quick" | "thorough";
export type SearchStats = {
	mean: number;
	min: number;
	max: number;
	p10: number;
	p90: number;
	samples: number;
};
export type SearchCandidate = {
	policy: AxisPolicy;
	stats: SearchStats;
	baseline: boolean;
};
export type SearchProgress = {
	phase: string;
	evaluated: number;
	simulations: number;
};
export type AxisSearchResult = {
	candidates: SearchCandidate[];
	baseline: SearchStats;
	trainingSamples: number;
	validationSamples: number;
	trainingSeed: number;
	validationSeed: number;
	evaluated: number;
	simulations: number;
};
export type AxisEvaluation = {
	policy: AxisPolicy;
	samples: number;
	seed: number;
};
export function axisPolicy(config: ElationTeamConfig): AxisPolicy {
	return Object.fromEntries(
		axisKeys.map((key) => [key, config[key]]),
	) as AxisPolicy;
}
export function policyKey(policy: AxisPolicy) {
	return JSON.stringify(axisKeys.map((key) => policy[key]));
}
export function searchDimensions(
	config: ElationTeamConfig,
): { key: AxisKey; values: (number | string)[] }[] {
	const ids: (string | undefined)[] = config.profiles.map((p) =>
		getCharacterCid(p.character.name),
	);
	const dimensions: { key: AxisKey; values: (number | string)[] }[] = [
		{
			key: "wolfUltMinScore",
			values: [
				60, 90, 120, 150, 180, 210, 240, 270, 300, 320, 380, 460, 560, 620, 700,
				800, 900,
			].filter((n) => n <= Math.max(config.hiddenScoreCap, 999)),
		},
		{
			key: "wolfUltRushWindow",
			values: [0, 20, 40, 60, 100, 150, 200].filter((n) => n <= config.limit),
		},
		{ key: "wolfSupportTiming", values: ["immediate", "score240"] },
	];
	if (ids.includes("1511")) {
		dimensions.push(
			{ key: "starSkillEvery", values: [1, 2, 3] },
			{
				key: "starEnvoyId",
				values: [
					"",
					...config.profiles
						.filter((p) => getCharacterCid(p.character.name) !== "1511")
						.map((p) => p.character.id),
				],
			},
		);
	}
	if (ids.includes("1503"))
		dimensions.push(
			{ key: "pearlSkillEvery", values: [1, 2, 3, 4] },
			{
				key: "pearlBlueprintId",
				values: [
					"",
					...config.profiles
						.filter((p) => getCharacterCid(p.character.name) !== "1503")
						.map((p) => p.character.id),
				],
			},
		);
	if (ids.includes("1217"))
		dimensions.push({ key: "huoSkillEvery", values: [1, 2, 3, 4] });
	if (ids.includes("8010"))
		dimensions.push({ key: "mcSkillEvery", values: [1, 2, 3] });
	if (ids.includes("1501"))
		dimensions.push({ key: "sparxieJackpotTarget", values: [1, 2, 3] });
	return dimensions;
}

/** Coordinate search over policies, never over equipment or disputed mechanism assumptions. */
export async function searchElationAxis(
	config: ElationTeamConfig,
	quality: SearchQuality,
	evaluate: (jobs: AxisEvaluation[]) => Promise<SearchStats[]>,
	onProgress: (p: SearchProgress) => void = () => {},
	cancelled: () => boolean = () => false,
): Promise<AxisSearchResult> {
	if (!config.enabled || config.profiles.length !== 4)
		throw new Error("请先启用伤害计算并导入四人配装");
	const trainingSamples = quality === "quick" ? 8 : 32;
	const validationSamples = quality === "quick" ? 32 : 128;
	const trainingSeed = config.seed >>> 0,
		validationSeed = (trainingSeed + 1000000) >>> 0;
	const initial = axisPolicy(config),
		dimensions = searchDimensions(config);
	const cache = new Map<string, { policy: AxisPolicy; stats: SearchStats }>();
	let evaluated = 0,
		simulations = 0;
	const check = () => {
		if (cancelled()) throw new Error("搜索已取消");
	};
	const train = async (policies: AxisPolicy[], phase: string) => {
		check();
		const missing = [
			...new Map(
				policies
					.filter((p) => !cache.has(policyKey(p)))
					.map((p) => [policyKey(p), p]),
			).values(),
		];
		if (missing.length) {
			const stats = await evaluate(
				missing.map((policy) => ({
					policy,
					samples: trainingSamples,
					seed: trainingSeed,
				})),
			);
			check();
			missing.forEach((policy, i) => {
				cache.set(policyKey(policy), { policy, stats: stats[i] });
			});
			evaluated += missing.length;
			simulations += missing.length * trainingSamples;
		}
		onProgress({ phase, evaluated, simulations });
		return policies.map(
			(p) =>
				cache.get(policyKey(p)) as { policy: AxisPolicy; stats: SearchStats },
		);
	};
	let current = initial;
	const starts =
		quality === "quick"
			? [initial]
			: [
					initial,
					{
						...initial,
						wolfUltMinScore: 560,
						wolfUltRushWindow: Math.min(20, config.limit),
					},
				];
	await train([initial], "评估当前策略");
	for (const [startIndex, start] of starts.entries()) {
		let local = start;
		for (let round = 0; round < (quality === "quick" ? 2 : 3); round++) {
			const before = policyKey(local);
			for (const dimension of dimensions) {
				const candidates = [
					local,
					...dimension.values.map((value) => ({
						...local,
						[dimension.key]: value,
					})),
				];
				const rows = await train(
					candidates,
					`粗筛 ${startIndex + 1}/${starts.length} · 第${round + 1}轮`,
				);
				rows.sort((a, b) => b.stats.mean - a.stats.mean);
				local = rows[0].policy;
			}
			if (policyKey(local) === before) break;
		}
		const rows = await train([current, local], "比较搜索起点");
		if (rows[1].stats.mean > rows[0].stats.mean) current = local;
	}
	const finalists = [...cache.values()]
		.sort((a, b) => b.stats.mean - a.stats.mean)
		.slice(0, 5)
		.map((x) => x.policy);
	const policies = [
		...new Map(
			[initial, current, ...finalists].map((p) => [policyKey(p), p]),
		).values(),
	];
	check();
	onProgress({ phase: "独立种子复核", evaluated, simulations });
	const stats = await evaluate(
		policies.map((policy) => ({
			policy,
			samples: validationSamples,
			seed: validationSeed,
		})),
	);
	check();
	evaluated += policies.length;
	simulations += policies.length * validationSamples;
	const candidates = policies
		.map((policy, i) => ({
			policy,
			stats: stats[i],
			baseline: policyKey(policy) === policyKey(initial),
		}))
		.sort((a, b) => b.stats.mean - a.stats.mean);
	onProgress({ phase: "完成", evaluated, simulations });
	return {
		candidates,
		baseline: stats[0],
		trainingSamples,
		validationSamples,
		trainingSeed,
		validationSeed,
		evaluated,
		simulations,
	};
}
