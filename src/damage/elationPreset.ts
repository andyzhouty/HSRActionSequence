import {
	defaultElationTeamConfig,
	type ElationTeamConfig,
} from "./elationTypes";
import { readTrialEquipment } from "./equipment";
/** Explicit requested cone replacements; never edits the source export. */
export function createElationTeamPreset(
	value: unknown,
	sourceFile = "FreeSR 配装",
	third: "mc" | "sparxie" = "mc",
	starSlot: "none" | "yao" | "third" | "huo" = "none",
	pearlSlot: "none" | "yao" | "third" | "huo" = "none",
): ElationTeamConfig {
	const raw = structuredClone(value) as {
		lightcones?: Record<string, unknown>[];
		avatars?: Record<string, { data?: { rank: number }; enhanced_id?: number }>;
	};
	if (
		!Array.isArray(raw.lightcones) ||
		!raw.avatars ||
		Array.isArray(raw.avatars)
	)
		throw new Error("需要完整FreeSR配置");
	const ids = ["1506", "1502", third === "sparxie" ? "1501" : "8010", "1217"];
	if (starSlot !== "none")
		ids[starSlot === "yao" ? 1 : starSlot === "third" ? 2 : 3] = "1511";
	if (pearlSlot !== "none") {
		if (pearlSlot === starSlot) throw new Error("虚照与真珠的替换位置不能相同");
		ids[pearlSlot === "yao" ? 1 : pearlSlot === "third" ? 2 : 3] = "1503";
	}
	const pearlCone = raw.lightcones.find(
		(x) => String(x.equip_avatar) === "1503",
	);
	if (ids.includes("1503") && !pearlCone)
		throw new Error("配装文件缺少真珠光锥");
	const starCone = raw.lightcones.find(
		(x) => String(x.equip_avatar) === "1511",
	);
	if (ids.includes("1511") && !starCone)
		throw new Error("配装文件缺少虚照光锥");
	const coneIds = [23057, 21064, 21064, 21007],
		ranks = [2, 1, 6, 1];
	const fireCone = raw.lightcones.find(
		(x) => String(x.equip_avatar) === "1501",
	);
	if (ids.includes("1501") && !fireCone)
		throw new Error("配装文件缺少火花光锥");
	raw.lightcones = raw.lightcones.filter(
		(x) => !ids.includes(String(x.equip_avatar)),
	);
	ids.forEach((cid, i) => {
		const avatar = raw.avatars?.[cid];
		if (!avatar?.data) throw new Error(`缺少角色${cid}`);
		if (cid !== "1511" && cid !== "1501" && cid !== "1503")
			avatar.data.rank = ranks[i];
		if (cid === "1217") avatar.enhanced_id = 1;

		const preserved =
			cid === "1511"
				? starCone
				: cid === "1501"
					? fireCone
					: cid === "1503"
						? pearlCone
						: undefined;
		raw.lightcones?.push({
			equip_avatar: Number(cid),
			item_id: preserved?.item_id ?? coneIds[i],
			rank: preserved?.rank ?? (i === 0 ? 1 : 5),
			level: preserved?.level ?? 80,
			promotion: preserved?.promotion ?? 6,
		});
	});
	const profiles = readTrialEquipment(raw, ids);
	if (profiles.some((p) => p.level !== 80))
		throw new Error("本次欢愉公式仅核对80级");
	return {
		...defaultElationTeamConfig,
		enabled: true,
		sourceFile,
		profiles,
		ahaBaseSpeedRule: ids.includes("1511") ? "starInParty" : "fixed80",
	};
}
