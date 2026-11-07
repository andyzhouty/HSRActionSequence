import { createTarget } from "../utils/action-sequence";
import type { SavedData } from "../utils/action-sequence/types";
import { readTrialEquipment } from "./equipment";
import { defaultPhainonTrialConfig } from "./types";

export function createTrialEnemy() {
	return {
		...createTarget("damage-trial-enemy", 0, "敌人"),
		name: "验证敌人（群攻）",
		speed: "200",
		baseSpeed: "200",
		techniqueOn: false,
	};
}

/** Choose just this trial's four characters from an account-wide export. */
export function createPhainonTrialPreset(
	raw: unknown,
	sourceFile = "FreeSR 配装",
	support: "sparkle" | "cerydra" = "sparkle",
): Partial<SavedData> {
	const profiles = readTrialEquipment(raw, [
		"1408",
		"1101",
		support === "cerydra" ? "1412" : "1306",
		"1309",
	]);
	const [phainon, bronya, sparkle, robin] = profiles;
	const config = {
		...defaultPhainonTrialConfig,
		enabled: true,
		characterId: phainon.character.id,
		baseAttack: phainon.baseAttack,
		attack: phainon.attack,
		critRate: phainon.critRate,
		critDamage: phainon.critDamage,
		damageBonus: phainon.physicalBonus,
		bronyaCritDamage: bronya.critDamage,
		sparkleCritDamage:
			support === "sparkle"
				? sparkle.critDamage
				: defaultPhainonTrialConfig.sparkleCritDamage,
		cerydraDamageBonus: support === "cerydra" ? sparkle.windBonus : 0,
		cerydraAttack:
			support === "cerydra"
				? sparkle.attack
				: defaultPhainonTrialConfig.cerydraAttack,
		cerydraBaseAttack:
			support === "cerydra"
				? sparkle.baseAttack
				: defaultPhainonTrialConfig.cerydraBaseAttack,
		cerydraCritRate:
			support === "cerydra"
				? sparkle.critRate
				: defaultPhainonTrialConfig.cerydraCritRate,
		cerydraCritDamage:
			support === "cerydra"
				? sparkle.critDamage
				: defaultPhainonTrialConfig.cerydraCritDamage,
		robinAttack: robin.attack,
		robinBaseAttack: robin.baseAttack,
		gear: Object.fromEntries(
			profiles.map((profile) => [profile.character.id, profile.gear]),
		),
		sourceFile,
		actionOverrides: {},
	};
	const skillOverrides: Record<string, string> = {};
	for (const profile of [bronya, sparkle, robin])
		for (let i = 1; i <= 12; i++)
			skillOverrides[`${profile.character.id}-${i}`] =
				i === 1 ? "EQ" : support === "cerydra" ? "A" : "E";
	skillOverrides[`${phainon.character.id}-1`] = "E";
	skillOverrides[`${phainon.character.id}-2`] = "E";
	const domainPrefix = `${bronya.character.id}-2-interrupt-0`;
	let ruin = Math.min(7, 4 + (phainon.character.techniqueOn ? 2 : 0));
	for (let index = 0; support === "sparkle" && index < 7; index++) {
		let skill: string;
		if (index === 0) {
			skill = "W";
			ruin = Math.min(7, ruin + config.enemyCount);
		} else if (ruin >= 4 && phainon.character.eidolon >= 2) {
			skill = "EA";
			ruin = ruin - 4 + 2;
		} else {
			skill = "A";
			ruin = Math.min(7, ruin + 2);
		}
		skillOverrides[`${domainPrefix}-domain-${index}`] = skill;
	}
	return {
		meritTarget: support === "cerydra" ? phainon.character.id : undefined,
		characters: [
			...profiles.map((profile) => profile.character),
			createTrialEnemy(),
		],
		limitPreset: "自定义",
		customLimit: "300",
		displayedLimit: "300",
		resources: ["火种", "毁伤"],
		overrides: {},
		ultInterrupts:
			support === "cerydra"
				? {}
				: {
						[`${bronya.character.id}-2`]: [
							{ casterId: phainon.character.id, timing: "after" },
						],
					},
		skillOverrides,
		resourceValues: {},
		defaultSkillTargets: {
			[bronya.character.id]: phainon.character.id,
			[sparkle.character.id]: phainon.character.id,
		},
		phainonDamageTrial: config,
	};
}
