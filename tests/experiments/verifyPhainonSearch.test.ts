import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { calculatePhainonTrial } from "../../src/damage/phainonTrial";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";
import { simulateActions } from "../../src/simulate/actions";
import { getDisplayOrderedActions } from "../../src/utils/actionDisplayOrder";

it.skipIf(!process.env.HSR_SEARCH_VERIFY)(
	"independently replays the saved optimized axis with full resource checks",
	() => {
		const path = process.env.HSR_SEARCH_VERIFY;
		if (!path) throw new Error("需要已保存的行动轴");
		const saved = toNormalizedSavedData(JSON.parse(readFileSync(path, "utf8")));
		if (!saved.phainonDamageTrial) throw new Error("缺少伤害设置");
		const actions = getDisplayOrderedActions(
			simulateActions({
				...saved,
				limit: 300,
				legacyUltOverrides: saved.ultOverrides,
			}),
			saved.sameAVOrder,
		);
		const result = calculatePhainonTrial({
			characters: saved.characters,
			actions,
			config: saved.phainonDamageTrial,
			skillTargets: saved.skillTargets,
			defaultSkillTargets: saved.defaultSkillTargets,
		});
		expect(result.warnings).toEqual([]);
		expect(result.rows.flatMap((row) => row.warnings)).toEqual([]);
		const reference = JSON.parse(
			readFileSync(join(dirname(path), "search-results.json"), "utf8"),
		) as { best: { score: number } };
		expect(result.rows[result.rows.length - 1].cumulative).toBeCloseTo(
			reference.best.score,
			6,
		);
	},
);
