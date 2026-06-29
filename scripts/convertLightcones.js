import { readFileSync, writeFileSync } from "fs";

const raw = readFileSync("lightcones.jsonc", "utf-8");
const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));

const pathMap = {
	1: "Destruction",
	2: "Hunt",
	3: "Erudition",
	4: "Harmony",
	5: "Nihility",
	6: "Preservation",
	7: "Abundance",
	8: "Remembrance",
	9: "Elation",
};

const lightcones = json.lightcones.map((lc) => ({
	id: lc.id,
	name: lc.name,
	rarity: lc.rarity,
	path: pathMap[lc.path_id] ?? "Unknown",
}));

writeFileSync(
	"src/data/lightcones.json",
	JSON.stringify({ lightcones }, null, "\t"),
	"utf-8",
);

console.log(`Converted ${lightcones.length} light cones to lightcones.json`);
