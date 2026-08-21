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

export const TRAILBLAZER_GENDER_PAIRS = [
	{ female: "8002", male: "8001" },
	{ female: "8004", male: "8003" },
	{ female: "8006", male: "8005" },
	{ female: "8008", male: "8007" },
	{ female: "8010", male: "8009" },
] as const;

export const TRAILBLAZER_CIDS = TRAILBLAZER_GENDER_PAIRS.flatMap((pair) => [
	pair.female,
	pair.male,
]);

export type TrailblazerGender = "female" | "male";

function findTrailblazerPair(cid: string) {
	return TRAILBLAZER_GENDER_PAIRS.find(
		(pair) => pair.female === cid || pair.male === cid,
	);
}

export function getTrailblazerGender(
	cid: string | undefined,
): TrailblazerGender | undefined {
	const pair = cid ? findTrailblazerPair(cid) : undefined;
	if (!pair) return undefined;
	return pair.male === cid ? "male" : "female";
}

export function getTrailblazerCid(
	cid: string,
	gender: TrailblazerGender,
): string | undefined {
	const pair = findTrailblazerPair(cid);
	return pair?.[gender];
}

export function areEquivalentCharacterCids(
	first: string | undefined,
	second: string | undefined,
): boolean {
	if (!first || !second) return false;
	if (first === second) return true;
	const pair = findTrailblazerPair(first);
	return pair?.female === second || pair?.male === second;
}

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
