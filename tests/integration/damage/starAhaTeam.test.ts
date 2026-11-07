import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElationTeamPreset } from "../../../src/damage/elationPreset";
import { simulateElationTeam } from "../../../src/damage/elationTeam";
import { toNormalizedSavedData } from "../../../src/pages/action-sequence/savedData";

const source = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(!source || !existsSync(source))(
	"runs actual Star Aha equipment in Yao, MC and Sparxie teams",
	() => {
		if (!source) throw new Error("Missing file");
		const raw = JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
		const cases = [
			{ name: "wolf-yao-star-huo", third: "mc", slot: "third", rank: 0 },
			{ name: "wolf-star-mc-huo", third: "mc", slot: "yao", rank: 2 },
			{ name: "wolf-yao-fire-star", third: "sparxie", slot: "huo", rank: 2 },
		] as const;
		const summary = [];
		for (const c of cases) {
			const data = structuredClone(raw);
			data.avatars[1511].data.rank = c.rank;
			const config = createElationTeamPreset(data, source, c.third, c.slot);
			const star = config.profiles.find((p) => p.character.lc_id === 23065);
			expect(star?.baseSpeed).toBe(106);
			expect(star?.gear.sets["329"]).toBe(2);
			expect(star?.gear.sets["133"]).toBe(4);
			const result = simulateElationTeam(config);
			expect(result.ahaBaseSpeed).toBe(106);
			expect(result.rows.some((r) => r.starTrueBase !== undefined)).toBe(true);
			expect(
				result.rows.every(
					(r) =>
						r.starWill !== undefined &&
						r.starWill >= 0 &&
						r.starWill <= 10 &&
						!Object.keys(r.energy).some((name) => name.includes("阿哈")),
				),
			).toBe(true);
			expect(
				result.rows.some(
					(r) =>
						r.starUniverseTurns && r.hiddenCap === (c.rank === 0 ? 360 : 999),
				),
			).toBe(true);
			expect(
				result.rows.some((r) =>
					r.resourceEvents.some((e) => e.source === "虚照升格·爽点回收"),
				),
			).toBe(true);
			if (c.third === "sparxie")
				expect(
					result.rows.some(
						(r) =>
							r.sparxieLottery?.jackpot &&
							r.starUniverseTurns &&
							r.resourceEvents.some(
								(e) => e.kind === "jokes" && e.requested > 2,
							),
					),
				).toBe(true);
			if (c.slot === "yao")
				expect(result.rows.some((r) => r.detail.includes("主角升格ES"))).toBe(
					true,
				);
			expect(result.total).toBe(simulateElationTeam(config).total);
			if (process.env.HSR_STAR_AHA_REPORT === "1") {
				const dir = "build/star-aha-trial";
				mkdirSync(dir, { recursive: true });
				writeFileSync(
					`${dir}/${c.name}-result.json`,
					JSON.stringify(result, null, 2),
				);
				writeFileSync(
					`${dir}/${c.name}-preset.json`,
					JSON.stringify(
						toNormalizedSavedData({
							characters: config.profiles.map((p) => p.character),
							elationTeamTrial: config,
						}),
						null,
						2,
					),
				);
			}
			summary.push({
				name: c.name,
				starRank: c.rank,
				total: result.total,
				byActor: result.byActor,
				starQ: result.rows
					.flatMap((r) => r.resourceEvents)
					.filter((e) => e.source === "虚照Q消耗8愿力").length,
				maxHidden: Math.max(...result.rows.map((r) => r.hidden)),
			});
		}
		if (process.env.HSR_STAR_AHA_REPORT === "1")
			writeFileSync(
				"build/star-aha-trial/summary.json",
				JSON.stringify(summary, null, 2),
			);
	},
	30000,
);
