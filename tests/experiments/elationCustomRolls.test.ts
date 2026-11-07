import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import { readTrialEquipment } from "../../src/damage/equipment";
import metadata from "../../src/data/damageMetadata.json";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

const file = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(process.env.HSR_CUSTOM_ROLLS !== "1" || !file || !existsSync(file))(
	"compares requested replacement substats and S1 Yao cone with unchanged action policy",
	() => {
		if (!file) throw new Error("Missing file");
		const saved = toNormalizedSavedData(
			JSON.parse(
				readFileSync("build/elation-score-strategy/best-preset.json", "utf8"),
			),
		);
		const baseline = saved.elationTeamTrial;
		if (!baseline) throw new Error("Missing baseline");
		const raw = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
		const ids = [1506, 1502, 8010, 1217];
		raw.lightcones = raw.lightcones.filter(
			(x: { equip_avatar: number }) => !ids.includes(Number(x.equip_avatar)),
		);
		for (const [i, id] of ids.entries()) {
			raw.avatars[id].data.rank = [2, 1, 6, 1][i];
			if (id === 1217) raw.avatars[id].enhanced_id = 1;
			raw.lightcones.push({
				equip_avatar: id,
				item_id: [23057, 23054, 21064, 21007][i],
				rank: i < 2 ? 1 : 5,
				level: 80,
				promotion: 6,
			});
		}
		for (const relic of raw.relics)
			if (ids.includes(Number(relic.equip_avatar))) {
				relic.sub_affixes = [];
				if (
					Number(relic.equip_avatar) === 1506 &&
					Number(relic.relic_id) % 10 === 3
				)
					relic.main_affix_id = 5;
				if (
					Number(relic.equip_avatar) === 8010 &&
					Number(relic.relic_id) % 10 <= 4
				) {
					const slot = Number(relic.relic_id) % 10;
					relic.relic_id = 61330 + slot;
					relic.relic_set_id = 133;
				}
			}
		const profiles = readTrialEquipment(raw, ids.map(String));
		for (const [i, p] of profiles.entries()) {
			p.speed += [20 * 2.6, 22 * 2.3, 20 * 2.3, 20 * 2.3][i];
			p.critRate += [20 * 0.032, 5 * 0.029, 10 * 0.029, 0][i];
			p.critDamage += [10 * 0.064, 5 * 0.058, 0, 0][i];
			p.character.speed = String(p.speed);
			p.character.hasVonwacq = (p.gear.sets["308"] ?? 0) >= 2 && p.speed >= 120;
		}
		const hpChar = metadata.characters["1217"].stats["6"];
		const hpCone = metadata.lightcones["21007"].stats.find(
			(x) => x.promotion === 6,
		);
		if (!hpCone) throw new Error("Missing cone base");
		profiles[3].hp +=
			(hpChar.hp_base +
				hpChar.hp_add * 79 +
				hpCone.base_hp +
				hpCone.base_hp_add * 79) *
			7 *
			0.039;
		const config = {
			...baseline,
			profiles,
			sourceFile: "用户自定义副词条；藿藿7×3.9%生命；爻光当她决定看见S1",
		};
		const result = simulateElationTeam(config);
		const sample = (cfg: typeof config) => {
			const totals = Array.from(
				{ length: 100 },
				(_, i) => simulateElationTeam({ ...cfg, seed: 20281106 + i }).total,
			).sort((a, b) => a - b);
			return {
				mean: totals.reduce((a, b) => a + b, 0) / 100,
				min: totals[0],
				max: totals[99],
				p10: totals[10],
				p90: totals[90],
			};
		};
		const comparison = {
			baseline: sample(baseline),
			requested: sample(config),
			profiles: profiles.map((p) => ({
				name: p.character.name,
				speed: p.speed,
				critRate: p.critRate,
				critDamage: p.critDamage,
				hp: p.hp,
				elation: p.elation,
				energyRegen: p.gear.energyRegen,
				sets: p.gear.sets,
			})),
			sampleTotal: result.total,
			byActor: result.byActor,
			policy: {
				wolfUltMinScore: config.wolfUltMinScore,
				huoSkillEvery: config.huoSkillEvery,
				mcSkillEvery: config.mcSkillEvery,
				wolfSupportTiming: config.wolfSupportTiming,
			},
			assumptions:
				"Listed substats replace all previous substats; Silver Wolf crit damage body; other main stats and inner sets unchanged; Huo HP rolls use 3.9%; no policy optimization",
		};
		expect(profiles[0].critRate).toBeCloseTo(0.877);
		expect(profiles[0].critDamage).toBeCloseTo(1.948);
		expect(profiles[1].character.superimpose).toBe(1);
		expect(profiles[2].gear.sets["133"]).toBe(4);
		expect(
			result.rows.some((r) =>
				r.energyEvents.some(
					(e) =>
						e.source === "当她决定看见·每波固定回能" &&
						e.amount === 15 &&
						e.fixed,
				),
			),
		).toBe(true);
		expect(
			result.rows.some((r) => r.buffs.some((b) => b.includes("伶人"))),
		).toBe(true);
		const dir = "build/elation-custom-rolls";
		mkdirSync(dir, { recursive: true });
		for (const [name, value] of Object.entries({
			comparison,
			result,
			preset: { ...saved, elationTeamTrial: config },
		}))
			writeFileSync(`${dir}/${name}.json`, JSON.stringify(value, null, 2));
	},
	30000,
);
