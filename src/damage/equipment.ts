import { getCharacterNameByCid } from "../data/characters";
import rawMetadata from "../data/damageMetadata.json";
import affixMetadata from "../data/damageRelicAffixes.json";
import { type CharacterConfig, createTarget } from "../utils/action-sequence";
import type { PhainonTrialConfig } from "./types";

type Entry = Record<string, unknown>;
type Rule = { property: string; base: number; step: number };
const mainAffixes = affixMetadata.main as Record<string, Record<string, Rule>>;
const subAffixes = affixMetadata.sub as Record<string, Record<string, Rule>>;
type Metadata = {
	path: string;
	stats: Record<
		string,
		{
			hp_base: number;
			hp_add: number;
			attack_base: number;
			attack_add: number;
			defence_base: number;
			defence_add: number;
			speed_base: number;
			critical_chance: number;
			critical_damage: number;
		}
	>;
	traces: Record<
		string,
		{ bonuses: { property_type: string; value: number }[] }
	>;
};
type ConeMetadata = {
	base_type: string;
	stats: {
		promotion: number;
		base_attack: number;
		base_attack_add: number;
		base_hp: number;
		base_hp_add: number;
		base_defence: number;
		base_defence_add: number;
	}[];
	refinements: {
		desc: string;
		level: Record<string, { param_list: number[] }>;
	};
};
const characters = rawMetadata.characters as unknown as Record<
	string,
	Metadata
>;
const cones = rawMetadata.lightcones as unknown as Record<string, ConeMetadata>;
const record = (value: unknown): value is Entry =>
	!!value && typeof value === "object" && !Array.isArray(value);
const numeric = (value: unknown, name: string) => {
	const result = Number(value);
	if (value === undefined || value === null || !Number.isFinite(result))
		throw new Error(`${name}缺失或无效`);
	return result;
};

export type EquipmentProfile = {
	character: CharacterConfig;
	level: number;
	baseSpeed?: number;
	baseDefense?: number;
	defense?: number;
	healingBonus?: number;
	hp: number;
	elation: number;
	effectRes: number;
	damageBonuses: Record<string, number>;
	baseAttack: number;
	attack: number;
	speed: number;
	critRate: number;
	critDamage: number;
	physicalBonus: number;
	windBonus: number;
	gear: PhainonTrialConfig["gear"][string];
};

