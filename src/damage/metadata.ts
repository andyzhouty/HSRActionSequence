import raw from "../data/damageMetadata.json";

type CharacterMetadata = {
	skills: Record<
		string,
		{ name: string; description: string; levels: Record<string, number[]> }
	>;
	traces: Record<string, { parameters: number[] }>;
};
const characters = raw.characters as unknown as Record<
	string,
	CharacterMetadata
>;
export const damageMetadataVersion = raw.version;

export function skillParameters(
	cid: string,
	suffix: string,
	level: number,
): number[] {
	const parameters =
		characters[cid === "11306" ? "1306" : cid === "11217" ? "1217" : cid]
			?.skills[`${cid}${suffix}`]?.levels[String(level)];
	if (!parameters)
		throw new Error(`缺少技能 ${cid}${suffix} 等级 ${level} 的倍率`);
	return parameters;
}

export function lightconeParameters(id: number, rank: number): number[] {
	const cone = (
		raw.lightcones as unknown as Record<
			string,
			{ refinements: { level: Record<string, { param_list: number[] }> } }
		>
	)[String(id)];
	const parameters = cone?.refinements.level[String(rank)]?.param_list;
	if (!parameters) throw new Error(`缺少光锥 ${id} 叠影 ${rank} 的参数`);
	return parameters;
}

export function rankParameters(cid: string, rank: number): number[] {
	return (
		(
			raw.characters as unknown as Record<
				string,
				{ ranks: Record<string, { param_list: number[] }> }
			>
		)[cid]?.ranks[String(rank)]?.param_list ?? []
	);
}

export function traceParameters(cid: string, suffix: string): number[] {
	const parameters =
		characters[cid === "11306" ? "1306" : cid === "11217" ? "1217" : cid]
			?.traces[`${cid}${suffix}`]?.parameters;
	if (!parameters) throw new Error(`缺少行迹 ${cid}${suffix} 的参数`);
	return parameters;
}
