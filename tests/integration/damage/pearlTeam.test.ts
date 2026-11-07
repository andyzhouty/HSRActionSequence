import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElationTeamPreset } from "../../../src/damage/elationPreset";
import { simulateElationTeam } from "../../../src/damage/elationTeam";
import { toNormalizedSavedData } from "../../../src/pages/action-sequence/savedData";

const file = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(!file || !existsSync(file))(
	"imports Pearl equipment and verifies three/four-Elation teams and signature",
	() => {
		if (!file) throw new Error("Missing file");
		const source = JSON.parse(
			readFileSync(file, "utf8").replace(/^\uFEFF/, ""),
		);
		const cases = [
			{
				name: "wolf-yao-pearl-huo",
				star: "none",
				pearl: "third",
				third: "mc",
				signature: false,
			},
			{
				name: "wolf-yao-pearl-star",
				star: "huo",
				pearl: "third",
				third: "mc",
				signature: false,
			},
			{
				name: "wolf-pearl-fire-star",
				star: "huo",
				pearl: "yao",
				third: "sparxie",
				signature: true,
			},
		] as const;
		const summary = [];
		for (const c of cases) {
			const raw = structuredClone(source);
			if (c.signature) {
				const cone = raw.lightcones.find(
					(x: { equip_avatar: number }) => x.equip_avatar === 1503,
				);
				cone.item_id = 23055;
				cone.rank = 1;
			}
			const config = createElationTeamPreset(
				raw,
				file,
				c.third,
				c.star,
				c.pearl,
			);
			const pearl = config.profiles.find((p) => p.character.name === "真珠");
			expect(pearl?.character.eidolon).toBe(2);
			expect(pearl?.gear.sets).toEqual({ "133": 4, "308": 2 });
			expect(pearl?.defense).toBeGreaterThan(0);
			const result = simulateElationTeam(config);
			expect(result.rows.some((r) => r.borrowedFrom)).toBe(true);
			expect(result.rows.some((r) => r.healingPerTarget !== undefined)).toBe(
				true,
			);
			expect(
				result.rows.some((r) =>
					r.resourceEvents.some((e) => e.kind === "pearlApplause"),
				),
			).toBe(true);
			expect(result.rows.some((r) => r.pearlExtraTurn)).toBe(c.star !== "none");
			expect(
				result.rows.every((r) => !r.pearlExtraTurn || r.skill !== "Q"),
			).toBe(true);
			if (c.signature)
				expect(
					result.rows.some((r) =>
						r.energyEvents.some(
							(e) =>
								e.source === "真珠专锥·欢愉技固定回能" &&
								e.amount === 10 &&
								e.fixed,
						),
					),
				).toBe(true);
			expect(result.total).toBe(simulateElationTeam(config).total);
			summary.push({
				name: c.name,
				total: result.total,
				byActor: result.byActor,
				defense: pearl?.defense,
				pearlQ: result.rows.filter((r) => r.actor === "真珠" && r.skill === "Q")
					.length,
				extraTurns: result.rows.filter(
					(r) => r.detail === "真珠额外回合结算完成",
				).length,
			});
			if (process.env.HSR_PEARL_REPORT === "1") {
				const dir = "build/pearl-trial";
				mkdirSync(dir, { recursive: true });
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
				writeFileSync(
					`${dir}/${c.name}-result.json`,
					JSON.stringify(result, null, 2),
				);
			}
		}
		if (process.env.HSR_PEARL_REPORT === "1")
			writeFileSync(
				"build/pearl-trial/summary.json",
				JSON.stringify(summary, null, 2),
			);
	},
	30000,
);
