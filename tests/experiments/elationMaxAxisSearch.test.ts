import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import type { ElationTeamConfig } from "../../src/damage/elationTypes";
import { buildTeam } from "./elationMaxBuild";

const source = process.env.HSR_FREESR_TEST_FILE;
const dir = process.env.HSR_ELATION_MAX_AXIS_DIR ?? "build/elation-max-axis";
const WOLF = "银狼LV.999";

/** 轴：只包含影响行动顺序与资源使用时点的选择。 */
const AXIS: { key: keyof ElationTeamConfig; values: unknown[] }[] = [
	{
		key: "wolfUltMinScore",
		values: [
			60, 75, 90, 105, 120, 135, 150, 170, 190, 200, 210, 220, 230, 240, 250,
			260, 270, 280, 290, 300, 320, 350, 380, 420, 460, 500, 560, 620, 700, 800,
			900,
		],
	},
	{
		key: "wolfUltRushWindow",
		values: [0, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200],
	},
	{ key: "wolfSupportTiming", values: ["immediate", "score240"] },
	{ key: "starSkillEvery", values: [1, 2, 3] },
	{ key: "pearlSkillEvery", values: [1, 2, 3, 4] },
	{
		key: "starEnvoyId",
		values: ["", "freesr-1506", "freesr-1511", "freesr-1503"],
	},
	{
		key: "pearlBlueprintId",
		values: ["", "freesr-1506", "freesr-1502", "freesr-1511"],
	},
];

/** 机制口径：不是轴，默认值保持文档口径，单独做敏感性。 */
const ASSUMPTIONS: {
	key: keyof ElationTeamConfig;
	value: unknown;
	label: string;
}[] = [
	{
		key: "boxCountsAsAttack",
		value: true,
		label: "强化A内置盲盒也触发大吉大利",
	},
	{
		key: "applausePhase",
		value: "before",
		label: "阿哈时刻先发好活再结算欢愉技",
	},
	{ key: "pearlCopyApplause", value: "blueprint", label: "真珠复制用底本好活" },
	{ key: "mushroomStacks", value: false, label: "两把菇菇嘎嘎易伤不叠加" },
	{ key: "mcTraceStack", value: true, label: "欢愉主行迹累加下一E好活" },
];

