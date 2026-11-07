import type { ElationTeamConfig } from "../../src/damage/elationTypes";
import { readTrialEquipment } from "../../src/damage/equipment";

/**
 * 五星副词条单条取中间值：档位倍率 0.8/0.9/1.0/1.1 里的 0.9 档，即 base + 1*step。
 * 速度 2.3、暴击率 2.916%、暴击伤害 5.832%、防御力 4.86%，与社区“平均词条”一致。
 */
export const MID = {
	speed: 2 + 0.3,
	critRate: 0.02592 + 0.00324,
	critDamage: 0.05184 + 0.00648,
	defence: 0.0432 + 0.0054,
};

type RollSpec = {
	cid: string;
	name: string;
	cone: number;
	speed: number;
	critRate: number;
	critDamage: number;
	defence: number;
};

/** 用户指定：四人全 6 魂、指定 S5 专锥、指定副词条条数（其余主词条与套装沿用导入配装）。 */
export const ROLLS: RollSpec[] = [
	{
		cid: "1506",
		name: "银狼",
		cone: 23057,
		speed: 20,
		critRate: 5,
		critDamage: 15,
		defence: 0,
	},
	{
		cid: "1502",
		name: "爻光",
		cone: 23054,
		speed: 20,
		critRate: 5,
		critDamage: 15,
		defence: 0,
	},
	{
		cid: "1511",
		name: "虚照",
		cone: 23065,
		speed: 20,
		critRate: 5,
		critDamage: 15,
		defence: 0,
	},
	{
		cid: "1503",
		name: "真珠",
		cone: 23055,
		speed: 23,
		critRate: 0,
		critDamage: 0,
		defence: 10,
	},
];

export function buildTeam(
	raw: unknown,
	sourceFile = "FreeSR 配装",
): ElationTeamConfig {
	const data = structuredClone(raw) as {
		avatars: Record<string, { data: { rank: number }; enhanced_id?: number }>;
		lightcones: Record<string, unknown>[];
		relics: Record<string, unknown>[];
	};
	const ids = ROLLS.map((r) => r.cid);
	data.lightcones = data.lightcones.filter(
		(x) => !ids.includes(String(x.equip_avatar)),
	);
	for (const r of ROLLS) {
		const avatar = data.avatars[r.cid];
		if (!avatar?.data) throw new Error(`缺少角色 ${r.cid}`);
		avatar.data.rank = 6;
		data.lightcones.push({
			equip_avatar: Number(r.cid),
			item_id: r.cone,
			rank: 5,
			level: 80,
			promotion: 6,
		});
		// 用户只给副词条条数：先清空原副词条，再按指定条数补入中间值。
		for (const relic of data.relics)
			if (String(relic.equip_avatar) === r.cid) relic.sub_affixes = [];
	}
	const profiles = readTrialEquipment(data, ids);
	for (const [i, p] of profiles.entries()) {
		const r = ROLLS[i];
		if (p.character.id !== `freesr-${r.cid}`)
			throw new Error("角色顺序与配装不符");
		p.speed += r.speed * MID.speed;
		p.critRate += r.critRate * MID.critRate;
		p.critDamage += r.critDamage * MID.critDamage;
		p.defense =
			(p.defense ?? 0) + (p.baseDefense ?? 0) * r.defence * MID.defence;
		p.character.speed = String(p.speed);
		p.character.hasVonwacq = (p.gear.sets["308"] ?? 0) >= 2 && p.speed >= 120;
	}
	return {
		enabled: true,
		profiles,
		sourceFile,
		resourceAccountingRule: "qCost60",
		ahaBaseSpeedRule: "starInParty",
		limit: 300,
		enemyLevel: 95,
		enemySpeed: 132,
		enemyCount: 1,
		enemyMaxHp: 0,
		starSkillEvery: 1,
		starEnvoyId: "",
		pearlBlueprintId: "",
		pearlSkillEvery: 3,
		pearlCopyApplause: "pearl",
		enemyAttackDamage: 0,
		resistance: 0,
		seed: 20261106,
		boxProbabilityModel: "resourceDependentV1",
		hiddenScoreCap: 300,
		boxBeanCurveK: 8,
		boxMinProbability: 0.05,
		basicPauseCuts: [25, 50, 75],
		wolfUltMinScore: 60,
		wolfUltRushWindow: 0,
		wolfSupportTiming: "immediate",
		huoSkillEvery: 3,
		mcSkillEvery: 1,
		sparxieJackpotTarget: 1,
		mcTechniqueElation: 0.2,
		lowHpHealTargets: 0,
		applausePhase: "after",
		mcTraceStack: false,
		mushroomStacks: true,
		boxCountsAsAttack: false,
		ahaDebt: true,
		critExpectation: true,
	};
}

export const panel = (config: ElationTeamConfig) =>
	config.profiles.map((p) => ({
		name: p.character.name,
		eidolon: p.character.eidolon,
		cone: p.character.lc_id,
		superimpose: p.character.superimpose,
		speed: +p.speed.toFixed(3),
		attack: +p.attack.toFixed(1),
		critRate: +(p.critRate * 100).toFixed(2),
		critDamage: +(p.critDamage * 100).toFixed(2),
		defense: +p.defense.toFixed(1),
		elation: +(p.elation * 100).toFixed(2),
		sets: p.gear.sets,
		energyRegen: +(p.gear.energyRegen ?? 0).toFixed(4),
		initialEnergy: p.gear.initialEnergy,
		ultimateCost: p.gear.ultimateCost,
	}));
