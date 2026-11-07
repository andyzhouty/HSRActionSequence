import metadata from "../../data/freesrSpeedMetadata.json";

type Entry = Record<string, unknown>;
const isRecord = (value: unknown): value is Entry =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const characterPoints = metadata.characters as Record<
	string,
	Record<string, Record<string, number>>
>;
const cones = metadata.lightcones as Record<
	string,
	{ path: string; kind: string; values: Record<string, number> }
>;
const paths: Record<string, string> = {
	Warrior: "Destruction",
	Rogue: "Hunt",
	Mage: "Erudition",
	Shaman: "Harmony",
	Warlock: "Nihility",
	Knight: "Preservation",
	Priest: "Abundance",
	Memory: "Remembrance",
};

/** Missing metadata or ambiguous affixes deliberately leave speed for manual entry. */
export function calculateFreeSrSpeed(
	cid: string,
	base: number,
	path: string,
	avatar: Entry,
	cone: unknown,
	relics: Entry[],
): string {
	const points = characterPoints[cid];
	const skills = isRecord(avatar.data)
		? (avatar.data.skills ?? avatar.skills)
		: avatar.skills;
	if (
		!points ||
		(!isRecord(skills) && !Array.isArray(skills)) ||
		relics.length !== 6
	)
		return "";
	const skillMap: Record<string, unknown> = {};
	if (Array.isArray(skills)) {
		for (const skill of skills)
			if (isRecord(skill))
				skillMap[String(skill.point_id ?? skill.skill_id ?? skill.id)] =
					skill.level;
	} else Object.assign(skillMap, skills);
	let delta = 0;
	for (const [id, levels] of Object.entries(points)) {
		const raw = skillMap[id] ?? skillMap[String(Number(id) % 1000)] ?? 0;
		const level = isRecord(raw) ? raw.level : raw;
		if (Number(level) === 0) continue;
		const amount = levels[String(level)];
		if (amount === undefined) return "";
		delta += amount;
	}
	let baseDelta = 0,
		ratio = 0;
	if (isRecord(cone)) {
		const info = cones[String(cone.item_id)];
		if (!info) return "";
		if ((paths[info.path] ?? info.path) === path && info.kind !== "none") {
			const bonus = info.values[String(cone.rank ?? 1)];
			if (bonus === undefined) return "";
			if (info.kind === "基础速度") baseDelta += bonus;
			else ratio += bonus;
		}
	}
	const counts = new Map<number, number>();
	const slots = new Set<number>();
	for (const relic of relics) {
		const item = Number(relic.item_id ?? relic.relic_id ?? relic.id);
		const rarity = Math.floor(item / 10000) - 1;
		const slot = Number(relic.slot ?? relic.type ?? item % 10);
		if (
			!Number.isInteger(rarity) ||
			rarity < 2 ||
			rarity > 5 ||
			slot < 1 ||
			slot > 6 ||
			slots.has(slot)
		)
			return "";
		slots.add(slot);
		const set = Number(
			relic.set_id ??
				relic.relic_set_id ??
				relic.setId ??
				relic.relicSetId ??
				Math.floor(item / 10) % 1000,
		);
		counts.set(set, (counts.get(set) ?? 0) + 1);
		const main = Number(
			relic.main_affix_id ??
				(isRecord(relic.main_affix) ? relic.main_affix.affix_id : NaN),
		);
		if (!Number.isInteger(main) || main < 1) return "";
		if (slot === 4 && main === 4) {
			const level = Number(relic.level);
			if (!Number.isInteger(level) || level < 0 || level > 15) return "";
			delta +=
				[0, 0, 1.6128, 2.4192, 3.2256, 4.032][rarity] +
				[0, 0, 1, 1, 1.1, 1.4][rarity] * level;
		}
		const affixes = relic.sub_affixes ?? relic.sub_affix_list;
		if (!Array.isArray(affixes)) return "";
		for (const affix of affixes) {
			if (!isRecord(affix)) return "";
			if (Number(affix.sub_affix_id ?? affix.affix_id) !== 7) continue;
			const count = Number(affix.count),
				step = Number(affix.step);
			if (
				!Number.isInteger(count) ||
				count < 1 ||
				!Number.isInteger(step) ||
				step < 0 ||
				step > count * 2
			)
				return "";
			delta +=
				[0, 0, 1, 1.2, 1.6, 2][rarity] * count +
				[0, 0, 0.1, 0.1, 0.2, 0.3][rarity] * step;
		}
	}
	for (const id of [114, 121, 125, 130, 133, 316, 320, 329, 330])
		if ((counts.get(id) ?? 0) >= 2) ratio += 0.06;
	if ((counts.get(102) ?? 0) >= 4) ratio += 0.06;
	if ((counts.get(124) ?? 0) >= 4) ratio -= 0.08;
	return String(Number(((base + baseDelta) * (1 + ratio) + delta).toFixed(6)));
}
