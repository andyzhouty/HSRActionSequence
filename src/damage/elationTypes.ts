import { getCharacterBaseSpeed, getCharacterCid } from "../data/characters";
import type { EquipmentProfile } from "./equipment";
export type ElationTeamConfig = {
	enabled: boolean;
	profiles: EquipmentProfile[];
	sourceFile: string;
	resourceAccountingRule: "qCost60";
	ahaBaseSpeedRule: "fixed80" | "starInParty";
	limit: number;
	enemyLevel: number;
	enemySpeed: number;
	enemyCount: number;
	enemyMaxHp: number;
	starSkillEvery: number;
	starEnvoyId: string;
	pearlBlueprintId: string;
	pearlSkillEvery: number;
	pearlCopyApplause: "pearl" | "blueprint";
	enemyAttackDamage: number;
	resistance: number;
	seed: number;
	boxProbabilityModel: "resourceDependentV1";
	hiddenScoreCap: number;
	boxBeanCurveK: number;
	/** 低于该触发率的分支按实战不可触发剔除并归一再分配；0 表示保留原模型。 */
	boxMinProbability: number;
	basicPauseCuts: [number, number, number];
	wolfUltMinScore: number;
	wolfUltRushWindow: number;
	wolfSupportTiming: "immediate" | "score240";
	huoSkillEvery: number;
	mcSkillEvery: number;
	sparxieJackpotTarget: 1 | 2 | 3;
	mcTechniqueElation: number;
	lowHpHealTargets: number;
	applausePhase: "before" | "after";
	mcTraceStack: boolean;
	mushroomStacks: boolean;
	boxCountsAsAttack: boolean;
	/** 阿哈正传·欢愉负债：把已造成伤害按面板比例额外计入总量。 */
	ahaDebt: boolean;
	/** true=暴击取期望；false=按每次都暴击结算。 */
	critExpectation: boolean;
};
export const defaultElationTeamConfig: ElationTeamConfig = {
	enabled: false,
	profiles: [],
	sourceFile: "",
	resourceAccountingRule: "qCost60",
	ahaBaseSpeedRule: "fixed80",
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
	boxMinProbability: 0,
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
export function normalizeElationTeamConfig(
	raw: unknown,
): ElationTeamConfig | undefined {
	if (raw === undefined) return undefined;
	if (!raw || typeof raw !== "object" || Array.isArray(raw))
		throw new Error("欢愉队设置无效");
	const v = {
		...defaultElationTeamConfig,
		...raw,
		resourceAccountingRule: "qCost60",
		boxProbabilityModel: "resourceDependentV1",
	} as ElationTeamConfig;
	delete (v as { boxWeights?: unknown }).boxWeights;
	for (const key of [
		"limit",
		"enemyLevel",
		"enemySpeed",
		"enemyCount",
		"seed",
		"wolfUltMinScore",
		"hiddenScoreCap",
		"wolfUltRushWindow",
		"huoSkillEvery",
		"mcSkillEvery",
		"starSkillEvery",
		"pearlSkillEvery",
		"lowHpHealTargets",
	] as const)
		if (!Number.isInteger(v[key]) || v[key] < 0)
			throw new Error(`欢愉队${key}无效`);
	if (
		v.limit < 1 ||
		v.limit > 3000 ||
		v.enemyLevel < 1 ||
		v.enemyLevel > 200 ||
		v.enemySpeed < 1 ||
		v.enemySpeed > 1000 ||
		v.enemyCount < 1 ||
		v.enemyCount > 5 ||
		v.wolfUltMinScore < 60 ||
		v.hiddenScoreCap < 60 ||
		v.hiddenScoreCap > 3000 ||
		// 升格会把银狼隐藏分上限抬到999，开大门槛允许超过基础上限
		v.wolfUltMinScore > Math.max(v.hiddenScoreCap, 999) ||
		typeof v.boxBeanCurveK !== "number" ||
		!Number.isFinite(v.boxBeanCurveK) ||
		v.boxBeanCurveK <= 0 ||
		v.boxBeanCurveK > 1000 ||
		typeof v.boxMinProbability !== "number" ||
		!Number.isFinite(v.boxMinProbability) ||
		v.boxMinProbability < 0 ||
		v.boxMinProbability > 1 ||
		v.wolfUltRushWindow > 300 ||
		!["immediate", "score240"].includes(v.wolfSupportTiming) ||
		v.huoSkillEvery < 1 ||
		v.mcSkillEvery < 1 ||
		v.starSkillEvery < 1 ||
		v.pearlSkillEvery < 1 ||
		typeof v.pearlBlueprintId !== "string" ||
		!["pearl", "blueprint"].includes(v.pearlCopyApplause) ||
		typeof v.enemyAttackDamage !== "number" ||
		!Number.isFinite(v.enemyAttackDamage) ||
		v.enemyAttackDamage < 0 ||
		typeof v.enemyMaxHp !== "number" ||
		!Number.isFinite(v.enemyMaxHp) ||
		v.enemyMaxHp < 0 ||
		typeof v.starEnvoyId !== "string" ||
		![1, 2, 3].includes(v.sparxieJackpotTarget) ||
		v.lowHpHealTargets > 4
	)
		throw new Error("欢愉队设置越界");
	if (
		!["fixed80", "starInParty"].includes(v.ahaBaseSpeedRule) ||
		v.resourceAccountingRule !== "qCost60" ||
		typeof v.enabled !== "boolean" ||
		typeof v.sourceFile !== "string" ||
		typeof v.resistance !== "number" ||
		!Number.isFinite(v.resistance) ||
		![0.2, 0.3].includes(v.mcTechniqueElation)
	)
		throw new Error("欢愉队设置无效");
	if (
		!["before", "after"].includes(v.applausePhase) ||
		[
			v.mcTraceStack,
			v.mushroomStacks,
			v.boxCountsAsAttack,
			v.ahaDebt,
			v.critExpectation,
		].some((x) => typeof x !== "boolean")
	)
		throw new Error("欢愉队机制设置无效");
	if (
		!Array.isArray(v.basicPauseCuts) ||
		v.basicPauseCuts.length !== 3 ||
		v.basicPauseCuts.some(
			(n, i) =>
				!Number.isInteger(n) ||
				n <= 0 ||
				n >= 100 ||
				(i > 0 && n <= v.basicPauseCuts[i - 1]),
		)
	)
		throw new Error("强化A盲盒暂停段数无效");
	if (
		!Array.isArray(v.profiles) ||
		(v.profiles.length !== 0 && v.profiles.length !== 4)
	)
		throw new Error("欢愉队需要四人配装");
	for (const p of v.profiles) {
		if (
			!p ||
			typeof p !== "object" ||
			!p.character ||
			!p.gear ||
			!p.gear.sets ||
			typeof p.character.id !== "string" ||
			typeof p.character.name !== "string"
		)
			throw new Error("欢愉队配装无效");
		for (const n of [
			p.level,
			p.hp,
			p.attack,
			p.baseAttack,
			p.speed,
			p.critRate,
			p.critDamage,
			p.elation,
			p.effectRes,
		])
			if (!Number.isFinite(n) || n < 0) throw new Error("欢愉队面板无效");
		if (
			p.speed <= 0 ||
			typeof p.gear.enhanced !== "boolean" ||
			!p.damageBonuses ||
			typeof p.damageBonuses !== "object" ||
			Array.isArray(p.damageBonuses)
		)
			throw new Error("欢愉队面板无效");
		if (
			Object.values(p.damageBonuses).some(
				(n) => !Number.isFinite(n) || n < 0,
			) ||
			Object.values(p.gear.sets).some(
				(n) => !Number.isInteger(n) || n < 0 || n > 6,
			)
		)
			throw new Error("欢愉队遗器设置无效");
		for (const n of [
			p.gear.skillLevel,
			p.gear.ultimateLevel,
			p.gear.talentLevel,
		])
			if (!Number.isInteger(n) || n < 1 || n > 15)
				throw new Error("欢愉队技能等级无效");
		for (const n of [
			p.gear.energyRegen ?? 0,
			p.gear.initialEnergy ?? 0,
			p.gear.ultimateCost ?? 1,
		])
			if (!Number.isFinite(n) || n < 0) throw new Error("欢愉队能量设置无效");
		if (
			!Number.isInteger(p.character.eidolon) ||
			p.character.eidolon < 0 ||
			p.character.eidolon > 6 ||
			!Number.isInteger(p.character.lc_id) ||
			!Number.isInteger(p.character.superimpose) ||
			p.character.superimpose < 1 ||
			p.character.superimpose > 5
		)
			throw new Error("欢愉队角色配置无效");
	}
	return v;
}

/** This trial's opt-in variant ignores account ownership and only inspects the active party. */
export function resolveElationAhaBaseSpeed(
	config: Pick<ElationTeamConfig, "ahaBaseSpeedRule" | "profiles">,
): number {
	if (config.ahaBaseSpeedRule === "fixed80") return 80;
	const star = config.profiles.find(
		(p) =>
			p.character.kind === "角色" &&
			getCharacterCid(p.character.name) === "1511",
	);
	return star
		? (star.baseSpeed ?? getCharacterBaseSpeed(star.character.name) ?? 80)
		: 80;
}
