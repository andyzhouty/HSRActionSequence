import { rankParameters, skillParameters, traceParameters } from "./metadata";

export function pearlDefenseElation(defense: number) {
	if (!Number.isFinite(defense) || defense < 0)
		throw new Error("真珠防御力无效");
	const t = traceParameters("1503", "101");
	return defense < t[0]
		? 0
		: t[1] + (Math.min(t[4], defense - t[0]) / t[2]) * t[3];
}
export function pearlExtraReward(
	eidolon: number,
	ultimateLevel: number,
	ascensionLevel: 0 | 1 | 2,
) {
	const q = skillParameters("1503", "03", ultimateLevel),
		scale = eidolon >= 2 ? 1 + rankParameters("1503", 2)[1] : 1;
	const p = ascensionLevel
		? skillParameters("1503", "29", ascensionLevel)
		: [50, 0, 0];
	return {
		jokes: q[6] * scale,
		applause: q[7] * scale,
		keepApplause: p[1],
		keepJokes: p[2],
	};
}
/** Input is total incoming damage after other mitigation, before Pearl's resistance pool. */
export function consumePearlResistance(
	points: number,
	incoming: number,
	unit = 200,
	ratio = 0.6,
) {
	if (
		![points, incoming, unit, ratio].every(Number.isFinite) ||
		points < 0 ||
		incoming < 0 ||
		unit <= 0 ||
		ratio < 0 ||
		ratio > 1
	)
		throw new Error("真珠抵御参数无效");
	const absorbed = Math.min(points * unit, incoming * ratio);
	return {
		points: Math.max(0, points - absorbed / unit),
		absorbed,
		remainingDamage: incoming - absorbed,
	};
}
