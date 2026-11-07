import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { searchPhainonAxis } from "../../src/damage/optimizer";
import { calculatePhainonTrial } from "../../src/damage/phainonTrial";
import type { NormalizedSavedData } from "../../src/pages/action-sequence/savedData";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";
import { simulateActions } from "../../src/simulate/actions";
import type { GeneratedAction } from "../../src/utils/action-sequence/types";
import { getDisplayOrderedActions } from "../../src/utils/actionDisplayOrder";

const BRONYA = "freesr-1101";
const SPARKLE = "freesr-1306";
const ROBIN = "freesr-1309";
const PHAINON = "freesr-1408";

type Cast = { actor: string; anchor: string; timing: "before" | "after" };
type Variant = { label: string; casts: Cast[] };

const at = (
	actor: string,
	index: number,
	timing: "before" | "after",
): Cast => ({
	actor,
	anchor: `${PHAINON}-${index}`,
	timing,
});

/** 原轴插入：花Q在花E后、鸭Q在鸭E后、鸟Q紧随鸭Q、白厄两次开大在第三/第八次E后。 */
const reference: Cast[] = [
	{ actor: BRONYA, anchor: `${BRONYA}-1`, timing: "after" },
	{ actor: BRONYA, anchor: `${BRONYA}-4`, timing: "after" },
	{ actor: SPARKLE, anchor: `${SPARKLE}-1`, timing: "after" },
	{ actor: SPARKLE, anchor: "damage-trial-enemy-5", timing: "after" },
	{ actor: ROBIN, anchor: `${BRONYA}-1`, timing: "after" },
	{ actor: PHAINON, anchor: `${PHAINON}-3`, timing: "after" },
	{ actor: PHAINON, anchor: `${PHAINON}-8`, timing: "after" },
];

const bronyaCasts = (first: Cast): Cast[] => [
	first,
	{ actor: BRONYA, anchor: `${BRONYA}-4`, timing: "after" },
];
const sparkleCasts = (first: Cast): Cast[] => [
	first,
	{ actor: SPARKLE, anchor: "damage-trial-enemy-5", timing: "after" },
];

/** 同时替换若干角色的插入位置。 */
const assignCasts = (
	label: string,
	updates: Record<string, Cast[]>,
): Variant => ({
	label,
	casts: [
		...reference.filter((cast) => !(cast.actor in updates)),
		...Object.values(updates).flat(),
	],
});

const variants: Variant[] = [
	{ label: "原轴", casts: reference },
	assignCasts("仅花火Q移到白厄第2次E前", {
		[SPARKLE]: sparkleCasts(at(SPARKLE, 2, "before")),
	}),
	assignCasts("仅鸭Q移到白厄第2次E前", {
		[BRONYA]: bronyaCasts(at(BRONYA, 2, "before")),
	}),
	assignCasts("鸭Q+花火Q都在白厄第2次E前（用户实战）", {
		[BRONYA]: bronyaCasts(at(BRONYA, 2, "before")),
		[SPARKLE]: sparkleCasts(at(SPARKLE, 2, "before")),
	}),
	assignCasts("鸭Q+花火Q都在白厄第2次E前，且鸟Q跟进", {
		[BRONYA]: bronyaCasts(at(BRONYA, 2, "before")),
		[SPARKLE]: sparkleCasts(at(SPARKLE, 2, "before")),
		[ROBIN]: [at(ROBIN, 2, "before")],
	}),
	assignCasts("鸭Q+花火Q都在白厄第1次E前", {
		[BRONYA]: bronyaCasts(at(BRONYA, 1, "before")),
		[SPARKLE]: sparkleCasts(at(SPARKLE, 1, "before")),
	}),
	assignCasts("鸭Q+花火Q都在白厄第3次E前", {
		[BRONYA]: bronyaCasts(at(BRONYA, 3, "before")),
		[SPARKLE]: sparkleCasts(at(SPARKLE, 3, "before")),
	}),
];

/** 只有真正生成了该锚点、该时序、该施法者的行动，才算这次插入被执行。 */
function findCast(actions: GeneratedAction[], cast: Cast) {
	return actions.find(
		(action) =>
			action.characterId === cast.actor &&
			action.skill === "Q" &&
			!action.isDomainAction &&
			action.key.startsWith(`${cast.anchor}-interrupt-`) &&
			action.interruptTiming === cast.timing,
	);
}

