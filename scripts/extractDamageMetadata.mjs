import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

// Run with the versioned zh directory from HSRVersionInspector as the argument.
const directory = process.argv[2];
if (!directory) throw new Error("Usage: node scripts/extractDamageMetadata.mjs <version/zh>");
const characters = {};
for (const cid of [1408, 1101, 1306, 1309, 1412, 1506, 1501, 1502, 1503, 1511, 8009, 8010, 1217]) {
	const raw = JSON.parse(await readFile(join(directory, "character", `${cid}.json`), "utf8"));
	const skills = { ...raw.skills, ...Object.assign({}, ...Object.values(raw.enhanced ?? {}).map((entry) => entry.skills ?? {})) };
	characters[cid] = {
		name: raw.name,
		path: raw.base_type,
		ultimateCost: raw.sp_need,
		stats: raw.stats,
		ranks: raw.ranks,
		skills: Object.fromEntries(Object.entries(skills).map(([id, skill]) => [id, {
			name: skill.name, description: skill.desc, energyGain: skill.sp_base ?? 0,
			levels: Object.fromEntries(Object.entries(skill.level).map(([level, data]) => [level, data.param_list])),
		}])),
		traces: Object.fromEntries([...Object.values(raw.skill_trees), ...Object.values(raw.enhanced ?? {}).flatMap((entry) => Object.values(entry.skill_trees ?? {}))].map((levels) => {
			const point = levels["1"];
			return [point.point_id, { description: point.point_desc, parameters: point.param_list, bonuses: point.status_add_list }];
		})),
	};
}
const lightcones = {};
for (const id of [23044, 23003, 21018, 23019, 23026, 23057, 21064, 21007, 23054, 23053, 23065, 23055]) lightcones[id] = JSON.parse(await readFile(join(directory, "lightcone", `${id}.json`), "utf8"));
const enemies = {};
const enemy = JSON.parse(await readFile(join(directory, "monster", "8015030.json"), "utf8"));
for (const variant of enemy.child) enemies[variant.id] = { name: enemy.name, physicalResistance: variant.damage_type_resistance.find((item) => item.damage_type === "Physical")?.value ?? 0 };
await writeFile("src/data/damageMetadata.json", `${JSON.stringify({ source: "HSRVersionInspector", version: basename(dirname(directory)), characters, lightcones, enemies }, null, 2)}\n`);
