import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElationTeamPreset } from "../../../src/damage/elationPreset";
import { simulateElationTeam } from "../../../src/damage/elationTeam";
import { analyzeSparxieRenewal } from "../../../src/mechanics/sparxieLottery";
import { toNormalizedSavedData } from "../../../src/pages/action-sequence/savedData";

const source = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(!source || !existsSync(source))(
	"imports the actual Sparxie build, exercises all stop policies and exports auditable draws",
	() => {
		if (!source) throw new Error("Missing file");
		const config = createElationTeamPreset(
			JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, "")),
			source,
			"sparxie",
		);
		expect(config.profiles.map((p) => p.character.name)).toContain("火花");
		expect(config.profiles[2].character.eidolon).toBe(2);
		expect(config.profiles[2].character.lc_id).toBe(23053);
		expect(config.profiles[2].character.superimpose).toBe(1);
		const runs = ([1, 2, 3] as const).map((sparxieJackpotTarget) => {
			const settings = { ...config, sparxieJackpotTarget };
			const result = simulateElationTeam(settings);
			const draws = result.rows.filter((r) => r.sparxieLottery);
			expect(draws.length).toBeGreaterThan(0);
			expect(
				result.rows.every(
					(r) => r.sp >= 0 && r.sp <= 8 && Number.isInteger(r.sparxiePity),
				),
			).toBe(true);
			expect(
				result.rows.some((r) => r.actor === "火花" && r.kind === "elation"),
			).toBe(true);
			expect(
				result.rows.some((r) => r.actor === "火花" && r.skill === "Q"),
			).toBe(true);
			const last = result.rows.at(-1);
			const events = result.rows.flatMap((r) => r.resourceEvents);
			for (const kind of ["hidden", "jokes"] as const)
				expect(
					events
						.filter((e) => e.kind === kind)
						.reduce((n, e) => n + e.amount, 0),
				).toBe(last?.[kind]);
			expect(simulateElationTeam(settings).total).toBe(result.total);
			return {
				target: sparxieJackpotTarget,
				settings,
				result,
				draws: draws.length,
				theory: analyzeSparxieRenewal(sparxieJackpotTarget),
			};
		});
		if (process.env.HSR_SPARXIE_REPORT === "1") {
			const dir = "build/sparxie-trial";
			mkdirSync(dir, { recursive: true });
			const summary = runs.map((run) => {
				const totals = Array.from(
					{ length: 100 },
					(_, i) =>
						simulateElationTeam({ ...run.settings, seed: 20281106 + i }).total,
				).sort((a, b) => a - b);
				writeFileSync(
					`${dir}/target-${run.target}-result.json`,
					JSON.stringify(run.result, null, 2),
				);
				writeFileSync(
					`${dir}/target-${run.target}-preset.json`,
					JSON.stringify(
						toNormalizedSavedData({
							characters: run.settings.profiles.map((p) => p.character),
							elationTeamTrial: run.settings,
						}),
						null,
						2,
					),
				);
				return {
					target: run.target,
					theory: run.theory,
					sampleTotal: run.result.total,
					draws: run.draws,
					mean: totals.reduce((a, b) => a + b, 0) / 100,
					p10: totals[10],
					p90: totals[90],
				};
			});
			writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 2));
		}
	},
	30000,
);