/** 直接回放给定轴，收集被优化器吞掉的资源/能量警告。 */
function diagnose(saved: NormalizedSavedData) {
	const config = saved.phainonDamageTrial;
	if (!config) return ["缺少伤害设置"];
	const replay = {
		...saved,
		overrides: {},
	};
	const actions = getDisplayOrderedActions(
		simulateActions({
			...replay,
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
	// 同一条警告常重复多次，只保留首次出现。
	return [...new Set(reasons)];
}

it.skipIf(!process.env.HSR_SUPPORT_TIMING_COMPARE)(
	"compares support ultimates inserted inside Phainon's own turn",
	() => {
		const file = process.env.HSR_FREESR_TEST_FILE,
			seedFile = process.env.HSR_SEARCH_SEED,
			output = process.env.HSR_DAMAGE_REPORT_DIR;
		if (!file || !seedFile || !output)
			throw new Error("需要配装、种子轴和输出路径");
		const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
		const seed = toNormalizedSavedData(
			JSON.parse(readFileSync(seedFile, "utf8")),
		);
		const results: {
			label: string;
			valid: boolean;
			executed: boolean;
			score?: number;
			reason?: string;
			missing?: string[];
			casts?: Cast[];
			openings?: number[];
			attacks?: {
				actionValue: number;
				skill: string;
				expected: number;
				attack: number;
				critDamage: number;
				damageBonus: number;
				seeds: number;
				ruin: number;
				skillPoints: number;
				buffs: string[];
			}[];
			saved?: unknown;
			rows?: unknown;
		}[] = [];
		for (const variant of variants) {
			const candidate = structuredClone(seed);
			candidate.ultInterrupts = {};
			for (const cast of variant.casts) {
				candidate.ultInterrupts[cast.anchor] ??= [];
				candidate.ultInterrupts[cast.anchor].push({
					casterId: cast.actor,
					timing: cast.timing,
				});
			}
			try {
				const result = searchPhainonAxis(raw, {
					seed: candidate,
					evaluateSeedOnly: true,
					budget: 20,
					restarts: 0,
				});
				const actions = result.best.actions;
				const missing = variant.casts
					.filter((cast) => !findCast(actions, cast))
					.map((cast) => `${cast.actor}@${cast.anchor}(${cast.timing})`);
				results.push({
					label: variant.label,
					valid: true,
					executed: missing.length === 0,
					score: result.best.score,
					missing,
					casts: variant.casts,
					openings: result.best.rows
						.filter((row) => row.description.includes("展开境界"))
						.map((row) => row.actionValue),
					attacks: result.best.rows
						.filter(
							(row) =>
								row.actor === "白厄" &&
								row.multipliers.some((multiplier) => multiplier > 0),
						)
						.map((row) => ({
							actionValue: row.actionValue,
							skill: row.skill,
							expected: row.expected,
							attack: row.attack,
							critDamage: row.critDamage,
							damageBonus: row.damageBonus,
							seeds: row.seeds,
							ruin: row.ruin,
							skillPoints: row.skillPoints,
							buffs: row.buffs,
						})),
					saved: result.best.saved,
					rows: result.best.rows,
				});
			} catch (error) {
				const reasons = diagnose(candidate);
				results.push({
					label: variant.label,
					valid: false,
					executed: false,
					reason: [
						error instanceof Error ? error.message : String(error),
						...reasons.slice(0, 4),
					].join("；"),
					casts: variant.casts,
				});
			}
		}
		mkdirSync(output, { recursive: true });
		writeFileSync(
			join(output, "support-ultimate-comparison.json"),
			JSON.stringify(results, null, 2),
		);
		const lines = [
			"# 辅助Q插入白厄自己回合的对照",
			"",
			"每个方案都保留原轴的其余插入与技能，只改动列出的Q位置；领域技能重新求解。",
			"「Q实际执行」为否时，该行分数只代表删掉这些Q之后的另一条轴，不能当作该操作本身的收益。",
			"",
			"| 方案 | 校验 | Q实际执行 | 300行动值期望伤害 | 白厄开Q行动值 | 未执行的插入 |",
			"|---|---|---|---:|---|---|",
			...results.map(
				(result) =>
					`| ${result.label} | ${result.valid ? "是" : "否"} | ${result.executed ? "是" : "否"} | ${result.score?.toFixed(2) ?? "—"} | ${result.openings?.map((value) => value.toFixed(4)).join(" / ") ?? result.reason} | ${result.missing?.join("、") || "—"} |`,
			),
			"",
		];
		writeFileSync(
			join(output, "support-ultimate-comparison.md"),
			lines.join("\n"),
		);
		expect(results.length).toBe(variants.length);
	},
	180000,
);
