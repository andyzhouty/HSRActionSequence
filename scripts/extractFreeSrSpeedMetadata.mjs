import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: node scripts/extractFreeSrSpeedMetadata.mjs <version/zh>");
const characters = {}, lightcones = {};
for (const file of await readdir(join(directory, "character"))) {
	if (!file.endsWith(".json")) continue;
	const raw = JSON.parse(await readFile(join(directory, "character", file), "utf8"));
	const points = {};
	for (const levels of Object.values(raw.skill_trees)) {
		const values = Object.fromEntries(Object.entries(levels).map(([level, point]) => [level, point.status_add_list.filter((item) => item.property_type === "SpeedDelta").reduce((sum, item) => sum + item.value, 0)]));
		if (Object.values(values).some(Boolean)) points[levels["1"].point_id] = values;
	}
	characters[file.slice(0, -5)] = points;
}
for (const file of await readdir(join(directory, "lightcone"))) {
	if (!file.endsWith(".json")) continue;
	const raw = JSON.parse(await readFile(join(directory, "lightcone", file), "utf8"));
	const description = raw.refinements.desc.replace(/<[^>]*>/g, "").replace(/\\n/g, "");
	const match = /^(?:使)?装备者的?(基础速度|速度)提高#(\d+)\[(?:i|f\d+)\](点|%)?(?:[，、。；]|$)/.exec(description);
	if (match) lightcones[file.slice(0, -5)] = { path: raw.base_type, kind: match[1], values: Object.fromEntries(Object.entries(raw.refinements.level).map(([rank, data]) => [rank, data.param_list[Number(match[2]) - 1]])) };
	else if (!description.includes("速度")) lightcones[file.slice(0, -5)] = { path: raw.base_type, kind: "none", values: {} };
}
await writeFile("src/data/freesrSpeedMetadata.json", `${JSON.stringify({ characters, lightcones }, null, 2)}\n`);