it.skipIf(process.env.HSR_ELATION_MAX_AXIS !== "1" || !source)(
	"searches the highest-damage 300 AV axis with Silver Wolf as the only fixed carry",
	() => {
		const raw = JSON.parse(
			readFileSync(source as string, "utf8").replace(/^\uFEFF/, ""),
		);
		const team = buildTeam(raw, source as string);
		const BASE = team.seed;

		const run = (
			patch: Partial<ElationTeamConfig>,
			n: number,
			offset: number,
		) => {
			const per: number[] = [];
			let wolf = 0,
				cycles = 0,
				basics = 0,
				extras = 0;
			for (let i = 0; i < n; i++) {
				const r = simulateElationTeam({
					...team,
					...patch,
					seed: BASE + offset + i,
				});
				per.push(r.total);
				wolf += r.byActor[WOLF] ?? 0;
				cycles += r.cycles.length;
				basics += r.cycles.reduce((s, c) => s + c.basics, 0);
				extras += r.cycles.reduce((s, c) => s + c.usedExtras, 0);
			}
			per.sort((a, b) => a - b);
			return {
				mean: per.reduce((a, b) => a + b, 0) / n,
				wolfMean: wolf / n,
				cycles: cycles / n,
				basics: basics / n,
				extras: extras / n,
				p10: per[Math.floor(n * 0.1)],
				p90: per[Math.floor(n * 0.9)],
			};
		};

		const TRAIN = 32,
			VALID = 200,
			OFFSET = 0,
			VALID_OFFSET = 500000;
		const log: string[] = [];
		const explored: {
			patch: Partial<ElationTeamConfig>;
			train: ReturnType<typeof run>;
		}[] = [];

		const defaultAxis: Partial<ElationTeamConfig> = {
			wolfUltMinScore: 60,
			wolfUltRushWindow: 0,
			wolfSupportTiming: "immediate",
			starSkillEvery: 1,
			pearlSkillEvery: 3,
			starEnvoyId: "",
			pearlBlueprintId: "",
		};

		// 0) 未优化的默认轴
		const base = run({}, TRAIN, OFFSET);
		log.push(
			`默认轴（全部为默认口径）：${(base.mean / 1e8).toFixed(3)}亿，银狼 ${(base.wolfMean / 1e8).toFixed(3)}亿，开大 ${base.cycles.toFixed(2)} 次`,
		);

		// 1) 机制口径敏感性（逐个单独改动）
		const assumptionRows = ASSUMPTIONS.map((a) => ({
			label: a.label,
			key: a.key,
			value: a.value,
			result: run(
				{ [a.key]: a.value } as Partial<ElationTeamConfig>,
				TRAIN,
				OFFSET,
			),
		}));
		log.push(
			`机制口径敏感性：${assumptionRows
				.map((r) => `${r.label}=${(r.result.mean / 1e8).toFixed(3)}亿`)
				.join("；")}`,
		);

		// 2) 单自由度边际扫描
		let current: Partial<ElationTeamConfig> = { ...defaultAxis };
		for (const knob of AXIS) {
			const rows = knob.values.map((value) => ({
				value,
				result: run(
					{ ...current, [knob.key]: value } as Partial<ElationTeamConfig>,
					TRAIN,
					OFFSET,
				),
			}));
			const sorted = [...rows].sort((a, b) => b.result.mean - a.result.mean);
			explored.push(
				...rows.map((r) => ({
					patch: { [knob.key]: r.value } as Partial<ElationTeamConfig>,
					train: r.result,
				})),
			);
			log.push(
				`${String(knob.key)}：${sorted
					.map(
						(r) =>
							`${String(r.value) || "默认"}=${(r.result.mean / 1e8).toFixed(3)}`,
					)
					.join("  ")}`,
			);
			current = {
				...current,
				[knob.key]: sorted[0].value,
			} as Partial<ElationTeamConfig>;
		}

		// 3) 坐标下降至收敛
		for (let round = 1; round <= 5; round++) {
			const before = run(current, TRAIN, OFFSET).mean;
			let improved = false;
			for (const knob of AXIS) {
				let bestValue = current[knob.key];
				let bestScore = run(current, TRAIN, OFFSET).mean;
				for (const value of knob.values) {
					if (value === current[knob.key]) continue;
					const candidate = {
						...current,
						[knob.key]: value,
					} as Partial<ElationTeamConfig>;
					const result = run(candidate, TRAIN, OFFSET);
					explored.push({
						patch: { [knob.key]: value } as Partial<ElationTeamConfig>,
						train: result,
					});
					if (result.mean > bestScore) {
						bestScore = result.mean;
						bestValue = value as never;
					}
				}
				if (bestValue !== current[knob.key]) {
					improved = true;
					current = {
						...current,
						[knob.key]: bestValue,
					} as Partial<ElationTeamConfig>;
				}
			}
			const after = run(current, TRAIN, OFFSET).mean;
			log.push(
				`第${round}轮坐标下降：${(before / 1e8).toFixed(3)}亿 → ${(after / 1e8).toFixed(3)}亿${improved ? "" : "（收敛）"}`,
			);
			if (!improved) break;
		}

		// 4) 交叉验证：另一组种子重排前若干候选
		explored.sort((a, b) => b.train.mean - a.train.mean);
		const finalists: {
			patch: Partial<ElationTeamConfig>;
			train: ReturnType<typeof run>;
			valid: ReturnType<typeof run>;
		}[] = [];
		const seen = new Set<string>();
		for (const item of explored) {
			const patch = { ...current, ...item.patch } as Partial<ElationTeamConfig>;
			const key = JSON.stringify(
				Object.entries(patch)
					.filter(([k]) => AXIS.some((a) => a.key === k))
					.sort(([a], [b]) => a.localeCompare(b)),
			);
			if (seen.has(key)) continue;
			seen.add(key);
			finalists.push({
				patch,
				train: run(patch, TRAIN, OFFSET),
				valid: run(patch, VALID, VALID_OFFSET),
			});
			if (finalists.length >= 12) break;
		}
		finalists.sort((a, b) => b.valid.mean - a.valid.mean);
		const best = finalists[0];
		const bestConfig = { ...team, ...best.patch } as ElationTeamConfig;

		// 5) 最优轴在各项机制口径下的稳健性
		const robustness = ASSUMPTIONS.map((a) => ({
			label: a.label,
			defaultRun: run({ ...best.patch }, 48, 900000),
			flipped: run(
				{ ...best.patch, [a.key]: a.value } as Partial<ElationTeamConfig>,
				48,
				900000,
			),
		}));

		const bestExample = simulateElationTeam(bestConfig);
		const byDetail = (r: typeof bestExample) => {
			const out = new Map<string, number>();
			for (const row of r.rows) {
				const key = `${row.actor}｜${row.skill}｜${row.detail}`;
				out.set(key, (out.get(key) ?? 0) + row.expected);
			}
			return [...out.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 20)
				.map(([key, value]) => ({ key, value }));
		};

		mkdirSync(dir, { recursive: true });
		writeFileSync(
			`${dir}/search.json`,
			JSON.stringify(
				{
					base,
					assumptions: assumptionRows,
					finalists,
					bestPatch: best.patch,
					robustness,
					bestExample: {
						total: bestExample.total,
						byActor: bestExample.byActor,
						cycles: bestExample.cycles,
						topDetails: byDetail(bestExample),
						rows: bestExample.rows.length,
					},
				},
				null,
				2,
			),
		);
		writeFileSync(`${dir}/search.log.txt`, log.join("\n"));
		writeFileSync(
			`${dir}/best-config.json`,
			JSON.stringify(bestConfig, null, 2),
		);
		console.log(log.join("\n"));
		console.log("best axis", JSON.stringify(best.patch, null, 1));
		console.log("valid", JSON.stringify(best.valid, null, 1));
		console.log(
			"robustness",
			robustness
				.map(
					(r) =>
						`${r.label}:${(r.defaultRun.mean / 1e8).toFixed(3)}→${(r.flipped.mean / 1e8).toFixed(3)}`,
				)
				.join(" | "),
		);
	},
	1800000,
);
