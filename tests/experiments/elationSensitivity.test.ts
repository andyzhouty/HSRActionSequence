import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createElationTeamPreset } from "../../src/damage/elationPreset";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import type { ElationTeamConfig } from "../../src/damage/elationTypes";

const file = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(
	process.env.HSR_ELATION_ANALYSIS !== "1" || !file || !existsSync(file),
)(
	"exports random-seed and mechanic sensitivity without fitting to a target damage number",
	() => {
		if (!file) throw new Error("Missing FreeSR file");
		const config = createElationTeamPreset(
			JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")),
			file,
		);
		const sample = (patch: Partial<ElationTeamConfig>, n = 100) => {
			const totals = Array.from(
				{ length: n },
				(_, i) =>
					simulateElationTeam({ ...config, ...patch, seed: config.seed + i })
						.total,
			).sort((a, b) => a - b);
			return {
				mean: totals.reduce((a, b) => a + b, 0) / n,
				min: totals[0],
				p10: totals[Math.floor(n * 0.1)],
				median: totals[Math.floor(n * 0.5)],
				p90: totals[Math.floor(n * 0.9)],
				max: totals[n - 1],
			};
		};
		const baseline = sample({});
		const sensitivity = {
			mcTechniqueHigh: sample({ mcTechniqueElation: 0.3 }, 30),
			mushroomNoStack: sample({ mushroomStacks: false }, 30),
			mcTraceStack: sample({ mcTraceStack: true }, 30),
			boxAttack: sample({ boxCountsAsAttack: true }, 30),
			lowHpFour: sample({ lowHpHealTargets: 4 }, 30),
		};
		const policies = [];
		for (const huoSkillEvery of [1, 2, 3, 4])
			for (const mcSkillEvery of [1, 2, 3])
				policies.push({
					huoSkillEvery,
					mcSkillEvery,
					...sample({ huoSkillEvery, mcSkillEvery }, 20),
				});
		policies.sort((a, b) => b.mean - a.mean);
		expect(Number.isFinite(baseline.mean)).toBe(true);
		const dir = process.env.HSR_ELATION_REPORT_DIR ?? "build/elation-trial";
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "sensitivity.json"),
			JSON.stringify(
				{ baseline, sensitivity, policies, assumptions: config },
				null,
				2,
			),
		);
		writeFileSync(
			join(dir, "sensitivity.md"),
			[
				"# 欢愉队试验敏感性",
				"",
				"以下均是显式假设权重下的模型输出，不代表游戏真实盲盒概率，也不以4000万～5000万为拟合目标。",
				"",
				`默认100种子：平均${baseline.mean.toFixed(2)}；范围${baseline.min.toFixed(2)}～${baseline.max.toFixed(2)}；P10～P90：${baseline.p10.toFixed(2)}～${baseline.p90.toFixed(2)}。`,
				"",
				"|假设变动|平均伤害|",
				"|---|---:|",
				...Object.entries(sensitivity).map(
					([k, v]) => `|${k}|${v.mean.toFixed(2)}|`,
				),
				"",
				"|藿藿E间隔|主角E间隔|20种子平均|",
				"|---:|---:|---:|",
				...policies.map(
					(p) => `|${p.huoSkillEvery}|${p.mcSkillEvery}|${p.mean.toFixed(2)}|`,
				),
			].join("\n"),
		);
	},
	120000,
);
