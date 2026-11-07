import type { DamageFactors } from "./formula";

export type PhainonTrialConfig = DamageFactors & {
	enabled: boolean;
	characterId: string;
	baseAttack: number;
	attack: number;
	enemyCount: number;
	targetIndex: number;
	basicLevel: number;
	skillLevel: number;
	ultimateLevel: number;
	talentLevel: number;
	bronyaCritDamage: number;
	sparkleCritDamage: number;
	robinAttack: number;
	robinBaseAttack: number;
	cerydraAttack: number;
	cerydraBaseAttack: number;
	cerydraCritRate: number;
	cerydraCritDamage: number;
	cerydraDamageBonus: number;
	initialSkillPoints: number;
	initialSparkleStacks: number;
	healingTrace: boolean;
	sourceFile: string;
	gear: Record<
		string,
		{
			sets: Record<string, number>;
			enhanced: boolean;
			skillLevel: number;
			ultimateLevel: number;
			talentLevel: number;
			breakEffect: number;
			energyRegen?: number;
			initialEnergy?: number;
			ultimateCost?: number;
		}
	>;
	actionOverrides: Record<
		string,
		{ ruin?: number; counterStacks?: number; targetIndex?: number }
	>;
};

export const defaultPhainonTrialConfig: PhainonTrialConfig = {
	enabled: false,
	characterId: "",
	baseAttack: 1400,
	attack: 3000,
	attackerLevel: 80,
	enemyLevel: 95,
	enemyCount: 1,
	targetIndex: 0,
	critRate: 0.8,
	critDamage: 1.8,
	damageBonus: 0.388,
	vulnerability: 0,
	weaken: 0,
	damageReduction: 0,
	resistance: 0,
	resistancePenetration: 0,
	defenseReduction: 0,
	defenseIgnore: 0,
	independentMultiplier: 1,
	toughnessBroken: false,
	basicLevel: 6,
	skillLevel: 10,
	ultimateLevel: 10,
	talentLevel: 10,
	bronyaCritDamage: 2,
	sparkleCritDamage: 2,
	robinAttack: 4000,
	robinBaseAttack: 1300,
	cerydraAttack: 3000,
	cerydraBaseAttack: 1200,
	cerydraCritRate: 0.05,
	cerydraCritDamage: 0.5,
	cerydraDamageBonus: 0,
	initialSkillPoints: 3,
	initialSparkleStacks: 0,
	healingTrace: false,
	sourceFile: "",
	gear: {},
	actionOverrides: {},
};

export function normalizePhainonTrialConfig(
	value: unknown,
): PhainonTrialConfig | undefined {
	if (value === undefined) return undefined;
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("白厄伤害设置必须是对象");
	const input = value as Record<string, unknown>;
	const result = { ...defaultPhainonTrialConfig };
	for (const key of Object.keys(
		defaultPhainonTrialConfig,
	) as (keyof PhainonTrialConfig)[]) {
		if (input[key] === undefined || key === "actionOverrides" || key === "gear")
			continue;
		if (
			typeof input[key] !== typeof result[key] ||
			(typeof input[key] === "number" &&
				(!Number.isFinite(input[key]) ||
					(key !== "resistance" && Number(input[key]) < 0)))
		)
			throw new Error(`白厄伤害设置 ${key} 无效`);
		Object.assign(result, { [key]: input[key] });
	}
	// Resistance may be negative; other percentages in this first trial are nonnegative.
	if (typeof input.resistance === "number" && Number.isFinite(input.resistance))
		result.resistance = input.resistance;
	if (input.gear !== undefined) {
		if (
			!input.gear ||
			typeof input.gear !== "object" ||
			Array.isArray(input.gear)
		)
			throw new Error("配装设置无效");
		result.gear = {};
		for (const [id, raw] of Object.entries(input.gear)) {
			if (!raw || typeof raw !== "object" || Array.isArray(raw))
				throw new Error("配装设置无效");
			const item = raw as Record<string, unknown>;
			if (
				typeof item.enhanced !== "boolean" ||
				!item.sets ||
				typeof item.sets !== "object" ||
				Array.isArray(item.sets)
			)
				throw new Error("配装设置无效");
			for (const field of [
				"skillLevel",
				"ultimateLevel",
				"talentLevel",
				"breakEffect",
			] as const)
				if (
					typeof item[field] !== "number" ||
					!Number.isFinite(item[field]) ||
					Number(item[field]) < 0 ||
					(field !== "breakEffect" &&
						(!Number.isInteger(item[field]) ||
							Number(item[field]) < 1 ||
							Number(item[field]) > 15))
				)
					throw new Error("配装技能等级无效");
			if (
				Object.values(item.sets).some(
					(count) =>
						!Number.isInteger(count) || Number(count) < 0 || Number(count) > 6,
				)
			)
				throw new Error("遗器套装数量无效");
			for (const field of [
				"energyRegen",
				"initialEnergy",
				"ultimateCost",
			] as const)
				if (
					item[field] !== undefined &&
					(typeof item[field] !== "number" ||
						!Number.isFinite(item[field]) ||
						Number(item[field]) < 0)
				)
					throw new Error("能量配置无效");
			result.gear[id] = item as PhainonTrialConfig["gear"][string];
		}
	}
	if (input.actionOverrides !== undefined) {
		if (
			!input.actionOverrides ||
			typeof input.actionOverrides !== "object" ||
			Array.isArray(input.actionOverrides)
		)
			throw new Error("伤害行动覆写必须是对象");
		result.actionOverrides = {};
		for (const [key, raw] of Object.entries(input.actionOverrides)) {
			if (!raw || typeof raw !== "object" || Array.isArray(raw))
				throw new Error("伤害行动覆写无效");
			const next: {
				ruin?: number;
				counterStacks?: number;
				targetIndex?: number;
			} = {};
			for (const field of ["ruin", "counterStacks", "targetIndex"] as const) {
				const amount = (raw as Record<string, unknown>)[field];
				if (amount === undefined) continue;
				if (
					typeof amount !== "number" ||
					!Number.isInteger(amount) ||
					amount < 0 ||
					amount >
						(field === "counterStacks" ? 100 : field === "targetIndex" ? 4 : 7)
				)
					throw new Error("伤害行动覆写数值无效");
				next[field] = amount;
			}
			result.actionOverrides[key] = next;
		}
	}
	for (const field of [
		"attackerLevel",
		"enemyLevel",
		"enemyCount",
		"targetIndex",
		"basicLevel",
		"skillLevel",
		"ultimateLevel",
		"talentLevel",
		"initialSkillPoints",
		"initialSparkleStacks",
	] as const)
		if (!Number.isInteger(result[field]))
			throw new Error(`${field} 必须是整数`);
	if (
		result.enemyCount < 1 ||
		result.enemyCount > 5 ||
		result.targetIndex >= result.enemyCount ||
		result.attackerLevel < 1 ||
		result.attackerLevel > 80 ||
		result.enemyLevel < 1 ||
		result.enemyLevel > 200 ||
		result.basicLevel < 1 ||
		result.basicLevel > 6 ||
		[result.skillLevel, result.ultimateLevel, result.talentLevel].some(
			(level) => level < 1 || level > 10,
		) ||
		result.initialSkillPoints > 7 ||
		result.initialSparkleStacks > 3
	)
		throw new Error("伤害试验参数超出支持范围");
	return result;
}
