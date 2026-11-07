import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { searchPhainonAxis } from "../../src/damage/optimizer";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

it.skipIf(!process.env.HSR_TIMING_COMPARE)(
	"compares earlier second ultimates after correcting seed refunds",
	() => {
		const source = process.env.HSR_FREESR_TEST_FILE,
			seedFile = process.env.HSR_SEARCH_SEED,
			output = process.env.HSR_DAMAGE_REPORT_DIR;
		if (!source || !seedFile || !output)
			throw new Error("需要配装、种子轴和输出路径");
		const raw: unknown = JSON.parse(readFileSync(source, "utf8"));
		const seed = toNormalizedSavedData(
			JSON.parse(readFileSync(seedFile, "utf8")),
		);
		const white = "freesr-1408";
		const comparisons: { label: string; opening: number; score: number }[] = [];
		for (const [label, after] of [
			["首个火种足够的敌方行动后", "damage-trial-enemy-5"],
			["花火第三次E拉起白厄后", "freesr-1408-7"],
			["等待鸭E与第二次Q", "freesr-1408-8"],
		]) {
			const candidate = structuredClone(seed);
			for (const [key, casts] of Object.entries(candidate.ultInterrupts)) {
				candidate.ultInterrupts[key] = casts.filter(
					(cast) =>
						!(cast.casterId === white && !key.startsWith("freesr-1408-3")) &&
						!(
							after !== "freesr-1408-8" &&
							cast.casterId === "freesr-1101" &&
							key !== "freesr-1101-1"
						),
				);
			}
			candidate.ultInterrupts[after] ??= [];
			candidate.ultInterrupts[after].push({
				casterId: white,
				timing: "after",
			});
			const result = searchPhainonAxis(raw, {
				seed: candidate,
				budget: 10,
				restarts: 0,
			});
			const openings = result.best.rows.filter(
				(row) => row.actor === "白厄" && row.description.includes("展开境界"),
			);
			expect(openings).toHaveLength(2);
			comparisons.push({
				label,
				opening: openings[1].actionValue,
				score: result.best.score,
			});
		}
		mkdirSync(output, { recursive: true });
		writeFileSync(
			join(output, "second-ultimate-comparison.json"),
			JSON.stringify(comparisons, null, 2),
		);
		writeFileSync(
			join(output, "second-ultimate-comparison.md"),
			[
				"# 二次开大时机对比",
				"",
				"已按开局1火种、退场3火种加溢出重算；更早开大方案去掉因境界离场而无法执行的后续鸭Q。只调整第二次白厄Q及境界技能，其他策略保持这条轴的设置，因此这也不是各时机的全局最优证明。",
				"",
				"| 方案 | 第二次Q行动值 | 300行动值白厄自身期望伤害 |",
				"|---|---:|---:|",
				...comparisons.map(
					(item) =>
						`| ${item.label} | ${item.opening.toFixed(4)} | ${item.score.toFixed(2)} |`,
				),
				"",
			].join("\n"),
		);
	},
	60000,
);
