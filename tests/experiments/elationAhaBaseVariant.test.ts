import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

const source =
	process.env.HSR_ELATION_VARIANT_SOURCE ??
	"build/elation-score-strategy/best-preset.json";
it.skipIf(process.env.HSR_ELATION_BASE_VARIANT !== "1" || !existsSync(source))(
	"creates a separate unchanged-gear party-only Aha base-speed variant",
	() => {
		const saved = toNormalizedSavedData(
			JSON.parse(readFileSync(source, "utf8")),
		);
		const original = saved.elationTeamTrial;
		if (!original) throw new Error("Missing trial settings");
		const config = { ...original, ahaBaseSpeedRule: "starInParty" as const };
		const variant = toNormalizedSavedData({
			...saved,
			elationTeamTrial: config,
		});
		expect(variant.characters).toEqual(saved.characters);
		expect(config.profiles).toEqual(original.profiles);
		expect({ ...config, ahaBaseSpeedRule: original.ahaBaseSpeedRule }).toEqual(
			original,
		);
		const before = simulateElationTeam(original),
			after = simulateElationTeam(config);
		expect(after.ahaBaseSpeed).toBe(80);
		expect(after).toEqual(before);
		let oldTotal = 0,
			newTotal = 0;
		for (let i = 0; i < 100; i++) {
			const a = simulateElationTeam({ ...original, seed: original.seed + i });
			const b = simulateElationTeam({ ...config, seed: config.seed + i });
			expect(b.total).toBe(a.total);
			oldTotal += a.total;
			newTotal += b.total;
		}
		const dir =
			process.env.HSR_ELATION_REPORT_DIR ?? "build/elation-star-absent-base80";
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "variant-preset.json"),
			JSON.stringify(variant, null, 2),
		);
		writeFileSync(
			join(dir, "variant-result.json"),
			JSON.stringify(after, null, 2),
		);
		writeFileSync(
			join(dir, "comparison.json"),
			JSON.stringify(
				{
					source,
					rule: "starInParty",
					ahaBaseSpeed: after.ahaBaseSpeed,
					profilesUnchanged: true,
					originalSample: before.total,
					variantSample: after.total,
					originalMean: oldTotal / 100,
					variantMean: newTotal / 100,
					difference: newTotal / 100 - oldTotal / 100,
				},
				null,
				2,
			),
		);
		writeFileSync(
			join(dir, "comparison.md"),
			[
				"# 同配装：星神不在队时禁用阿哈基础速度替换",
				"",
				`来源：${source}。原预设文件未改写；仅新版本配置的ahaBaseSpeedRule改为starInParty。`,
				"",
				"角色、星魂、光锥、遗器、循环、敌人和随机参数完全相同；采用上一版攒分候选。当前四人队不含星神阿哈，因此基础速度固定80，不能按已获取/拥有该角色而替换为94。欢愉角色当前速度的加权贡献照常计入。",
				"",
				"旧模拟实际也已使用80基础值，因此新旧结果一致；不存在本次禁用94后才下降的差值。",
				"",
				"|项目|旧版|新版本|",
				"|---|---:|---:|",
				`|阿哈时刻基础速度|${before.ahaBaseSpeed}|${after.ahaBaseSpeed}|`,
				`|原始种子伤害|${before.total.toFixed(2)}|${after.total.toFixed(2)}|`,
				`|同组100种子平均|${(oldTotal / 100).toFixed(2)}|${(newTotal / 100).toFixed(2)}|`,
				"",
				"本版本保留隐藏分去尾取整。盲盒权重和其他实验假设仍沿用原预设，不代表游戏实测。",
			].join("\n"),
		);
	},
	120000,
);
