import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { searchPhainonAxis } from "../../src/damage/optimizer";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

it.skipIf(!process.env.HSR_DAMAGE_SEARCH)(
	"searches a 300 AV axis using the supplied equipment",
	() => {
		const source = process.env.HSR_FREESR_TEST_FILE;
		const output = process.env.HSR_DAMAGE_REPORT_DIR;
		if (!source || !output) throw new Error("需要配装文件和输出路径");
		const raw: unknown = JSON.parse(
			readFileSync(source, "utf8").replace(/^\uFEFF/, ""),
		);
		const lockedCasts = (process.env.HSR_LOCKED_CASTS ?? "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean)
			.map((item) => {
				const [actor, after, timing] = item.split("@");
				if (!actor || !after)
					throw new Error("锁定插入格式应为 actor@anchor@timing");
				return {
					actor,
					after,
					timing:
						timing === "before" ? ("before" as const) : ("after" as const),
				};
			});
		const critRate = Number(process.env.HSR_CRIT_RATE ?? Number.NaN);
		const critDamage = Number(process.env.HSR_CRIT_DAMAGE ?? Number.NaN);
		const configOverride = {
			...(Number.isFinite(critRate) ? { critRate } : {}),
			...(Number.isFinite(critDamage) ? { critDamage } : {}),
		};
		const result = searchPhainonAxis(raw, {
			seed: process.env.HSR_SEARCH_SEED
				? toNormalizedSavedData(
						JSON.parse(readFileSync(process.env.HSR_SEARCH_SEED, "utf8")),
					)
				: undefined,
			lockedCasts,
			configOverride,
			limit: Number(process.env.HSR_SEARCH_LIMIT ?? 300),
			ruinCarryValue: Number(process.env.HSR_RUIN_CARRY ?? 0),
			budget: Number(process.env.HSR_SEARCH_BUDGET ?? 20000),
			restarts: Number(process.env.HSR_SEARCH_RESTARTS ?? 3),
			onProgress: (message) => console.log(message),
		});
		expect(result.best.score).toBeGreaterThanOrEqual(result.baselineScore);
		expect(result.best.rows.flatMap((row) => row.warnings)).toEqual([]);
		mkdirSync(output, { recursive: true });
		writeFileSync(
			join(output, "action-sequence-phainon-optimized.json"),
			JSON.stringify(result.best.saved, null, 2),
		);
		writeFileSync(
			join(output, "search-results.json"),
			JSON.stringify(result, null, 2),
		);
		const report = [
			"# 白厄300行动值搜索结果",
			"",
			...result.constraints.map((line) => `- ${line}`),
			"",
			`评估${result.evaluations}条，合法${result.valid}条；基准${result.baselineScore.toFixed(2)}，当前找到的最高${result.best.score.toFixed(2)}，提升${((result.best.score / result.baselineScore - 1) * 100).toFixed(2)}%。`,
			"",
			"| AV | 角色/技能 | 结算 | 伤害 | 火种/毁伤/SP | 布洛妮娅/花火/知更鸟能量 | 增益 |",
			"|---:|---|---|---:|---|---|---|",
			...result.best.rows.map(
				(row) =>
					`| ${row.actionValue.toFixed(4)} | ${row.actor} ${row.skill} | ${row.description} | ${row.expected.toFixed(2)} | ${row.seeds}/${row.ruin}/${row.skillPoints} | ${[
						"1101",
						"1306",
						"1309",
					]
						.map((cid) => {
							const state = row.energy[`freesr-${cid}`];
							return state
								? `${state.current.toFixed(3)}/${state.maximum}`
								: "—";
						})
						.join(" / ")} | ${row.buffs.join("、")} |`,
			),
			"",
		];
		writeFileSync(join(output, "search-report.md"), report.join("\n"));
		console.log(
			JSON.stringify({
				score: result.best.score,
				baseline: result.baselineScore,
				evaluations: result.evaluations,
				valid: result.valid,
			}),
		);
	},
	600000,
);
