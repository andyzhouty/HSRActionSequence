import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createElationTeamPreset } from "../../../src/damage/elationPreset";
import { simulateElationTeam } from "../../../src/damage/elationTeam";

const source = process.env.HSR_FREESR_TEST_FILE;
describe("requested Silver Wolf elation team", () => {
	it.skipIf(!source || !existsSync(source))(
		"uses actual relics and requested cones, computes a reproducible legal 300 AV axis",
		() => {
			if (!source) throw new Error("Missing FreeSR file");
			const raw = JSON.parse(
				readFileSync(source, "utf8").replace(/^\uFEFF/, ""),
			);
			const config = createElationTeamPreset(raw, source);
			expect(config.profiles.map((p) => p.character.eidolon)).toEqual([
				2, 1, 6, 1,
			]);
			expect(config.profiles.map((p) => p.character.lc_id)).toEqual([
				23057, 21064, 21064, 21007,
			]);
			expect(config.profiles.map((p) => p.character.superimpose)).toEqual([
				1, 5, 5, 5,
			]);
			expect(config.profiles[3].gear.enhanced).toBe(true);
			expect(config.profiles[2].gear).toMatchObject({
				skillLevel: 12,
				ultimateLevel: 12,
				talentLevel: 12,
			});
			const result = simulateElationTeam(config);
			expect(result.total).toBeGreaterThan(0);
			expect(result.rows.every((r) => Number.isInteger(r.hidden))).toBe(true);
			for (const row of result.rows.filter((r) => r.skill === "退场"))
				expect(row.hidden).toBe(
					Math.floor((result.cycles[row.cycle - 1].exitHidden ?? 0) * 0.2),
				);

			const wolfRows = result.rows.filter((r) => r.actor === "银狼LV.999");
			const enhancedChunks = wolfRows.filter(
				(r) => r.skill === "强化A" && r.detail.startsWith("弹射"),
			);
			expect(enhancedChunks.length).toBeGreaterThan(0);
			expect(enhancedChunks.every((r) => r.multiplier === 0.6)).toBe(true);
			expect(
				wolfRows
					.filter((r) => r.detail === "最后一击")
					.every((r) => r.multiplier === 1),
			).toBe(true);
			expect(
				wolfRows
					.filter((r) => r.kind === "elation")
					.every((r) => (r.factors?.defenseIgnore ?? 0) <= 0.60000001),
			).toBe(true);
			expect(
				wolfRows
					.filter((r) => r.kind === "normal")
					.every((r) => r.factors?.defenseIgnore === 0),
			).toBe(true);
			const costs = result.rows
				.flatMap((r) => r.energyEvents)
				.filter((e) => e.source === "终结技消耗");
			expect(costs.length).toBeGreaterThan(0);
			const wolfQ = result.rows.filter(
				(r) => r.skill === "Q" && r.actor === "银狼LV.999",
			);
			expect(
				wolfQ.some((r) =>
					r.energyEvents.some((e) => e.source === "强化藿藿天赋治疗回能"),
				),
			).toBe(true);

			expect(
				costs.every(
					(e) =>
						e.fixed && Math.abs(e.before + e.amount) < 1e-6 && e.after === 0,
				),
			).toBe(true);

			expect(
				result.rows.every(
					(r) =>
						r.av >= 0 &&
						r.av <= 300 &&
						r.sp >= 0 &&
						r.sp <= 5 &&
						r.hidden >= 0 &&
						r.hidden <= 300 &&
						Number.isFinite(r.expected),
				),
			).toBe(true);
			const enemyRows = result.rows.filter((r) => r.skill === "敌方群攻");
			expect(enemyRows).toHaveLength(3);
			enemyRows.forEach((row, i) => {
				expect(row.av).toBeCloseTo(((i + 1) * 10000) / 132, 8);
			});
			expect(result.rows.some((r) => r.detail === "E2额外回合")).toBe(true);
			expect(
				result.rows
					.filter((r) => r.skill === "Q")
					.some((r) => r.actor.includes("银狼")),
			).toBe(true);
			expect(simulateElationTeam(config).total).toBe(result.total);
			const output = process.env.HSR_ELATION_REPORT_DIR;
			if (output) {
				mkdirSync(output, { recursive: true });
				writeFileSync(
					join(output, "config.json"),
					JSON.stringify(config, null, 2),
				);
				writeFileSync(
					join(output, "result.json"),
					JSON.stringify(result, null, 2),
				);
				writeFileSync(
					join(output, "report.md"),
					[
						"# 银狼欢愉队300AV试验",
						"",
						"配置：单敌人95级、132速（75.75757576AV一次群攻）；银狼E2/欢迎来到银河城S1、爻光E1/菇菇嘎嘎S5、欢愉主E6/菇菇嘎嘎S5、强化藿藿E1/同一种心情S5。遗器来自用户文件。",
						"循环：藿藿EAA，欢愉主优先E，爻光维持结界后A，银狼按隐藏分开大；盲盒按当前SP与隐藏分动态采样，笑点曲线默认a=C/8。",
						"欢愉公式按用户提供截图，基础7535.107；常规增伤不作用于欢愉伤害。",
						"",
						`总伤害：${result.total.toFixed(2)}（仅暴击取期望；盲盒为指定随机种子样本）`,
						"",
						...Object.entries(result.byActor).map(
							([n, d]) => `- ${n}：${d.toFixed(2)}`,
						),
						"",
						...result.warnings,
						"",
						"|AV|角色|技能|结算|伤害|累计|笑点|隐藏分|SP|",
						"|---:|---|---|---|---:|---:|---:|---:|---:|",
						...result.rows.map(
							(r) =>
								`|${r.av.toFixed(4)}|${r.actor}|${r.skill}|${r.detail}|${r.expected.toFixed(2)}|${r.cumulative.toFixed(2)}|${r.jokes}|${r.hidden}|${r.sp}|`,
						),
					].join("\n"),
				);
			}
		},
	);
});
