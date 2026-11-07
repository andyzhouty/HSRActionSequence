import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { searchPhainonAxis } from "../../src/damage/optimizer";
import { calculatePhainonTrial } from "../../src/damage/phainonTrial";
import type { NormalizedSavedData } from "../../src/pages/action-sequence/savedData";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";
import { simulateActions } from "../../src/simulate/actions";
import { getDisplayOrderedActions } from "../../src/utils/actionDisplayOrder";

const BRONYA = "freesr-1101";
const SPARKLE = "freesr-1306";
const ROBIN = "freesr-1309";
const PHAINON = "freesr-1408";

type Cast = { actor: string; after: string; timing: "before" | "after" };

const current: Cast[] = [
	{ actor: BRONYA, after: `${BRONYA}-4`, timing: "after" },
	{ actor: BRONYA, after: `${PHAINON}-2`, timing: "before" },
	{ actor: SPARKLE, after: `${SPARKLE}-1`, timing: "after" },
	{ actor: SPARKLE, after: "damage-trial-enemy-5", timing: "after" },
	{ actor: ROBIN, after: `${PHAINON}-2`, timing: "before" },
	{ actor: PHAINON, after: `${PHAINON}-3`, timing: "after" },
	{ actor: PHAINON, after: `${PHAINON}-8`, timing: "after" },
];

/** 只替换给定角色的插入，其余保持当前最优轴。 */
const variant = (label: string, updates: Record<string, Cast[]>) => ({
	label,
	casts: [
		...current.filter((cast) => !(cast.actor in updates)),
		...Object.values(updates).flat(),
	],
});

const variants = [
	{ label: "当前最优轴（花Q 在花E 后，鸭Q+鸟Q 在第二次E 前）", casts: current },
	variant("你的版本：鸟Q 在第一次E 后，花Q+鸭Q 插在第二次E 前", {
		[ROBIN]: [{ actor: ROBIN, after: `${PHAINON}-1`, timing: "after" }],
		[SPARKLE]: [
			{ actor: SPARKLE, after: `${PHAINON}-2`, timing: "before" },
			{ actor: SPARKLE, after: "damage-trial-enemy-5", timing: "after" },
		],
	}),
	variant("同位置，但鸟Q 排在鸭Q 之后（仍在第二次E 前）", {
		[SPARKLE]: [
			{ actor: SPARKLE, after: `${PHAINON}-2`, timing: "before" },
			{ actor: SPARKLE, after: "damage-trial-enemy-5", timing: "after" },
		],
	}),
	variant("花Q 插第二次E 前，鸟Q 仍在第一次E 后、且鸭Q 留在原位", {
		[ROBIN]: [{ actor: ROBIN, after: `${PHAINON}-1`, timing: "after" }],
		[SPARKLE]: [
			{ actor: SPARKLE, after: `${PHAINON}-2`, timing: "before" },
			{ actor: SPARKLE, after: "damage-trial-enemy-5", timing: "after" },
		],
		[BRONYA]: [{ actor: BRONYA, after: `${BRONYA}-4`, timing: "after" }],
	}),
];

/** 直接回放，取回被优化器吞掉的资源/能量警告。 */
function diagnose(saved: NormalizedSavedData) {
	const config = saved.phainonDamageTrial;
	if (!config) return ["缺少伤害设置"];
	const actions = getDisplayOrderedActions(
		simulateActions({
			...saved,
			overrides: {},
			limit: 300,
			legacyUltOverrides: saved.ultOverrides,
		}),
		saved.sameAVOrder,
	).filter((action) => action.actionValue <= 300);
	const result = calculatePhainonTrial({
		characters: saved.characters,
		actions,
		config,
		skillTargets: saved.skillTargets,
		defaultSkillTargets: saved.defaultSkillTargets,
		attackDisabled: saved.attackDisabled,
	});
	const reasons = [...result.warnings];
	for (const row of result.rows)
		for (const warning of row.warnings)
			reasons.push(
				`${row.actionValue.toFixed(3)} ${row.actor}${row.skill}：${warning}`,
			);
	return [...new Set(reasons)];
}

it.skipIf(!process.env.HSR_OPENING_COMPARE)(
	"compares opening orders proposed for the first Phainon domain",
	() => {
		const file = process.env.HSR_FREESR_TEST_FILE;
		const seedFile = process.env.HSR_SEARCH_SEED;
		const output = process.env.HSR_DAMAGE_REPORT_DIR;
		if (!file || !seedFile || !output)
			throw new Error("需要配装、种子轴和输出路径");
		const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
		const seed = toNormalizedSavedData(
			JSON.parse(readFileSync(seedFile, "utf8")),
		);
		const results: {
			label: string;
			valid: boolean;
			score?: number;
			reason?: string;
			opening?: string[];
		}[] = [];
		for (const item of variants) {
			const candidate = structuredClone(seed);
			candidate.ultInterrupts = {};
			for (const cast of item.casts) {
				candidate.ultInterrupts[cast.after] ??= [];
				candidate.ultInterrupts[cast.after].push({
					casterId: cast.actor,
					timing: cast.timing,
				});
			}
			try {
				const result = searchPhainonAxis(raw, {
					seed: candidate,
					evaluateSeedOnly: true,
					lockedCasts: item.casts,
					budget: 20,
					restarts: 0,
				});
				const opening = result.best.rows
					.slice(
						0,
						result.best.rows.findIndex((row) =>
							row.description.includes("展开境界"),
						) + 1,
					)
					.map(
						(row) =>
							`${row.actionValue.toFixed(4)} ${row.actor} ${row.skill.trim()} 火种${row.seeds}/毁伤${row.ruin}`,
					);
				results.push({
					label: item.label,
					valid: true,
					score: result.best.score,
					opening,
				});
			} catch (error) {
				results.push({
					label: item.label,
					valid: false,
					reason: [
						error instanceof Error ? error.message : String(error),
						...diagnose(candidate).slice(0, 3),
					].join("；"),
				});
			}
		}
		mkdirSync(output, { recursive: true });
		writeFileSync(
			join(output, "opening-comparison.json"),
			JSON.stringify(results, null, 2),
		);
		writeFileSync(
			join(output, "opening-comparison.md"),
			[
				"# 首次开大前开场顺序对照",
				"",
				"| 方案 | 校验 | 300行动值期望伤害 |",
				"|---|---|---:|",
				...results.map(
					(result) =>
						`| ${result.label} | ${result.valid ? "是" : `否：${result.reason}`} | ${result.score?.toFixed(2) ?? "—"} |`,
				),
				"",
				...results.flatMap((result) =>
					result.opening
						? [
								`## ${result.label}`,
								"",
								...result.opening.map((line) => `- ${line}`),
								"",
							]
						: [],
				),
			].join("\n"),
		);
		expect(results.length).toBe(variants.length);
	},
	180000,
);
