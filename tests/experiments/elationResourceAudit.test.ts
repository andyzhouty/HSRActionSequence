import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

const source =
	"build/elation-resource-audit/pre-audit/elation-60m-example/preset.json";
it.skipIf(
	process.env.HSR_ELATION_RESOURCE_AUDIT !== "1" || !existsSync(source),
)(
	"recomputes the exact previously published preset without refitting its policy or seed",
	() => {
		const saved = toNormalizedSavedData(
			JSON.parse(readFileSync(source, "utf8")),
		);
		const config = saved.elationTeamTrial;
		if (!config) throw new Error("Missing archived config");
		const correctedConfig = {
			...config,
			resourceAccountingRule: "qCost60" as const,
		};
		const corrected = simulateElationTeam(correctedConfig);
		const old = JSON.parse(
			readFileSync(
				"build/elation-resource-audit/pre-audit/elation-60m-example/result.json",
				"utf8",
			),
		);
		const q = corrected.rows.find(
			(r) => r.actor === "银狼LV.999" && r.skill === "Q",
		);
		expect(
			q?.resourceEvents.find((e) => e.source === "银狼Q消耗60隐藏分")?.before,
		).toBe(158);
		expect(q?.hidden).toBe(138);
		expect(q?.cycleScore).toBe(138);
		const ledger = corrected.rows.flatMap((r) => r.resourceEvents);
		for (const kind of ["jokes", "hidden"] as const)
			expect(
				ledger.filter((e) => e.kind === kind).reduce((n, e) => n + e.amount, 0),
			).toBe(corrected.rows.at(-1)?.[kind]);
		const sample = () => {
			const totals = Array.from(
				{ length: 100 },
				(_, i) =>
					simulateElationTeam({
						...config,
						seed: 20261106 + i,
						resourceAccountingRule: "qCost60",
					}).total,
			);
			return {
				mean: totals.reduce((n, x) => n + x, 0) / totals.length,
				min: Math.min(...totals),
				max: Math.max(...totals),
			};
		};
		const comparison = {
			seed: config.seed,
			legacyTotal: old.total,
			correctedTotal: corrected.total,
			delta: corrected.total - old.total,

			corrected100: sample(),
			resourceRule: "qCost60",
			boxProbabilityModel: correctedConfig.boxProbabilityModel,
			boxBeanCurveK: correctedConfig.boxBeanCurveK,
			hiddenScoreCap: correctedConfig.hiddenScoreCap,
		};
		const dir = "build/elation-resource-audit";
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			`${dir}/comparison.json`,
			JSON.stringify(comparison, null, 2),
		);
		writeFileSync(
			`${dir}/corrected-original-preset.json`,
			JSON.stringify({ ...saved, elationTeamTrial: correctedConfig }, null, 2),
		);
		writeFileSync(
			`${dir}/corrected-original-result.json`,
			JSON.stringify(corrected, null, 2),
		);
		writeFileSync(
			`${dir}/resource-ledger.json`,
			JSON.stringify(ledger, null, 2),
		);
	},
	30000,
);