/** Exact affix coefficients; no rounding until display. Only the first trial's four characters/cones. */
export function readTrialEquipment(
	value: unknown,
	cids = ["1408", "1101", "1306", "1309"],
): EquipmentProfile[] {
	if (
		!record(value) ||
		!Array.isArray(value.relics) ||
		!Array.isArray(value.lightcones)
	)
		throw new Error("需要完整的 FreeSR 配装文件");
	const lightcones = value.lightcones;
	const allRelics = value.relics;
	const avatars = Array.isArray(value.avatars)
		? value.avatars
		: record(value.avatars)
			? Object.entries(value.avatars).map(([id, avatar]) =>
					record(avatar)
						? { ...avatar, avatar_id: avatar.avatar_id ?? id }
						: avatar,
				)
			: [];
	return cids.map((cid, index) => {
		const avatar = avatars.find(
			(item) => record(item) && String(item.avatar_id) === cid,
		);
		if (!record(avatar)) throw new Error(`缺少角色 ${cid}`);
		const data = record(avatar.data) ? avatar.data : avatar;
		const enhanced = Number(avatar.enhanced_id ?? data.enhanced_id ?? 0) > 0;
		const skills = data.skills;
		if (!record(skills)) throw new Error(`角色 ${cid} 缺少行迹数据`);
		const level = numeric(data.level ?? avatar.level, "角色等级");
		const promotion = String(
			numeric(data.promotion ?? avatar.promotion, "角色升阶"),
		);
		const metadata = characters[cid];
		const base = metadata.stats[promotion];
		if (!base) throw new Error(`缺少角色 ${cid} 的升阶数据`);
		const cone = lightcones.filter(
			(item) => record(item) && String(item.equip_avatar) === cid,
		);
		if (cone.length !== 1 || !record(cone[0]))
			throw new Error(`角色 ${cid} 的光锥缺失或重复`);
		const equippedCone = cone[0];
		const lcId = numeric(equippedCone.item_id, "光锥编号");
		const coneInfo = cones[String(lcId)];
		if (!coneInfo) throw new Error(`尚未实现光锥 ${lcId}，不能自动还原该配装`);
		const coneBase = coneInfo.stats.find(
			(stat) =>
				Number(stat.promotion) === numeric(equippedCone.promotion, "光锥升阶"),
		);
		if (!coneBase) throw new Error("光锥升阶数据缺失");
		const totals: Record<string, number> = {};
		const add = (property: string, amount: number) => {
			totals[property] = (totals[property] ?? 0) + amount;
		};
		for (const [pointId, point] of Object.entries(metadata.traces)) {
			if (
				(cid === "1306" || cid === "1217") &&
				!pointId.startsWith(enhanced ? `1${cid}` : cid)
			)
				continue;
			const raw = skills[pointId];
			if (Number(record(raw) ? raw.level : raw) > 0)
				for (const bonus of point.bonuses)
					add(bonus.property_type, bonus.value);
		}
		const relics = allRelics.filter(
			(item) =>
				record(item) && String(item.equip_avatar ?? item.equipAvatar) === cid,
		);
		if (relics.length !== 6) throw new Error(`角色 ${cid} 需要完整六件遗器`);
		const sets: Record<string, number> = {},
			slots = new Set<number>();
		for (const relic of relics) {
			if (!record(relic)) throw new Error("遗器数据无效");
			const item = numeric(
				relic.item_id ?? relic.relic_id ?? relic.id,
				"遗器编号",
			);
			const rarity = Math.floor(item / 10000) - 1,
				slot = Number(relic.slot ?? item % 10);
			if (slots.has(slot)) throw new Error(`角色 ${cid} 遗器槽位重复`);
			slots.add(slot);
			const set = String(
				relic.set_id ?? relic.relic_set_id ?? Math.floor(item / 10) % 1000,
			);
			sets[set] = (sets[set] ?? 0) + 1;
			const affixId = String(
				relic.main_affix_id ??
					(record(relic.main_affix) ? relic.main_affix.affix_id : ""),
			);
			const rule = mainAffixes[`${rarity}${slot}`]?.[affixId];
			if (!rule) throw new Error("遗器主词条系数缺失");
			add(
				rule.property,
				rule.base + rule.step * numeric(relic.level, "遗器等级"),
			);
			const subAffixesRaw = relic.sub_affixes ?? relic.sub_affix_list;
			if (!Array.isArray(subAffixesRaw)) throw new Error("遗器副词条缺失");
			for (const affix of subAffixesRaw) {
				if (!record(affix)) throw new Error("副词条格式无效");
				const subRule =
					subAffixes[String(rarity)]?.[
						String(affix.sub_affix_id ?? affix.affix_id)
					];
				if (!subRule) throw new Error("遗器副词条系数缺失");
				add(
					subRule.property,
					subRule.base * numeric(affix.count, "副词条次数") +
						subRule.step * numeric(affix.step, "副词条档位"),
				);
			}
		}
		// Unconditional bonuses used by this team. Reject other sets rather than guessing.
		const supportedSets = new Set([
			"102",
			"110",
			"121",
			"123",
			"126",
			"308",
			"309",
			"114",
			"129",
			"130",
			"133",
			"325",
			"310",
			"317",
			"314",
			"329",
		]);
		for (const id of Object.keys(sets))
			if (!supportedSets.has(id))
				throw new Error(`尚未实现遗器套装 ${id} 的面板，请手动输入`);
		if ((sets["314"] ?? 0) >= 2) add("AttackAddedRatio", 0.12);
		if ((sets["129"] ?? 0) >= 2) add("CriticalDamageBase", 0.16);
		if ((sets["325"] ?? 0) >= 2) add("ElationDamageAddedRatioBase", 0.08);
		if ((sets["130"] ?? 0) >= 2) add("SpeedAddedRatio", 0.06);
		if ((sets["329"] ?? 0) >= 2) add("SpeedAddedRatio", 0.06);
		if ((sets["133"] ?? 0) >= 2) add("SpeedAddedRatio", 0.06);
		if ((sets["114"] ?? 0) >= 2) add("SpeedAddedRatio", 0.06);
		if ((sets["310"] ?? 0) >= 2) add("StatusResistanceBase", 0.1);
		if ((sets["317"] ?? 0) >= 2) add("SPRatioBase", 0.05);
		if ((sets["110"] ?? 0) >= 2) add("WindAddedRatio", 0.1);
		if ((sets["102"] ?? 0) >= 2) add("AttackAddedRatio", 0.12);
		if ((sets["102"] ?? 0) >= 4) add("SpeedAddedRatio", 0.06);
		if ((sets["123"] ?? 0) >= 2) add("AttackAddedRatio", 0.12);
		if ((sets["121"] ?? 0) >= 2) add("SpeedAddedRatio", 0.06);
		if ((sets["126"] ?? 0) >= 2) add("CriticalDamageBase", 0.16);
		if ((sets["309"] ?? 0) >= 2) add("CriticalChanceBase", 0.08);
		if ((sets["308"] ?? 0) >= 2) add("SPRatioBase", 0.05);
		const rank = numeric(equippedCone.rank, "光锥叠影");
		const params = coneInfo.refinements.level[String(rank)]?.param_list;
		if (!params) throw new Error("光锥叠影系数缺失");
		if (lcId === 23057 || lcId === 23054) add("SpeedAddedRatio", params[0]);
		if (lcId === 23055) add("DefenceAddedRatio", params[0]);
		if (lcId === 23053) add("CriticalDamageBase", params[0]);
		if (lcId === 21064) add("ElationDamageAddedRatioBase", params[0]);
		if (lcId === 23044 || lcId === 23065) add("BaseSpeedDelta", params[0]);
		if (lcId === 23019) add("BreakDamageAddedRatioBase", params[0]);
		if (lcId === 23003) add("SPRatioBase", params[0]);
		const baseAttack =
			base.attack_base +
			base.attack_add * (level - 1) +
			coneBase.base_attack +
			coneBase.base_attack_add * (numeric(equippedCone.level, "光锥等级") - 1);
		const baseDefense =
			base.defence_base +
			base.defence_add * (level - 1) +
			coneBase.base_defence +
			coneBase.base_defence_add * (numeric(equippedCone.level, "光锥等级") - 1);
		const speedBase = base.speed_base + (totals.BaseSpeedDelta ?? 0);
		const speed =
			speedBase * (1 + (totals.SpeedAddedRatio ?? 0)) +
			(totals.SpeedDelta ?? 0);
		const skillLevel = (suffix: string) => {
			const raw = skills[`${cid}${suffix}`];
			return numeric(record(raw) ? raw.level : raw, "技能等级");
		};
		const eidolon = numeric(data.rank ?? avatar.rank ?? 0, "星魂");
		// 文件没给 sp_value 时保持省略，由能量结算回退到半能量，而不是当成 0。
		const rankUp = (suffix: string) => {
			if (cid === "1503" && suffix === "003" && eidolon >= 3) return 2;
			if (cid === "1503" && ["002", "004"].includes(suffix) && eidolon >= 5)
				return 2;
			if (cid === "1511" && suffix === "003" && eidolon >= 3) return 2;
			if (cid === "1511" && ["002", "004"].includes(suffix) && eidolon >= 5)
				return 2;
			if (cid === "1501" && suffix === "002" && eidolon >= 3) return 2;
			if (cid === "1501" && ["003", "004"].includes(suffix) && eidolon >= 5)
				return 2;
			// 银狼/爻光 星魂3：战技+2、普攻+1、欢愉技+1；星魂5：终结技+2、天赋+2、欢愉技+1。
			if (
				(cid === "1506" || cid === "1502") &&
				suffix === "002" &&
				eidolon >= 3
			)
				return 2;
			if (
				(cid === "1506" || cid === "1502") &&
				["003", "004"].includes(suffix) &&
				eidolon >= 5
			)
				return 2;
			if (
				(cid === "8010" || cid === "8009") &&
				suffix === "004" &&
				eidolon >= 3
			)
				return 2;
			if (
				(cid === "8010" || cid === "8009") &&
				suffix === "002" &&
				eidolon >= 3
			)
				return 2;
			if (
				(cid === "8010" || cid === "8009") &&
				suffix === "003" &&
				eidolon >= 5
			)
				return 2;
			if (cid === "1412" && suffix === "002" && eidolon >= 3) return 2;
			if (cid === "1412" && ["003", "004"].includes(suffix) && eidolon >= 5)
				return 2;
			if (cid === "1101" && ["003", "004"].includes(suffix) && eidolon >= 3)
				return 2;
			return 0;
		};
		const importedEnergy =
			avatar.sp_value === undefined || avatar.sp_value === null
				? undefined
				: Number(avatar.sp_value);
		return {
			character: {
				...createTarget(`freesr-${cid}`, index),
				name: getCharacterNameByCid(cid) ?? cid,
				speed: String(Number(speed.toFixed(6))),
				eidolon,
				lc_id: lcId,
				superimpose: rank,
				techniqueOn:
					Array.isArray(avatar.techniques) && avatar.techniques.length > 0,
				hasVonwacq: (sets["308"] ?? 0) >= 2 && speed >= 120,
				hasWindSet: (sets["110"] ?? 0) >= 4,
			},
			level,
			baseSpeed: speedBase,
			baseDefense,
			defense:
				baseDefense * (1 + (totals.DefenceAddedRatio ?? 0)) +
				(totals.DefenceDelta ?? 0),
			healingBonus: totals.HealRatioBase ?? 0,
			hp:
				(base.hp_base +
					base.hp_add * (level - 1) +
					coneBase.base_hp +
					coneBase.base_hp_add *
						(numeric(equippedCone.level, "光锥等级") - 1)) *
					(1 + (totals.HPAddedRatio ?? 0)) +
				(totals.HPDelta ?? 0),
			elation: totals.ElationDamageAddedRatioBase ?? 0,
			effectRes: totals.StatusResistanceBase ?? 0,
			damageBonuses: Object.fromEntries(
				["Physical", "Wind", "Thunder", "Imaginary", "Fire", "Quantum"].map(
					(element) => [element, totals[`${element}AddedRatio`] ?? 0],
				),
			),
			baseAttack,
			attack:
				baseAttack * (1 + (totals.AttackAddedRatio ?? 0)) +
				(totals.AttackDelta ?? 0),
			speed,
			critRate: base.critical_chance + (totals.CriticalChanceBase ?? 0),
			critDamage: base.critical_damage + (totals.CriticalDamageBase ?? 0),
			physicalBonus: totals.PhysicalAddedRatio ?? 0,
			windBonus: totals.WindAddedRatio ?? 0,
			gear: {
				sets,
				enhanced,
				skillLevel: skillLevel("002") + rankUp("002"),
				ultimateLevel: skillLevel("003") + rankUp("003"),
				talentLevel: skillLevel("004") + rankUp("004"),
				breakEffect: totals.BreakDamageAddedRatioBase ?? 0,
				energyRegen: totals.SPRatioBase ?? 0,
				initialEnergy: Number.isFinite(importedEnergy)
					? importedEnergy
					: undefined,
				ultimateCost: Number(avatar.sp_max ?? 0),
			},
		};
	});
}
