import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import { normalizeElationTeamConfig } from "../../src/damage/elationTypes";

it.skipIf(process.env.HSR_INTEGER_JOKES_AUDIT !== "1")(
	"recalculates the last no-debt P95 configurations with integer joke changes",
	() => {
		const root = "build/wolf-speed-40rolls-max25",
			dir = "build/jokes-integer-audit";
		mkdirSync(dir, { recursive: true });
		const reports = [];
		for (const name of ["爻光队", "火花队"]) {
			const old = JSON.parse(
				readFileSync(`${root}/${name}-summary.json`, "utf8"),
			);
			const config = normalizeElationTeamConfig(
				JSON.parse(
					readFileSync(`${root}/${name}-best-p95-config.json`, "utf8"),
				),
			);
			if (!config) throw new Error("missing config");
			const samples = [];
			for (let i = 0; i < 1000; i++) {
				const seed = old.seedStart + i,
					result = simulateElationTeam({ ...config, seed });
				expect(result.rows.every((r) => Number.isInteger(r.jokes))).toBe(true);
				samples.push({ seed, total: result.total });
			}
			samples.sort((a, b) => a.total - b.total || a.seed - b.seed);
			const selected = samples[950];
			const current = {
				mean: samples.reduce((s, x) => s + x.total, 0) / samples.length,
				p10: samples[100].total,
				p90: samples[900].total,
				p95: selected.total,
				seed: selected.seed,
				samples: 1000,
			};
			const result = simulateElationTeam({ ...config, seed: selected.seed });
			const report = {
				name,
				previous: old.bestP95.stats,
				current,
				seedStart: old.seedStart,
				axisPolicyChanged: false,
				warning:
					"Only the existing P95-priority policy was re-evaluated; no new optimum is claimed.",
			};
			reports.push(report);
			writeFileSync(
				`${dir}/${name}-summary.json`,
				JSON.stringify(report, null, 2),
			);
			writeFileSync(
				`${dir}/${name}-p95-result.json`,
				JSON.stringify(result, null, 2),
			);
			writeFileSync(
				`${dir}/${name}-saved-axis.json`,
				JSON.stringify(
					{
						characters: config.profiles.map((p) => p.character),
						elationTeamTrial: { ...config, seed: selected.seed },
						limitPreset: "自定义",
						customLimit: "300",
						displayedLimit: "300",
						resources: [],
					},
					null,
					2,
				),
			);
		}
		const oldSample = JSON.parse(
			readFileSync(`${root}/p95-23.62-axis/summary.json`, "utf8"),
		);
		const raw = normalizeElationTeamConfig(
			JSON.parse(readFileSync(`${root}/p95-23.62-axis/config.json`, "utf8")),
		);
		if (!raw) throw new Error("missing old sample");
		const corrected = simulateElationTeam(raw);
		writeFileSync(
			`${dir}/old-23.62-seed-corrected-result.json`,
			JSON.stringify(corrected, null, 2),
		);
		const sample = {
			seed: raw.seed,
			previous: oldSample.total,
			current: corrected.total,
		};
		writeFileSync(
			`${dir}/summary.json`,
			JSON.stringify(
				{
					rule: "floor shared jokes after each change; hidden gain and total jokes use actual integer gain",
					reports,
					oldSample: sample,
				},
				null,
				2,
			),
		);
		const v = (n: number) => `${(n / 1e8).toFixed(4)}亿`;
		writeFileSync(
			`${dir}/report.md`,
			[
				"# 笑点逐次向下取整修正",
				"",
				"笑点每次变动后立即向下取整，不保留小数尾数。百分比回收、真珠临时笑点清理、固定计入与手动排轴同步采用整数；银狼隐藏分和累计产笑按实际整数收益。能量和好活计入不在本次规则更改范围内。",
				"",
				"仍为原配装、原P95优先策略，95级单体、205速、20%抗性、300AV、不计负债。每队使用原来的同一组1000个独立种子，没有重新搜索最优策略。",
				"",
				"|队伍|旧均伤|新均伤|旧P95|新P95|新P95种子|",
				"|---|---:|---:|---:|---:|---:|",
				...reports.map(
					(r) =>
						`|${r.name}|${v(r.previous.mean)}|${v(r.current.mean)}|${v(r.previous.p95)}|${v(r.current.p95)}|${r.current.seed}|`,
				),
				"",
				`旧23.62亿轴的同一个种子${sample.seed}：${v(sample.previous)} → ${v(sample.current)}。旧输出保留为历史，不应继续当作当前规则的计算结果。`,
			].join("\n") + "\n",
		);
	},
	60000,
);
