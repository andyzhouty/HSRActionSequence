import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createElationTeamPreset } from "../../src/damage/elationPreset";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import type { ElationTeamConfig } from "../../src/damage/elationTypes";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

const file = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(
	process.env.HSR_ELATION_SCORE_SEARCH !== "1" || !file || !existsSync(file),
)(
	"compares banking hidden score to immediate ults on independent seeds",
	() => {
		if (!file) throw new Error("Missing file");
		const base = createElationTeamPreset(
			JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")),
			file,
		);
		const sample = (
			patch: Partial<ElationTeamConfig>,
			n: number,
			offset = 0,
		) => {
			let total = 0,
				closed = 0,
				full = 0,
				basics = 0,
				usedExtras = 0,
				ults = 0;
			const results = Array.from({ length: n }, (_, i) =>
				simulateElationTeam({
					...base,
					...patch,
					seed: base.seed + offset + i,
				}),
			);
			for (const r of results) {
				total += r.total;
				for (const c of r.cycles) {
					ults++;
					basics += c.basics;
					usedExtras += c.usedExtras;
					if (c.end !== undefined) {
						closed++;
						if (c.usedExtras >= 2) full++;
					}
				}
			}
			return {
				mean: total / n,
				closed: closed / n,
				full: full / n,
				fullRate: closed ? full / closed : 0,
				basics: basics / n,
				usedExtras: usedExtras / n,
				ults: ults / n,
			};
		};
		const candidates = [];
		for (const huoSkillEvery of [1, 2, 3, 4])
			for (const wolfUltMinScore of [
				60, 90, 120, 140, 150, 160, 180, 200, 220, 240,
			])
				for (const wolfUltRushWindow of [0, 50])
					for (const wolfSupportTiming of ["immediate", "score240"] as const) {
						const patch = {
							huoSkillEvery,
							wolfUltMinScore,
							wolfUltRushWindow,
							wolfSupportTiming,
						};
						candidates.push({ patch, training: sample(patch, 20) });
					}
		candidates.sort((a, b) => b.training.mean - a.training.mean);
		const baseline = sample({}, 100, 10000);
		const finalists = candidates
			.slice(0, 5)
			.map((c) => ({ ...c, validation: sample(c.patch, 100, 10000) }));
		finalists.sort((a, b) => b.validation.mean - a.validation.mean);
		const focused = [60, 120, 160, 200, 240].map((wolfUltMinScore) => ({
			wolfUltMinScore,
			...sample({ wolfUltMinScore }, 100, 10000),
		}));
		const best = finalists[0];
		const first = simulateElationTeam(base),
			bestConfig = { ...base, ...best.patch },
			second = simulateElationTeam(bestConfig);
		expect(first.cycles.length).toBeGreaterThan(0);
		expect(second.cycles.length).toBeGreaterThan(0);
		const presets = (config: typeof base) =>
			toNormalizedSavedData({
				characters: config.profiles.map((p) => p.character),
				elationTeamTrial: config,
				limitPreset: "自定义",
				customLimit: "300",
				displayedLimit: "300",
				resources: [],
				overrides: {},
			});

		const output =
			process.env.HSR_ELATION_REPORT_DIR ?? "build/elation-score-strategy";
		mkdirSync(output, { recursive: true });
		writeFileSync(
			join(output, "best-preset.json"),
			JSON.stringify(presets(bestConfig), null, 2),
		);
		writeFileSync(
			join(output, "baseline-preset.json"),
			JSON.stringify(presets(base), null, 2),
		);
		const robustness = [
			{ name: "均分假设", patch: {} },
			{ name: "菇菇不叠加", patch: { mushroomStacks: false } },
		].map((c) => ({
			name: c.name,
			baseline: sample(c.patch, 50, 20000),
			banking: sample({ ...c.patch, ...best.patch }, 50, 20000),
		}));
		writeFileSync(
			join(output, "robustness.json"),
			JSON.stringify(robustness, null, 2),
		);

		writeFileSync(
			join(output, "comparison.json"),
			JSON.stringify(
				{
					baseline,
					focused,
					finalists,
					candidates,
					baselineExample: first,
					bestExample: second,
					bestConfig,
				},
				null,
				2,
			),
		);
		const cycleRows = (r: typeof first, label: string) =>
			r.cycles.map(
				(c, i) =>
					`|${label}|${i + 1}|${c.start.toFixed(4)}|${c.end?.toFixed(4) ?? "300AV内未退大"}|${c.entryHidden.toFixed(2)}|${c.peakHidden.toFixed(2)}|${c.basics}|${c.usedExtras}|`,
			);
		writeFileSync(
			join(output, "comparison.md"),
			[
				"# 攒分流与即时开大：300AV对照",
				"",
				"同一配装、95级单敌/132速、主角优先E；同时比较藿藿E/EA/EAA/EAAA；三分支按SP和隐藏分的用户假设动态计算。候选先用20个种子筛选，表中伤害使用另一组100个种子验证，未按某个幸运种子选轴。",
				"",
				"|策略|藿藿E间隔|开大最低分|末段放宽窗口|队友Q时机|平均伤害|强化A次数|额外A次数|已退大轮次中吃到两次额外A比例|",
				"|---|---:|---:|---:|---|---:|---:|---:|---:|",
				`|原策略|3|60|0|immediate|${baseline.mean.toFixed(2)}|${baseline.basics.toFixed(2)}|${baseline.usedExtras.toFixed(2)}|${(baseline.fullRate * 100).toFixed(2)}%|`,
				...finalists.map(
					(c, i) =>
						`|候选${i + 1}|${c.patch.huoSkillEvery}|${c.patch.wolfUltMinScore}|${c.patch.wolfUltRushWindow}|${c.patch.wolfSupportTiming}|${c.validation.mean.toFixed(2)}|${c.validation.basics.toFixed(2)}|${c.validation.usedExtras.toFixed(2)}|${(c.validation.fullRate * 100).toFixed(2)}%|`,
				),
				"",
				"队友Q时机score240：变身中只在最后一次可用普攻前、且尚未到240时使用爻光/欢愉主Q；已到240则留给退大后。藿藿Q不延迟。额外回合不消费自然行动进度，没有人工延迟角色或冻结时间。",
				"",
				"## 只提高开大门槛（藿藿仍为EAA，独立100种子）",
				"",
				"|门槛|平均伤害|强化A次数|已退大轮次吃到两次额外A比例|",
				"|---:|---:|---:|---:|",
				...focused.map(
					(c) =>
						`|${c.wolfUltMinScore}|${c.mean.toFixed(2)}|${c.basics.toFixed(2)}|${(c.fullRate * 100).toFixed(2)}%|`,
				),
				"",
				"## 另一组种子与假设变动复核（每项50次）",
				"",
				"|假设|原策略|攒分候选|提升|",
				"|---|---:|---:|---:|",
				...robustness.map(
					(c) =>
						`|${c.name}|${c.baseline.mean.toFixed(2)}|${c.banking.mean.toFixed(2)}|${((c.banking.mean / c.baseline.mean - 1) * 100).toFixed(2)}%|`,
				),
				"",
				"## 原始种子逐轮对照",
				"",
				"|策略|轮次|开Q AV|退大AV|Q前隐藏分|本轮最高隐藏分|强化A次数|实际额外A次数|",
				"|---|---:|---:|---|---:|---:|---:|---:|",
				...cycleRows(first, "原策略"),
				...cycleRows(second, "最佳候选"),
				"",
				"本比较不是全局最优证明；未独立测定盲盒实际概率，也未枚举所有人为插Q时点。",
			].join("\n"),
		);
	},
	120000,
);
