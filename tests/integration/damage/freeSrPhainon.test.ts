import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readTrialEquipment } from "../../../src/damage/equipment";
import { calculatePhainonTrial } from "../../../src/damage/phainonTrial";
import { createPhainonTrialPreset } from "../../../src/damage/preset";
import { toNormalizedSavedData } from "../../../src/pages/action-sequence/savedData";
import { simulateActions } from "../../../src/simulate/actions";
import { getDisplayOrderedActions } from "../../../src/utils/actionDisplayOrder";

const source = process.env.HSR_FREESR_TEST_FILE;
describe("user-supplied four-character equipment validation", () => {
	it.skipIf(!source || !existsSync(source))(
		"replays the actual equipped relics and exports a reviewable axis",
		() => {
			if (!source) throw new Error("需要指定 FreeSR 文件");
			const raw: unknown = JSON.parse(
				readFileSync(source, "utf8").replace(/^\uFEFF/, ""),
			);
			const profiles = readTrialEquipment(raw);
			expect(profiles.map((profile) => profile.character.eidolon)).toEqual([
				2, 4, 0, 1,
			]);
			expect(profiles[2].gear.enhanced).toBe(true);
			expect(profiles[1].gear.ultimateLevel).toBe(12);
			expect(profiles[1].gear.skillLevel).toBe(10);
			const saved = toNormalizedSavedData(
				createPhainonTrialPreset(raw, "freesr-data(4).json"),
			);
			const actions = getDisplayOrderedActions(
				simulateActions({
					...saved,
					limit: 300,
					legacyUltOverrides: saved.ultOverrides,
				}),
				saved.sameAVOrder,
			);
			if (!saved.phainonDamageTrial) throw new Error("缺少配装设置");
			expect(
				actions
					.filter(
						(action) => action.isDomainAction && !action.isDomainFinalAction,
					)
					.every((action) => action.skill !== ""),
			).toBe(true);
			const result = calculatePhainonTrial({
				config: saved.phainonDamageTrial,
				characters: saved.characters,
				actions,
				defaultSkillTargets: saved.defaultSkillTargets,
			});
			expect(result.warnings).toEqual([]);
			expect(result.rows.flatMap((row) => row.warnings)).toEqual([]);
			expect(saved.phainonDamageTrial.enemyLevel).toBe(95);
			expect(saved.phainonDamageTrial.resistance).toBe(0);
			const enemyActions = actions.filter(
				(action) => action.characterId === "damage-trial-enemy",
			);
			expect(enemyActions.length).toBeGreaterThan(1);
			const forced = enemyActions.find((action) =>
				action.key.includes("-domain-"),
			);
			if (!forced) throw new Error("缺少W强制敌方行动");
			const nextEnemy = enemyActions.find(
				(action) => action.actionValue > forced.actionValue,
			);
			expect(nextEnemy?.actionValue).toBeCloseTo(forced.actionValue + 50);
			const domainActions = actions.filter((action) => action.isDomainAction);
			expect(saved.overrides).toEqual({});
			const secondE = actions.find(
				(action) => action.key === `${profiles[0].character.id}-2`,
			);
			expect(secondE?.actionValue).toBeLessThan(50);
			expect(domainActions[0].actionValue).toBeGreaterThan(50);
			expect(
				actions.some(
					(action) =>
						action.characterId === profiles[3].character.id &&
						action.actionValue > domainActions[0].actionValue &&
						action.actionValue <
							domainActions[domainActions.length - 1].actionValue,
				),
			).toBe(false);
			expect(
				result.rows.some((row) => row.description.includes("最后一击")),
			).toBe(true);
			expect(
				result.rows
					.filter((row) => row.expected > 0)
					.every((row) => Number.isFinite(row.expected)),
			).toBe(true);
			expect(
				result.rows.some((row) => row.buffs.includes("知更鸟1魂穿透")),
			).toBe(true);
			const output = process.env.HSR_DAMAGE_REPORT_DIR;
			if (output) {
				mkdirSync(output, { recursive: true });
				writeFileSync(
					join(output, "action-sequence-phainon-validation.json"),
					JSON.stringify(saved, null, 2),
				);
				writeFileSync(
					join(output, "damage-results.json"),
					JSON.stringify({ profiles, result }, null, 2),
				);
				const report = [
					"# 白厄验证轴 · 4.6.54",
					"",
					"配装来源：用户提供的 freesr-data(4).json，仅使用当前装备的遗器；备选 loadout 未应用。敌人按用户指定的默认95级、200速、每次群攻处理，不使用原文件中的Boss与祝福；境界内敌方行动不增加火种。",
					"",
					"## 出战前面板",
					"",
					"| 角色 | 星魂 | 光锥 | 攻击力 | 基础攻击 | 速度 | 暴击率 | 暴伤 |",
					"|---|---:|---|---:|---:|---:|---:|---:|",
					...profiles.map(
						(profile) =>
							`| ${profile.character.name} | ${profile.character.eidolon} | ${profile.character.lc_id} S${profile.character.superimpose} | ${profile.attack.toFixed(6)} | ${profile.baseAttack.toFixed(6)} | ${profile.speed.toFixed(6)} | ${(profile.critRate * 100).toFixed(4)}% | ${(profile.critDamage * 100).toFixed(4)}% |`,
					),
					"",
					"## 行动结算",
					"",
					"| AV | 行动 | 攻击力 | 期望伤害 | 火种 | 毁伤 | 校验 |",
					"|---:|---|---:|---:|---:|---:|---|",
					...result.rows.map(
						(row) =>
							`| ${row.actionValue.toFixed(4)} | ${row.actor} ${row.skill} ${row.description} | ${row.attack.toFixed(4)} | ${row.expected.toFixed(4)} | ${row.seeds} | ${row.ruin} | ${row.warnings.join("；")} |`,
					),
					"",
					"结果是指定参数下白厄自身的伤害回放。未包括知更鸟附加伤害、其他队友伤害、击破、Boss阶段机制和原文件的4个战斗祝福；已按配装校验能量，击杀未自动模拟。增益领域保留和知更鸟Q攻击快照为当前试验口径。",
					"",
				];
				writeFileSync(join(output, "report.md"), report.join("\n"));
			}
		},
	);
});
