import { getCharacterCatalog } from "../../data/characters";
import { TRAILBLAZER_GENDER_PAIRS } from "../../domain/identity/characterId";
import { createTarget, type SavedData } from "../../utils/action-sequence";
import { calculateFreeSrSpeed } from "./freeSrSpeed";

const record = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export function isFreeSrData(value: unknown): boolean {
	return record(value) && "avatars" in value;
}

export function importFreeSrData(value: unknown): Partial<SavedData> {
	if (
		!record(value) ||
		(!Array.isArray(value.avatars) && !record(value.avatars)) ||
		!Array.isArray(value.lightcones) ||
		!Array.isArray(value.relics)
	) {
		throw new Error("FreeSR 数据需要包含 avatars、lightcones 和 relics");
	}
	const catalog = getCharacterCatalog();
	const entries = Array.isArray(value.avatars)
		? value.avatars.map((avatar) => ["", avatar] as const)
		: Object.entries(value.avatars);
	const seen = new Set<string>();
	const characters = entries.map(([key, raw], index) => {
		if (!record(raw)) throw new Error(`角色 ${index + 1} 数据无效`);
		const cid = String(raw.avatar_id ?? key);
		const equivalent = TRAILBLAZER_GENDER_PAIRS.find(
			(pair) => pair.male === cid || pair.female === cid,
		);
		const character = catalog.find(
			(entry) =>
				entry.cid === cid ||
				(equivalent &&
					(entry.cid === equivalent.male || entry.cid === equivalent.female)),
		);
		if (!character) throw new Error(`暂不支持角色 CID ${cid}`);
		if (seen.has(character.cid)) throw new Error(`角色 CID ${cid} 重复`);
		seen.add(character.cid);
		const data = record(raw.data) ? raw.data : raw;
		const eidolon = Number(data.rank ?? raw.rank ?? 0);
		if (!Number.isInteger(eidolon) || eidolon < 0 || eidolon > 6)
			throw new Error(`角色 ${character.names[0]} 的星魂无效`);
		const cones = (value.lightcones as unknown[]).filter(
			(item) => record(item) && Number(item.equip_avatar) === Number(cid),
		);
		if (cones.length > 1)
			throw new Error(`角色 ${character.names[0]} 装备了多个光锥`);
		const cone = cones[0];
		const lcId = record(cone) ? Number(cone.item_id) : 0;
		const rank = record(cone) ? Number(cone.rank ?? 1) : 1;
		if (
			!Number.isSafeInteger(lcId) ||
			lcId < 0 ||
			!Number.isInteger(rank) ||
			rank < 1 ||
			rank > 5
		)
			throw new Error(`角色 ${character.names[0]} 的光锥数据无效`);
		const counts = new Map<number, number>();
		const equippedRelics: Record<string, unknown>[] = [];
		for (const relic of value.relics as unknown[]) {
			if (
				!record(relic) ||
				Number(relic.equip_avatar ?? relic.equipAvatar) !== Number(cid)
			)
				continue;
			equippedRelics.push(relic);
			const itemId = Number(relic.item_id ?? relic.relic_id ?? relic.id ?? 0);
			const setId = Number(
				relic.set_id ??
					relic.relic_set_id ??
					relic.setId ??
					relic.relicSetId ??
					Math.floor(itemId / 10) % 1000,
			);
			counts.set(setId, (counts.get(setId) ?? 0) + 1);
		}
		const speed = calculateFreeSrSpeed(
			cid,
			character.baseSpeed,
			character.path ?? "",
			raw,
			cone,
			equippedRelics,
		);
		return {
			...createTarget(`freesr-${cid}`, index),
			name: character.names[0],
			speed,
			eidolon,
			lc_id: lcId,
			superimpose: rank,
			hasVonwacq: (counts.get(308) ?? 0) >= 2,
			hasWindSet: (counts.get(110) ?? 0) >= 4,
			hasMessengerSet: (counts.get(114) ?? 0) >= 4,
		};
	});
	if (characters.length === 0) throw new Error("FreeSR 数据中没有角色");
	return { characters };
}
