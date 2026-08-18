/** 角色数据表中的稳定角色标识。 */
export type CharacterId = string & {
	readonly __characterId: unique symbol;
};

export function toCharacterId(value: unknown): CharacterId {
	if (typeof value !== "string" || !/^\d+$/.test(value)) {
		throw new TypeError(`无效的角色 CID：${String(value)}`);
	}
	return value as CharacterId;
}

export function isCharacterId(value: unknown): value is CharacterId {
	return typeof value === "string" && /^\d+$/.test(value);
}

/** 代码中需要按身份判断机制的角色 CID，统一从此处引用。 */
export const CHARACTER_IDS = {
	archer: "1015",
	aglaea: "1402",
	castorice: "1407",
	tribbie: "1403",
	mydei: "1404",
	phainon: "1408",
	cyrene: "1415",
	danHengPermansor: "1414",
	saber: "1014",
	kafka: "1005",
	ruanMei: "1303",
	robin: "1309",
	huohuo: "1217",
	silverWolf: "1506",
	spBlade: "1507",
	gilgamesh: "1509",
	spRobin: "1512",
	spAventurine: "1513",
	ashveil: "1504",
	evanescia: "1505",
	hyacine: "1410",
	theHerta: "1401",
	memoryTrailblazer: "8008",
} as const satisfies Record<string, string>;

export type KnownCharacterId =
	(typeof CHARACTER_IDS)[keyof typeof CHARACTER_IDS] extends infer T
		? T extends string
			? CharacterId & T
			: never
		: never;

export function knownCharacterId(
	name: keyof typeof CHARACTER_IDS,
): KnownCharacterId {
	return CHARACTER_IDS[name] as KnownCharacterId;
}
