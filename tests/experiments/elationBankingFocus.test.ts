import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

it.skipIf(process.env.HSR_BANKING_FOCUS !== "1")(
	"compares higher entry scores with the same support policy and seeds",
	() => {
		const config = toNormalizedSavedData(
			JSON.parse(
				readFileSync("build/elation-score-strategy/best-preset.json", "utf8"),
			),
		).elationTeamTrial;
		if (!config) throw new Error("Missing config");
		const report = [60, 90, 120, 140, 150, 160, 180, 200, 220, 240, 260].map(
			(threshold) => {
				let damage = 0,
					second = 0,
					extras = 0,
					basics = 0,
					ults = 0,
					closed = 0,
					fullClosed = 0;
				for (let i = 0; i < 100; i++) {
					const r = simulateElationTeam({
						...config,
						wolfUltMinScore: threshold,
						seed: 20281106 + i,
					});
					damage += r.total;
					for (const c of r.cycles) {
						ults++;
						second += Number(c.usedExtras >= 2);
						extras += c.usedExtras;
						basics += c.basics;
						if (c.end !== undefined) {
							closed++;
							fullClosed += Number(c.usedExtras >= 2);
						}
					}
				}
				return {
					threshold,
					mean: damage / 100,
					secondExtras: second / 100,
					allExtras: extras / 100,
					basics: basics / 100,
					ults: ults / 100,
					closedSecondRate: closed ? fullClosed / closed : 0,
				};
			},
		);
		expect(report.every((r) => Number.isFinite(r.mean))).toBe(true);
		writeFileSync(
			"build/elation-resource-audit/banking-focus.json",
			JSON.stringify(
				{
					rule: config.resourceAccountingRule,
					seeds: "20281106–20281205",
					supportPolicy: "same as current best; only entry threshold changes",
					report,
				},
				null,
				2,
			),
		);
	},
	30000,
);
